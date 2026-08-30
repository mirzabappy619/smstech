-- ============================================================================
-- INVENTORY INTEGRITY & POS CORRECTNESS (017)
-- ============================================================================
-- Adds the columns/tables the admin panel already queries but that were never
-- created, plus atomic stock helpers so concurrent sales cannot lose updates.
--
-- Safe to re-run: every statement is guarded.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Inventory columns the admin UI reads (reorder thresholds, bin, last count)
-- ----------------------------------------------------------------------------
ALTER TABLE inventory
ADD COLUMN IF NOT EXISTS reorder_point INT DEFAULT 5,
ADD COLUMN IF NOT EXISTS reorder_quantity INT DEFAULT 20,
ADD COLUMN IF NOT EXISTS bin_location TEXT,
ADD COLUMN IF NOT EXISTS last_counted_at TIMESTAMPTZ;

-- One inventory row per (product, variation, warehouse) so upserts are safe.
-- NULL variation_id needs its own index; Postgres treats NULLs as distinct.
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_unique_variation
    ON inventory (product_id, variation_id, warehouse_id)
    WHERE variation_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_unique_product
    ON inventory (product_id, warehouse_id)
    WHERE variation_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_warehouse ON inventory (warehouse_id);

-- ----------------------------------------------------------------------------
-- 2. Stock movement audit trail
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_id UUID REFERENCES inventory(id) ON DELETE CASCADE,
    adjustment_type TEXT NOT NULL CHECK (adjustment_type IN (
        'purchase', 'sale', 'return', 'adjustment', 'damage', 'transfer_in', 'transfer_out'
    )),
    quantity_change INT NOT NULL,
    quantity_before INT NOT NULL,
    quantity_after INT NOT NULL,
    reason TEXT,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_logs_inventory ON inventory_logs (inventory_id);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_created ON inventory_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_type ON inventory_logs (adjustment_type);

-- ----------------------------------------------------------------------------
-- 3. Link POS sales back to the pre-booking they settle
-- ----------------------------------------------------------------------------
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS pre_booking_id UUID REFERENCES pre_bookings(id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- 4. Only one register shift may be open per branch at a time
-- ----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_pos_shifts_one_open_per_warehouse
    ON pos_shifts (warehouse_id)
    WHERE status = 'open';

-- ----------------------------------------------------------------------------
-- 5. Atomic stock movement
-- ----------------------------------------------------------------------------
-- Applies a signed delta to the inventory row for (product, variation, warehouse),
-- creating the row when it does not exist. Refuses to drop stock below zero.
-- Runs as a single statement per call, so concurrent sales cannot lose updates
-- the way a read-modify-write from application code does.
--
-- Returns the new on-hand quantity.
CREATE OR REPLACE FUNCTION apply_stock_movement(
    p_product_id     UUID,
    p_variation_id   UUID,
    p_warehouse_id   UUID,
    p_delta          INT,
    p_adjustment_type TEXT DEFAULT 'adjustment',
    p_reason         TEXT DEFAULT NULL,
    p_order_id       UUID DEFAULT NULL,
    p_user_id        UUID DEFAULT NULL,
    p_allow_negative BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (inventory_id UUID, quantity_before INT, quantity_after INT)
LANGUAGE plpgsql
AS $$
DECLARE
    v_row      inventory%ROWTYPE;
    v_before   INT;
    v_after    INT;
BEGIN
    IF p_warehouse_id IS NULL THEN
        RAISE EXCEPTION 'apply_stock_movement requires a warehouse_id';
    END IF;

    -- Lock the row for the duration of the transaction. FOR UPDATE serialises
    -- concurrent callers so the read-then-write below cannot interleave.
    SELECT * INTO v_row
    FROM inventory
    WHERE product_id = p_product_id
      AND warehouse_id = p_warehouse_id
      AND variation_id IS NOT DISTINCT FROM p_variation_id
    FOR UPDATE;

    IF NOT FOUND THEN
        IF p_delta < 0 AND NOT p_allow_negative THEN
            RAISE EXCEPTION 'INSUFFICIENT_STOCK: no inventory record for product % at warehouse %',
                p_product_id, p_warehouse_id;
        END IF;

        INSERT INTO inventory (product_id, variation_id, warehouse_id, quantity, reserved_quantity)
        VALUES (p_product_id, p_variation_id, p_warehouse_id, GREATEST(p_delta, 0), 0)
        RETURNING * INTO v_row;

        v_before := 0;
        v_after  := v_row.quantity;
    ELSE
        v_before := v_row.quantity;
        v_after  := v_before + p_delta;

        IF v_after < 0 AND NOT p_allow_negative THEN
            RAISE EXCEPTION 'INSUFFICIENT_STOCK: have %, need %', v_before, ABS(p_delta);
        END IF;

        -- Never let reservations exceed what is on hand.
        IF v_after < v_row.reserved_quantity AND NOT p_allow_negative THEN
            RAISE EXCEPTION 'INSUFFICIENT_STOCK: % on hand would fall below % reserved',
                v_after, v_row.reserved_quantity;
        END IF;

        UPDATE inventory
        SET quantity = v_after,
            updated_at = NOW()
        WHERE id = v_row.id;
    END IF;

    INSERT INTO inventory_logs (
        inventory_id, adjustment_type, quantity_change,
        quantity_before, quantity_after, reason, order_id, user_id
    )
    VALUES (
        v_row.id, p_adjustment_type, p_delta,
        v_before, v_after, p_reason, p_order_id, p_user_id
    );

    RETURN QUERY SELECT v_row.id, v_before, v_after;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5b. Warehouse fulfilment records + atomic reservation
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_fulfillments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'picked', 'packed', 'dispatched', 'delivered', 'failed', 'cancelled')),
    reservation_expires_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_fulfillments_warehouse ON order_fulfillments (warehouse_id);

-- Move units into (positive delta) or out of (negative delta) reserved_quantity
-- without letting reservations exceed what is physically on hand.
CREATE OR REPLACE FUNCTION reserve_stock(
    p_product_id   UUID,
    p_variation_id UUID,
    p_warehouse_id UUID,
    p_quantity     INT
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    v_row      inventory%ROWTYPE;
    v_reserved INT;
BEGIN
    SELECT * INTO v_row
    FROM inventory
    WHERE product_id = p_product_id
      AND warehouse_id = p_warehouse_id
      AND variation_id IS NOT DISTINCT FROM p_variation_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'INSUFFICIENT_STOCK: no inventory record for product % at warehouse %',
            p_product_id, p_warehouse_id;
    END IF;

    v_reserved := v_row.reserved_quantity + p_quantity;

    IF v_reserved < 0 THEN
        v_reserved := 0;
    END IF;

    IF v_reserved > v_row.quantity THEN
        RAISE EXCEPTION 'INSUFFICIENT_STOCK: cannot reserve %, only % on hand (% already reserved)',
            p_quantity, v_row.quantity, v_row.reserved_quantity;
    END IF;

    UPDATE inventory
    SET reserved_quantity = v_reserved,
        updated_at = NOW()
    WHERE id = v_row.id;

    RETURN v_reserved;
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. Atomic shift accumulator
-- ----------------------------------------------------------------------------
-- Adds to a shift's running payment totals in one statement, so two tills
-- settling at the same moment cannot clobber each other's figures.
CREATE OR REPLACE FUNCTION increment_shift_totals(
    p_shift_id       UUID,
    p_cash           NUMERIC DEFAULT 0,
    p_card           NUMERIC DEFAULT 0,
    p_mobile         NUMERIC DEFAULT 0,
    p_wallet         NUMERIC DEFAULT 0,
    p_dues_created   NUMERIC DEFAULT 0,
    p_dues_collected NUMERIC DEFAULT 0
)
RETURNS VOID
LANGUAGE sql
AS $$
    UPDATE pos_shifts
    SET cash_sales_total    = COALESCE(cash_sales_total, 0)    + p_cash,
        card_sales_total    = COALESCE(card_sales_total, 0)    + p_card,
        mobile_sales_total  = COALESCE(mobile_sales_total, 0)  + p_mobile,
        wallet_sales_total  = COALESCE(wallet_sales_total, 0)  + p_wallet,
        dues_created_total  = COALESCE(dues_created_total, 0)  + p_dues_created,
        dues_collected_total= COALESCE(dues_collected_total,0) + p_dues_collected
    WHERE id = p_shift_id;
$$;

-- ----------------------------------------------------------------------------
-- 7. Expected drawer cash — one definition, used by UI and close-shift alike
-- ----------------------------------------------------------------------------
-- opening float + cash sales + dues collected in cash
--   + cash_in - cash_out - drops moved to the safe
CREATE OR REPLACE FUNCTION shift_expected_cash(p_shift_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(s.opening_float, 0)
         + COALESCE(s.cash_sales_total, 0)
         + COALESCE(s.dues_collected_total, 0)
         + COALESCE((
             SELECT SUM(
                 CASE m.type
                     WHEN 'cash_in'          THEN m.amount
                     WHEN 'float_adjustment' THEN m.amount
                     WHEN 'cash_out'         THEN -m.amount
                     WHEN 'drop'             THEN -m.amount
                     ELSE 0
                 END
             )
             FROM pos_cash_movements m
             WHERE m.shift_id = s.id
         ), 0)
    FROM pos_shifts s
    WHERE s.id = p_shift_id;
$$;

-- ----------------------------------------------------------------------------
-- 8. Reporting aggregates that do not hit the PostgREST 1000-row ceiling
-- ----------------------------------------------------------------------------
-- Revenue counts only orders that represent money actually earned. Cancelled
-- and refunded orders are excluded.
CREATE OR REPLACE FUNCTION admin_order_totals(
    p_warehouse_id UUID DEFAULT NULL,
    p_from         TIMESTAMPTZ DEFAULT NULL,
    p_to           TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
    order_count   BIGINT,
    revenue       NUMERIC,
    cogs          NUMERIC,
    items_sold    BIGINT
)
LANGUAGE sql
STABLE
AS $$
    WITH earned AS (
        SELECT o.id, o.total
        FROM orders o
        WHERE o.status NOT IN ('cancelled', 'refunded')
          AND (p_warehouse_id IS NULL OR o.warehouse_id = p_warehouse_id)
          AND (p_from IS NULL OR o.created_at >= p_from)
          AND (p_to   IS NULL OR o.created_at <  p_to)
    )
    SELECT
        (SELECT COUNT(*) FROM earned),
        COALESCE((SELECT SUM(total) FROM earned), 0),
        -- Real cost of goods, from the serialized units actually sold.
        COALESCE((
            SELECT SUM(du.cost_price)
            FROM device_units du
            WHERE du.sold_order_id IN (SELECT id FROM earned)
        ), 0),
        COALESCE((
            SELECT SUM(oi.quantity)
            FROM order_items oi
            WHERE oi.order_id IN (SELECT id FROM earned)
        ), 0);
$$;

CREATE OR REPLACE FUNCTION admin_orders_by_status(
    p_warehouse_id UUID DEFAULT NULL,
    p_from         TIMESTAMPTZ DEFAULT NULL,
    p_to           TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (status TEXT, count BIGINT)
LANGUAGE sql
STABLE
AS $$
    SELECT o.status, COUNT(*)
    FROM orders o
    WHERE (p_warehouse_id IS NULL OR o.warehouse_id = p_warehouse_id)
      AND (p_from IS NULL OR o.created_at >= p_from)
      AND (p_to   IS NULL OR o.created_at <  p_to)
    GROUP BY o.status;
$$;

-- Revenue per calendar day, so the analytics chart does not have to pull every
-- order row into the API to bucket them.
CREATE OR REPLACE FUNCTION admin_daily_revenue(
    p_from TIMESTAMPTZ,
    p_to   TIMESTAMPTZ
)
RETURNS TABLE (day DATE, revenue NUMERIC, orders BIGINT)
LANGUAGE sql
STABLE
AS $$
    SELECT
        (o.created_at AT TIME ZONE 'Asia/Dhaka')::date AS day,
        COALESCE(SUM(o.total) FILTER (
            WHERE o.status NOT IN ('cancelled', 'refunded')
        ), 0) AS revenue,
        COUNT(*) AS orders
    FROM orders o
    WHERE o.created_at >= p_from
      AND o.created_at <  p_to
    GROUP BY 1
    ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION admin_customer_balances()
RETURNS TABLE (
    customer_count      BIGINT,
    dues_receivable     NUMERIC,
    advance_liabilities NUMERIC
)
LANGUAGE sql
STABLE
AS $$
    SELECT COUNT(*),
           COALESCE(SUM(outstanding_due), 0),
           COALESCE(SUM(advance_balance), 0)
    FROM customers;
$$;

CREATE OR REPLACE FUNCTION admin_prebooking_stats()
RETURNS TABLE (total BIGINT, converted BIGINT)
LANGUAGE sql
STABLE
AS $$
    SELECT COUNT(*),
           COUNT(*) FILTER (WHERE status IN ('allocated', 'ready_for_pickup', 'fulfilled'))
    FROM pre_bookings;
$$;

CREATE OR REPLACE FUNCTION admin_supplier_balances()
RETURNS TABLE (payables NUMERIC)
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(SUM(
        CASE WHEN entry_type = 'credit' THEN amount ELSE -amount END
    ), 0)
    FROM party_ledgers
    WHERE party_type = 'supplier';
$$;

-- ----------------------------------------------------------------------------
-- 9. Grants
-- ----------------------------------------------------------------------------
ALTER TABLE inventory_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_fulfillments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'inventory_logs' AND policyname = 'Service role manages inventory_logs'
    ) THEN
        CREATE POLICY "Service role manages inventory_logs" ON inventory_logs
            FOR ALL USING (auth.role() = 'service_role');
    END IF;
END $$;

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

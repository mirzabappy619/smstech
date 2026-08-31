-- ============================================================================
-- COMBINED MIGRATION — run this once in the Supabase SQL editor
-- ============================================================================
-- Contains migrations 017, 018, 019, 020 and 021.
--
-- Verified with scripts/test-migrations.mjs (62 assertions) against a real
-- Postgres seeded to migration 016 — which is exactly where this project's
-- database currently sits — including a clean second run, so re-applying is
-- safe. Additive except for three deliberately dropped policies (see 021).
--
-- WHAT IT FIXES
--
-- Missing tables (13) — every screen below queries a table that was never
-- created and errors at runtime:
--   /admin/coupons            /admin/sliders          /admin/google-analytics
--   /admin/landing-pages      /admin/inventory        storefront cart
--   storefront wishlist       account addresses       checkout delivery zones
--
-- Missing columns:
--   inventory   reorder_point, reorder_quantity, bin_location, last_counted_at
--   orders      pre_booking_id, shipping/billing address, currency, tax_amount,
--               coupon_code, customer_notes, internal_notes, source, fbc, fbp,
--               tracking_number and the eight courier_* columns
--   warehouses  type, split address, phone, email, latitude, longitude
--
-- Security (021):
--   Removes "Public read orders", which exposed every customer's name, phone,
--   email, address and order total to anyone holding the public anon key, plus
--   the matching public INSERT policies. Replaces them with owner-scoped rules
--   and adds the missing policies that were silently emptying the account
--   pages and the storefront's store settings.
--
-- Supabase dashboard -> SQL Editor -> New query -> paste -> Run.
-- ============================================================================

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

-- ============================================================================
-- STOREFRONT & REMAINING ADMIN TABLES (018)
-- ============================================================================
-- Eleven tables the application queries that were never created. Column names
-- and types are taken from the queries and Zod schemas already in the code, so
-- existing routes work against them unchanged.
--
-- Affected features:
--   carts / cart_items          shopping cart (guest + signed-in)
--   wishlists                   saved products
--   addresses                   customer address book
--   coupons                     discount codes (/admin/coupons)
--   hero_sliders                homepage carousel (/admin/sliders)
--   google_analytics_settings   GA config (/admin/google-analytics)
--   landing_page_blocks         landing page builder
--   order_notes                 internal order notes
--   order_tracking_events       courier tracking history
--   delivery_zones              shipping rates by postal code
--
-- Safe to re-run: every statement is guarded.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Cart
-- ----------------------------------------------------------------------------
-- A cart belongs either to a signed-in user or to a guest session, never both.
CREATE TABLE IF NOT EXISTS carts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT carts_owner_present CHECK (user_id IS NOT NULL OR session_id IS NOT NULL)
);

-- The cart routes do .eq(user_id).single() and .eq(session_id).single(), so
-- each owner must have at most one cart or those calls raise PGRST116.
CREATE UNIQUE INDEX IF NOT EXISTS idx_carts_user ON carts (user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_carts_session ON carts (session_id) WHERE session_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS cart_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variation_id UUID REFERENCES product_variations(id) ON DELETE SET NULL,
    quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON cart_items (cart_id);

-- One row per product/variation in a cart; the add-to-cart route looks for an
-- existing line and bumps its quantity rather than inserting a duplicate.
CREATE UNIQUE INDEX IF NOT EXISTS idx_cart_items_unique_variation
    ON cart_items (cart_id, product_id, variation_id)
    WHERE variation_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cart_items_unique_product
    ON cart_items (cart_id, product_id)
    WHERE variation_id IS NULL;

-- ----------------------------------------------------------------------------
-- 2. Wishlist
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wishlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_wishlists_user ON wishlists (user_id);

-- ----------------------------------------------------------------------------
-- 3. Address book
-- ----------------------------------------------------------------------------
-- Columns match the Zod schema in api/v1/users/me/addresses.
CREATE TABLE IF NOT EXISTS addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label TEXT,
    street TEXT NOT NULL,
    apartment TEXT,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    postal_code TEXT NOT NULL,
    country TEXT NOT NULL DEFAULT 'Bangladesh',
    phone TEXT,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses (user_id);

-- At most one default address per user. The routes clear the old default
-- before setting a new one; this makes that invariant enforced rather than
-- merely intended.
CREATE UNIQUE INDEX IF NOT EXISTS idx_addresses_one_default
    ON addresses (user_id)
    WHERE is_default;

-- ----------------------------------------------------------------------------
-- 4. Coupons
-- ----------------------------------------------------------------------------
-- The admin route maps its API field names onto these columns
-- (discount_type -> type, usage_limit -> max_uses, and so on).
CREATE TABLE IF NOT EXISTS coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed', 'free_shipping')),
    value DECIMAL(10,2) NOT NULL DEFAULT 0.00 CHECK (value >= 0),
    min_order_amount DECIMAL(10,2),
    max_discount_amount DECIMAL(10,2),
    max_uses INT CHECK (max_uses IS NULL OR max_uses > 0),
    uses_count INT NOT NULL DEFAULT 0,
    starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- A window that closes before it opens can never be valid.
    CONSTRAINT coupons_valid_window CHECK (expires_at IS NULL OR expires_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons (is_active, starts_at, expires_at);

-- ----------------------------------------------------------------------------
-- 5. Homepage sliders
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hero_sliders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    subtitle TEXT,
    badge TEXT DEFAULT 'FEATURED',
    image_url TEXT NOT NULL,
    link_url TEXT DEFAULT '/laptops',
    button_text TEXT DEFAULT 'Shop Now',
    sort_order INT DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hero_sliders_order ON hero_sliders (is_active, sort_order);

-- ----------------------------------------------------------------------------
-- 6. Google Analytics settings
-- ----------------------------------------------------------------------------
-- Read with .single(), so this is a single-row settings table.
CREATE TABLE IF NOT EXISTS google_analytics_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    measurement_id TEXT DEFAULT '',
    enabled BOOLEAN DEFAULT false,
    enabled_events JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 7. Landing page builder blocks
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS landing_page_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    landing_page_id UUID NOT NULL REFERENCES landing_pages(id) ON DELETE CASCADE,
    block_type TEXT NOT NULL,
    block_data JSONB DEFAULT '{}'::jsonb,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_landing_page_blocks_page
    ON landing_page_blocks (landing_page_id, sort_order);

-- ----------------------------------------------------------------------------
-- 8. Order notes
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    note TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_notes_order ON order_notes (order_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 9. Courier tracking history
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_tracking_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    provider TEXT,
    status TEXT NOT NULL,
    status_detail TEXT,
    location TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_tracking_order
    ON order_tracking_events (order_id, timestamp DESC);

-- ----------------------------------------------------------------------------
-- 10. Delivery zones
-- ----------------------------------------------------------------------------
-- Matched with .contains('postal_codes', [code]), so postal_codes is an array.
CREATE TABLE IF NOT EXISTS delivery_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    postal_codes TEXT[] DEFAULT ARRAY[]::TEXT[],
    shipping_rate DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    min_order_for_free DECIMAL(10,2),
    estimated_days INT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_zones_codes
    ON delivery_zones USING GIN (postal_codes);

-- Default Bangladesh zones so checkout has rates to work with.
INSERT INTO delivery_zones (name, postal_codes, shipping_rate, min_order_for_free, estimated_days, is_active)
SELECT 'Inside Dhaka', ARRAY['1000','1100','1200','1205','1206','1207','1208','1209','1212','1213','1214','1215','1216','1217','1219','1229','1230'], 60.00, 5000.00, 1, true
WHERE NOT EXISTS (SELECT 1 FROM delivery_zones WHERE name = 'Inside Dhaka');

INSERT INTO delivery_zones (name, postal_codes, shipping_rate, min_order_for_free, estimated_days, is_active)
SELECT 'Outside Dhaka', ARRAY['4000','4100','6000','6100','8000','9000','2200','3100','5800','7400'], 120.00, 10000.00, 3, true
WHERE NOT EXISTS (SELECT 1 FROM delivery_zones WHERE name = 'Outside Dhaka');

-- ----------------------------------------------------------------------------
-- 11. Row level security
-- ----------------------------------------------------------------------------
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE hero_sliders ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_analytics_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE landing_page_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_tracking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;

-- Storefront reads these anonymously; writes all go through API routes running
-- under the service role, which bypasses RLS.
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'hero_sliders',
        'google_analytics_settings',
        'landing_page_blocks',
        'delivery_zones'
    ] LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = t AND policyname = 'Public read ' || t
        ) THEN
            EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING (true)', 'Public read ' || t, t);
        END IF;
    END LOOP;
END $$;

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- ============================================================================
-- WAREHOUSE CONTACT & ADDRESS FIELDS (019)
-- ============================================================================
-- /admin/inventory/warehouse and POST /api/v1/admin/warehouses accept a type,
-- a split address, contact details and coordinates. The warehouses table only
-- had (name, code, address, is_active, is_default), so every create/update that
-- filled those fields was rejected by PostgREST as unknown columns.
--
-- The route previously wrote to a table called "locations" that no migration
-- ever created; it now targets warehouses, and these are the columns it needs.
--
-- Safe to re-run: every statement is guarded.
-- ============================================================================

ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'warehouse';
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS address_street TEXT;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS address_city TEXT;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS address_state TEXT;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS address_postal_code TEXT;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS address_country TEXT DEFAULT 'Bangladesh';
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7);
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7);

-- Matches the z.enum() in POST /api/v1/admin/warehouses.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'warehouses_type_check'
    ) THEN
        ALTER TABLE warehouses ADD CONSTRAINT warehouses_type_check
            CHECK (type IN ('warehouse', 'store', 'fulfillment_center'));
    END IF;
END $$;

-- The create/update handlers unset every other default before setting one, so
-- at most one row can be the default. Enforce that in the database too.
CREATE UNIQUE INDEX IF NOT EXISTS idx_warehouses_single_default
    ON warehouses (is_default) WHERE is_default;

-- The legacy "address" column is superseded by the split fields above. Keep it
-- (data may exist) but seed the new street column from it where it is unset.
UPDATE warehouses SET address_street = address
WHERE address_street IS NULL AND address IS NOT NULL;

-- ============================================================================
-- STOREFRONT ORDER & COURIER COLUMNS (020)
-- ============================================================================
-- The orders table was created for in-store POS sales. The storefront checkout
-- and the courier integration both write a wider record than it can hold, so
-- every web order insert was rejected and every courier screen errored out.
--
-- Affected features:
--   POST /api/v1/orders          web checkout (inserted 10 unknown columns)
--   /admin/courier               Pathao / Steadfast dispatch and sync
--   /admin/orders/[id]           tracking number, internal notes, addresses
--   webhooks/pathao, /steadfast  delivery status callbacks
--   capi-purchase edge function  fbc / fbp match-quality signals
--
-- Additive only: no drops, no data changes.
-- Safe to re-run: every statement is guarded.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Web checkout fields
-- ----------------------------------------------------------------------------
-- Addresses are stored as JSONB because checkout accepts a free-form address
-- object (name, lines, city, state, postcode, country, phone, email).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address JSONB;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing_address JSONB;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'BDT';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_notes TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS internal_notes TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'web';

-- ----------------------------------------------------------------------------
-- 2. Meta Conversions API match quality
-- ----------------------------------------------------------------------------
-- Captured at checkout and read by the capi-purchase edge function so browser
-- and server events deduplicate against the same user_data.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fbc TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS fbp TEXT;

-- ----------------------------------------------------------------------------
-- 3. Courier dispatch and tracking
-- ----------------------------------------------------------------------------
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_provider TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_consignment_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_tracking_code TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_status TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_delivery_fee NUMERIC(12, 2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_data JSONB;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_sent_at TIMESTAMPTZ;

-- Only pathao and steadfast are implemented in src/infrastructure/courier.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'orders_courier_provider_check'
    ) THEN
        ALTER TABLE orders ADD CONSTRAINT orders_courier_provider_check
            CHECK (courier_provider IS NULL
                   OR courier_provider IN ('pathao', 'steadfast'));
    END IF;
END $$;

-- The courier dashboard filters on provider/status, and the webhooks look an
-- order up by its consignment id.
CREATE INDEX IF NOT EXISTS idx_orders_courier_provider
    ON orders (courier_provider) WHERE courier_provider IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_courier_status
    ON orders (courier_status) WHERE courier_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_courier_consignment
    ON orders (courier_consignment_id) WHERE courier_consignment_id IS NOT NULL;

-- Web orders are listed per shopper via customers.user_id -> orders.customer_id.
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders (customer_id);

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES (021)
-- ============================================================================
-- Two problems this fixes.
--
-- 1. DATA LEAK. Migration 000 created:
--        CREATE POLICY "Public read orders" ON orders FOR SELECT USING (true);
--    With the anon key that exposes every order — customer name, phone, email,
--    delivery address and totals — to anyone on the internet. The matching
--    "Public insert" policies let anyone forge orders. All three are replaced
--    below with owner-scoped equivalents.
--
-- 2. LOCKED-OUT STOREFRONT. users, wishlists, addresses, carts, cart_items and
--    coupons have RLS enabled but no policy at all, so the signed-in session
--    client reads zero rows. That silently emptied the account pages and made
--    the login route fall back to role "customer" for admins.
--
-- Admin API routes run under the service role, which bypasses RLS entirely, so
-- none of the admin panel is affected by anything here.
--
-- Safe to re-run: every statement is guarded.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Helper — the users.id behind the current auth session
-- ----------------------------------------------------------------------------
-- SECURITY DEFINER so the lookup itself is not subject to the users policy it
-- is used to define, which would recurse.
CREATE OR REPLACE FUNCTION current_profile_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id FROM users WHERE auth_id = auth.uid()
$$;

GRANT EXECUTE ON FUNCTION current_profile_id() TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 1. Orders — replace the blanket public policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public read orders" ON orders;
DROP POLICY IF EXISTS "Public insert orders" ON orders;
DROP POLICY IF EXISTS "Public insert order_items" ON order_items;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE tablename = 'orders' AND policyname = 'Own orders read') THEN
        CREATE POLICY "Own orders read" ON orders FOR SELECT
            USING (customer_id IN (
                SELECT id FROM customers WHERE user_id = current_profile_id()
            ));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE tablename = 'order_items' AND policyname = 'Own order items read') THEN
        CREATE POLICY "Own order items read" ON order_items FOR SELECT
            USING (order_id IN (
                SELECT o.id FROM orders o
                JOIN customers c ON c.id = o.customer_id
                WHERE c.user_id = current_profile_id()
            ));
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Profile row
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE tablename = 'users' AND policyname = 'Own profile read') THEN
        CREATE POLICY "Own profile read" ON users FOR SELECT
            USING (auth_id = auth.uid());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE tablename = 'users' AND policyname = 'Own profile update') THEN
        CREATE POLICY "Own profile update" ON users FOR UPDATE
            USING (auth_id = auth.uid())
            WITH CHECK (auth_id = auth.uid());
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. Customer record
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE tablename = 'customers' AND policyname = 'Own customer read') THEN
        CREATE POLICY "Own customer read" ON customers FOR SELECT
            USING (user_id = current_profile_id());
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. Wishlist and address book — full ownership
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['wishlists', 'addresses'] LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_policies
                       WHERE tablename = t AND policyname = 'Own ' || t) THEN
            EXECUTE format(
                'CREATE POLICY %I ON %I FOR ALL USING (user_id = current_profile_id()) WITH CHECK (user_id = current_profile_id())',
                'Own ' || t, t
            );
        END IF;
    END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 5. Carts
-- ----------------------------------------------------------------------------
-- Signed-in carts are owner-scoped here. Guest carts key off an opaque
-- session_id that RLS cannot verify, so those requests are served by the API
-- routes under the service role, which scope every query by that session id.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE tablename = 'carts' AND policyname = 'Own cart') THEN
        CREATE POLICY "Own cart" ON carts FOR ALL
            USING (user_id = current_profile_id())
            WITH CHECK (user_id = current_profile_id());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE tablename = 'cart_items' AND policyname = 'Own cart items') THEN
        CREATE POLICY "Own cart items" ON cart_items FOR ALL
            USING (cart_id IN (SELECT id FROM carts WHERE user_id = current_profile_id()))
            WITH CHECK (cart_id IN (SELECT id FROM carts WHERE user_id = current_profile_id()));
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 6. Coupons — the storefront validates a code the shopper typed
-- ----------------------------------------------------------------------------
-- Only active codes are readable; usage counts and limits are not secret, but
-- inactive/expired campaigns stay hidden.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE tablename = 'coupons' AND policyname = 'Public read active coupons') THEN
        CREATE POLICY "Public read active coupons" ON coupons FOR SELECT
            USING (is_active = true);
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 7. Storefront-visible configuration
-- ----------------------------------------------------------------------------
-- store_settings is key/value and holds only storefront configuration (name,
-- contact details, shipping rates, social links). Without a policy the
-- storefront silently fell back to hardcoded defaults, so nothing an admin
-- saved ever reached the site.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE tablename = 'store_settings' AND policyname = 'Public read store_settings') THEN
        CREATE POLICY "Public read store_settings" ON store_settings FOR SELECT
            USING (true);
    END IF;
END $$;


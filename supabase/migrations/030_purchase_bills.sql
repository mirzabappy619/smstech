-- ============================================================================
-- PURCHASE BILLS (030)
-- ============================================================================
-- Sales leave a document behind — an order, with its items, listable and
-- searchable. Purchases did not. A batch intake wrote device_units, a stock
-- movement and a ledger line, then forgot the transaction itself: there was no
-- record with a header saying who the goods came from, what the bill came to,
-- and what was paid. A purchase paid for in cash left no ledger line either,
-- so it was invisible from every direction.
--
-- That made a purchase history impossible to show without reconstructing it
-- from three places and still missing rows. These two tables are the buy-side
-- mirror of orders + order_items.
--
--   purchase_bills       one intake: party, branch, totals, settlement
--   purchase_bill_items  what was received on it
--
-- Safe to re-run: every statement is guarded.
-- ============================================================================

CREATE TABLE IF NOT EXISTS purchase_bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_number TEXT UNIQUE NOT NULL,

    -- Points into `suppliers` or `customers` depending on the type, the same
    -- way party_ledgers addresses a party. A walk-in has a name and no id.
    party_type TEXT NOT NULL CHECK (party_type IN ('supplier', 'customer', 'walk_in')),
    party_id UUID,
    party_name TEXT NOT NULL,

    warehouse_id UUID REFERENCES warehouses(id) ON DELETE RESTRICT,

    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    amount_paid DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    due_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    unit_count INT NOT NULL DEFAULT 0,

    -- Set when the goods arrived as a trade-in against a sale, so a
    -- part-exchange can be read from either side.
    exchange_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,

    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT purchase_bills_amounts_nonneg
        CHECK (subtotal >= 0 AND amount_paid >= 0 AND due_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_purchase_bills_created
    ON purchase_bills (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_bills_party
    ON purchase_bills (party_id) WHERE party_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchase_bills_warehouse
    ON purchase_bills (warehouse_id);
-- "What is still owed on purchases" is the buy-side counterpart of the due
-- list; most bills are settled, so a partial index stays small.
CREATE INDEX IF NOT EXISTS idx_purchase_bills_outstanding
    ON purchase_bills (due_amount) WHERE due_amount > 0;

CREATE TABLE IF NOT EXISTS purchase_bill_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID NOT NULL REFERENCES purchase_bills(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    variation_id UUID REFERENCES product_variations(id) ON DELETE SET NULL,
    -- Kept as text as well: a product renamed or deleted later must not
    -- rewrite what a historical bill says was bought.
    product_name TEXT NOT NULL,
    is_serialized BOOLEAN NOT NULL DEFAULT false,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    line_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_bill_items_bill
    ON purchase_bill_items (bill_id);

-- Ties the units received back to the bill they arrived on.
ALTER TABLE device_units ADD COLUMN IF NOT EXISTS purchase_bill_id UUID
    REFERENCES purchase_bills(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_device_units_purchase_bill
    ON device_units (purchase_bill_id) WHERE purchase_bill_id IS NOT NULL;

-- ─── RLS ────────────────────────────────────────────────────────────────────
-- Back-office only: every read and write goes through an admin API route
-- running requirePermission with the service role.

ALTER TABLE purchase_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_bill_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages purchase_bills" ON purchase_bills;
CREATE POLICY "Service role manages purchase_bills" ON purchase_bills
    FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages purchase_bill_items" ON purchase_bill_items;
CREATE POLICY "Service role manages purchase_bill_items" ON purchase_bill_items
    FOR ALL TO service_role USING (true) WITH CHECK (true);

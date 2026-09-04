-- ============================================================================
-- PARTIES: SUPPLIERS, WHOLESALE CUSTOMERS, CREDIT SALES (028)
-- ============================================================================
-- Two gaps this closes.
--
-- 1. Suppliers had no table. party_ledgers.party_id for a supplier was filled
--    with a UUID *derived from the supplier's name* (adHocSupplierId in the
--    procurement route), so a supplier could not be edited, renamed, listed, or
--    given contact details, and two spellings of one name were two parties.
--    They are real records now; the derived-id path stays only as the fallback
--    for a name typed straight into the intake form.
--
-- 2. The sell side had no way to mark a party as a wholesale/corporate account
--    rather than a walk-in, and credit sales through Batch Sell never touched
--    the customer's balance at all — the order carried payment_status='due'
--    and nothing was ever recorded as owed.
--
-- Safe to re-run: every statement is guarded.
-- ============================================================================

-- ─── 1. Suppliers (buy-side parties) ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    supplier_code TEXT UNIQUE,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    -- What we owe them is derived from party_ledgers, never stored here, so
    -- the ledger stays the single source of truth for the running payable.
    -- This is only the balance carried in when the supplier was registered.
    opening_balance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_active ON suppliers (is_active, name);

-- Two suppliers with the same name are almost always one supplier entered
-- twice; case- and space-insensitive so "Star Tech" and "star  tech" collide.
CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_unique_name
    ON suppliers (lower(regexp_replace(name, '\s+', ' ', 'g')));

-- ─── 2. Sell-side parties ───────────────────────────────────────────────────
-- A wholesale account is the same record as a retail customer — same balances,
-- same ledger — but the Batch Sell screen lists only wholesale parties and the
-- POS defaults to retail, so the two do not clutter each other's pickers.

ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_type TEXT NOT NULL DEFAULT 'retail';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS company_name TEXT;

DO $$
BEGIN
    ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_customer_type_check;
    ALTER TABLE customers ADD CONSTRAINT customers_customer_type_check
        CHECK (customer_type IN ('retail', 'wholesale'));
END $$;

CREATE INDEX IF NOT EXISTS idx_customers_type ON customers (customer_type, name);

-- Credit cannot be negative, and a party that owes nothing must not show a
-- negative due through a rounding slip.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'customers_credit_nonneg_check'
    ) THEN
        ALTER TABLE customers ADD CONSTRAINT customers_credit_nonneg_check
            CHECK (credit_limit >= 0 AND outstanding_due >= 0 AND advance_balance >= 0);
    END IF;
END $$;

-- ─── 3. Wholesale orders carry what was actually paid ───────────────────────
-- Batch Sell recorded the full value as the order total with no record of the
-- part settled at dispatch, so a partly-paid wholesale order was
-- indistinguishable from an unpaid one.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(12,2) NOT NULL DEFAULT 0.00;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS due_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00;

-- ─── 4. RLS ─────────────────────────────────────────────────────────────────
-- Suppliers are back-office only: every read and write goes through an admin
-- API route running requirePermission with the service role.

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages suppliers" ON suppliers;
CREATE POLICY "Service role manages suppliers" ON suppliers
    FOR ALL TO service_role USING (true) WITH CHECK (true);

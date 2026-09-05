-- ============================================================================
-- BUYING FROM AND EXCHANGING WITH ANY PARTY (029)
-- ============================================================================
-- Stock could only ever be bought from a supplier: the intake route credited a
-- supplier ledger and nothing else. A shop that deals in pre-owned hardware
-- buys most of its stock from the person standing at the counter, and takes
-- devices in part-exchange against a new sale — neither of which could be
-- recorded at all.
--
-- Two things this adds:
--
-- 1. Provenance on the unit. When a used device comes back for warranty, or is
--    resold, the first question is who it was bought from and for how much.
--    device_units.cost_price held the figure but nothing held the source.
--
-- 2. 'exchange' as an invoice type, so a part-exchange sale is distinguishable
--    from a straight one in reporting rather than masquerading as a discount.
--
-- Safe to re-run: every statement is guarded.
-- ============================================================================

-- ─── 1. Where a unit came from ──────────────────────────────────────────────

ALTER TABLE device_units ADD COLUMN IF NOT EXISTS acquired_from_type TEXT;
ALTER TABLE device_units ADD COLUMN IF NOT EXISTS acquired_from_party_id UUID;
ALTER TABLE device_units ADD COLUMN IF NOT EXISTS acquired_from_name TEXT;
-- The exchange the unit arrived against, when it was taken in part-payment.
ALTER TABLE device_units ADD COLUMN IF NOT EXISTS acquired_order_id UUID REFERENCES orders(id) ON DELETE SET NULL;
ALTER TABLE device_units ADD COLUMN IF NOT EXISTS acquisition_ref TEXT;

-- No FK on the party id: it points into `customers` or `suppliers` depending on
-- the type, the same way party_ledgers addresses a party.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'device_units_acquired_from_type_check'
    ) THEN
        ALTER TABLE device_units ADD CONSTRAINT device_units_acquired_from_type_check
            CHECK (acquired_from_type IS NULL
                OR acquired_from_type IN ('supplier', 'customer', 'walk_in'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_device_units_acquired_from
    ON device_units (acquired_from_party_id)
    WHERE acquired_from_party_id IS NOT NULL;

-- ─── 2. Part-exchange sales ─────────────────────────────────────────────────
-- The CHECK from 015 listed four invoice types; a part-exchange is a fifth.

DO $$
BEGIN
    ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_invoice_type_check;
    ALTER TABLE orders ADD CONSTRAINT orders_invoice_type_check
        CHECK (invoice_type IN ('storefront', 'pos', 'b2b_wholesale', 'pre_booking', 'exchange'));
END $$;

-- What the goods taken in part-payment were valued at. Kept beside the order
-- so the arithmetic on an exchange invoice can be reconstructed later:
-- total = goods out, trade_in_value = goods in, the customer settles the rest.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS trade_in_value DECIMAL(12,2) NOT NULL DEFAULT 0.00;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'orders_trade_in_value_nonneg_check'
    ) THEN
        ALTER TABLE orders ADD CONSTRAINT orders_trade_in_value_nonneg_check
            CHECK (trade_in_value >= 0);
    END IF;
END $$;

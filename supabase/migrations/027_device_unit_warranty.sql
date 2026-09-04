-- ============================================================================
-- SERIALIZED WARRANTY TRACKING (027)
-- ============================================================================
-- device_units already carried warranty_months and warranty_expires_at, but
-- nothing recorded when a warranty actually began: intake never captured a
-- term, and the POS wrote a hardcoded 365-day expiry that ignored the term on
-- the unit. A warranty on a serialized device starts when the customer takes
-- it home, not when it lands in the stockroom, so the clock needs its own
-- column — the sale timestamp alone cannot be trusted to stay in sync once
-- units are returned, re-stocked and re-sold.
--
--   warranty_starts_at  - NULL while the unit is on the shelf, set at sale
--
-- warranty_expires_at stays the derived field (starts_at + warranty_months),
-- so existing readers (track-order, the customer warranty lookup) keep working
-- unchanged.
--
-- Safe to re-run: every statement is guarded.
-- ============================================================================

ALTER TABLE device_units ADD COLUMN IF NOT EXISTS warranty_starts_at TIMESTAMPTZ;

-- A term of 0 means "no warranty offered on this unit" — valid for clearance
-- and as-is stock. Anything negative is a data-entry mistake.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'device_units_warranty_months_check'
    ) THEN
        ALTER TABLE device_units ADD CONSTRAINT device_units_warranty_months_check
            CHECK (warranty_months >= 0 AND warranty_months <= 120);
    END IF;
END $$;

-- Units sold before this migration had their warranty started implicitly by
-- the sale, so backfill from sold_at rather than leaving the column empty.
UPDATE device_units
   SET warranty_starts_at = sold_at
 WHERE warranty_starts_at IS NULL
   AND sold_at IS NOT NULL;

-- "Which warranties expire this month" drives the service desk; only sold
-- units have an expiry, so a partial index stays small.
CREATE INDEX IF NOT EXISTS idx_device_units_warranty_expiry
    ON device_units (warranty_expires_at) WHERE warranty_expires_at IS NOT NULL;

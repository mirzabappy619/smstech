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

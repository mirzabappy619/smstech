-- ============================================================================
-- PRODUCT ADMIN COLUMNS (026)
-- ============================================================================
-- The admin product form (/admin/products/new and /admin/products/[id]) writes
-- a set of columns that no migration ever created — the create/update routes
-- reference "migration 009/010", which does not exist in this repo (the chain
-- jumps 000 -> 014). PostgREST rejects the whole INSERT when it cannot find a
-- column in its schema cache, so *every* product creation failed with
-- PRODUCT_CREATE_FAILED, and product edits failed the same way.
--
-- products:
--   cost_price            - buy price, drives margin reporting
--   barcode              - scanned at the POS
--   weight               - courier weight, kg
--   is_digital           - no shipment required
--   requires_shipping    - derived from is_digital by the API on write
--   seo_keywords         - keyword list, split from the comma-separated field
--   metadata             - brand + trust badges shown on the product page
--   unit_system          - base unit / units per package / package name
--   attribute_definitions - attribute names and values variations are built from
--
-- product_variations:
--   is_auto_generated    - variation came from the attribute matrix, not by hand
--   images               - per-variation gallery
--
-- Safe to re-run: every statement is guarded.
-- ============================================================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10, 2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS weight DECIMAL(10, 3);
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_digital BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS requires_shipping BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE products ADD COLUMN IF NOT EXISTS seo_keywords TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE products ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Written on every create (the API applies the zod default), so a matching
-- column default keeps rows created outside the admin form consistent.
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit_system JSONB NOT NULL
    DEFAULT '{"baseUnit": "piece", "unitsPerPackage": 1, "packageName": "Individual"}'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS attribute_definitions JSONB NOT NULL
    DEFAULT '[]'::jsonb;

ALTER TABLE product_variations ADD COLUMN IF NOT EXISTS is_auto_generated BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE product_variations ADD COLUMN IF NOT EXISTS images JSONB NOT NULL DEFAULT '[]'::jsonb;

-- The POS looks a product up by scanned barcode; most rows have none, so a
-- partial index stays small. Not unique: the same code can appear on a
-- pre-owned unit and its brand-new equivalent.
CREATE INDEX IF NOT EXISTS idx_products_barcode
    ON products (barcode) WHERE barcode IS NOT NULL;

-- ============================================================================
-- POS AND SEARCH PERFORMANCE (031)
-- ============================================================================
-- The till's search, its customer type-ahead and its counter list were all
-- sequential scans.
--
-- Every text lookup on those paths is `ilike '%term%'`. A leading wildcard
-- cannot use a btree index, so `idx_device_units_serial` and friends were
-- never touched by the query that needed them most — each keystroke read the
-- whole table. Trigram (GIN) indexes are the ones that can serve a pattern
-- anchored at neither end.
--
-- The rest are ordinary btree indexes over column pairs the POS filters and
-- sorts on together, which the single-column indexes could only half serve.
--
-- Every statement is guarded, so this is safe to re-run.
--
-- NOTE: CREATE INDEX takes a brief write lock on the table. On a busy shop,
-- run this outside trading hours, or re-issue each statement with
-- CREATE INDEX CONCURRENTLY (which cannot run inside a transaction block).
-- ============================================================================

-- ─── Trigram indexes for the ilike '%…%' paths ──────────────────────────────
-- Guarded: pg_trgm ships with Supabase, but the migration test harness runs
-- against a stripped Postgres, and a missing extension should not break the
-- chain — it only means these lookups stay as scans there.
DO $$
DECLARE
    has_trgm BOOLEAN := FALSE;
BEGIN
    BEGIN
        CREATE EXTENSION IF NOT EXISTS pg_trgm;
        has_trgm := TRUE;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'pg_trgm unavailable — skipping trigram indexes (%).', SQLERRM;
    END;

    IF NOT has_trgm THEN
        RETURN;
    END IF;

    -- POS product search: /api/v1/admin/pos/search filters name, sku, brand.
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_products_name_trgm
        ON products USING gin (name gin_trgm_ops)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_products_sku_trgm
        ON products USING gin (sku gin_trgm_ops)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_products_brand_trgm
        ON products USING gin (brand gin_trgm_ops)';

    -- Serialized units: scanned barcodes and typed serials hit all four.
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_device_units_serial_trgm
        ON device_units USING gin (serial_number gin_trgm_ops)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_device_units_imei1_trgm
        ON device_units USING gin (imei_1 gin_trgm_ops)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_device_units_imei2_trgm
        ON device_units USING gin (imei_2 gin_trgm_ops)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_device_units_mac_trgm
        ON device_units USING gin (mac_address gin_trgm_ops)';

    -- Customer type-ahead at the counter, and the party pickers that share it.
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_customers_name_trgm
        ON customers USING gin (name gin_trgm_ops)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_customers_phone_trgm
        ON customers USING gin (phone gin_trgm_ops)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_customers_code_trgm
        ON customers USING gin (customer_code gin_trgm_ops)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_customers_company_trgm
        ON customers USING gin (company_name gin_trgm_ops)';

    -- Supplier picker on the procurement screens.
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_suppliers_name_trgm
        ON suppliers USING gin (name gin_trgm_ops)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_suppliers_phone_trgm
        ON suppliers USING gin (phone gin_trgm_ops)';
END $$;

-- ─── Exact-match lookups on hot paths ───────────────────────────────────────
-- POS checkout resolves a walk-in by phone before every sale, and the
-- register-from-the-till shortcut checks the same column for a duplicate.
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers (phone);

-- ─── Stock reads are always scoped to one branch ────────────────────────────
-- idx_inventory_warehouse covers the branch alone; every POS read also filters
-- by product, and the pair lets the planner go straight to the rows.
CREATE INDEX IF NOT EXISTS idx_inventory_warehouse_product
    ON inventory (warehouse_id, product_id);

-- The counter's browse grid asks for what this branch is holding, biggest
-- first. Partial, because rows at zero are exactly the ones it skips.
CREATE INDEX IF NOT EXISTS idx_inventory_warehouse_available
    ON inventory (warehouse_id, available_quantity DESC)
    WHERE available_quantity > 0;

-- Variations are fetched per product for the POS picker and the product pages.
CREATE INDEX IF NOT EXISTS idx_product_variations_product_active
    ON product_variations (product_id)
    WHERE is_active;

-- ─── "Last sold" and "most sold" at the counter ─────────────────────────────
-- order_items had indexes on order_id and product_id but none on created_at,
-- so both rows sorted the whole table.
CREATE INDEX IF NOT EXISTS idx_order_items_created_at
    ON order_items (created_at DESC);

-- Those two rows join back to orders to scope by branch; the sales register
-- and the branch dashboards filter the same pair.
CREATE INDEX IF NOT EXISTS idx_orders_warehouse_created
    ON orders (warehouse_id, created_at DESC);

-- ============================================================================
-- After applying, refresh the planner's statistics so it starts using them:
--     ANALYZE products, device_units, customers, inventory, order_items, orders;
-- ============================================================================

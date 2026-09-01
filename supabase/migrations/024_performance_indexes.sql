-- ============================================================================
-- INDEXES FOR HOT QUERY PATHS (024)
-- ============================================================================
-- Several columns the application filters and joins on every request had no
-- index, so those queries were sequential scans that get slower as the shop
-- grows. Each index below backs a query that actually exists in the codebase.
--
-- Safe to re-run: every statement is guarded.
-- ============================================================================

-- Orders hang off customers, not users. Every "my orders" view and the admin
-- customer list resolve customer ids then filter orders by them. customers.id
-- is already indexed as the primary key; customers.user_id is the lookup.
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers (user_id);

-- Order lists sort by recency and filter by status
-- (/api/v1/admin/orders, the dashboard status breakdown).
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status_created
    ON orders (status, created_at DESC);

-- Every storefront category page and the categories product_count roll-up
-- filter products by category, almost always alongside is_active.
CREATE INDEX IF NOT EXISTS idx_products_category_active
    ON products (category_id, is_active);

-- The storefront home and listing pages filter on these flags directly.
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products (is_active) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_products_is_featured ON products (is_featured) WHERE is_featured;

-- order_items is read for every order detail view and every invoice.
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items (product_id);

-- The POS terminal reads the open shift for a branch on load and after every
-- sale; cash movements are summed for the drawer figure each time.
CREATE INDEX IF NOT EXISTS idx_pos_shifts_warehouse_status
    ON pos_shifts (warehouse_id, status);
CREATE INDEX IF NOT EXISTS idx_pos_cash_movements_shift
    ON pos_cash_movements (shift_id);

-- Branch transfer lists filter by either end of the move.
CREATE INDEX IF NOT EXISTS idx_branch_transfers_source
    ON branch_transfers (source_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_branch_transfers_target
    ON branch_transfers (target_warehouse_id);

-- The pre-booking queue is ordered by priority within a product, and the
-- allocator walks queued rows in that order.
CREATE INDEX IF NOT EXISTS idx_pre_bookings_product_queue
    ON pre_bookings (product_id, status, queue_priority);

-- Serialized stock is looked up by branch and status on the POS search path.
CREATE INDEX IF NOT EXISTS idx_device_units_warehouse_status
    ON device_units (warehouse_id, status);

-- Staff branch resolution runs on every authenticated admin request.
CREATE INDEX IF NOT EXISTS idx_user_branches_user ON user_branches (user_id);

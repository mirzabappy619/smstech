-- ============================================================================
-- PRODUCT-LEVEL PRE-ORDER MODE (022)
-- ============================================================================
-- The pre-booking engine (pre_bookings + /admin/pre-bookings) already handles
-- deposits, queue priority and serial allocation, but nothing marked a product
-- as pre-order: the storefront showed "Pre-Book with Deposit" on every product
-- alongside Add to Cart, and the deposit was hardcoded at 10% in the page.
--
-- These columns make pre-order an explicit per-product setting:
--   is_preorder            - hides Add to Cart / Buy Now, pre-booking only
--   preorder_release_date  - optional expected availability date (display only)
--   preorder_deposit_pct   - deposit required to join the queue, default 10%
--
-- Safe to re-run: every statement is guarded.
-- ============================================================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS is_preorder BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS preorder_release_date DATE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS preorder_deposit_pct NUMERIC(5, 2) NOT NULL DEFAULT 10;

-- Deposit is a percentage of the line price; 0 would let anyone hold a queue
-- slot for free, so require a real deposit up to full prepayment.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'products_preorder_deposit_pct_check'
    ) THEN
        ALTER TABLE products ADD CONSTRAINT products_preorder_deposit_pct_check
            CHECK (preorder_deposit_pct > 0 AND preorder_deposit_pct <= 100);
    END IF;
END $$;

-- Storefront and admin both filter on "which products are pre-order"; the flag
-- is false for most rows, so a partial index stays small.
CREATE INDEX IF NOT EXISTS idx_products_is_preorder
    ON products (is_preorder) WHERE is_preorder;

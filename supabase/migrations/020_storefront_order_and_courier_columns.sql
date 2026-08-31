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

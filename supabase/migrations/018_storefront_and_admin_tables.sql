-- ============================================================================
-- STOREFRONT & REMAINING ADMIN TABLES (018)
-- ============================================================================
-- Eleven tables the application queries that were never created. Column names
-- and types are taken from the queries and Zod schemas already in the code, so
-- existing routes work against them unchanged.
--
-- Affected features:
--   carts / cart_items          shopping cart (guest + signed-in)
--   wishlists                   saved products
--   addresses                   customer address book
--   coupons                     discount codes (/admin/coupons)
--   hero_sliders                homepage carousel (/admin/sliders)
--   google_analytics_settings   GA config (/admin/google-analytics)
--   landing_page_blocks         landing page builder
--   order_notes                 internal order notes
--   order_tracking_events       courier tracking history
--   delivery_zones              shipping rates by postal code
--
-- Safe to re-run: every statement is guarded.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Cart
-- ----------------------------------------------------------------------------
-- A cart belongs either to a signed-in user or to a guest session, never both.
CREATE TABLE IF NOT EXISTS carts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT carts_owner_present CHECK (user_id IS NOT NULL OR session_id IS NOT NULL)
);

-- The cart routes do .eq(user_id).single() and .eq(session_id).single(), so
-- each owner must have at most one cart or those calls raise PGRST116.
CREATE UNIQUE INDEX IF NOT EXISTS idx_carts_user ON carts (user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_carts_session ON carts (session_id) WHERE session_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS cart_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variation_id UUID REFERENCES product_variations(id) ON DELETE SET NULL,
    quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON cart_items (cart_id);

-- One row per product/variation in a cart; the add-to-cart route looks for an
-- existing line and bumps its quantity rather than inserting a duplicate.
CREATE UNIQUE INDEX IF NOT EXISTS idx_cart_items_unique_variation
    ON cart_items (cart_id, product_id, variation_id)
    WHERE variation_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cart_items_unique_product
    ON cart_items (cart_id, product_id)
    WHERE variation_id IS NULL;

-- ----------------------------------------------------------------------------
-- 2. Wishlist
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wishlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_wishlists_user ON wishlists (user_id);

-- ----------------------------------------------------------------------------
-- 3. Address book
-- ----------------------------------------------------------------------------
-- Columns match the Zod schema in api/v1/users/me/addresses.
CREATE TABLE IF NOT EXISTS addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label TEXT,
    street TEXT NOT NULL,
    apartment TEXT,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    postal_code TEXT NOT NULL,
    country TEXT NOT NULL DEFAULT 'Bangladesh',
    phone TEXT,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses (user_id);

-- At most one default address per user. The routes clear the old default
-- before setting a new one; this makes that invariant enforced rather than
-- merely intended.
CREATE UNIQUE INDEX IF NOT EXISTS idx_addresses_one_default
    ON addresses (user_id)
    WHERE is_default;

-- ----------------------------------------------------------------------------
-- 4. Coupons
-- ----------------------------------------------------------------------------
-- The admin route maps its API field names onto these columns
-- (discount_type -> type, usage_limit -> max_uses, and so on).
CREATE TABLE IF NOT EXISTS coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed', 'free_shipping')),
    value DECIMAL(10,2) NOT NULL DEFAULT 0.00 CHECK (value >= 0),
    min_order_amount DECIMAL(10,2),
    max_discount_amount DECIMAL(10,2),
    max_uses INT CHECK (max_uses IS NULL OR max_uses > 0),
    uses_count INT NOT NULL DEFAULT 0,
    starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- A window that closes before it opens can never be valid.
    CONSTRAINT coupons_valid_window CHECK (expires_at IS NULL OR expires_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons (is_active, starts_at, expires_at);

-- ----------------------------------------------------------------------------
-- 5. Homepage sliders
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hero_sliders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    subtitle TEXT,
    badge TEXT DEFAULT 'FEATURED',
    image_url TEXT NOT NULL,
    link_url TEXT DEFAULT '/laptops',
    button_text TEXT DEFAULT 'Shop Now',
    sort_order INT DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hero_sliders_order ON hero_sliders (is_active, sort_order);

-- ----------------------------------------------------------------------------
-- 6. Google Analytics settings
-- ----------------------------------------------------------------------------
-- Read with .single(), so this is a single-row settings table.
CREATE TABLE IF NOT EXISTS google_analytics_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    measurement_id TEXT DEFAULT '',
    enabled BOOLEAN DEFAULT false,
    enabled_events JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 7. Landing page builder blocks
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS landing_page_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    landing_page_id UUID NOT NULL REFERENCES landing_pages(id) ON DELETE CASCADE,
    block_type TEXT NOT NULL,
    block_data JSONB DEFAULT '{}'::jsonb,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_landing_page_blocks_page
    ON landing_page_blocks (landing_page_id, sort_order);

-- ----------------------------------------------------------------------------
-- 8. Order notes
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    note TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_notes_order ON order_notes (order_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 9. Courier tracking history
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_tracking_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    provider TEXT,
    status TEXT NOT NULL,
    status_detail TEXT,
    location TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_tracking_order
    ON order_tracking_events (order_id, timestamp DESC);

-- ----------------------------------------------------------------------------
-- 10. Delivery zones
-- ----------------------------------------------------------------------------
-- Matched with .contains('postal_codes', [code]), so postal_codes is an array.
CREATE TABLE IF NOT EXISTS delivery_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    postal_codes TEXT[] DEFAULT ARRAY[]::TEXT[],
    shipping_rate DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    min_order_for_free DECIMAL(10,2),
    estimated_days INT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_zones_codes
    ON delivery_zones USING GIN (postal_codes);

-- Default Bangladesh zones so checkout has rates to work with.
INSERT INTO delivery_zones (name, postal_codes, shipping_rate, min_order_for_free, estimated_days, is_active)
SELECT 'Inside Dhaka', ARRAY['1000','1100','1200','1205','1206','1207','1208','1209','1212','1213','1214','1215','1216','1217','1219','1229','1230'], 60.00, 5000.00, 1, true
WHERE NOT EXISTS (SELECT 1 FROM delivery_zones WHERE name = 'Inside Dhaka');

INSERT INTO delivery_zones (name, postal_codes, shipping_rate, min_order_for_free, estimated_days, is_active)
SELECT 'Outside Dhaka', ARRAY['4000','4100','6000','6100','8000','9000','2200','3100','5800','7400'], 120.00, 10000.00, 3, true
WHERE NOT EXISTS (SELECT 1 FROM delivery_zones WHERE name = 'Outside Dhaka');

-- ----------------------------------------------------------------------------
-- 11. Row level security
-- ----------------------------------------------------------------------------
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE hero_sliders ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_analytics_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE landing_page_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_tracking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;

-- Storefront reads these anonymously; writes all go through API routes running
-- under the service role, which bypasses RLS.
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'hero_sliders',
        'google_analytics_settings',
        'landing_page_blocks',
        'delivery_zones'
    ] LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = t AND policyname = 'Public read ' || t
        ) THEN
            EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING (true)', 'Public read ' || t, t);
        END IF;
    END LOOP;
END $$;

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

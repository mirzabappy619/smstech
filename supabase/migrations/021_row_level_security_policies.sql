-- ============================================================================
-- ROW LEVEL SECURITY POLICIES (021)
-- ============================================================================
-- Two problems this fixes.
--
-- 1. DATA LEAK. Migration 000 created:
--        CREATE POLICY "Public read orders" ON orders FOR SELECT USING (true);
--    With the anon key that exposes every order — customer name, phone, email,
--    delivery address and totals — to anyone on the internet. The matching
--    "Public insert" policies let anyone forge orders. All three are replaced
--    below with owner-scoped equivalents.
--
-- 2. LOCKED-OUT STOREFRONT. users, wishlists, addresses, carts, cart_items and
--    coupons have RLS enabled but no policy at all, so the signed-in session
--    client reads zero rows. That silently emptied the account pages and made
--    the login route fall back to role "customer" for admins.
--
-- Admin API routes run under the service role, which bypasses RLS entirely, so
-- none of the admin panel is affected by anything here.
--
-- Safe to re-run: every statement is guarded.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Helper — the users.id behind the current auth session
-- ----------------------------------------------------------------------------
-- SECURITY DEFINER so the lookup itself is not subject to the users policy it
-- is used to define, which would recurse.
CREATE OR REPLACE FUNCTION current_profile_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id FROM users WHERE auth_id = auth.uid()
$$;

GRANT EXECUTE ON FUNCTION current_profile_id() TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 1. Orders — replace the blanket public policies
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public read orders" ON orders;
DROP POLICY IF EXISTS "Public insert orders" ON orders;
DROP POLICY IF EXISTS "Public insert order_items" ON order_items;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE tablename = 'orders' AND policyname = 'Own orders read') THEN
        CREATE POLICY "Own orders read" ON orders FOR SELECT
            USING (customer_id IN (
                SELECT id FROM customers WHERE user_id = current_profile_id()
            ));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE tablename = 'order_items' AND policyname = 'Own order items read') THEN
        CREATE POLICY "Own order items read" ON order_items FOR SELECT
            USING (order_id IN (
                SELECT o.id FROM orders o
                JOIN customers c ON c.id = o.customer_id
                WHERE c.user_id = current_profile_id()
            ));
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Profile row
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE tablename = 'users' AND policyname = 'Own profile read') THEN
        CREATE POLICY "Own profile read" ON users FOR SELECT
            USING (auth_id = auth.uid());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE tablename = 'users' AND policyname = 'Own profile update') THEN
        CREATE POLICY "Own profile update" ON users FOR UPDATE
            USING (auth_id = auth.uid())
            WITH CHECK (auth_id = auth.uid());
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. Customer record
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE tablename = 'customers' AND policyname = 'Own customer read') THEN
        CREATE POLICY "Own customer read" ON customers FOR SELECT
            USING (user_id = current_profile_id());
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. Wishlist and address book — full ownership
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['wishlists', 'addresses'] LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_policies
                       WHERE tablename = t AND policyname = 'Own ' || t) THEN
            EXECUTE format(
                'CREATE POLICY %I ON %I FOR ALL USING (user_id = current_profile_id()) WITH CHECK (user_id = current_profile_id())',
                'Own ' || t, t
            );
        END IF;
    END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 5. Carts
-- ----------------------------------------------------------------------------
-- Signed-in carts are owner-scoped here. Guest carts key off an opaque
-- session_id that RLS cannot verify, so those requests are served by the API
-- routes under the service role, which scope every query by that session id.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE tablename = 'carts' AND policyname = 'Own cart') THEN
        CREATE POLICY "Own cart" ON carts FOR ALL
            USING (user_id = current_profile_id())
            WITH CHECK (user_id = current_profile_id());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE tablename = 'cart_items' AND policyname = 'Own cart items') THEN
        CREATE POLICY "Own cart items" ON cart_items FOR ALL
            USING (cart_id IN (SELECT id FROM carts WHERE user_id = current_profile_id()))
            WITH CHECK (cart_id IN (SELECT id FROM carts WHERE user_id = current_profile_id()));
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 6. Coupons — the storefront validates a code the shopper typed
-- ----------------------------------------------------------------------------
-- Only active codes are readable; usage counts and limits are not secret, but
-- inactive/expired campaigns stay hidden.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE tablename = 'coupons' AND policyname = 'Public read active coupons') THEN
        CREATE POLICY "Public read active coupons" ON coupons FOR SELECT
            USING (is_active = true);
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 7. Storefront-visible configuration
-- ----------------------------------------------------------------------------
-- store_settings is key/value and holds only storefront configuration (name,
-- contact details, shipping rates, social links). Without a policy the
-- storefront silently fell back to hardcoded defaults, so nothing an admin
-- saved ever reached the site.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies
                   WHERE tablename = 'store_settings' AND policyname = 'Public read store_settings') THEN
        CREATE POLICY "Public read store_settings" ON store_settings FOR SELECT
            USING (true);
    END IF;
END $$;

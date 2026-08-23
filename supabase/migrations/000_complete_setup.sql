-- ============================================================================
-- SMSTECH COMPLETE DATABASE SETUP (ONE SINGLE FILE)
-- Copy and run this entire file in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/etcusvjamhqrhocjggut/sql
-- ============================================================================

-- Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop existing tables cleanly if needed (in cascade order)
DROP TABLE IF EXISTS courier_settings CASCADE;
DROP TABLE IF EXISTS homepage_settings CASCADE;
DROP TABLE IF EXISTS shipping_methods CASCADE;
DROP TABLE IF EXISTS capi_settings CASCADE;
DROP TABLE IF EXISTS store_settings CASCADE;
DROP TABLE IF EXISTS meta_pixel_settings CASCADE;
DROP TABLE IF EXISTS landing_pages CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS cart_items CASCADE;
DROP TABLE IF EXISTS carts CASCADE;
DROP TABLE IF EXISTS inventory_logs CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS warehouses CASCADE;
DROP TABLE IF EXISTS product_variations CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS coupons CASCADE;

-- 1. USERS
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_id UUID UNIQUE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    phone TEXT,
    role TEXT DEFAULT 'customer' CHECK (role IN ('customer', 'admin', 'owner', 'staff')),
    is_active BOOLEAN DEFAULT true,
    avatar_url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CUSTOMERS
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT DEFAULT 'Dhaka',
    state TEXT,
    postal_code TEXT,
    country TEXT DEFAULT 'Bangladesh',
    total_orders INT DEFAULT 0,
    total_spent DECIMAL(12,2) DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CATEGORIES
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    image_url TEXT,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. PRODUCTS
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    short_description TEXT,
    sku TEXT UNIQUE,
    brand TEXT,
    subcategory TEXT,
    base_price DECIMAL(10,2) NOT NULL,
    compare_at_price DECIMAL(10,2),
    currency TEXT DEFAULT 'BDT',
    images JSONB DEFAULT '[]'::jsonb,
    specs JSONB DEFAULT '{}'::jsonb,
    short_spec TEXT,
    badges JSONB DEFAULT '[]'::jsonb,
    warranty TEXT,
    colors JSONB DEFAULT '[]'::jsonb,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    is_new BOOLEAN DEFAULT false,
    stock_status TEXT DEFAULT 'in_stock' CHECK (stock_status IN ('in_stock', 'low_stock', 'out_of_stock')),
    stock_count INT DEFAULT 50,
    store_availability JSONB DEFAULT '{"store1": true, "store2": true, "online": true}'::jsonb,
    average_rating DECIMAL(3,2) DEFAULT 5.0,
    review_count INT DEFAULT 0,
    seo_title TEXT,
    seo_description TEXT,
    track_inventory BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. PRODUCT VARIATIONS
CREATE TABLE product_variations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sku TEXT UNIQUE,
    price DECIMAL(10,2) NOT NULL,
    compare_at_price DECIMAL(10,2),
    attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. WAREHOUSES & INVENTORY
CREATE TABLE warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    address TEXT,
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    variation_id UUID REFERENCES product_variations(id) ON DELETE CASCADE,
    quantity INT DEFAULT 0,
    reserved_quantity INT DEFAULT 0,
    available_quantity INT GENERATED ALWAYS AS (quantity - reserved_quantity) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. ORDERS & ORDER ITEMS
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT UNIQUE NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_email TEXT,
    address_line1 TEXT NOT NULL,
    city TEXT DEFAULT 'Dhaka',
    shipping_method TEXT DEFAULT 'Inside Dhaka Delivery',
    shipping_amount DECIMAL(10,2) DEFAULT 60.00,
    discount_amount DECIMAL(10,2) DEFAULT 0.00,
    subtotal DECIMAL(10,2) NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    payment_method TEXT DEFAULT 'cash_on_delivery',
    payment_status TEXT DEFAULT 'pending',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    variation_id UUID REFERENCES product_variations(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    variation_name TEXT,
    unit_price DECIMAL(10,2) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    total DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. LANDING PAGES & SETTINGS
CREATE TABLE landing_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'draft',
    design_data JSONB DEFAULT '{}'::jsonb,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE store_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE meta_pixel_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pixel_id TEXT,
    access_token TEXT,
    is_enabled BOOLEAN DEFAULT false,
    test_event_code TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE courier_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL UNIQUE,
    credentials JSONB DEFAULT '{}'::jsonb,
    is_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- RLS POLICIES & PERMISSIONS
-- ============================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variations ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE landing_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_pixel_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE courier_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read categories" ON categories FOR SELECT USING (true);
CREATE POLICY "Public read products" ON products FOR SELECT USING (true);
CREATE POLICY "Public read product_variations" ON product_variations FOR SELECT USING (true);
CREATE POLICY "Public read orders" ON orders FOR SELECT USING (true);
CREATE POLICY "Public insert orders" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Public insert order_items" ON order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Public read landing_pages" ON landing_pages FOR SELECT USING (true);

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- ============================================================================
-- INITIAL SEED DATA
-- ============================================================================

-- Categories
INSERT INTO categories (id, name, slug, description, sort_order, is_active) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Laptops', 'laptops', 'High performance laptops for work, gaming and creativity', 1, true),
  ('a1000000-0000-0000-0000-000000000002', 'Smartphones', 'smartphones', 'Flagship & budget mobile phones from leading brands', 2, true),
  ('a1000000-0000-0000-0000-000000000003', 'Gaming', 'gaming-laptops', 'High-refresh rate laptops & gaming devices', 3, true),
  ('a1000000-0000-0000-0000-000000000004', 'MacBooks', 'macbook', 'Apple MacBooks powered by M1, M2 and M3 chips', 4, true),
  ('a1000000-0000-0000-0000-000000000005', 'Pre-Owned', 'pre-owned', 'Certified pre-owned and like-new laptops with warranty', 5, true);

-- Products Catalog
INSERT INTO products (
  id, name, slug, brand, subcategory, base_price, compare_at_price, category_id,
  images, specs, short_spec, badges, warranty, colors, is_active, is_featured, is_new, stock_status, stock_count
) VALUES
  (
    'b1000000-0000-0000-0000-000000000001',
    'Apple MacBook Air M1 (8GB / 256GB)',
    'apple-macbook-air-m1-8-256',
    'Apple',
    'macbook',
    59000.00,
    60000.00,
    'a1000000-0000-0000-0000-000000000004',
    '["https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=800&h=600&fit=crop&auto=format", "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&h=600&fit=crop&auto=format"]'::jsonb,
    '{"Processor": "Apple M1 Chip (8-core CPU / 7-core GPU)", "RAM": "8GB Unified Memory", "Storage": "256GB SSD", "Display": "13.3-inch Retina Display", "Wholesale Price": "৳60,000", "Retail Price": "৳59,000", "OS": "macOS Sonoma"}'::jsonb,
    'Apple M1 · 8GB · 256GB SSD · 13.3" Retina',
    '["Best Seller", "MacBook", "Hot Deal"]'::jsonb,
    '1 Year Apple Warranty',
    '["Rose Gold", "Silver", "Space Gray"]'::jsonb,
    true, true, true, 'in_stock', 25
  ),
  (
    'b1000000-0000-0000-0000-000000000002',
    'ASUS ROG Strix G16 Gaming Laptop',
    'asus-rog-strix-g16',
    'ASUS',
    'gaming',
    189999.00,
    204999.00,
    'a1000000-0000-0000-0000-000000000003',
    '["https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=800&h=600&fit=crop&auto=format"]'::jsonb,
    '{"Processor": "Intel Core i7-14700HX", "RAM": "16GB DDR5", "Storage": "512GB NVMe SSD", "GPU": "NVIDIA RTX 4060 8GB", "Display": "16 QHD 240Hz"}'::jsonb,
    'i7-14700HX · 16GB · RTX 4060 · 16" QHD 240Hz',
    '["Hot Deal", "Gaming"]'::jsonb,
    '2 Years ASUS Warranty',
    '["Eclipse Gray"]'::jsonb,
    true, true, false, 'in_stock', 15
  ),
  (
    'b1000000-0000-0000-0000-000000000003',
    'MacBook Air 15" M3',
    'macbook-air-m3',
    'Apple',
    'macbook',
    179999.00,
    189999.00,
    'a1000000-0000-0000-0000-000000000004',
    '["https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=800&h=600&fit=crop&auto=format"]'::jsonb,
    '{"Processor": "Apple M3 Chip", "RAM": "16GB Unified Memory", "Storage": "512GB SSD", "Display": "15.3 Liquid Retina"}'::jsonb,
    'Apple M3 · 16GB · 512GB · 15.3" Retina',
    '["Best Seller", "MacBook"]'::jsonb,
    '1 Year Apple Warranty',
    '["Midnight", "Starlight", "Space Gray", "Silver"]'::jsonb,
    true, true, false, 'in_stock', 18
  ),
  (
    'b1000000-0000-0000-0000-000000000004',
    'iPhone 17 Pro',
    'iphone-17-pro',
    'Apple',
    'flagship',
    179999.00,
    189999.00,
    'a1000000-0000-0000-0000-000000000002',
    '["https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=800&h=600&fit=crop&auto=format"]'::jsonb,
    '{"Display": "6.3 Super Retina XDR OLED", "Processor": "Apple A19 Pro", "RAM": "8GB", "Storage": "256GB"}'::jsonb,
    'A19 Pro · 8GB · 256GB · 6.3" OLED · 5G',
    '["New", "Best Seller"]'::jsonb,
    '1 Year Apple Warranty',
    '["Natural Titanium", "Desert Titanium", "Black", "White"]'::jsonb,
    true, true, true, 'in_stock', 30
  ),
  (
    'b1000000-0000-0000-0000-000000000005',
    'Galaxy S26 Ultra',
    'samsung-galaxy-s26-ultra',
    'Samsung',
    'flagship',
    174999.00,
    184999.00,
    'a1000000-0000-0000-0000-000000000002',
    '["https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=800&h=600&fit=crop&auto=format"]'::jsonb,
    '{"Display": "6.9 Dynamic AMOLED 2X 120Hz", "Processor": "Snapdragon 8 Elite", "RAM": "12GB", "Storage": "256GB"}'::jsonb,
    'Snapdragon 8 Elite · 12GB · 200MP · 5G',
    '["New", "Hot Deal"]'::jsonb,
    '1 Year Samsung Warranty',
    '["Titanium Black", "Titanium Silver"]'::jsonb,
    true, true, true, 'in_stock', 20
  ),

  -- Pre-Owned Laptops Requested
  (
    'b1000000-0000-0000-0000-000000000006',
    'Dell Latitude 3410 14"',
    'dell-latitude-3410-14',
    'Dell',
    'pre-owned',
    38500.00,
    45000.00,
    'a1000000-0000-0000-0000-000000000005',
    '["https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800&h=600&fit=crop&auto=format"]'::jsonb,
    '{"Processor": "Intel Core i5-10th Gen", "RAM": "8GB DDR4", "Storage": "256GB SSD", "Display": "14 HD Anti-Glare", "OS": "Windows 11 Pro"}'::jsonb,
    'i5 10th Gen · 8GB · 256GB SSD · 14"',
    '["Pre-Owned", "Hot Deal"]'::jsonb,
    '6 Months SMSTech Replacement Warranty',
    '["Black"]'::jsonb,
    true, true, false, 'in_stock', 10
  ),
  (
    'b1000000-0000-0000-0000-000000000007',
    'HP ProBook 445 G7 (Ryzen 5 / 8GB / 256GB)',
    'hp-probook-445-g7-ryzen-5',
    'HP',
    'pre-owned',
    42000.00,
    48000.00,
    'a1000000-0000-0000-0000-000000000005',
    '["https://images.unsplash.com/photo-1544731612-de7f96afe55f?w=800&h=600&fit=crop&auto=format"]'::jsonb,
    '{"Processor": "AMD Ryzen 5 4500U", "RAM": "8GB DDR4", "Storage": "256GB NVMe SSD", "Display": "14 FHD", "Accessories": "Original Charger Included"}'::jsonb,
    'Ryzen 5 · 8GB · 256GB SSD · With Charger',
    '["Pre-Owned", "With Charger"]'::jsonb,
    '6 Months SMSTech Replacement Warranty',
    '["Pike Silver"]'::jsonb,
    true, true, false, 'in_stock', 12
  ),
  (
    'b1000000-0000-0000-0000-000000000008',
    'HP EliteBook 840 G8 (i5-11th / 16GB / 512GB)',
    'hp-elitebook-840-g8-i5-11th',
    'HP',
    'pre-owned',
    52500.00,
    60000.00,
    'a1000000-0000-0000-0000-000000000005',
    '["https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800&h=600&fit=crop&auto=format"]'::jsonb,
    '{"Processor": "Intel Core i5-11th Gen", "RAM": "16GB DDR4", "Storage": "512GB NVMe SSD", "Display": "14 FHD IPS", "OS": "Windows 11 Pro"}'::jsonb,
    'i5 11th Gen · 16GB · 512GB SSD · 14" FHD',
    '["Pre-Owned", "Premium"]'::jsonb,
    '6 Months SMSTech Replacement Warranty',
    '["Silver"]'::jsonb,
    true, true, false, 'in_stock', 8
  ),
  (
    'b1000000-0000-0000-0000-000000000009',
    'Microsoft Surface Laptop 4 (i7-11th / 16GB / 512GB)',
    'microsoft-surface-laptop-4-i7-11th',
    'Microsoft',
    'pre-owned',
    68000.00,
    78000.00,
    'a1000000-0000-0000-0000-000000000005',
    '["https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&h=600&fit=crop&auto=format"]'::jsonb,
    '{"Processor": "Intel Core i7-11th Gen", "RAM": "16GB LPDDR4x", "Storage": "512GB SSD", "Display": "13.5 PixelSense Touchscreen"}'::jsonb,
    'i7 11th Gen · 16GB · 512GB SSD · 13.5" Touch',
    '["Pre-Owned", "Touchscreen"]'::jsonb,
    '6 Months SMSTech Replacement Warranty',
    '["Platinum", "Matte Black"]'::jsonb,
    true, true, false, 'in_stock', 5
  ),
  (
    'b1000000-0000-0000-0000-000000000010',
    'HP ProBook 445 G9 (Ryzen 5 / 16GB / 512GB)',
    'hp-probook-445-g9-ryzen-5',
    'HP',
    'pre-owned',
    56000.00,
    64000.00,
    'a1000000-0000-0000-0000-000000000005',
    '["https://images.unsplash.com/photo-1544731612-de7f96afe55f?w=800&h=600&fit=crop&auto=format"]'::jsonb,
    '{"Processor": "AMD Ryzen 5 5625U", "RAM": "16GB DDR4", "Storage": "512GB NVMe SSD", "Display": "14 FHD", "Accessories": "Original Charger Included"}'::jsonb,
    'Ryzen 5 · 16GB · 512GB SSD · With Charger',
    '["Pre-Owned", "With Charger"]'::jsonb,
    '6 Months SMSTech Replacement Warranty',
    '["Pike Silver"]'::jsonb,
    true, true, false, 'in_stock', 9
  ),
  (
    'b1000000-0000-0000-0000-000000000011',
    'HP ProBook 640 G9 (i5-12th / 16GB / 512GB)',
    'hp-probook-640-g9-i5-12th',
    'HP',
    'pre-owned',
    62000.00,
    70000.00,
    'a1000000-0000-0000-0000-000000000005',
    '["https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800&h=600&fit=crop&auto=format"]'::jsonb,
    '{"Processor": "Intel Core i5-12th Gen", "RAM": "16GB DDR4", "Storage": "512GB NVMe SSD", "Display": "14 FHD", "Accessories": "Original Charger Included"}'::jsonb,
    'i5 12th Gen · 16GB · 512GB SSD · With Charger',
    '["Pre-Owned", "12th Gen", "With Charger"]'::jsonb,
    '6 Months SMSTech Replacement Warranty',
    '["Silver"]'::jsonb,
    true, true, false, 'in_stock', 7
  ),
  (
    'b1000000-0000-0000-0000-000000000012',
    'HP EliteBook 830 G8 (i7-11th / 16GB / 512GB)',
    'hp-elitebook-830-g8-i7-11th',
    'HP',
    'pre-owned',
    58500.00,
    66000.00,
    'a1000000-0000-0000-0000-000000000005',
    '["https://images.unsplash.com/photo-1544731612-de7f96afe55f?w=800&h=600&fit=crop&auto=format"]'::jsonb,
    '{"Processor": "Intel Core i7-11th Gen", "RAM": "16GB DDR4", "Storage": "512GB NVMe SSD", "Condition": "Like New", "Accessories": "Original Charger Included"}'::jsonb,
    'i7 11th Gen · 16GB · 512GB SSD · Condition Like New',
    '["Pre-Owned", "Like New", "With Charger"]'::jsonb,
    '6 Months SMSTech Replacement Warranty',
    '["Silver"]'::jsonb,
    true, true, false, 'in_stock', 11
  );

-- Product Variations
INSERT INTO product_variations (id, product_id, name, sku, price, compare_at_price, attributes) VALUES
  ('e1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', '8GB / 256GB SSD', 'MBA-M1-8-256', 94999.00, 104999.00, '{"ram": "8GB", "storage": "256GB"}'::jsonb),
  ('e1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000001', '8GB / 512GB SSD', 'MBA-M1-8-512', 114999.00, 124999.00, '{"ram": "8GB", "storage": "512GB"}'::jsonb);

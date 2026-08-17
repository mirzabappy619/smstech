-- Incremental snippet: Add Pre-Owned category and 7 laptops without dropping existing tables

-- 1. Insert Pre-Owned Category
INSERT INTO categories (id, name, slug, description, sort_order, is_active) VALUES
  ('a1000000-0000-0000-0000-000000000005', 'Pre-Owned', 'pre-owned', 'Certified pre-owned and like-new laptops with warranty', 5, true)
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name;

-- 2. Insert 7 Pre-Owned Laptops
INSERT INTO products (
  id, name, slug, brand, subcategory, base_price, compare_at_price, category_id,
  images, specs, short_spec, badges, warranty, colors, is_active, is_featured, is_new, stock_status, stock_count
) VALUES
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
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  base_price = EXCLUDED.base_price,
  specs = EXCLUDED.specs,
  badges = EXCLUDED.badges;

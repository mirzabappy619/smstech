-- Sample Orders for Testing
-- Run this in Supabase SQL Editor after running the main seed file

-- Note: Make sure you have a user account first
-- You can get a user ID by running: SELECT id FROM auth.users LIMIT 1;

-- Sample Order 1: Completed Order
INSERT INTO orders (
  id,
  order_number,
  user_id,
  status,
  payment_status,
  subtotal,
  tax,
  discount,
  shipping_cost,
  total,
  currency,
  payment_method,
  shipping_method,
  tracking_number,
  shipping_address,
  billing_address,
  notes,
  source,
  created_at,
  updated_at
) VALUES (
  'ord11111-1111-1111-1111-111111111111',
  'ORD-2024-00001',
  (SELECT id FROM auth.users LIMIT 1), -- Replace with actual user_id
  'delivered',
  'paid',
  1299.97,
  103.99,
  50.00,
  9.99,
  1363.95,
  'USD',
  'card',
  'Standard Shipping',
  'TRK1234567890',
  '{"first_name": "John", "last_name": "Doe", "address_line1": "123 Main St", "address_line2": "Apt 4B", "city": "New York", "state": "NY", "postal_code": "10001", "country": "United States", "phone": "+1 555-123-4567"}'::jsonb,
  '{"first_name": "John", "last_name": "Doe", "address_line1": "123 Main St", "address_line2": "Apt 4B", "city": "New York", "state": "NY", "postal_code": "10001", "country": "United States"}'::jsonb,
  'Please leave at front door if not home.',
  'web',
  NOW() - INTERVAL '5 days',
  NOW() - INTERVAL '2 days'
);

-- Sample Order Items for Order 1
INSERT INTO order_items (
  id,
  order_id,
  product_id,
  variation_id,
  quantity,
  unit_price,
  total_price,
  created_at
) VALUES 
  (
    'oi111111-1111-1111-1111-111111111111',
    'ord11111-1111-1111-1111-111111111111',
    'a2222222-2222-2222-2222-222222222222', -- Wireless Headphones
    NULL,
    1,
    349.99,
    349.99,
    NOW() - INTERVAL '5 days'
  ),
  (
    'oi111111-1111-1111-1111-111111111112',
    'ord11111-1111-1111-1111-111111111111',
    'a3333333-3333-3333-3333-333333333333', -- Smart Watch (if exists)
    NULL,
    1,
    399.00,
    399.00,
    NOW() - INTERVAL '5 days'
  );

-- Sample Order 2: Processing Order
INSERT INTO orders (
  id,
  order_number,
  user_id,
  status,
  payment_status,
  subtotal,
  tax,
  discount,
  shipping_cost,
  total,
  currency,
  payment_method,
  shipping_method,
  shipping_address,
  billing_address,
  source,
  created_at,
  updated_at
) VALUES (
  'ord22222-2222-2222-2222-222222222222',
  'ORD-2024-00002',
  (SELECT id FROM auth.users LIMIT 1),
  'processing',
  'paid',
  599.99,
  48.00,
  0.00,
  9.99,
  657.98,
  'USD',
  'card',
  'Express Shipping',
  '{"first_name": "Jane", "last_name": "Smith", "address_line1": "456 Oak Ave", "city": "Los Angeles", "state": "CA", "postal_code": "90001", "country": "United States", "phone": "+1 555-987-6543"}'::jsonb,
  '{"first_name": "Jane", "last_name": "Smith", "address_line1": "456 Oak Ave", "city": "Los Angeles", "state": "CA", "postal_code": "90001", "country": "United States"}'::jsonb,
  'web',
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '1 day'
);

-- Sample Order Items for Order 2
INSERT INTO order_items (
  id,
  order_id,
  product_id,
  variation_id,
  quantity,
  unit_price,
  total_price,
  created_at
) VALUES 
  (
    'oi222222-2222-2222-2222-222222222222',
    'ord22222-2222-2222-2222-222222222222',
    'a1111111-1111-1111-1111-111111111112', -- Budget Phone
    NULL,
    2,
    299.99,
    599.98,
    NOW() - INTERVAL '2 days'
  );

-- Sample Order 3: Pending Order
INSERT INTO orders (
  id,
  order_number,
  user_id,
  status,
  payment_status,
  subtotal,
  tax,
  discount,
  shipping_cost,
  total,
  currency,
  payment_method,
  shipping_method,
  shipping_address,
  billing_address,
  notes,
  source,
  created_at,
  updated_at
) VALUES (
  'ord33333-3333-3333-3333-333333333333',
  'ORD-2024-00003',
  (SELECT id FROM auth.users LIMIT 1),
  'pending',
  'pending',
  999.99,
  80.00,
  100.00,
  0.00,
  979.99,
  'USD',
  'cash_on_delivery',
  'Standard Shipping',
  '{"first_name": "Mike", "last_name": "Johnson", "address_line1": "789 Pine Rd", "city": "Chicago", "state": "IL", "postal_code": "60601", "country": "United States", "phone": "+1 555-456-7890"}'::jsonb,
  '{"first_name": "Mike", "last_name": "Johnson", "address_line1": "789 Pine Rd", "city": "Chicago", "state": "IL", "postal_code": "60601", "country": "United States"}'::jsonb,
  'Please call before delivery.',
  'landing_page',
  NOW() - INTERVAL '1 day',
  NOW()
);

-- Sample Order Items for Order 3
INSERT INTO order_items (
  id,
  order_id,
  product_id,
  variation_id,
  quantity,
  unit_price,
  total_price,
  created_at
) VALUES 
  (
    'oi333333-3333-3333-3333-333333333333',
    'ord33333-3333-3333-3333-333333333333',
    'a1111111-1111-1111-1111-111111111111', -- Pro Smartphone
    NULL,
    1,
    999.99,
    999.99,
    NOW() - INTERVAL '1 day'
  );

-- Verify the orders were created
SELECT 
  o.id,
  o.order_number,
  o.status,
  o.payment_status,
  o.total,
  u.email as customer_email,
  COUNT(oi.id) as item_count
FROM orders o
LEFT JOIN auth.users u ON o.user_id = u.id
LEFT JOIN order_items oi ON o.id = oi.order_id
WHERE o.order_number LIKE 'ORD-2024-%'
GROUP BY o.id, o.order_number, o.status, o.payment_status, o.total, u.email
ORDER BY o.created_at DESC;

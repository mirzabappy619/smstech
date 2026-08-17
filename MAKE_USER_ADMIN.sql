-- ==============================================
-- MAKE USER ADMIN
-- ==============================================
-- This script promotes a user to admin role
-- 
-- USAGE:
-- 1. Sign up for an account on your site (or use existing account)
-- 2. Find your user's auth_id by running:
--    SELECT id, email FROM auth.users;
-- 3. Replace 'YOUR_AUTH_ID_HERE' below with your actual auth ID
-- 4. Run this script in Supabase SQL Editor
-- ==============================================

-- Option 1: If you know the user's auth_id
INSERT INTO users (auth_id, email, first_name, last_name, role, email_verified)
VALUES (
  'YOUR_AUTH_ID_HERE',  -- Replace with actual auth.users.id
  'admin@example.com',   -- Replace with your email
  'Admin',
  'User',
  'admin',              -- Can be 'admin' or 'owner'
  true
)
ON CONFLICT (auth_id) 
DO UPDATE SET role = 'admin';

-- Option 2: Promote existing user by email
-- Uncomment and run this if your user record already exists:
-- UPDATE users 
-- SET role = 'admin' 
-- WHERE email = 'admin@example.com';  -- Replace with your email

-- Verify the change
SELECT u.id, u.email, u.role, au.email as auth_email
FROM users u
JOIN auth.users au ON u.auth_id = au.id
WHERE u.role IN ('admin', 'owner');

-- ============================================
-- CREATE ADMIN USER IN SUPABASE
-- ============================================
-- This script creates a new admin user account
-- Run this in Supabase SQL Editor
-- ============================================

-- STEP 1: Create auth user (this will send verification email)
-- Replace the email and password with your desired credentials

-- Note: You need to run this in Supabase dashboard under Authentication > Users
-- Click "Add user" and select "Email" and enter:
-- Email: admin@ggadgets.com
-- Password: YourSecurePassword123!
-- Then come back here and continue with STEP 2

-- STEP 2: Find the auth_id of the user you just created
SELECT id as auth_id, email, created_at 
FROM auth.users 
WHERE email = 'admin@ggadgets.com';
-- Copy the 'auth_id' from the result

-- STEP 3: Create user profile with admin role
-- Replace YOUR_AUTH_ID_HERE with the auth_id from STEP 2
INSERT INTO users (
    auth_id,
    email,
    role,
    first_name,
    last_name,
    created_at,
    updated_at
)
VALUES (
    '6278f1f3-4dd4-4408-a572-531a8df461d4',  -- Replace with actual auth_id from STEP 2
    'admin@ggadgets.com',  -- Match the email from STEP 1
    'admin',              -- Role: admin or owner
    'Admin',              -- First name
    'User',               -- Last name
    NOW(),
    NOW()
)
ON CONFLICT (auth_id) 
DO UPDATE SET 
    role = 'admin',
    updated_at = NOW();

-- STEP 4: Verify the admin user was created
SELECT 
    u.id,
    u.auth_id,
    u.email,
    u.role,
    u.first_name,
    u.last_name,
    au.email_confirmed_at
FROM users u
JOIN auth.users au ON u.auth_id = au.id
WHERE u.email = 'admin@ggadgets.com';

-- ============================================
-- ALTERNATIVE: Promote existing user to admin
-- ============================================
-- If you already have an account and just want to make it admin:

-- 1. Find your user
SELECT id as auth_id, email FROM auth.users WHERE email = 'admin@ggadgets.com';

-- 2. Update/create profile with admin role
INSERT INTO users (auth_id, email, role, first_name, last_name)
VALUES (
    '6278f1f3-4dd4-4408-a572-531a8df461d4',
    'admin@ggadgets.com',
    'admin',
    'Admin',
    'User'
)
ON CONFLICT (auth_id)
DO UPDATE SET role = 'admin';

-- ============================================
-- QUICK FIX FOR DEVELOPMENT
-- ============================================
-- If you just want to make ALL existing users admin (ONLY FOR DEVELOPMENT):
UPDATE users SET role = 'admin';

-- ============================================
-- ROLES EXPLAINED
-- ============================================
-- 'customer' - Regular user, storefront access only
-- 'delivery' - Delivery driver (future feature)
-- 'admin'    - Admin panel access
-- 'owner'    - Full system access (highest level)

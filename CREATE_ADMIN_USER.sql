-- ============================================
-- CREATE SUPERADMIN / OWNER USER IN SUPABASE
-- ============================================
-- Run this in your Supabase SQL Editor:
-- Dashboard -> SQL Editor -> New Query -> Run
-- ============================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  new_auth_id uuid := gen_random_uuid();
  user_email text := 'admin@smstech.bd';
  user_password text := 'AdminPassword123!';
  existing_auth_id uuid;
BEGIN
  -- Check if user already exists in auth.users
  SELECT id INTO existing_auth_id FROM auth.users WHERE email = user_email;
  
  IF existing_auth_id IS NULL THEN
    -- 1. Insert into auth.users (auto-confirmed)
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      new_auth_id,
      'authenticated',
      'authenticated',
      user_email,
      crypt(user_password, gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      '{"first_name":"Super","last_name":"Admin"}',
      NOW(),
      NOW(),
      '',
      ''
    );
    
    -- 2. Insert into public.users with 'owner' (Superadmin) role
    INSERT INTO users (
      auth_id,
      email,
      role,
      first_name,
      last_name,
      created_at,
      updated_at
    ) VALUES (
      new_auth_id,
      user_email,
      'owner',
      'Super',
      'Admin',
      NOW(),
      NOW()
    );
  ELSE
    -- If auth user exists, update password and set owner role
    UPDATE auth.users 
    SET encrypted_password = crypt(user_password, gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
        updated_at = NOW()
    WHERE id = existing_auth_id;

    INSERT INTO users (
      auth_id,
      email,
      role,
      first_name,
      last_name,
      created_at,
      updated_at
    ) VALUES (
      existing_auth_id,
      user_email,
      'owner',
      'Super',
      'Admin',
      NOW(),
      NOW()
    )
    ON CONFLICT (auth_id)
    DO UPDATE SET role = 'owner', updated_at = NOW();
  END IF;
END $$;

-- Verify the superadmin user
SELECT 
    u.id as user_id,
    u.auth_id,
    u.email,
    u.role,
    u.first_name,
    u.last_name,
    au.email_confirmed_at
FROM users u
JOIN auth.users au ON u.auth_id = au.id
WHERE u.email = 'admin@smstech.bd';

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

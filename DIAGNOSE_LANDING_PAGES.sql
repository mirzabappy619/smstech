-- ============================================
-- DIAGNOSE LANDING PAGE CREATION ISSUES
-- ============================================
-- Run this in Supabase SQL Editor to diagnose problems

-- 1. Check if you're logged in user exists in users table
SELECT 
    'Logged in user check' as test,
    au.id as auth_id,
    au.email,
    u.id as user_id,
    u.role
FROM auth.users au
LEFT JOIN users u ON au.id = u.auth_id
WHERE au.email = 'admin@agdbd.com';  -- Change to your email
-- EXPECTED: Should show user_id and role='admin'
-- IF user_id is NULL: Your user record is missing!

-- 2. Check landing_pages table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'landing_pages'
ORDER BY ordinal_position;

-- 3. Check foreign key constraints
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'landing_pages' 
    AND tc.constraint_type = 'FOREIGN KEY';

-- 4. Try to insert a test landing page manually
-- This will help identify which column is causing the issue
INSERT INTO landing_pages (
    title,
    slug,
    status,
    created_by,
    updated_by
)
VALUES (
    'Test Page',
    'test-page-' || gen_random_uuid()::text,
    'draft',
    (SELECT id FROM users WHERE email = 'admin@agdbd.com' LIMIT 1),
    (SELECT id FROM users WHERE email = 'admin@agdbd.com' LIMIT 1)
)
RETURNING id, title, slug, created_by;
-- IF this fails, check the error message carefully

-- 5. Check if you have any existing landing pages
SELECT 
    id, 
    title, 
    slug, 
    status,
    created_by,
    created_at
FROM landing_pages
ORDER BY created_at DESC
LIMIT 5;

-- ============================================
-- QUICK FIXES
-- ============================================

-- FIX 1: If user record is missing
-- Run this if test #1 shows user_id is NULL
INSERT INTO users (auth_id, email, role, first_name, last_name)
SELECT 
    id,
    email,
    'admin',
    'Admin',
    'User'
FROM auth.users
WHERE email = 'admin@agdbd.com'
ON CONFLICT (auth_id) DO UPDATE SET role = 'admin';

-- FIX 2: Check RLS policies aren't blocking inserts
-- Temporarily disable RLS to test (DON'T DO THIS IN PRODUCTION!)
-- ALTER TABLE landing_pages DISABLE ROW LEVEL SECURITY;
-- Try creating page again
-- Then re-enable: ALTER TABLE landing_pages ENABLE ROW LEVEL SECURITY;

-- FIX 3: Grant proper permissions
GRANT ALL ON landing_pages TO authenticated;
GRANT ALL ON landing_page_blocks TO authenticated;

-- ============================================
-- VERIFICATION
-- ============================================
-- After fixes, verify your setup:
SELECT 
    'Final check' as status,
    (SELECT COUNT(*) FROM auth.users WHERE email = 'admin@agdbd.com') as auth_users,
    (SELECT COUNT(*) FROM users WHERE email = 'admin@agdbd.com') as users_table,
    (SELECT role FROM users WHERE email = 'admin@agdbd.com') as user_role;
-- EXPECTED: auth_users=1, users_table=1, user_role='admin'

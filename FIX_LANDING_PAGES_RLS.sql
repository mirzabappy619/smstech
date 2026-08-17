-- ============================================
-- FIX LANDING PAGES RLS POLICIES
-- ============================================
-- Add missing admin policies for landing_pages and landing_page_blocks
-- Run this in Supabase SQL Editor

-- Drop existing policies if they exist (for re-running)
DROP POLICY IF EXISTS "Admins can do everything on landing_pages" ON landing_pages;
DROP POLICY IF EXISTS "Admins can do everything on landing_page_blocks" ON landing_page_blocks;

-- Admin/Owner can do everything with landing pages
CREATE POLICY "Admins can do everything on landing_pages"
ON landing_pages
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.auth_id = auth.uid() 
    AND users.role IN ('admin', 'owner')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.auth_id = auth.uid() 
    AND users.role IN ('admin', 'owner')
  )
);

-- Admin/Owner can do everything with landing page blocks
CREATE POLICY "Admins can do everything on landing_page_blocks"
ON landing_page_blocks
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.auth_id = auth.uid() 
    AND users.role IN ('admin', 'owner')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.auth_id = auth.uid() 
    AND users.role IN ('admin', 'owner')
  )
);

-- Verify policies were created
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename IN ('landing_pages', 'landing_page_blocks')
ORDER BY tablename, policyname;

-- Test if you can now query landing_pages
-- This should return data if you're logged in as admin
SELECT COUNT(*) as total_pages FROM landing_pages;
SELECT id, title, slug, status FROM landing_pages ORDER BY created_at DESC LIMIT 5;

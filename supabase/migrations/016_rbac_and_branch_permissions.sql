-- ============================================================================
-- SMSTech BD: RBAC & Branch Permission Management Migration (016_rbac_and_branch_permissions.sql)
-- ============================================================================

-- 1. Create ROLES Table
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create PERMISSIONS Table
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    module TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create ROLE_PERMISSIONS Junction Table
CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_key TEXT NOT NULL REFERENCES roles(key) ON DELETE CASCADE,
    permission_code TEXT NOT NULL REFERENCES permissions(code) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(role_key, permission_code)
);

-- 4. Create USER_BRANCHES Junction Table (Multi-Branch Permission Mapping)
CREATE TABLE IF NOT EXISTS user_branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, warehouse_id)
);

-- 5. Extend USERS Table for Quick Branch & Role Scoping
ALTER TABLE users
ADD COLUMN IF NOT EXISTS default_branch_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_all_branches BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS custom_permissions TEXT[] DEFAULT ARRAY[]::TEXT[];

-- 6. Seed System Roles
INSERT INTO roles (key, name, description, is_system) VALUES
  ('owner', 'Superadmin / Owner', 'Full unrestricted access to all system modules, financial ledgers, and branches', true),
  ('admin', 'General Administrator', 'Operational administration across all modules, products, and fulfillment', true),
  ('branch_manager', 'Branch Manager', 'Full management over assigned branch operations, POS shifts, staff, and stock', true),
  ('cashier', 'Branch Cashier', 'Point of sale cashier, invoice billing, and payment collection at assigned branch', true),
  ('inventory_manager', 'Inventory Manager', 'Stock audits, serialized hardware devices, and inter-branch transfers', true),
  ('accountant', 'Accountant', 'Financial party ledgers, dues clearance, and sales revenue analytics', true),
  ('delivery_agent', 'Delivery Agent', 'Access to assigned shipments, order status updates, and courier dispatch', true),
  ('customer', 'Customer', 'Default storefront customer account', true)
ON CONFLICT (key) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description, is_system = EXCLUDED.is_system;

-- 7. Seed Granular Permissions
INSERT INTO permissions (code, name, description, module) VALUES
  -- Dashboard & Analytics
  ('dashboard:view', 'View Dashboard Overview', 'Access high-level sales and operational KPIs', 'Dashboard'),
  ('analytics:view', 'View Analytics Reports', 'Access sales analytics, profit margins, and customer insights', 'Analytics'),
  
  -- POS Terminal
  ('pos:access', 'Access POS Terminal', 'Open and operate the shop POS cash register', 'POS'),
  ('pos:shifts', 'Manage Cash Shifts', 'Open, reconcile, and close daily cash drawer shifts', 'POS'),
  ('pos:discounts', 'Apply Custom Discounts', 'Apply custom discounts and promo markdowns at POS checkout', 'POS'),
  ('pos:refund', 'Process POS Refunds', 'Issue cash or store credit refunds at POS checkout', 'POS'),
  
  -- Products Catalog
  ('products:view', 'View Products Catalog', 'Browse catalog items, pricing, and specifications', 'Products'),
  ('products:create', 'Create Products', 'Add new products and product variations to the catalog', 'Products'),
  ('products:edit', 'Edit Products', 'Update product information, pricing, images, and descriptions', 'Products'),
  ('products:delete', 'Delete Products', 'Remove or archive items from the product catalog', 'Products'),
  
  -- Inventory & Serialized Hardware
  ('inventory:view', 'View Inventory Stock', 'View stock levels across warehouses and branches', 'Inventory'),
  ('inventory:adjust', 'Adjust Stock Levels', 'Perform manual stock additions, subtractions, and damage write-offs', 'Inventory'),
  ('inventory:serials', 'Manage Serial Numbers & IMEIs', 'Add, scan, and audit serialized hardware units and battery health', 'Inventory'),
  ('inventory:transfers', 'Manage Branch Transfers', 'Initiate, dispatch, and receive inter-branch inventory transfers', 'Inventory'),
  ('inventory:procurement', 'Batch Procurement & Buyback', 'Record purchase batches and customer trade-in buybacks', 'Inventory'),
  
  -- Orders & Billing
  ('orders:view', 'View Store Orders', 'View all eCommerce and POS customer orders', 'Orders'),
  ('orders:create', 'Create Orders', 'Create manual orders on behalf of customers', 'Orders'),
  ('orders:edit_status', 'Update Order Status', 'Change order processing, packaging, and fulfillment statuses', 'Orders'),
  ('orders:cancel', 'Cancel Orders', 'Cancel orders and release reserved inventory', 'Orders'),
  ('orders:invoice', 'Print Invoices & Slips', 'Print thermal receipts, invoices, and packing slips', 'Orders'),
  
  -- Logistics & Courier
  ('courier:view', 'View Courier Logistics', 'Monitor shipping tracking and delivery dispatch statuses', 'Courier'),
  ('courier:manage', 'Send to Courier', 'Dispatch packages via Pathao, Steadfast, and internal drivers', 'Courier'),
  ('courier:settings', 'Configure Courier APIs', 'Manage API keys and courier warehouse settings', 'Courier'),
  
  -- Party Accounting & Customers
  ('customers:view', 'View Customers', 'Access customer profiles, purchase history, and contact details', 'Customers'),
  ('customers:edit', 'Edit Customer Profiles', 'Update customer credit limits, loyalty tiers, and notes', 'Customers'),
  ('accounting:view', 'View Accounting Ledgers', 'Inspect party ledgers, accounts receivable, and payables', 'Accounting'),
  ('accounting:manage', 'Manage Ledgers & Due Payments', 'Record payments, collections, advances, and manual adjustments', 'Accounting'),
  
  -- Marketing & Landing Pages
  ('marketing:coupons', 'Manage Coupons', 'Create and manage discount codes and promotional vouchers', 'Marketing'),
  ('marketing:landing', 'Manage Landing Pages', 'Build and publish drag-and-drop promotional landing pages', 'Marketing'),
  ('marketing:sliders', 'Manage Hero Sliders', 'Configure homepage banner carousels and promotional graphics', 'Marketing'),
  
  -- Administration & Security
  ('branches:manage', 'Manage Branch Locations', 'Add, rename, and configure branch warehouses and store pickup', 'Administration'),
  ('roles:manage', 'Manage Roles & Permissions', 'Create custom roles and customize permission matrices', 'Administration'),
  ('staff:manage', 'Manage Staff & Branch Assignments', 'Create staff accounts and assign branch access permissions', 'Administration'),
  ('settings:manage', 'Manage Store Settings', 'Configure general store settings, tax rates, and integrations', 'Administration')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description, module = EXCLUDED.module;

-- 8. Seed Default Role Permissions
-- A. Owner (All permissions)
INSERT INTO role_permissions (role_key, permission_code)
SELECT 'owner', code FROM permissions
ON CONFLICT DO NOTHING;

-- B. Admin (All operations except roles management)
INSERT INTO role_permissions (role_key, permission_code)
SELECT 'admin', code FROM permissions
WHERE code NOT IN ('roles:manage')
ON CONFLICT DO NOTHING;

-- C. Branch Manager
INSERT INTO role_permissions (role_key, permission_code)
VALUES 
  ('branch_manager', 'dashboard:view'),
  ('branch_manager', 'pos:access'),
  ('branch_manager', 'pos:shifts'),
  ('branch_manager', 'pos:discounts'),
  ('branch_manager', 'pos:refund'),
  ('branch_manager', 'products:view'),
  ('branch_manager', 'inventory:view'),
  ('branch_manager', 'inventory:adjust'),
  ('branch_manager', 'inventory:serials'),
  ('branch_manager', 'inventory:transfers'),
  ('branch_manager', 'orders:view'),
  ('branch_manager', 'orders:create'),
  ('branch_manager', 'orders:edit_status'),
  ('branch_manager', 'orders:invoice'),
  ('branch_manager', 'customers:view'),
  ('branch_manager', 'customers:edit'),
  ('branch_manager', 'accounting:view'),
  ('branch_manager', 'accounting:manage')
ON CONFLICT DO NOTHING;

-- D. Cashier
INSERT INTO role_permissions (role_key, permission_code)
VALUES 
  ('cashier', 'pos:access'),
  ('cashier', 'pos:shifts'),
  ('cashier', 'products:view'),
  ('cashier', 'inventory:view'),
  ('cashier', 'orders:view'),
  ('cashier', 'orders:create'),
  ('cashier', 'orders:invoice'),
  ('cashier', 'customers:view')
ON CONFLICT DO NOTHING;

-- E. Inventory Manager
INSERT INTO role_permissions (role_key, permission_code)
VALUES 
  ('inventory_manager', 'products:view'),
  ('inventory_manager', 'products:create'),
  ('inventory_manager', 'products:edit'),
  ('inventory_manager', 'inventory:view'),
  ('inventory_manager', 'inventory:adjust'),
  ('inventory_manager', 'inventory:serials'),
  ('inventory_manager', 'inventory:transfers'),
  ('inventory_manager', 'inventory:procurement'),
  ('inventory_manager', 'orders:view'),
  ('inventory_manager', 'orders:invoice')
ON CONFLICT DO NOTHING;

-- F. Accountant
INSERT INTO role_permissions (role_key, permission_code)
VALUES 
  ('accountant', 'dashboard:view'),
  ('accountant', 'analytics:view'),
  ('accountant', 'orders:view'),
  ('accountant', 'customers:view'),
  ('accountant', 'accounting:view'),
  ('accountant', 'accounting:manage')
ON CONFLICT DO NOTHING;

-- G. Delivery Agent
INSERT INTO role_permissions (role_key, permission_code)
VALUES 
  ('delivery_agent', 'orders:view'),
  ('delivery_agent', 'orders:edit_status'),
  ('delivery_agent', 'courier:view')
ON CONFLICT DO NOTHING;

-- 9. Ensure Superadmin has is_all_branches = true
UPDATE users
SET is_all_branches = true, role = 'owner'
WHERE email = 'superadmin@smstechbd.com' OR role = 'owner';

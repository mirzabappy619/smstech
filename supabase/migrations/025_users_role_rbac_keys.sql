-- ============================================================================
-- SMSTech BD: Align users.role with the RBAC role keys (025)
-- ============================================================================
-- users.role was created with a four-value CHECK (customer/admin/owner/staff)
-- in 000, but 016 introduced the granular role catalog the whole admin panel
-- reads from — branch_manager, cashier, inventory_manager, accountant,
-- delivery_agent. Creating any of those staff accounts fails on the old
-- constraint, so the check now follows the roles table it is meant to mirror.

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (
    role IN (
        'owner',
        'admin',
        'branch_manager',
        'cashier',
        'inventory_manager',
        'accountant',
        'delivery_agent',
        'staff',
        'customer'
    )
);

-- Staff seeded while the old constraint was in force landed on 'staff' with
-- their real role parked in metadata. Promote them now that it is allowed.
UPDATE users
SET role = metadata->>'rbac_role'
WHERE role = 'staff'
  AND metadata->>'rbac_role' IS NOT NULL
  AND metadata->>'rbac_role' IN (
      'branch_manager', 'cashier', 'inventory_manager', 'accountant', 'delivery_agent'
  );

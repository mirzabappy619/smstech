-- ============================================================================
-- PENDING MIGRATIONS 022 + 023 — paste into the Supabase SQL editor and run.
-- ============================================================================
-- Verified missing from the live database on 2026-09-04:
--   022  products.is_preorder / preorder_release_date / preorder_deposit_pct
--        -> without these, POST /api/v1/orders 500s and NO storefront order
--           is ever created.
--   023  cash_close_approvals, approval_pipelines, approval_pipeline_nodes,
--        cash_close_approval_actions  -> /admin/approvals cannot work.
--
-- Every statement is guarded (IF NOT EXISTS / DO $$), so this is safe to
-- re-run and safe if part of it was already applied.
-- ============================================================================

BEGIN;

-- ─────────────── 022_product_preorder.sql ───────────────
-- ============================================================================
-- PRODUCT-LEVEL PRE-ORDER MODE (022)
-- ============================================================================
-- The pre-booking engine (pre_bookings + /admin/pre-bookings) already handles
-- deposits, queue priority and serial allocation, but nothing marked a product
-- as pre-order: the storefront showed "Pre-Book with Deposit" on every product
-- alongside Add to Cart, and the deposit was hardcoded at 10% in the page.
--
-- These columns make pre-order an explicit per-product setting:
--   is_preorder            - hides Add to Cart / Buy Now, pre-booking only
--   preorder_release_date  - optional expected availability date (display only)
--   preorder_deposit_pct   - deposit required to join the queue, default 10%
--
-- Safe to re-run: every statement is guarded.
-- ============================================================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS is_preorder BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS preorder_release_date DATE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS preorder_deposit_pct NUMERIC(5, 2) NOT NULL DEFAULT 10;

-- Deposit is a percentage of the line price; 0 would let anyone hold a queue
-- slot for free, so require a real deposit up to full prepayment.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'products_preorder_deposit_pct_check'
    ) THEN
        ALTER TABLE products ADD CONSTRAINT products_preorder_deposit_pct_check
            CHECK (preorder_deposit_pct > 0 AND preorder_deposit_pct <= 100);
    END IF;
END $$;

-- Storefront and admin both filter on "which products are pre-order"; the flag
-- is false for most rows, so a partial index stays small.
CREATE INDEX IF NOT EXISTS idx_products_is_preorder
    ON products (is_preorder) WHERE is_preorder;

-- ─────────────── 023_cash_close_approval_pipeline.sql ───────────────
-- ============================================================================
-- CASH CLOSE APPROVAL PIPELINE + RBAC HARDENING (023)
-- ============================================================================
-- Closing a POS shift used to write status='closed' straight away with no
-- review. Cash variance is the one number in the system nobody should be able
-- to sign off on alone, so a close now becomes an approval request that walks
-- a configurable chain of approvers.
--
-- Model:
--   approval_pipelines        - a named chain, global or scoped to one branch
--   approval_pipeline_nodes   - ordered steps; each step is either a ROLE
--                               (anyone holding it with access to the branch)
--                               or one NAMED USER
--   cash_close_approvals      - one request per shift close, tracking which
--                               step it currently sits on
--   cash_close_approval_actions - immutable log of every approve/reject
--
-- The last node of every pipeline must be the owner (superadmin) role. That is
-- enforced by a trigger below, not just in the API, so the tree cannot be
-- topped by anyone else even through direct SQL.
--
-- Safe to re-run: every statement is guarded.
-- ============================================================================

-- ─── 1. New permissions ─────────────────────────────────────────────────────

INSERT INTO permissions (code, name, description, module) VALUES
  ('approvals:view', 'View Approval Queue', 'See cash close approval requests awaiting action', 'Accounting'),
  ('approvals:act', 'Approve / Reject Requests', 'Act on approval steps you are an assigned approver for', 'Accounting'),
  ('approvals:manage', 'Configure Approval Pipelines', 'Create and edit the approval chains cash closes are routed through', 'Administration')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description, module = EXCLUDED.module;

-- Grant them to roles that already have DB-backed permission rows. Roles still
-- running on the in-code defaults pick these up from permissions.ts instead.
INSERT INTO role_permissions (role_key, permission_code)
SELECT r.role_key, p.code
FROM (SELECT DISTINCT role_key FROM role_permissions) r
CROSS JOIN (VALUES ('approvals:view'), ('approvals:act')) AS p(code)
WHERE r.role_key IN ('owner', 'admin', 'branch_manager', 'accountant')
ON CONFLICT (role_key, permission_code) DO NOTHING;

INSERT INTO role_permissions (role_key, permission_code)
SELECT r.role_key, 'approvals:manage'
FROM (SELECT DISTINCT role_key FROM role_permissions) r
WHERE r.role_key IN ('owner', 'admin')
ON CONFLICT (role_key, permission_code) DO NOTHING;

-- ─── 2. Pipelines ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS approval_pipelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    -- Only cash_close today; the column keeps the table reusable for the next
    -- thing that needs sign-off (refunds, write-offs) without a rename.
    type TEXT NOT NULL DEFAULT 'cash_close',
    -- NULL = applies to every branch that has no pipeline of its own.
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- At most one active pipeline per (type, branch), and one active global
-- fallback per type. Resolution is therefore never ambiguous.
CREATE UNIQUE INDEX IF NOT EXISTS idx_approval_pipelines_one_active_per_branch
    ON approval_pipelines (type, warehouse_id) WHERE is_active AND warehouse_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_approval_pipelines_one_active_global
    ON approval_pipelines (type) WHERE is_active AND warehouse_id IS NULL;

CREATE TABLE IF NOT EXISTS approval_pipeline_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id UUID NOT NULL REFERENCES approval_pipelines(id) ON DELETE CASCADE,
    step_order INT NOT NULL,
    name TEXT NOT NULL,
    -- Exactly one of these is set: a role anyone can satisfy, or one person.
    approver_role TEXT REFERENCES roles(key) ON DELETE RESTRICT,
    approver_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    -- Steps below this variance are skipped; 0 means the step always runs.
    min_variance_abs DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (pipeline_id, step_order),
    CONSTRAINT approval_node_single_approver CHECK (
        (approver_role IS NOT NULL AND approver_user_id IS NULL)
     OR (approver_role IS NULL AND approver_user_id IS NOT NULL)
    ),
    CONSTRAINT approval_node_variance_nonneg CHECK (min_variance_abs >= 0)
);

CREATE INDEX IF NOT EXISTS idx_approval_nodes_pipeline
    ON approval_pipeline_nodes (pipeline_id, step_order);

-- ─── 3. Superadmin must top every tree ──────────────────────────────────────

CREATE OR REPLACE FUNCTION assert_owner_tops_pipeline()
RETURNS TRIGGER AS $$
DECLARE
    v_pipeline UUID;
    v_top_role TEXT;
    v_node_count INT;
BEGIN
    -- NEW is unassigned on DELETE, so pick the record by operation rather
    -- than COALESCE-ing across both.
    IF TG_OP = 'DELETE' THEN
        v_pipeline := OLD.pipeline_id;
    ELSE
        v_pipeline := NEW.pipeline_id;
    END IF;

    SELECT COUNT(*) INTO v_node_count
    FROM approval_pipeline_nodes WHERE pipeline_id = v_pipeline;

    -- An empty pipeline is a pipeline mid-rebuild, not a violation.
    IF v_node_count = 0 THEN
        RETURN NULL;
    END IF;

    SELECT approver_role INTO v_top_role
    FROM approval_pipeline_nodes
    WHERE pipeline_id = v_pipeline
    ORDER BY step_order DESC
    LIMIT 1;

    IF v_top_role IS DISTINCT FROM 'owner' THEN
        RAISE EXCEPTION
            'The final step of an approval pipeline must be the owner (superadmin) role';
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assert_owner_tops_pipeline ON approval_pipeline_nodes;
-- Deferred to statement end so a multi-row rebuild is judged on its final state
-- rather than rejected halfway through.
CREATE CONSTRAINT TRIGGER trg_assert_owner_tops_pipeline
    AFTER INSERT OR UPDATE OR DELETE ON approval_pipeline_nodes
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION assert_owner_tops_pipeline();

-- ─── 4. Cash close requests ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cash_close_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_number TEXT UNIQUE NOT NULL,
    shift_id UUID NOT NULL REFERENCES pos_shifts(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    pipeline_id UUID REFERENCES approval_pipelines(id) ON DELETE SET NULL,
    -- Figures frozen at submission so later edits cannot rewrite what was approved.
    closing_cash_expected DECIMAL(12,2) NOT NULL,
    closing_cash_actual DECIMAL(12,2) NOT NULL,
    difference DECIMAL(12,2) NOT NULL,
    submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_node_id UUID REFERENCES approval_pipeline_nodes(id) ON DELETE SET NULL,
    current_step INT NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
    resolved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- One live request per shift; a rejected one can be superseded by a re-submit.
CREATE UNIQUE INDEX IF NOT EXISTS idx_cash_close_one_pending_per_shift
    ON cash_close_approvals (shift_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_cash_close_status ON cash_close_approvals (status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_close_warehouse ON cash_close_approvals (warehouse_id);

CREATE TABLE IF NOT EXISTS cash_close_approval_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    approval_id UUID NOT NULL REFERENCES cash_close_approvals(id) ON DELETE CASCADE,
    node_id UUID REFERENCES approval_pipeline_nodes(id) ON DELETE SET NULL,
    step_order INT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('approved', 'rejected')),
    acted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    acted_by_role TEXT,
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_close_actions_approval
    ON cash_close_approval_actions (approval_id, step_order);

-- ─── 5. Shift status gains the pending state ────────────────────────────────

ALTER TABLE pos_shifts ADD COLUMN IF NOT EXISTS closed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE pos_shifts ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

DO $$
BEGIN
    ALTER TABLE pos_shifts DROP CONSTRAINT IF EXISTS pos_shifts_status_check;
    ALTER TABLE pos_shifts ADD CONSTRAINT pos_shifts_status_check
        CHECK (status IN ('open', 'pending_approval', 'closed', 'rejected'));
END $$;

-- The register is free for the next cashier as soon as the drawer is counted:
-- the one-open-shift index only covers status='open', so a shift waiting on
-- approval never blocks the branch from trading.

-- ─── 6. RLS ─────────────────────────────────────────────────────────────────
-- Every read and write goes through admin API routes that run requirePermission
-- with the service role, so these tables are closed to the anon/authenticated
-- keys entirely rather than carrying permissive policies.

ALTER TABLE approval_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_pipeline_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_close_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_close_approval_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages approval_pipelines" ON approval_pipelines;
CREATE POLICY "Service role manages approval_pipelines" ON approval_pipelines
    FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages approval_pipeline_nodes" ON approval_pipeline_nodes;
CREATE POLICY "Service role manages approval_pipeline_nodes" ON approval_pipeline_nodes
    FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages cash_close_approvals" ON cash_close_approvals;
CREATE POLICY "Service role manages cash_close_approvals" ON cash_close_approvals
    FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages cash_close_approval_actions" ON cash_close_approval_actions;
CREATE POLICY "Service role manages cash_close_approval_actions" ON cash_close_approval_actions
    FOR ALL TO service_role USING (true) WITH CHECK (true);
-- ─── 7. Default pipeline ────────────────────────────────────────────────────
-- Branch Manager, then Superadmin. Global (every branch) until someone builds
-- a branch-specific chain in /admin/approvals/pipelines.

DO $$
DECLARE
    v_pipeline UUID;
BEGIN
    SELECT id INTO v_pipeline FROM approval_pipelines
    WHERE type = 'cash_close' AND warehouse_id IS NULL AND is_active;

    IF v_pipeline IS NULL THEN
        INSERT INTO approval_pipelines (name, description, type, warehouse_id)
        VALUES (
            'Default Cash Close Approval',
            'Branch manager reviews the drawer count, superadmin signs off.',
            'cash_close',
            NULL
        )
        RETURNING id INTO v_pipeline;

        INSERT INTO approval_pipeline_nodes (pipeline_id, step_order, name, approver_role)
        VALUES
            (v_pipeline, 1, 'Branch Manager Review', 'branch_manager'),
            (v_pipeline, 2, 'Superadmin Sign-off', 'owner');
    END IF;
END $$;


COMMIT;

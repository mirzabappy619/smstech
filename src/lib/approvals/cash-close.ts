// ============================================================================
// Cash Close Approval Pipeline
// ============================================================================
// A POS shift close does not finalise on its own. It creates a request that
// walks an ordered chain of approver nodes, resolved per branch. The chain
// always ends at the owner (superadmin) role — enforced both here and by a
// database trigger (migration 023).
// ============================================================================

import type { ResolvedUserRBAC } from "@/lib/rbac/rbac-service";
import { hasBranchAccess } from "@/lib/rbac/rbac-service";

export const OWNER_ROLE = "owner";

export interface PipelineNode {
	id: string;
	pipeline_id: string;
	step_order: number;
	name: string;
	approver_role: string | null;
	approver_user_id: string | null;
	min_variance_abs: number;
}

export interface Pipeline {
	id: string;
	name: string;
	description: string | null;
	type: string;
	warehouse_id: string | null;
	is_active: boolean;
	nodes: PipelineNode[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = any;

/**
 * The pipeline a branch's cash closes run through: its own if it has one,
 * otherwise the global chain. Nodes come back in step order.
 */
export async function resolvePipeline(
	supabase: Supabase,
	warehouseId: string,
	type = "cash_close",
): Promise<Pipeline | null> {
	const { data: pipelines } = await supabase
		.from("approval_pipelines")
		.select("*, nodes:approval_pipeline_nodes(*)")
		.eq("type", type)
		.eq("is_active", true)
		.or(`warehouse_id.eq.${warehouseId},warehouse_id.is.null`);

	if (!pipelines || pipelines.length === 0) return null;

	// A branch-specific chain wins over the global fallback.
	const chosen =
		pipelines.find((p: Pipeline) => p.warehouse_id === warehouseId) ??
		pipelines.find((p: Pipeline) => p.warehouse_id === null);

	if (!chosen) return null;

	const nodes = [...(chosen.nodes || [])].sort(
		(a: PipelineNode, b: PipelineNode) => a.step_order - b.step_order,
	);

	return { ...chosen, nodes };
}

/**
 * Steps carrying a variance threshold are skipped when the drawer came in
 * closer than that, so a balanced till does not need the whole chain.
 */
export function nodeApplies(node: PipelineNode, difference: number): boolean {
	const threshold = Number(node.min_variance_abs) || 0;
	if (threshold <= 0) return true;
	return Math.abs(difference) >= threshold;
}

/** First step a request with this variance should land on. */
export function firstApplicableNode(
	nodes: PipelineNode[],
	difference: number,
): PipelineNode | null {
	return nodes.find((n) => nodeApplies(n, difference)) ?? null;
}

/** Next step after `afterStep`, skipping ones the variance does not trigger. */
export function nextApplicableNode(
	nodes: PipelineNode[],
	afterStep: number,
	difference: number,
): PipelineNode | null {
	return (
		nodes.find((n) => n.step_order > afterStep && nodeApplies(n, difference)) ??
		null
	);
}

/**
 * Whether this user may approve or reject at this node.
 *
 * Named-user nodes accept only that person. Role nodes accept anyone holding
 * the role who also has access to the shift's branch — a Dhaka manager cannot
 * sign off a Chattogram drawer. Owners may act at any step; the action log
 * records who acted and under which role, so an override stays visible.
 */
export function canActOnNode(
	user: ResolvedUserRBAC,
	node: PipelineNode,
	warehouseId: string,
): boolean {
	if (!node) return false;

	if (!user.isOwner && !hasBranchAccess(user.branchContext, warehouseId)) {
		return false;
	}

	if (node.approver_user_id) {
		return user.isOwner || user.userId === node.approver_user_id;
	}

	if (node.approver_role) {
		return user.isOwner || user.role === node.approver_role;
	}

	return false;
}

/**
 * Validates a pipeline's node list before it is saved.
 * Returns an error message, or null when the shape is legal.
 */
export function validateNodeList(
	nodes: { approver_role?: string | null; approver_user_id?: string | null }[],
): string | null {
	if (!nodes || nodes.length === 0) {
		return "A pipeline needs at least one approval step.";
	}

	for (const [i, node] of nodes.entries()) {
		const hasRole = !!node.approver_role;
		const hasUser = !!node.approver_user_id;
		if (hasRole === hasUser) {
			return `Step ${i + 1} must name either a role or a specific user, not both.`;
		}
	}

	const top = nodes[nodes.length - 1];
	if (top.approver_role !== OWNER_ROLE) {
		return "The final step must be the Superadmin / Owner role.";
	}

	// An owner step anywhere but the top would let the chain end early.
	const earlyOwner = nodes
		.slice(0, -1)
		.some((n) => n.approver_role === OWNER_ROLE);
	if (earlyOwner) {
		return "The Superadmin / Owner role can only be the final step.";
	}

	return null;
}

/**
 * Tests for the cash close approval chain.
 *
 * The rules that matter here are the ones that decide who is allowed to sign
 * off money: branch scoping, named-approver steps, and the guarantee that a
 * chain cannot end anywhere but the superadmin.
 */
import { describe, it, expect } from "vitest";
import {
	canActOnNode,
	firstApplicableNode,
	nextApplicableNode,
	nodeApplies,
	validateNodeList,
	type PipelineNode,
} from "@/lib/approvals/cash-close";
import type { ResolvedUserRBAC } from "@/lib/rbac/rbac-service";

const DHAKA = "11111111-1111-1111-1111-111111111111";
const CHATTOGRAM = "22222222-2222-2222-2222-222222222222";

const node = (over: Partial<PipelineNode> = {}): PipelineNode => ({
	id: "node-1",
	pipeline_id: "pipe-1",
	step_order: 1,
	name: "Branch Manager Review",
	approver_role: "branch_manager",
	approver_user_id: null,
	min_variance_abs: 0,
	...over,
});

const user = (over: Partial<ResolvedUserRBAC> = {}): ResolvedUserRBAC =>
	({
		userId: "user-1",
		authId: "auth-1",
		email: "manager@smstech.test",
		fullName: "Branch Manager",
		role: "branch_manager",
		roleName: "Branch Manager",
		isOwner: false,
		isAdmin: false,
		permissions: ["approvals:view", "approvals:act"],
		branchContext: {
			isAllBranches: false,
			defaultBranchId: DHAKA,
			branches: [],
			branchIds: [DHAKA],
		},
		...over,
	}) as ResolvedUserRBAC;

describe("who may act on a step", () => {
	it("lets a role holder approve at their own branch", () => {
		expect(canActOnNode(user(), node(), DHAKA)).toBe(true);
	});

	it("refuses a manager from another branch", () => {
		// The whole point of branch scoping: a Dhaka manager must not sign off
		// a Chattogram drawer just because they hold the role.
		expect(canActOnNode(user(), node(), CHATTOGRAM)).toBe(false);
	});

	it("refuses a role holder whose role does not match the step", () => {
		expect(
			canActOnNode(user({ role: "cashier" }), node(), DHAKA),
		).toBe(false);
	});

	it("lets the owner act at any step and any branch", () => {
		const owner = user({
			role: "owner",
			isOwner: true,
			branchContext: {
				isAllBranches: true,
				defaultBranchId: null,
				branches: [],
				branchIds: [],
			},
		});
		expect(canActOnNode(owner, node(), CHATTOGRAM)).toBe(true);
	});

	it("binds a named-user step to that one person", () => {
		const named = node({ approver_role: null, approver_user_id: "user-9" });
		expect(canActOnNode(user({ userId: "user-9" }), named, DHAKA)).toBe(true);
		expect(canActOnNode(user({ userId: "user-1" }), named, DHAKA)).toBe(false);
	});

	it("refuses a node with neither a role nor a user", () => {
		const empty = node({ approver_role: null, approver_user_id: null });
		expect(canActOnNode(user(), empty, DHAKA)).toBe(false);
	});
});

describe("variance thresholds", () => {
	const chain: PipelineNode[] = [
		node({ id: "n1", step_order: 1, min_variance_abs: 0 }),
		node({ id: "n2", step_order: 2, approver_role: "accountant", min_variance_abs: 500 }),
		node({ id: "n3", step_order: 3, approver_role: "owner", min_variance_abs: 0 }),
	];

	it("always runs a step with no threshold", () => {
		expect(nodeApplies(node({ min_variance_abs: 0 }), 0)).toBe(true);
	});

	it("skips a threshold step when the drawer is close enough", () => {
		expect(nodeApplies(chain[1], 100)).toBe(false);
		expect(nextApplicableNode(chain, 1, 100)?.id).toBe("n3");
	});

	it("runs a threshold step once the variance reaches it", () => {
		expect(nodeApplies(chain[1], -500)).toBe(true);
		expect(nextApplicableNode(chain, 1, -500)?.id).toBe("n2");
	});

	it("measures variance by magnitude, so a short drawer counts like an over one", () => {
		expect(nodeApplies(chain[1], -900)).toBe(true);
		expect(nodeApplies(chain[1], 900)).toBe(true);
	});

	it("starts a balanced close on the first unconditional step", () => {
		expect(firstApplicableNode(chain, 0)?.id).toBe("n1");
	});

	it("returns null past the end of the chain, which is what closes the shift", () => {
		expect(nextApplicableNode(chain, 3, 5000)).toBeNull();
	});
});

describe("pipeline shape", () => {
	it("requires at least one step", () => {
		expect(validateNodeList([])).toMatch(/at least one/i);
	});

	it("requires the owner at the top", () => {
		expect(
			validateNodeList([{ approver_role: "branch_manager" }]),
		).toMatch(/final step must be the Superadmin/i);
	});

	it("rejects an owner step anywhere but the top", () => {
		// An early owner step would let the chain be signed off before the
		// steps below it ever ran.
		expect(
			validateNodeList([
				{ approver_role: "owner" },
				{ approver_role: "branch_manager" },
				{ approver_role: "owner" },
			]),
		).toMatch(/only be the final step/i);
	});

	it("rejects a step naming both a role and a user", () => {
		expect(
			validateNodeList([
				{ approver_role: "branch_manager", approver_user_id: "user-9" },
				{ approver_role: "owner" },
			]),
		).toMatch(/either a role or a specific user/i);
	});

	it("rejects a step naming neither", () => {
		expect(
			validateNodeList([{}, { approver_role: "owner" }]),
		).toMatch(/either a role or a specific user/i);
	});

	it("accepts a long chain that ends at the owner", () => {
		expect(
			validateNodeList([
				{ approver_role: "cashier" },
				{ approver_role: "branch_manager" },
				{ approver_user_id: "user-9" },
				{ approver_role: "accountant" },
				{ approver_role: "owner" },
			]),
		).toBeNull();
	});
});

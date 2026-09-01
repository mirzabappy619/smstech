import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { requirePermission, hasBranchAccess } from "@/lib/rbac/rbac-service";
import {
	resolvePipeline,
	canActOnNode,
	nextApplicableNode,
	type PipelineNode,
} from "@/lib/approvals/cash-close";

/**
 * GET /api/v1/admin/approvals
 *
 * The cash close queue, scoped to the branches the caller can see. Each row
 * carries `can_act`, so the UI never offers a button the API would reject.
 */
export async function GET(request: NextRequest) {
	try {
		const auth = await requirePermission(request, "approvals:view");
		if (auth.error) return auth.error;
		const { userRBAC } = auth;

		const { searchParams } = new URL(request.url);
		const status = searchParams.get("status") || "pending";
		const warehouseId = searchParams.get("warehouse_id");

		const supabase = await createAdminClient();

		let query = supabase
			.from("cash_close_approvals")
			.select(
				`*,
				warehouses (id, name, code),
				pos_shifts (id, shift_number, opening_float, cash_sales_total, dues_collected_total, opened_at, closed_at),
				pipeline:approval_pipelines (id, name),
				current_node:approval_pipeline_nodes!cash_close_approvals_current_node_id_fkey (id, step_order, name, approver_role, approver_user_id),
				actions:cash_close_approval_actions (id, step_order, action, acted_by, acted_by_role, comment, created_at)`,
			)
			.order("submitted_at", { ascending: false })
			.limit(100);

		if (status !== "all") query = query.eq("status", status);

		if (warehouseId) {
			if (!hasBranchAccess(userRBAC.branchContext, warehouseId)) {
				return NextResponse.json(
					{ success: false, error: "You do not have access to this branch." },
					{ status: 403 },
				);
			}
			query = query.eq("warehouse_id", warehouseId);
		} else if (!userRBAC.branchContext.isAllBranches) {
			query = query.in("warehouse_id", userRBAC.branchContext.branchIds);
		}

		const { data: approvals, error } = await query;
		if (error) throw error;

		const canAct = userRBAC.permissions.includes("approvals:act");

		const enriched = (approvals || []).map(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(a: any) => ({
				...a,
				actions: [...(a.actions || [])].sort(
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					(x: any, y: any) => x.step_order - y.step_order,
				),
				can_act:
					canAct &&
					a.status === "pending" &&
					!!a.current_node &&
					canActOnNode(userRBAC, a.current_node as PipelineNode, a.warehouse_id),
			}),
		);

		return NextResponse.json({ success: true, data: enriched });
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		return NextResponse.json({ success: false, error: message }, { status: 500 });
	}
}

/**
 * POST /api/v1/admin/approvals
 * Body: { approval_id, action: "approve" | "reject", comment? }
 *
 * Advances the request to the next applicable node. When the chain runs out —
 * the owner step having signed off — the shift itself is finally closed.
 */
export async function POST(request: NextRequest) {
	try {
		const auth = await requirePermission(request, "approvals:act");
		if (auth.error) return auth.error;
		const { userRBAC } = auth;

		const body = await request.json();
		const { approval_id, action, comment } = body;

		if (!approval_id || !["approve", "reject"].includes(action)) {
			return NextResponse.json(
				{ success: false, error: "approval_id and a valid action are required." },
				{ status: 400 },
			);
		}

		if (action === "reject" && !comment?.trim()) {
			return NextResponse.json(
				{ success: false, error: "A reason is required when rejecting a cash close." },
				{ status: 400 },
			);
		}

		const supabase = await createAdminClient();

		const { data: approval, error: fetchErr } = await supabase
			.from("cash_close_approvals")
			.select("*")
			.eq("id", approval_id)
			.single();

		if (fetchErr || !approval) {
			return NextResponse.json(
				{ success: false, error: "Approval request not found." },
				{ status: 404 },
			);
		}

		if (approval.status !== "pending") {
			return NextResponse.json(
				{ success: false, error: `This request was already ${approval.status}.` },
				{ status: 409 },
			);
		}

		const pipeline = await resolvePipeline(supabase, approval.warehouse_id);
		if (!pipeline) {
			return NextResponse.json(
				{ success: false, error: "The approval pipeline for this branch no longer exists." },
				{ status: 409 },
			);
		}

		const currentNode = pipeline.nodes.find(
			(n) => n.id === approval.current_node_id,
		);
		if (!currentNode) {
			return NextResponse.json(
				{
					success: false,
					error:
						"The step this request is sitting on was removed from the pipeline. An administrator must re-route it.",
				},
				{ status: 409 },
			);
		}

		if (!canActOnNode(userRBAC, currentNode, approval.warehouse_id)) {
			return NextResponse.json(
				{
					success: false,
					error: `This request is awaiting "${currentNode.name}". You are not an approver for that step.`,
				},
				{ status: 403 },
			);
		}

		// Log the action first: the audit trail records the attempt regardless of
		// what the request does next.
		await supabase.from("cash_close_approval_actions").insert({
			approval_id,
			node_id: currentNode.id,
			step_order: currentNode.step_order,
			action: action === "approve" ? "approved" : "rejected",
			acted_by: userRBAC.userId,
			acted_by_role: userRBAC.role,
			comment: comment || null,
		});

		const now = new Date().toISOString();

		if (action === "reject") {
			const { data: rejected } = await supabase
				.from("cash_close_approvals")
				.update({
					status: "rejected",
					rejection_reason: comment,
					resolved_at: now,
					updated_at: now,
				})
				.eq("id", approval_id)
				.eq("status", "pending")
				.select()
				.single();

			await supabase
				.from("pos_shifts")
				.update({ status: "rejected" })
				.eq("id", approval.shift_id);

			return NextResponse.json({
				success: true,
				data: rejected,
				message: "Cash close rejected. The branch can recount and resubmit.",
			});
		}

		const next = nextApplicableNode(
			pipeline.nodes,
			currentNode.step_order,
			Number(approval.difference) || 0,
		);

		if (next) {
			const { data: advanced } = await supabase
				.from("cash_close_approvals")
				.update({
					current_node_id: next.id,
					current_step: next.step_order,
					updated_at: now,
				})
				.eq("id", approval_id)
				.eq("status", "pending")
				.select()
				.single();

			return NextResponse.json({
				success: true,
				data: advanced,
				message: `Approved. Now awaiting: ${next.name}.`,
			});
		}

		// Final node signed off — the shift is closed for good.
		const { data: approved } = await supabase
			.from("cash_close_approvals")
			.update({
				status: "approved",
				current_node_id: null,
				resolved_at: now,
				updated_at: now,
			})
			.eq("id", approval_id)
			.eq("status", "pending")
			.select()
			.single();

		await supabase
			.from("pos_shifts")
			.update({ status: "closed", approved_at: now })
			.eq("id", approval.shift_id);

		return NextResponse.json({
			success: true,
			data: approved,
			message: "Fully approved. The shift is now closed.",
		});
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		return NextResponse.json({ success: false, error: message }, { status: 500 });
	}
}

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/rbac/rbac-service";
import { validateNodeList } from "@/lib/approvals/cash-close";

interface NodeInput {
	name?: string;
	approver_role?: string | null;
	approver_user_id?: string | null;
	min_variance_abs?: number | string | null;
}

/** GET /api/v1/admin/approvals/pipelines — every configured chain. */
export async function GET(request: NextRequest) {
	try {
		const auth = await requirePermission(request, "approvals:manage");
		if (auth.error) return auth.error;

		const supabase = await createAdminClient();

		const { data: pipelines, error } = await supabase
			.from("approval_pipelines")
			.select("*, warehouses (id, name, code), nodes:approval_pipeline_nodes(*)")
			.order("created_at", { ascending: true });

		if (error) throw error;

		const sorted = (pipelines || []).map(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(p: any) => ({
				...p,
				nodes: [...(p.nodes || [])].sort(
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					(a: any, b: any) => a.step_order - b.step_order,
				),
			}),
		);

		return NextResponse.json({ success: true, data: sorted });
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		return NextResponse.json({ success: false, error: message }, { status: 500 });
	}
}

/**
 * POST /api/v1/admin/approvals/pipelines
 * Creates a chain, or replaces the nodes of an existing one when `id` is given.
 *
 * Nodes arrive as an ordered array; step_order is assigned from position so the
 * caller never has to keep the numbering consistent itself.
 */
export async function POST(request: NextRequest) {
	try {
		const auth = await requirePermission(request, "approvals:manage");
		if (auth.error) return auth.error;

		const body = await request.json();
		const { id, name, description, warehouse_id, is_active, nodes } = body;

		if (!name?.trim()) {
			return NextResponse.json(
				{ success: false, error: "Give the pipeline a name." },
				{ status: 400 },
			);
		}

		const nodeList: NodeInput[] = Array.isArray(nodes) ? nodes : [];
		const invalid = validateNodeList(nodeList);
		if (invalid) {
			return NextResponse.json({ success: false, error: invalid }, { status: 400 });
		}

		const supabase = await createAdminClient();

		const pipelineFields = {
			name: name.trim(),
			description: description?.trim() || null,
			type: "cash_close",
			warehouse_id: warehouse_id || null,
			is_active: is_active !== false,
			updated_at: new Date().toISOString(),
		};

		let pipelineId = id as string | undefined;

		if (pipelineId) {
			const { error: updateErr } = await supabase
				.from("approval_pipelines")
				.update(pipelineFields)
				.eq("id", pipelineId);
			if (updateErr) throw updateErr;
		} else {
			const { data: created, error: insertErr } = await supabase
				.from("approval_pipelines")
				.insert(pipelineFields)
				.select()
				.single();
			if (insertErr) {
				if (insertErr.code === "23505") {
					return NextResponse.json(
						{
							success: false,
							error: warehouse_id
								? "That branch already has an active cash close pipeline."
								: "An active global cash close pipeline already exists.",
						},
						{ status: 409 },
					);
				}
				throw insertErr;
			}
			pipelineId = created.id;
		}

		// Replace the node list wholesale. The owner-tops-the-tree trigger is
		// deferred to commit, so the delete-then-insert is judged on the result.
		const { error: deleteErr } = await supabase
			.from("approval_pipeline_nodes")
			.delete()
			.eq("pipeline_id", pipelineId);
		if (deleteErr) throw deleteErr;

		const rows = nodeList.map((n, i) => ({
			pipeline_id: pipelineId,
			step_order: i + 1,
			name: n.name?.trim() || `Step ${i + 1}`,
			approver_role: n.approver_role || null,
			approver_user_id: n.approver_user_id || null,
			min_variance_abs: Number(n.min_variance_abs) || 0,
		}));

		const { error: nodesErr } = await supabase
			.from("approval_pipeline_nodes")
			.insert(rows);
		if (nodesErr) throw nodesErr;

		const { data: full } = await supabase
			.from("approval_pipelines")
			.select("*, warehouses (id, name, code), nodes:approval_pipeline_nodes(*)")
			.eq("id", pipelineId)
			.single();

		return NextResponse.json({ success: true, data: full });
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		return NextResponse.json({ success: false, error: message }, { status: 500 });
	}
}

/** DELETE /api/v1/admin/approvals/pipelines?id=... */
export async function DELETE(request: NextRequest) {
	try {
		const auth = await requirePermission(request, "approvals:manage");
		if (auth.error) return auth.error;

		const { searchParams } = new URL(request.url);
		const id = searchParams.get("id");
		if (!id) {
			return NextResponse.json(
				{ success: false, error: "id is required" },
				{ status: 400 },
			);
		}

		const supabase = await createAdminClient();

		// Requests still in flight reference this chain; deleting it would strand
		// them on a step that no longer exists.
		const { count } = await supabase
			.from("cash_close_approvals")
			.select("id", { count: "exact", head: true })
			.eq("pipeline_id", id)
			.eq("status", "pending");

		if ((count || 0) > 0) {
			return NextResponse.json(
				{
					success: false,
					error: `${count} cash close request(s) are still moving through this pipeline. Resolve them first, or deactivate the pipeline instead.`,
				},
				{ status: 409 },
			);
		}

		const { error } = await supabase
			.from("approval_pipelines")
			.delete()
			.eq("id", id);
		if (error) throw error;

		return NextResponse.json({ success: true });
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		return NextResponse.json({ success: false, error: message }, { status: 500 });
	}
}

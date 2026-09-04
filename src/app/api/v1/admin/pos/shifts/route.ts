import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission, hasBranchAccess } from "@/lib/rbac/rbac-service";
import {
	resolvePipeline,
	firstApplicableNode,
	closesWithoutApproval,
} from "@/lib/approvals/cash-close";

type SupabaseClient = Awaited<ReturnType<typeof getSupabaseServerClient>>;

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Expected drawer cash for a shift.
 *
 * opening float + cash sales + dues collected in cash
 *   + cash in - cash out - safe drops
 *
 * Both the close-shift handler and the terminal read this, so the cashier is
 * always reconciled against the same number they were shown.
 */
async function expectedCash(supabase: SupabaseClient, shiftId: string) {
	const { data, error } = await supabase.rpc("shift_expected_cash", {
		p_shift_id: shiftId,
	});
	if (error) throw error;
	return round2(Number(data) || 0);
}

async function withDrawerFigures(
	supabase: SupabaseClient,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	shift: any,
) {
	if (!shift) return shift;

	const { data: movements } = await supabase
		.from("pos_cash_movements")
		.select("id, type, amount, reason, created_at")
		.eq("shift_id", shift.id)
		.order("created_at", { ascending: false });

	return {
		...shift,
		cash_movements: movements || [],
		closing_cash_expected: await expectedCash(supabase, shift.id),
	};
}

// GET current active shift for warehouse/cashier or shift history
export async function GET(request: NextRequest) {
	try {
		const auth = await requirePermission(request, "pos:shifts");
		if (auth.error) return auth.error;
		const { userRBAC } = auth;

		const { searchParams } = new URL(request.url);
		const warehouseId = searchParams.get("warehouse_id");
		const status = searchParams.get("status") || "open";

		if (warehouseId && !hasBranchAccess(userRBAC.branchContext, warehouseId)) {
			return NextResponse.json(
				{ success: false, error: "You do not have access to this branch." },
				{ status: 403 },
			);
		}

		const supabase = await getSupabaseServerClient();

		if (status === "open" && warehouseId) {
			const { data: openShift } = await supabase
				.from("pos_shifts")
				.select(
					`
          *,
          warehouses (id, name, code)
        `,
				)
				.eq("warehouse_id", warehouseId)
				.eq("status", "open")
				.maybeSingle();

			return NextResponse.json({
				success: true,
				data: openShift ? await withDrawerFigures(supabase, openShift) : null,
			});
		}

		// Otherwise list shifts
		let query = supabase
			.from("pos_shifts")
			.select(
				`
        *,
        warehouses (id, name, code)
      `,
			)
			.order("created_at", { ascending: false })
			.limit(30);

		if (warehouseId) {
			query = query.eq("warehouse_id", warehouseId);
		} else if (!userRBAC.branchContext.isAllBranches) {
			// No branch asked for: show only the ones this user is assigned to,
			// never the whole estate.
			query = query.in("warehouse_id", userRBAC.branchContext.branchIds);
		}

		const { data: shifts, error } = await query;
		if (error) throw error;

		return NextResponse.json({ success: true, data: shifts || [] });
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		return NextResponse.json({ success: false, error: message }, { status: 500 });
	}
}

// POST: Open Shift, Close Shift, or Add Cash Movement
export async function POST(request: NextRequest) {
	try {
		const auth = await requirePermission(request, "pos:shifts");
		if (auth.error) return auth.error;
		const { userRBAC } = auth;

		const body = await request.json();
		const {
			action,
			warehouse_id,
			opening_float,
			closing_cash_actual,
			shift_id,
			movement_type,
			movement_amount,
			reason,
			notes,
		} = body;
		const supabase = await getSupabaseServerClient();

		if (action === "open_shift") {
			if (!warehouse_id) {
				return NextResponse.json(
					{ success: false, error: "Select a branch before opening a shift." },
					{ status: 400 },
				);
			}

			if (!hasBranchAccess(userRBAC.branchContext, warehouse_id)) {
				return NextResponse.json(
					{ success: false, error: "You cannot open a shift at this branch." },
					{ status: 403 },
				);
			}

			const float = Number(opening_float);
			if (!Number.isFinite(float) || float < 0) {
				return NextResponse.json(
					{ success: false, error: "Opening float must be zero or more." },
					{ status: 400 },
				);
			}

			const shiftNumber = `SHIFT-${Date.now().toString().slice(-6)}`;
			const { data: newShift, error } = await supabase
				.from("pos_shifts")
				.insert({
					shift_number: shiftNumber,
					warehouse_id,
					cashier_user_id: userRBAC.userId,
					opening_float: float,
					closing_cash_expected: float,
					status: "open",
					notes: notes || null,
				})
				.select()
				.single();

			if (error) {
				// A partial unique index on (warehouse_id) WHERE status='open'
				// makes this the single source of truth, rather than a
				// check-then-insert that two cashiers can both pass.
				if (error.code === "23505") {
					return NextResponse.json(
						{
							success: false,
							error: "A register shift is already open for this branch.",
						},
						{ status: 409 },
					);
				}
				throw error;
			}

			return NextResponse.json({
				success: true,
				data: await withDrawerFigures(supabase, newShift),
			});
		}

		if (action === "cash_movement") {
			const amount = Number(movement_amount);

			if (!shift_id) {
				return NextResponse.json(
					{ success: false, error: "shift_id is required" },
					{ status: 400 },
				);
			}

			if (!Number.isFinite(amount) || amount <= 0) {
				return NextResponse.json(
					{ success: false, error: "Enter an amount greater than zero." },
					{ status: 400 },
				);
			}

			const allowedTypes = ["cash_in", "cash_out", "drop", "float_adjustment"];
			const type = movement_type || "drop";
			if (!allowedTypes.includes(type)) {
				return NextResponse.json(
					{ success: false, error: `"${type}" is not a drawer movement type.` },
					{ status: 400 },
				);
			}

			const { data: shift } = await supabase
				.from("pos_shifts")
				.select("id, status, warehouse_id")
				.eq("id", shift_id)
				.maybeSingle();

			if (!shift) {
				return NextResponse.json(
					{ success: false, error: "Shift not found" },
					{ status: 404 },
				);
			}
			if (!hasBranchAccess(userRBAC.branchContext, shift.warehouse_id)) {
				return NextResponse.json(
					{ success: false, error: "You do not have access to this branch." },
					{ status: 403 },
				);
			}
			if (shift.status !== "open") {
				return NextResponse.json(
					{ success: false, error: "That shift is already closed." },
					{ status: 409 },
				);
			}

			// Taking money out of the drawer cannot leave it negative.
			if (type === "cash_out" || type === "drop") {
				const available = await expectedCash(supabase, shift_id);
				if (amount > available) {
					return NextResponse.json(
						{
							success: false,
							error: `Only ৳${available.toLocaleString("en-BD")} is in the drawer.`,
						},
						{ status: 400 },
					);
				}
			}

			const { data: movement, error } = await supabase
				.from("pos_cash_movements")
				.insert({
					shift_id,
					type,
					amount,
					reason: reason || "Mid-day drawer adjustment",
				})
				.select()
				.single();

			if (error) throw error;

			return NextResponse.json({
				success: true,
				data: movement,
				expected_cash: await expectedCash(supabase, shift_id),
			});
		}

		if (action === "close_shift") {
			if (!shift_id) {
				return NextResponse.json(
					{ success: false, error: "shift_id is required" },
					{ status: 400 },
				);
			}

			const { data: currentShift, error: fetchErr } = await supabase
				.from("pos_shifts")
				.select("*")
				.eq("id", shift_id)
				.single();

			if (fetchErr || !currentShift) {
				return NextResponse.json(
					{ success: false, error: "Shift not found" },
					{ status: 404 },
				);
			}

			if (!hasBranchAccess(userRBAC.branchContext, currentShift.warehouse_id)) {
				return NextResponse.json(
					{ success: false, error: "You do not have access to this branch." },
					{ status: 403 },
				);
			}

			if (currentShift.status === "closed") {
				return NextResponse.json(
					{ success: false, error: "That shift is already closed." },
					{ status: 409 },
				);
			}
			if (currentShift.status === "pending_approval") {
				return NextResponse.json(
					{
						success: false,
						error: "This close is already awaiting approval.",
					},
					{ status: 409 },
				);
			}

			const actual = Number(closing_cash_actual);
			if (!Number.isFinite(actual) || actual < 0) {
				return NextResponse.json(
					{ success: false, error: "Enter the cash counted in the drawer." },
					{ status: 400 },
				);
			}

			const expected = await expectedCash(supabase, shift_id);
			const difference = round2(actual - expected);

			// A shift already rejected once may be recounted and resubmitted;
			// the previous request stays in the log as history.
			const previousStatus = currentShift.status;

			// Migration 023 makes the owner the final step of every approval
			// chain, so sending an owner's own close through the pipeline would
			// only ever be them approving themselves. They close the drawer
			// outright — but the request and its action row are still written,
			// already approved, so the trail still shows who signed this drawer
			// off and that no chain was walked.
			if (closesWithoutApproval(userRBAC)) {
				const ownerPipeline = await resolvePipeline(
					supabase,
					currentShift.warehouse_id,
				);
				const closedAt = new Date().toISOString();

				const { data: closedShift, error: ownerCloseErr } = await supabase
					.from("pos_shifts")
					.update({
						closing_cash_actual: actual,
						closing_cash_expected: expected,
						difference,
						status: "closed",
						closed_at: closedAt,
						closed_by_user_id: userRBAC.userId,
						approved_at: closedAt,
						notes: notes || currentShift.notes,
					})
					.eq("id", shift_id)
					.eq("status", previousStatus)
					.select()
					.single();

				if (ownerCloseErr) throw ownerCloseErr;
				if (!closedShift) {
					return NextResponse.json(
						{ success: false, error: "That shift was changed by someone else." },
						{ status: 409 },
					);
				}

				const ownerRequestNumber = `CCA-${Date.now().toString().slice(-8)}`;
				// Records the close as landing at the top of the chain, which is
				// where the owner sits when there is a pipeline to speak of.
				const ownerStep = ownerPipeline?.nodes.length || 1;

				const { data: ownerApproval, error: ownerApprovalErr } = await supabase
					.from("cash_close_approvals")
					.insert({
						request_number: ownerRequestNumber,
						shift_id,
						warehouse_id: currentShift.warehouse_id,
						pipeline_id: ownerPipeline?.id ?? null,
						closing_cash_expected: expected,
						closing_cash_actual: actual,
						difference,
						submitted_by: userRBAC.userId,
						current_node_id: null,
						current_step: ownerStep,
						status: "approved",
						resolved_at: closedAt,
						notes: notes || null,
					})
					.select()
					.single();

				if (ownerApprovalErr) {
					// A closed drawer with no record of who closed it is worse
					// than one still open, so undo rather than close silently.
					await supabase
						.from("pos_shifts")
						.update({
							status: previousStatus,
							closed_at: null,
							closed_by_user_id: null,
							approved_at: null,
						})
						.eq("id", shift_id);
					throw ownerApprovalErr;
				}

				await supabase.from("cash_close_approval_actions").insert({
					approval_id: ownerApproval.id,
					node_id: null,
					step_order: ownerStep,
					action: "approved",
					acted_by: userRBAC.userId,
					acted_by_role: userRBAC.role,
					comment:
						"Closed directly by Superadmin / Owner — approval chain not required.",
				});

				return NextResponse.json({
					success: true,
					data: closedShift,
					approval: ownerApproval,
					closed_without_approval: true,
					message: `Drawer closed and signed off as ${ownerRequestNumber}. Superadmin close — no approval chain required.`,
				});
			}

			// Everyone else: the drawer count is routed through the branch's
			// approval chain rather than closing the shift outright.
			const pipeline = await resolvePipeline(
				supabase,
				currentShift.warehouse_id,
			);

			if (!pipeline || pipeline.nodes.length === 0) {
				return NextResponse.json(
					{
						success: false,
						error:
							"No cash close approval pipeline is configured for this branch. Ask an administrator to set one up under Approvals → Pipelines.",
					},
					{ status: 409 },
				);
			}

			const firstNode = firstApplicableNode(pipeline.nodes, difference);
			if (!firstNode) {
				return NextResponse.json(
					{
						success: false,
						error:
							"The approval pipeline for this branch has no step that applies to this variance.",
					},
					{ status: 409 },
				);
			}

			const { data: pendingShift, error: closeErr } = await supabase
				.from("pos_shifts")
				.update({
					closing_cash_actual: actual,
					closing_cash_expected: expected,
					difference,
					status: "pending_approval",
					closed_at: new Date().toISOString(),
					closed_by_user_id: userRBAC.userId,
					notes: notes || currentShift.notes,
				})
				.eq("id", shift_id)
				.eq("status", previousStatus)
				.select()
				.single();

			if (closeErr) throw closeErr;
			if (!pendingShift) {
				return NextResponse.json(
					{ success: false, error: "That shift was changed by someone else." },
					{ status: 409 },
				);
			}

			const requestNumber = `CCA-${Date.now().toString().slice(-8)}`;
			const { data: approval, error: approvalErr } = await supabase
				.from("cash_close_approvals")
				.insert({
					request_number: requestNumber,
					shift_id,
					warehouse_id: currentShift.warehouse_id,
					pipeline_id: pipeline.id,
					closing_cash_expected: expected,
					closing_cash_actual: actual,
					difference,
					submitted_by: userRBAC.userId,
					current_node_id: firstNode.id,
					current_step: firstNode.step_order,
					status: "pending",
					notes: notes || null,
				})
				.select()
				.single();

			if (approvalErr) {
				// Leave the shift open rather than stranding it in a pending
				// state with nothing to approve it.
				await supabase
					.from("pos_shifts")
					.update({ status: previousStatus, closed_at: null, closed_by_user_id: null })
					.eq("id", shift_id);
				throw approvalErr;
			}

			return NextResponse.json({
				success: true,
				data: pendingShift,
				approval,
				pipeline: { id: pipeline.id, name: pipeline.name, steps: pipeline.nodes.length },
				next_approver: firstNode.name,
				message: `Drawer submitted for approval as ${requestNumber}. Awaiting: ${firstNode.name}.`,
			});
		}

		return NextResponse.json(
			{ success: false, error: "Invalid action" },
			{ status: 400 },
		);
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		console.error("POS shift action failed:", message);
		return NextResponse.json({ success: false, error: message }, { status: 500 });
	}
}

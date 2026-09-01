import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission, hasBranchAccess } from "@/lib/rbac/rbac-service";

// A transfer may only move forward through these states.
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
	pending: ["in_transit", "rejected"],
	in_transit: ["received", "rejected"],
	received: [],
	rejected: [],
};

function badRequest(error: string, status = 400) {
	return NextResponse.json({ success: false, error }, { status });
}

export async function GET(request: NextRequest) {
	try {
		const auth = await requirePermission(request, "inventory:view");
		if (auth.error) return auth.error;

		const supabase = await getSupabaseServerClient();
		let query = supabase
			.from("branch_transfers")
			.select(
				`
        *,
        source:warehouses!branch_transfers_source_warehouse_id_fkey(id, name, code),
        target:warehouses!branch_transfers_target_warehouse_id_fkey(id, name, code),
        branch_transfer_items (
          id, product_id, device_unit_id, quantity,
          products ( id, name, sku )
        )
      `,
			)
			.order("created_at", { ascending: false });

		// A transfer is visible to both ends of it, and to nobody else.
		if (!auth.userRBAC.branchContext.isAllBranches) {
			const ids = auth.userRBAC.branchContext.branchIds;
			const list = ids.length > 0 ? ids.join(",") : "00000000-0000-0000-0000-000000000000";
			query = query.or(
				`source_warehouse_id.in.(${list}),target_warehouse_id.in.(${list})`,
			);
		}

		const { data: transfers, error } = await query;

		if (error) throw error;
		return NextResponse.json({ success: true, data: transfers || [] });
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		return NextResponse.json({ success: false, error: message }, { status: 500 });
	}
}

export async function POST(request: NextRequest) {
	const supabase = await getSupabaseServerClient();

	try {
		const auth = await requirePermission(request, "inventory:transfers");
		if (auth.error) return auth.error;

		const body = await request.json();
		const {
			action,
			transfer_id,
			source_warehouse_id,
			target_warehouse_id,
			items,
			notes,
		} = body;

		// ====================================================================
		// CREATE — take the stock out of the source branch immediately
		// ====================================================================
		if (action === "create_transfer") {
			if (!source_warehouse_id || !target_warehouse_id || !items?.length) {
				return badRequest("Source branch, destination branch and items are required.");
			}
			if (source_warehouse_id === target_warehouse_id) {
				return badRequest("Source and destination branches must differ.");
			}
			// Dispatching removes stock from the source, so that is the branch
			// the caller has to hold. Receiving is checked separately below.
			if (!hasBranchAccess(auth.userRBAC.branchContext, source_warehouse_id)) {
				return badRequest("You cannot dispatch stock from this branch.", 403);
			}

			// ── Validate lines ───────────────────────────────────────────────
			const serialLines: { product_id: string; device_unit_id: string }[] = [];
			const bulkLines: {
				product_id: string;
				variation_id: string | null;
				quantity: number;
				name: string;
			}[] = [];

			for (const item of items) {
				if (!item.product_id) return badRequest("Every line needs a product.");

				if (item.device_unit_id) {
					serialLines.push({
						product_id: item.product_id,
						device_unit_id: item.device_unit_id,
					});
				} else {
					const quantity = Number(item.quantity);
					if (!Number.isInteger(quantity) || quantity < 1) {
						return badRequest("Bulk lines need a whole quantity of 1 or more.");
					}
					bulkLines.push({
						product_id: item.product_id,
						variation_id: item.variation_id || null,
						quantity,
						name: item.product_name || "Item",
					});
				}
			}

			// ── Confirm the source actually holds all of it ──────────────────
			if (serialLines.length > 0) {
				const { data: units } = await supabase
					.from("device_units")
					.select("id, serial_number, status, warehouse_id")
					.in(
						"id",
						serialLines.map((l) => l.device_unit_id),
					);

				for (const line of serialLines) {
					const unit = (units || []).find((u) => u.id === line.device_unit_id);
					if (!unit) return badRequest("A serialized unit on this transfer no longer exists.");
					if (unit.warehouse_id !== source_warehouse_id) {
						return badRequest(
							`Unit ${unit.serial_number} is not held at the source branch.`,
						);
					}
					if (unit.status !== "in_stock") {
						return badRequest(
							`Unit ${unit.serial_number} is marked "${unit.status}" and cannot be transferred.`,
						);
					}
				}
			}

			if (bulkLines.length > 0) {
				const { data: stockRows } = await supabase
					.from("inventory")
					.select("product_id, variation_id, available_quantity")
					.eq("warehouse_id", source_warehouse_id)
					.in(
						"product_id",
						bulkLines.map((l) => l.product_id),
					);

				for (const line of bulkLines) {
					const row = (stockRows || []).find(
						(s) =>
							s.product_id === line.product_id &&
							(s.variation_id ?? null) === line.variation_id,
					);
					const available = row?.available_quantity ?? 0;
					if (available < line.quantity) {
						return badRequest(
							`Only ${available} of "${line.name}" at the source branch — ${line.quantity} requested.`,
						);
					}
				}
			}

			// ── Write ────────────────────────────────────────────────────────
			// total_items now counts units in transit, not manifest lines.
			const totalUnits =
				serialLines.length +
				bulkLines.reduce((sum, l) => sum + l.quantity, 0);

			const transferNumber = `TRF-${Date.now().toString().slice(-6)}`;
			const { data: transfer, error: trfErr } = await supabase
				.from("branch_transfers")
				.insert({
					transfer_number: transferNumber,
					source_warehouse_id,
					target_warehouse_id,
					status: "pending",
					total_items: totalUnits,
					notes: notes || null,
				})
				.select()
				.single();

			if (trfErr) throw trfErr;

			const movedBulk: typeof bulkLines = [];

			try {
				for (const line of serialLines) {
					const { error: itemErr } = await supabase
						.from("branch_transfer_items")
						.insert({
							transfer_id: transfer.id,
							product_id: line.product_id,
							device_unit_id: line.device_unit_id,
							quantity: 1,
						});
					if (itemErr) throw itemErr;

					const { error: unitErr } = await supabase
						.from("device_units")
						.update({ status: "in_transit" })
						.eq("id", line.device_unit_id)
						.eq("status", "in_stock");
					if (unitErr) throw unitErr;
				}

				for (const line of bulkLines) {
					const { error: itemErr } = await supabase
						.from("branch_transfer_items")
						.insert({
							transfer_id: transfer.id,
							product_id: line.product_id,
							device_unit_id: null,
							quantity: line.quantity,
						});
					if (itemErr) throw itemErr;

					// Bulk quantities used to be recorded and then ignored, so
					// stock never actually left the source branch.
					const { error: stockErr } = await supabase.rpc(
						"apply_stock_movement",
						{
							p_product_id: line.product_id,
							p_variation_id: line.variation_id,
							p_warehouse_id: source_warehouse_id,
							p_delta: -line.quantity,
							p_adjustment_type: "transfer_out",
							p_reason: `Transfer ${transferNumber} to destination branch`,
							p_order_id: null,
							p_user_id: null,
							p_allow_negative: false,
						},
					);
					if (stockErr) throw stockErr;

					movedBulk.push(line);
				}
			} catch (writeError) {
				for (const line of movedBulk) {
					await supabase.rpc("apply_stock_movement", {
						p_product_id: line.product_id,
						p_variation_id: line.variation_id,
						p_warehouse_id: source_warehouse_id,
						p_delta: line.quantity,
						p_adjustment_type: "adjustment",
						p_reason: `Reversal of failed transfer ${transferNumber}`,
						p_order_id: null,
						p_user_id: null,
						p_allow_negative: true,
					});
				}
				await supabase
					.from("device_units")
					.update({ status: "in_stock" })
					.in(
						"id",
						serialLines.map((l) => l.device_unit_id),
					)
					.eq("status", "in_transit");
				await supabase
					.from("branch_transfer_items")
					.delete()
					.eq("transfer_id", transfer.id);
				await supabase.from("branch_transfers").delete().eq("id", transfer.id);
				throw writeError;
			}

			return NextResponse.json({
				success: true,
				data: { ...transfer, total_units: totalUnits },
			});
		}

		// ====================================================================
		// UPDATE STATUS
		// ====================================================================
		if (action === "update_status") {
			const { status } = body;
			if (!transfer_id || !status) {
				return badRequest("transfer_id and status are required");
			}

			const { data: transfer } = await supabase
				.from("branch_transfers")
				.select("*")
				.eq("id", transfer_id)
				.maybeSingle();

			if (!transfer) {
				return badRequest("Transfer not found", 404);
			}

			// Either end may move a transfer along — the source cancels or
			// dispatches, the destination receives — but a third branch cannot.
			const ctx = auth.userRBAC.branchContext;
			if (
				!hasBranchAccess(ctx, transfer.source_warehouse_id) &&
				!hasBranchAccess(ctx, transfer.target_warehouse_id)
			) {
				return badRequest("This transfer does not involve your branch.", 403);
			}

			const allowed = ALLOWED_TRANSITIONS[transfer.status] ?? [];
			if (!allowed.includes(status)) {
				return badRequest(
					allowed.length === 0
						? `This transfer is already ${transfer.status} and cannot change.`
						: `A ${transfer.status} transfer can only move to: ${allowed.join(", ")}.`,
					409,
				);
			}

			const { data: transferItems } = await supabase
				.from("branch_transfer_items")
				.select("*")
				.eq("transfer_id", transfer_id);

			const items_ = transferItems || [];

			if (status === "received") {
				// Serialized units land at the destination.
				for (const it of items_.filter((i) => i.device_unit_id)) {
					await supabase
						.from("device_units")
						.update({
							warehouse_id: transfer.target_warehouse_id,
							status: "in_stock",
						})
						.eq("id", it.device_unit_id);
				}

				// Bulk quantities are credited to the destination. They were
				// already taken out of the source when the transfer was created.
				for (const it of items_.filter((i) => !i.device_unit_id)) {
					const { error } = await supabase.rpc("apply_stock_movement", {
						p_product_id: it.product_id,
						p_variation_id: null,
						p_warehouse_id: transfer.target_warehouse_id,
						p_delta: it.quantity,
						p_adjustment_type: "transfer_in",
						p_reason: `Transfer ${transfer.transfer_number} received`,
						p_order_id: null,
						p_user_id: null,
						p_allow_negative: false,
					});
					if (error) throw error;
				}
			} else if (status === "rejected") {
				// Everything goes back where it came from — including the
				// warehouse_id, which the previous version never restored.
				for (const it of items_.filter((i) => i.device_unit_id)) {
					await supabase
						.from("device_units")
						.update({
							warehouse_id: transfer.source_warehouse_id,
							status: "in_stock",
						})
						.eq("id", it.device_unit_id);
				}

				for (const it of items_.filter((i) => !i.device_unit_id)) {
					const { error } = await supabase.rpc("apply_stock_movement", {
						p_product_id: it.product_id,
						p_variation_id: null,
						p_warehouse_id: transfer.source_warehouse_id,
						p_delta: it.quantity,
						p_adjustment_type: "transfer_in",
						p_reason: `Transfer ${transfer.transfer_number} rejected, returned to source`,
						p_order_id: null,
						p_user_id: null,
						p_allow_negative: false,
					});
					if (error) throw error;
				}
			}

			// Guard the write on the state we validated, so two clicks cannot
			// both apply the stock movements above.
			const updatePayload: Record<string, unknown> = { status };
			if (status === "in_transit") updatePayload.shipped_at = new Date().toISOString();
			if (status === "received") updatePayload.received_at = new Date().toISOString();

			const { data: updated, error: updateErr } = await supabase
				.from("branch_transfers")
				.update(updatePayload)
				.eq("id", transfer_id)
				.eq("status", transfer.status)
				.select()
				.maybeSingle();

			if (updateErr) throw updateErr;
			if (!updated) {
				return badRequest("That transfer changed while you were working on it. Reload and retry.", 409);
			}

			return NextResponse.json({
				success: true,
				data: updated,
				message: `Transfer updated to ${status}`,
			});
		}

		return badRequest("Invalid action");
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		console.error("Transfer action failed:", message);

		const friendly = message.includes("INSUFFICIENT_STOCK")
			? "Not enough stock at the source branch to move. Nothing was transferred."
			: message;

		return NextResponse.json({ success: false, error: friendly }, { status: 500 });
	}
}

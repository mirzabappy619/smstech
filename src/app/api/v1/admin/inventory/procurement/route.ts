import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
	supplierRunningBalance,
	writeLedgerEntry,
} from "@/lib/accounting/ledger";
import { requirePermission, hasBranchAccess } from "@/lib/rbac/rbac-service";

const round2 = (n: number) => Math.round(n * 100) / 100;

// Suppliers entered ad-hoc by name share this sentinel party id, so give each
// name its own deterministic bucket rather than collapsing them all into one.
const AD_HOC_SUPPLIER_NAMESPACE = "00000000-0000-0000-0000-0000000000";

function adHocSupplierId(name: string) {
	// Stable 2-hex-digit suffix derived from the name, so repeat purchases from
	// the same unregistered supplier accumulate against one ledger party.
	let hash = 0;
	for (let i = 0; i < name.length; i++) {
		hash = (hash * 31 + name.charCodeAt(i)) & 0xff;
	}
	return AD_HOC_SUPPLIER_NAMESPACE + hash.toString(16).padStart(2, "0");
}

function badRequest(error: string, status = 400) {
	return NextResponse.json({ success: false, error }, { status });
}

export async function POST(request: NextRequest) {
	const supabase = await getSupabaseServerClient();

	try {
		const auth = await requirePermission(request, "inventory:procurement");
		if (auth.error) return auth.error;

		const body = await request.json();
		const {
			type,
			supplier_id,
			supplier_name,
			customer_id,
			customer_name,
			warehouse_id,
			items,
			payment_status,
			notes,
		} = body;

		// Stock lands in a specific branch, so the caller must hold that branch.
		if (
			warehouse_id &&
			!hasBranchAccess(auth.userRBAC.branchContext, warehouse_id)
		) {
			return badRequest("You do not have access to this branch.", 403);
		}

		// ====================================================================
		// BATCH BUY — intake from a supplier
		// ====================================================================
		if (type === "batch_buy") {
			if (!warehouse_id || !Array.isArray(items) || items.length === 0) {
				return badRequest("A branch and at least one line item are required.");
			}

			// ── Validate every line before writing anything ──────────────────
			const serialLines: {
				product_id: string;
				unit_cost: number;
				selling_price: number;
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				serials: any[];
			}[] = [];
			const bulkLines: {
				product_id: string;
				variation_id: string | null;
				quantity: number;
				unit_cost: number;
			}[] = [];

			let computedTotal = 0;

			for (const it of items) {
				if (!it.product_id) {
					return badRequest("Every line needs a product.");
				}

				const unitCost = Number(it.unit_cost);
				if (!Number.isFinite(unitCost) || unitCost < 0) {
					return badRequest("Every line needs a valid unit cost.");
				}

				if (it.serial_numbers && Array.isArray(it.serial_numbers)) {
					if (it.serial_numbers.length === 0) {
						return badRequest("A serialized line needs at least one serial number.");
					}

					const sellingPrice = Number(it.selling_price);
					if (!Number.isFinite(sellingPrice) || sellingPrice <= 0) {
						return badRequest(
							"Serialized lines need an explicit selling price — it is no longer guessed from cost.",
						);
					}

					const serials = it.serial_numbers.map(
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						(sn: any) => (typeof sn === "string" ? { serial: sn } : sn),
					);

					for (const sn of serials) {
						if (!sn.serial || !String(sn.serial).trim()) {
							return badRequest("Every serialized unit needs a serial number.");
						}
						if (sn.battery_health !== undefined && sn.battery_health !== null && sn.battery_health !== "") {
							const bh = Number(sn.battery_health);
							if (!Number.isFinite(bh) || bh < 0 || bh > 100) {
								return badRequest(
									`Battery health for ${sn.serial} must be between 0 and 100.`,
								);
							}
						}
					}

					serialLines.push({
						product_id: it.product_id,
						unit_cost: unitCost,
						selling_price: sellingPrice,
						serials,
					});
					computedTotal += unitCost * serials.length;
				} else {
					const quantity = Number(it.quantity);
					if (!Number.isInteger(quantity) || quantity < 1) {
						return badRequest("Bulk lines need a whole quantity of 1 or more.");
					}
					bulkLines.push({
						product_id: it.product_id,
						variation_id: it.variation_id || null,
						quantity,
						unit_cost: unitCost,
					});
					computedTotal += unitCost * quantity;
				}
			}

			computedTotal = round2(computedTotal);

			// Reject duplicate serials up front — both within this batch and
			// against what is already in stock.
			const allSerials = serialLines.flatMap((l) =>
				l.serials.map((s) => String(s.serial).trim()),
			);

			const dupInBatch = allSerials.find(
				(s, i) => allSerials.indexOf(s) !== i,
			);
			if (dupInBatch) {
				return badRequest(`Serial "${dupInBatch}" appears twice in this batch.`);
			}

			if (allSerials.length > 0) {
				const { data: existing } = await supabase
					.from("device_units")
					.select("serial_number")
					.in("serial_number", allSerials);

				if (existing && existing.length > 0) {
					return badRequest(
						`Already in stock: ${existing.map((e) => e.serial_number).join(", ")}`,
					);
				}
			}

			// ── Write ────────────────────────────────────────────────────────
			const billRef = `BILL-IN-${Date.now().toString().slice(-6)}`;
			let createdUnits = 0;

			for (const line of serialLines) {
				const rows = line.serials.map((sn) => ({
					product_id: line.product_id,
					warehouse_id,
					serial_number: String(sn.serial).trim(),
					imei_1: sn.imei1 || null,
					imei_2: sn.imei2 || null,
					battery_health_pct:
						sn.battery_health !== undefined &&
						sn.battery_health !== null &&
						sn.battery_health !== ""
							? Number(sn.battery_health)
							: 100,
					battery_cycles: Number(sn.cycles) || 0,
					cosmetic_grade: sn.grade || "Brand New",
					regional_variant: sn.variant || "Official",
					cost_price: line.unit_cost,
					selling_price: line.selling_price,
					status: "in_stock",
				}));

				const { data: inserted, error } = await supabase
					.from("device_units")
					.insert(rows)
					.select("id");

				// Previously this error was discarded, so a failed batch still
				// reported success.
				if (error) throw error;
				createdUnits += inserted?.length || 0;
			}

			for (const line of bulkLines) {
				const { error } = await supabase.rpc("apply_stock_movement", {
					p_product_id: line.product_id,
					p_variation_id: line.variation_id,
					p_warehouse_id: warehouse_id,
					p_delta: line.quantity,
					p_adjustment_type: "purchase",
					p_reason: `Purchase intake ${billRef}`,
					p_order_id: null,
					p_user_id: null,
					p_allow_negative: false,
				});
				if (error) throw error;
			}

			// ── Supplier ledger: accumulate, do not overwrite ────────────────
			if (supplier_id || supplier_name) {
				const partyId =
					supplier_id || adHocSupplierId(supplier_name || "Central Supplier");
				const previous = await supplierRunningBalance(supabase, partyId);

				await writeLedgerEntry(supabase, {
					partyType: "supplier",
					partyId,
					partyName: supplier_name || "Central Supplier",
					entryType: "credit",
					amount: computedTotal,
					balanceAfter: round2(previous + computedTotal),
					referenceType: "purchase_bill",
					referenceId: billRef,
					notes: notes || "Batch purchase intake",
				});
			}

			return NextResponse.json({
				success: true,
				data: {
					billRef,
					serializedUnitsAdded: createdUnits,
					bulkLinesAdded: bulkLines.length,
					totalAmount: computedTotal,
				},
				message: `Batch intake completed — ${createdUnits} serialized unit(s) and ${bulkLines.length} bulk line(s) added, ৳${computedTotal.toLocaleString("en-BD")} billed.`,
			});
		}

		// ====================================================================
		// BATCH SELL — wholesale dispatch
		// ====================================================================
		if (type === "batch_sell") {
			if (!customer_name || !Array.isArray(items) || items.length === 0) {
				return badRequest("A customer and at least one line item are required.");
			}
			if (!warehouse_id) {
				return badRequest("Select the branch the stock is leaving from.");
			}

			// ── Validate and price the order from its own lines ──────────────
			const lines: {
				product_id: string;
				variation_id: string | null;
				product_name: string;
				quantity: number;
				unit_price: number;
				line_total: number;
			}[] = [];

			for (const it of items) {
				if (!it.product_id) return badRequest("Every line needs a product.");

				const quantity = Number(it.quantity);
				const unitPrice = Number(it.unit_price ?? it.selling_price);

				if (!Number.isInteger(quantity) || quantity < 1) {
					return badRequest("Every line needs a whole quantity of 1 or more.");
				}
				if (!Number.isFinite(unitPrice) || unitPrice < 0) {
					return badRequest("Every line needs a valid unit price.");
				}

				lines.push({
					product_id: it.product_id,
					variation_id: it.variation_id || null,
					product_name: it.product_name || "Wholesale item",
					quantity,
					unit_price: unitPrice,
					line_total: round2(unitPrice * quantity),
				});
			}

			// The total is computed here, not accepted from the client.
			const subtotal = round2(
				lines.reduce((sum, l) => sum + l.line_total, 0),
			);

			// ── Confirm the branch can cover it ──────────────────────────────
			const { data: stockRows } = await supabase
				.from("inventory")
				.select("product_id, variation_id, available_quantity")
				.eq("warehouse_id", warehouse_id)
				.in(
					"product_id",
					lines.map((l) => l.product_id),
				);

			const needed = new Map<string, { name: string; qty: number }>();
			for (const l of lines) {
				const key = `${l.product_id}:${l.variation_id ?? ""}`;
				const existing = needed.get(key);
				if (existing) existing.qty += l.quantity;
				else needed.set(key, { name: l.product_name, qty: l.quantity });
			}

			for (const [key, { name, qty }] of needed) {
				const [productId, variationId] = key.split(":");
				const row = (stockRows || []).find(
					(s) =>
						s.product_id === productId &&
						(s.variation_id ?? "") === variationId,
				);
				const available = row?.available_quantity ?? 0;
				if (available < qty) {
					return badRequest(
						`Only ${available} of "${name}" at this branch — ${qty} requested.`,
					);
				}
			}

			// ── Write the order, its items, and the stock movement ───────────
			const orderNumber = `B2B-${Date.now().toString().slice(-6)}`;
			const { data: order, error } = await supabase
				.from("orders")
				.insert({
					order_number: orderNumber,
					customer_id: customer_id || null,
					customer_name,
					customer_phone: body.customer_phone || "01700000000",
					address_line1: body.address || "Corporate Delivery",
					subtotal,
					total: subtotal,
					shipping_amount: 0,
					discount_amount: 0,
					payment_status: payment_status || "paid",
					status: "delivered",
					invoice_type: "b2b_wholesale",
					warehouse_id,
					notes: notes || "Corporate wholesale dispatch",
				})
				.select()
				.single();

			if (error) throw error;

			const applied: typeof lines = [];

			try {
				for (const l of lines) {
					const { error: itemErr } = await supabase.from("order_items").insert({
						order_id: order.id,
						product_id: l.product_id,
						variation_id: l.variation_id,
						product_name: l.product_name,
						unit_price: l.unit_price,
						quantity: l.quantity,
						total: l.line_total,
					});
					if (itemErr) throw itemErr;

					const { error: stockErr } = await supabase.rpc(
						"apply_stock_movement",
						{
							p_product_id: l.product_id,
							p_variation_id: l.variation_id,
							p_warehouse_id: warehouse_id,
							p_delta: -l.quantity,
							p_adjustment_type: "sale",
							p_reason: `Wholesale dispatch ${orderNumber}`,
							p_order_id: order.id,
							p_user_id: null,
							p_allow_negative: false,
						},
					);
					if (stockErr) throw stockErr;

					applied.push(l);
				}
			} catch (writeError) {
				// Put back whatever we took, then drop the half-written order.
				for (const l of applied) {
					await supabase.rpc("apply_stock_movement", {
						p_product_id: l.product_id,
						p_variation_id: l.variation_id,
						p_warehouse_id: warehouse_id,
						p_delta: l.quantity,
						p_adjustment_type: "adjustment",
						p_reason: `Reversal of failed dispatch ${orderNumber}`,
						p_order_id: null,
						p_user_id: null,
						p_allow_negative: true,
					});
				}
				await supabase.from("order_items").delete().eq("order_id", order.id);
				await supabase.from("orders").delete().eq("id", order.id);
				throw writeError;
			}

			return NextResponse.json({
				success: true,
				data: { ...order, items: lines },
				message: `B2B wholesale order ${orderNumber} created for ৳${subtotal.toLocaleString("en-BD")}.`,
			});
		}

		return badRequest("Invalid procurement type");
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		console.error("Procurement failed:", message);

		const friendly = message.includes("INSUFFICIENT_STOCK")
			? "Stock ran out while processing this batch. Nothing was recorded."
			: message;

		return NextResponse.json({ success: false, error: friendly }, { status: 500 });
	}
}

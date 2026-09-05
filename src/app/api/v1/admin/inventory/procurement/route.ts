import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
	supplierRunningBalance,
	writeLedgerEntry,
} from "@/lib/accounting/ledger";
import { requirePermission, hasBranchAccess } from "@/lib/rbac/rbac-service";
import { checkCreditLimit } from "@/lib/parties";
import { adHocSupplierId } from "@/lib/trade";
import {
	fetchProductNames,
	findExistingSerials,
	validateIntakeLines,
	writeIntakeLines,
	writePurchaseBill,
} from "@/lib/inventory/intake";
import { paymentStatusFor } from "@/lib/pos/checkout-math";

const round2 = (n: number) => Math.round(n * 100) / 100;

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

			// Validated and written through the shared intake path, so a supplier
			// batch, a counter purchase and a part-exchange all record provenance
			// and warranty terms the same way.
			const intake = validateIntakeLines(items);
			if ("error" in intake) return badRequest(intake.error);
			const lines = intake.value;
			const computedTotal = lines.total;

			const clashes = await findExistingSerials(supabase, lines);
			if (clashes.length > 0) {
				return badRequest(`Already in stock: ${clashes.join(", ")}`);
			}

			const billRef = `BILL-IN-${Date.now().toString().slice(-6)}`;
			const { createdUnitIds } = await writeIntakeLines(supabase, {
				lines,
				warehouseId: warehouse_id,
				acquisition: {
					from_type: "supplier",
					party_id: supplier_id || null,
					party_name: supplier_name || "Central Supplier",
					reference: billRef,
				},
				movementReason: `Purchase intake ${billRef}`,
			});
			const createdUnits = createdUnitIds.length;
			const bulkLines = lines.bulkLines;

			// A supplier batch is billed on account, so the whole total is due.
			await writePurchaseBill(supabase, {
				lines,
				warehouseId: warehouse_id,
				acquisition: {
					from_type: "supplier",
					party_id: supplier_id || null,
					party_name: supplier_name || "Central Supplier",
					reference: billRef,
				},
				amountPaid: 0,
				dueAmount: lines.total,
				createdUnitIds,
				productNames: await fetchProductNames(supabase, lines),
				notes,
				createdBy: auth.userRBAC.userId,
			});

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

			// ── How much of this dispatch is settled now ─────────────────────
			// The amount is what is authoritative; payment_status alone could
			// not express a part payment, so the status is derived from it.
			let amountPaid: number;
			if (
				body.amount_paid !== undefined &&
				body.amount_paid !== null &&
				body.amount_paid !== ""
			) {
				const paid = Number(body.amount_paid);
				if (!Number.isFinite(paid) || paid < 0) {
					return badRequest("Amount paid must be zero or more.");
				}
				if (paid > subtotal + 0.01) {
					return badRequest(
						`Amount paid (৳${round2(paid).toLocaleString("en-BD")}) is more than the order total.`,
					);
				}
				amountPaid = round2(Math.min(paid, subtotal));
			} else {
				amountPaid = payment_status === "due" ? 0 : subtotal;
			}

			const dueAmount = round2(subtotal - amountPaid);

			// ── Selling on due needs a registered party with credit ──────────
			// An ad-hoc name can be dispatched to when the goods are paid for,
			// but a due has to be owed by someone the shop can look up and
			// chase later.
			let creditParty: {
				id: string;
				name: string;
				credit_limit: number | string | null;
				outstanding_due: number | string | null;
			} | null = null;

			if (dueAmount > 0) {
				if (!customer_id) {
					return badRequest(
						"Selling on due needs a registered party. Pick one, or add them under Customer Management first.",
					);
				}

				const { data: party } = await supabase
					.from("customers")
					.select("id, name, credit_limit, outstanding_due")
					.eq("id", customer_id)
					.maybeSingle();

				if (!party) {
					return badRequest("That party is not registered.");
				}

				const credit = checkCreditLimit(party, dueAmount);
				if (!credit.ok) return badRequest(credit.message as string);

				creditParty = party;
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
					amount_paid: amountPaid,
					due_amount: dueAmount,
					payment_status: paymentStatusFor(dueAmount, amountPaid),
					status: "delivered",
					invoice_type: "b2b_wholesale",
					warehouse_id,
					notes: notes || "Corporate wholesale dispatch",
				})
				.select()
				.single();

			if (error) throw error;

			const applied: typeof lines = [];
			let dueApplied: { partyId: string; previousDue: number } | null = null;

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

				// ── Post the due against the party ───────────────────────────
				// Last, so a dispatch that failed on stock never leaves a
				// balance behind. The ledger row carries the running net
				// receivable, matching the convention in lib/accounting/ledger.
				if (creditParty && dueAmount > 0) {
					const previousDue = round2(Number(creditParty.outstanding_due) || 0);
					const newDue = round2(previousDue + dueAmount);

					const { error: dueErr } = await supabase
						.from("customers")
						.update({ outstanding_due: newDue })
						.eq("id", creditParty.id);
					if (dueErr) throw dueErr;

					dueApplied = { partyId: creditParty.id, previousDue };

					await writeLedgerEntry(supabase, {
						partyType: "customer",
						partyId: creditParty.id,
						partyName: creditParty.name,
						entryType: "debit",
						amount: dueAmount,
						balanceAfter: newDue,
						referenceType: "sales_invoice",
						referenceId: orderNumber,
						notes:
							amountPaid > 0
								? `Wholesale dispatch ${orderNumber} — ৳${amountPaid.toLocaleString("en-BD")} paid, balance on due`
								: `Wholesale dispatch ${orderNumber} on due`,
					});
				}
			} catch (writeError) {
				// Undo the balance before the stock: a party left owing money
				// for an order that no longer exists is the worst outcome here.
				if (dueApplied) {
					await supabase
						.from("customers")
						.update({ outstanding_due: dueApplied.previousDue })
						.eq("id", dueApplied.partyId);
				}

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

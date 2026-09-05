import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission, hasBranchAccess } from "@/lib/rbac/rbac-service";
import { buildIlikeOr } from "@/lib/supabase/filters";
import {
	customerNetBalance,
	supplierRunningBalance,
	writeLedgerEntry,
} from "@/lib/accounting/ledger";
import { checkCreditLimit } from "@/lib/parties";
import {
	applyCreditToCustomer,
	settleExchange,
	settlePurchase,
	adHocSupplierId,
	type TradePartyType,
} from "@/lib/trade";
import {
	fetchProductNames,
	findExistingSerials,
	reverseIntakeLines,
	validateIntakeLines,
	writeIntakeLines,
	writePurchaseBill,
} from "@/lib/inventory/intake";

const round2 = (n: number) => Math.round(n * 100) / 100;

function badRequest(error: string, status = 400) {
	return NextResponse.json({ success: false, error }, { status });
}

interface ResolvedParty {
	type: TradePartyType;
	id: string | null;
	name: string;
	// Customers only.
	outstanding_due: number;
	advance_balance: number;
	credit_limit: number;
}

/**
 * Resolves whoever the shop is trading with. A walk-in needs no record when
 * they are paid in full on the spot; anything left on account has to be owed
 * to or by somebody the shop can look up later.
 */
async function resolveParty(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	supabase: any,
	partyType: TradePartyType,
	partyId: string | null | undefined,
	fallbackName: string | undefined,
): Promise<{ error: string } | { value: ResolvedParty }> {
	if (partyType === "walk_in" || !partyId) {
		const name = (fallbackName || "").trim();
		if (!name) return { error: "Say who the goods are coming from." };

		// A supplier typed in rather than picked still keeps a ledger of its
		// own, so an unregistered name can be bought from on account.
		if (partyType === "supplier") {
			return {
				value: {
					type: "supplier",
					id: adHocSupplierId(name),
					name,
					outstanding_due: 0,
					advance_balance: 0,
					credit_limit: 0,
				},
			};
		}

		return {
			value: {
				type: "walk_in",
				id: null,
				name,
				outstanding_due: 0,
				advance_balance: 0,
				credit_limit: 0,
			},
		};
	}

	if (partyType === "supplier") {
		const { data } = await supabase
			.from("suppliers")
			.select("id, name")
			.eq("id", partyId)
			.maybeSingle();
		if (!data) return { error: "That supplier is not registered." };
		return {
			value: {
				type: "supplier",
				id: data.id,
				name: data.name,
				outstanding_due: 0,
				advance_balance: 0,
				credit_limit: 0,
			},
		};
	}

	const { data } = await supabase
		.from("customers")
		.select("id, name, outstanding_due, advance_balance, credit_limit")
		.eq("id", partyId)
		.maybeSingle();
	if (!data) return { error: "That party is not registered." };

	return {
		value: {
			type: "customer",
			id: data.id,
			name: data.name,
			outstanding_due: round2(Number(data.outstanding_due) || 0),
			advance_balance: round2(Number(data.advance_balance) || 0),
			credit_limit: round2(Number(data.credit_limit) || 0),
		},
	};
}

/**
 * GET /api/v1/admin/inventory/purchases
 *   ?party_type=supplier|customer|walk_in &warehouse_id= &q= &settled=paid|due
 *
 * The purchase history: every intake, whoever it came from, with its lines.
 * Scoped to the branches the caller holds, the same way the sales list is.
 */
export async function GET(request: NextRequest) {
	try {
		const auth = await requirePermission(request, "inventory:view");
		if (auth.error) return auth.error;

		const { searchParams } = new URL(request.url);
		const partyType = searchParams.get("party_type");
		const warehouseId = searchParams.get("warehouse_id");
		const settled = searchParams.get("settled");
		const query = searchParams.get("q")?.trim();
		const limit = Math.min(Number(searchParams.get("limit")) || 100, 200);

		if (
			warehouseId &&
			warehouseId !== "all" &&
			!hasBranchAccess(auth.userRBAC.branchContext, warehouseId)
		) {
			return badRequest("You do not have access to this branch.", 403);
		}

		const supabase = await getSupabaseServerClient();

		let billQuery = supabase
			.from("purchase_bills")
			.select(
				`*,
				warehouses (id, name, code),
				items:purchase_bill_items (id, product_name, is_serialized, quantity, unit_cost, line_total)`,
			)
			.order("created_at", { ascending: false })
			.limit(limit);

		if (warehouseId && warehouseId !== "all") {
			billQuery = billQuery.eq("warehouse_id", warehouseId);
		} else if (!auth.userRBAC.branchContext.isAllBranches) {
			billQuery = billQuery.in(
				"warehouse_id",
				auth.userRBAC.branchContext.branchIds,
			);
		}

		if (partyType && partyType !== "all") {
			billQuery = billQuery.eq("party_type", partyType);
		}

		// "Settled" is derived from what is still owed, not a stored status, so
		// it cannot drift out of step with the figure beside it.
		if (settled === "due") billQuery = billQuery.gt("due_amount", 0);
		if (settled === "paid") billQuery = billQuery.eq("due_amount", 0);

		const filter = buildIlikeOr(["bill_number", "party_name"], query);
		if (filter) billQuery = billQuery.or(filter);

		const { data: bills, error } = await billQuery;
		if (error) throw error;

		const rows = bills || [];
		return NextResponse.json({
			success: true,
			data: rows,
			summary: {
				count: rows.length,
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				total: round2(rows.reduce((sum: number, b: any) => sum + Number(b.subtotal || 0), 0)),
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				outstanding: round2(rows.reduce((sum: number, b: any) => sum + Number(b.due_amount || 0), 0)),
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				units: rows.reduce((sum: number, b: any) => sum + Number(b.unit_count || 0), 0),
			},
		});
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		console.error("Purchase list failed:", message);
		return NextResponse.json({ success: false, error: message }, { status: 500 });
	}
}

/**
 * POST /api/v1/admin/inventory/purchases
 *
 * Two operations, both of which bring goods in:
 *
 *   type: "purchase"  goods received from a supplier, a registered party, or a
 *                     walk-in selling a used device over the counter. Whatever
 *                     is not paid on the spot is left owed to them.
 *
 *   type: "exchange"  a part-exchange: goods taken in are valued and set
 *                     against goods going out. Only the difference is settled.
 */
export async function POST(request: NextRequest) {
	const supabase = await getSupabaseServerClient();

	try {
		const auth = await requirePermission(request, "inventory:procurement");
		if (auth.error) return auth.error;

		const body = await request.json();
		const {
			type,
			party_type,
			party_id,
			party_name,
			warehouse_id,
			items,
			amount_paid,
			notes,
		} = body;

		if (!warehouse_id) {
			return badRequest("Select the branch the goods are landing in.");
		}
		if (!hasBranchAccess(auth.userRBAC.branchContext, warehouse_id)) {
			return badRequest("You do not have access to this branch.", 403);
		}

		const partyType: TradePartyType = ["supplier", "customer", "walk_in"].includes(
			party_type,
		)
			? party_type
			: "walk_in";

		const partyResult = await resolveParty(supabase, partyType, party_id, party_name);
		if ("error" in partyResult) return badRequest(partyResult.error);
		const party = partyResult.value;

		// ── Goods coming in, common to both operations ───────────────────────
		const intake = validateIntakeLines(items);
		if ("error" in intake) return badRequest(intake.error);
		const lines = intake.value;

		const clashes = await findExistingSerials(supabase, lines);
		if (clashes.length > 0) {
			return badRequest(`Already in stock: ${clashes.join(", ")}`);
		}

		// ====================================================================
		// PURCHASE — goods in, money out
		// ====================================================================
		if (type === "purchase") {
			const settlement = settlePurchase(lines.total, amount_paid);
			if ("error" in settlement) return badRequest(settlement.error);
			const { total, paid_now, on_account } = settlement.value;

			if (on_account > 0 && !party.id) {
				return badRequest(
					"Part of this purchase is unpaid, so it has to be owed to a registered party. Pick one, or pay in full.",
				);
			}

			const reference = `BILL-IN-${Date.now().toString().slice(-6)}`;
			const { createdUnitIds } = await writeIntakeLines(supabase, {
				lines,
				warehouseId: warehouse_id,
				acquisition: {
					from_type: party.type,
					party_id: party.id,
					party_name: party.name,
					reference,
				},
				movementReason: `Purchase intake ${reference}`,
			});

			try {
				await writePurchaseBill(supabase, {
					lines,
					warehouseId: warehouse_id,
					acquisition: {
						from_type: party.type,
						party_id: party.id,
						party_name: party.name,
						reference,
					},
					amountPaid: paid_now,
					dueAmount: on_account,
					createdUnitIds,
					productNames: await fetchProductNames(supabase, lines),
					notes,
					createdBy: auth.userRBAC.userId,
				});

				if (on_account > 0 && party.id) {
					if (party.type === "supplier") {
						// We owe them more: a supplier's running payable goes up.
						const previous = await supplierRunningBalance(supabase, party.id);
						await writeLedgerEntry(supabase, {
							partyType: "supplier",
							partyId: party.id,
							partyName: party.name,
							entryType: "credit",
							amount: on_account,
							balanceAfter: round2(previous + on_account),
							referenceType: "purchase_bill",
							referenceId: reference,
							notes: notes || "Goods received, unpaid",
						});
					} else {
						// Buying from a customer puts the shop in their debt. It
						// clears anything they owe first — paying out cash while
						// the same person is behind on an invoice is how a debt
						// quietly disappears.
						const applied = applyCreditToCustomer(
							on_account,
							party.outstanding_due,
							party.advance_balance,
						);

						const { error: balErr } = await supabase
							.from("customers")
							.update({
								outstanding_due: applied.new_due,
								advance_balance: applied.new_advance,
							})
							.eq("id", party.id);
						if (balErr) throw balErr;

						if (applied.applied_to_due > 0) {
							await writeLedgerEntry(supabase, {
								partyType: "customer",
								partyId: party.id,
								partyName: party.name,
								entryType: "credit",
								amount: applied.applied_to_due,
								balanceAfter: customerNetBalance(
									applied.new_due,
									party.advance_balance,
								),
								referenceType: "purchase_bill",
								referenceId: reference,
								notes: `Goods bought in on ${reference}, set against what they owed`,
							});
						}

						if (applied.to_advance > 0) {
							await writeLedgerEntry(supabase, {
								partyType: "customer",
								partyId: party.id,
								partyName: party.name,
								entryType: "credit",
								amount: applied.to_advance,
								balanceAfter: customerNetBalance(
									applied.new_due,
									applied.new_advance,
								),
								referenceType: "advance_deposit",
								referenceId: reference,
								notes: `Goods bought in on ${reference}, credited to their account`,
							});
						}
					}
				}
			} catch (writeError) {
				await supabase
					.from("purchase_bills")
					.delete()
					.eq("bill_number", reference);
				await reverseIntakeLines(supabase, {
					lines,
					warehouseId: warehouse_id,
					createdUnitIds,
					reference,
				});
				throw writeError;
			}

			return NextResponse.json({
				success: true,
				data: {
					reference,
					party: party.name,
					party_type: party.type,
					units_received: lines.unitCount,
					serialized_units: createdUnitIds.length,
					total,
					paid_now,
					on_account,
				},
				message:
					on_account > 0
						? `Received ${lines.unitCount} unit(s) from ${party.name} for ৳${total.toLocaleString("en-BD")} — ৳${paid_now.toLocaleString("en-BD")} paid, ৳${on_account.toLocaleString("en-BD")} left on their account.`
						: `Received ${lines.unitCount} unit(s) from ${party.name}, paid in full: ৳${total.toLocaleString("en-BD")}.`,
			});
		}

		// ====================================================================
		// EXCHANGE — goods in and goods out, only the difference settled
		// ====================================================================
		if (type === "exchange") {
			if (party.type === "supplier") {
				return badRequest("An exchange is with a customer, not a supplier.");
			}

			const sellItems = body.sell_items;
			if (!Array.isArray(sellItems) || sellItems.length === 0) {
				return badRequest("An exchange needs at least one product going out.");
			}

			// ── Price the outbound side ──────────────────────────────────────
			const outLines: {
				product_id: string;
				variation_id: string | null;
				product_name: string;
				quantity: number;
				unit_price: number;
				line_total: number;
			}[] = [];

			for (const it of sellItems) {
				if (!it.product_id) return badRequest("Every outgoing line needs a product.");

				const quantity = Number(it.quantity);
				const unitPrice = Number(it.unit_price);
				if (!Number.isInteger(quantity) || quantity < 1) {
					return badRequest("Outgoing lines need a whole quantity of 1 or more.");
				}
				if (!Number.isFinite(unitPrice) || unitPrice < 0) {
					return badRequest("Every outgoing line needs a valid unit price.");
				}

				outLines.push({
					product_id: it.product_id,
					variation_id: it.variation_id || null,
					product_name: it.product_name || "Exchange item",
					quantity,
					unit_price: unitPrice,
					line_total: round2(unitPrice * quantity),
				});
			}

			const goodsOut = round2(outLines.reduce((sum, l) => sum + l.line_total, 0));
			const settlement = settleExchange(goodsOut, lines.total, amount_paid);
			if ("error" in settlement) return badRequest(settlement.error);
			const exchange = settlement.value;

			// Anything left owing, or owed back, needs a party on record.
			if ((exchange.customer_due > 0 || exchange.shop_owes > 0) && !party.id) {
				return badRequest(
					exchange.customer_due > 0
						? "The balance after the trade-in is unpaid, so it has to be owed by a registered party. Pick one, or collect it in full."
						: "The trade-in is worth more than the goods going out, so the difference has to be credited to a registered party.",
				);
			}

			if (exchange.customer_due > 0 && party.id) {
				const credit = checkCreditLimit(
					{
						name: party.name,
						credit_limit: party.credit_limit,
						outstanding_due: party.outstanding_due,
					},
					exchange.customer_due,
				);
				if (!credit.ok) return badRequest(credit.message as string);
			}

			// ── Confirm the branch can cover the outbound side ───────────────
			const { data: stockRows } = await supabase
				.from("inventory")
				.select("product_id, variation_id, available_quantity")
				.eq("warehouse_id", warehouse_id)
				.in(
					"product_id",
					outLines.map((l) => l.product_id),
				);

			const needed = new Map<string, { name: string; qty: number }>();
			for (const l of outLines) {
				const key = `${l.product_id}:${l.variation_id ?? ""}`;
				const existing = needed.get(key);
				if (existing) existing.qty += l.quantity;
				else needed.set(key, { name: l.product_name, qty: l.quantity });
			}

			for (const [key, { name, qty }] of needed) {
				const [productId, variationId] = key.split(":");
				const row = (stockRows || []).find(
					(s: { product_id: string; variation_id: string | null }) =>
						s.product_id === productId && (s.variation_id ?? "") === variationId,
				);
				const available = row?.available_quantity ?? 0;
				if (available < qty) {
					return badRequest(
						`Only ${available} of "${name}" at this branch — ${qty} requested.`,
					);
				}
			}

			// ── Write the exchange ───────────────────────────────────────────
			const reference = `EXC-${Date.now().toString().slice(-6)}`;
			const { data: order, error: orderErr } = await supabase
				.from("orders")
				.insert({
					order_number: reference,
					customer_id: party.id,
					customer_name: party.name,
					customer_phone: body.party_phone || "01700000000",
					address_line1: body.address || "Counter exchange",
					subtotal: exchange.goods_out,
					total: exchange.goods_out,
					trade_in_value: exchange.trade_in,
					shipping_amount: 0,
					discount_amount: 0,
					amount_paid: exchange.customer_pays,
					due_amount: exchange.customer_due,
					payment_status: exchange.customer_due > 0 ? "partial" : "paid",
					status: "delivered",
					invoice_type: "exchange",
					warehouse_id,
					notes:
						notes ||
						`Part-exchange: ৳${exchange.trade_in.toLocaleString("en-BD")} allowed against ৳${exchange.goods_out.toLocaleString("en-BD")} of goods`,
				})
				.select()
				.single();

			if (orderErr) throw orderErr;

			let createdUnitIds: string[] = [];
			const dispatched: typeof outLines = [];
			let balanceMoved: { new_due: number; new_advance: number } | null = null;

			try {
				// Goods in, tagged to the order they arrived against.
				const written = await writeIntakeLines(supabase, {
					lines,
					warehouseId: warehouse_id,
					acquisition: {
						from_type: party.type,
						party_id: party.id,
						party_name: party.name,
						reference,
						order_id: order.id,
					},
					movementReason: `Part-exchange intake ${reference}`,
				});
				createdUnitIds = written.createdUnitIds;

				// The trade-in is a purchase in its own right; tagging it to the
				// order keeps a part-exchange readable from either side.
				await writePurchaseBill(supabase, {
					lines,
					warehouseId: warehouse_id,
					acquisition: {
						from_type: party.type,
						party_id: party.id,
						party_name: party.name,
						reference,
						order_id: order.id,
					},
					// Settled by the goods going out, not by cash.
					amountPaid: lines.total,
					dueAmount: 0,
					createdUnitIds,
					productNames: await fetchProductNames(supabase, lines),
					notes: `Taken in part-exchange on ${reference}`,
					createdBy: auth.userRBAC.userId,
				});

				// Goods out.
				for (const l of outLines) {
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

					const { error: stockErr } = await supabase.rpc("apply_stock_movement", {
						p_product_id: l.product_id,
						p_variation_id: l.variation_id,
						p_warehouse_id: warehouse_id,
						p_delta: -l.quantity,
						p_adjustment_type: "sale",
						p_reason: `Exchange ${reference}`,
						p_order_id: order.id,
						p_user_id: null,
						p_allow_negative: false,
					});
					if (stockErr) throw stockErr;

					dispatched.push(l);
				}

				// ── Settle the difference ────────────────────────────────────
				if (party.id && exchange.customer_due > 0) {
					const newDue = round2(party.outstanding_due + exchange.customer_due);
					const { error: dueErr } = await supabase
						.from("customers")
						.update({ outstanding_due: newDue })
						.eq("id", party.id);
					if (dueErr) throw dueErr;
					balanceMoved = { new_due: newDue, new_advance: party.advance_balance };

					await writeLedgerEntry(supabase, {
						partyType: "customer",
						partyId: party.id,
						partyName: party.name,
						entryType: "debit",
						amount: exchange.customer_due,
						balanceAfter: customerNetBalance(newDue, party.advance_balance),
						referenceType: "sales_invoice",
						referenceId: reference,
						notes: `Balance after ৳${exchange.trade_in.toLocaleString("en-BD")} trade-in on ${reference}`,
					});
				}

				if (party.id && exchange.shop_owes > 0) {
					// Their old device was worth more than the new one. Clear any
					// due first, then leave the rest as credit on the account.
					const applied = applyCreditToCustomer(
						exchange.shop_owes,
						party.outstanding_due,
						party.advance_balance,
					);

					const { error: balErr } = await supabase
						.from("customers")
						.update({
							outstanding_due: applied.new_due,
							advance_balance: applied.new_advance,
						})
						.eq("id", party.id);
					if (balErr) throw balErr;
					balanceMoved = {
						new_due: applied.new_due,
						new_advance: applied.new_advance,
					};

					await writeLedgerEntry(supabase, {
						partyType: "customer",
						partyId: party.id,
						partyName: party.name,
						entryType: "credit",
						amount: exchange.shop_owes,
						balanceAfter: customerNetBalance(applied.new_due, applied.new_advance),
						referenceType:
							applied.to_advance > 0 ? "advance_deposit" : "due_clearance",
						referenceId: reference,
						notes: `Trade-in on ${reference} worth more than the goods taken`,
					});
				}
			} catch (writeError) {
				// Unwind in the reverse order: balances, then goods out, then
				// goods in, then the order itself.
				if (balanceMoved && party.id) {
					await supabase
						.from("customers")
						.update({
							outstanding_due: party.outstanding_due,
							advance_balance: party.advance_balance,
						})
						.eq("id", party.id);
				}

				for (const l of dispatched) {
					await supabase.rpc("apply_stock_movement", {
						p_product_id: l.product_id,
						p_variation_id: l.variation_id,
						p_warehouse_id: warehouse_id,
						p_delta: l.quantity,
						p_adjustment_type: "adjustment",
						p_reason: `Reversal of failed exchange ${reference}`,
						p_order_id: null,
						p_user_id: null,
						p_allow_negative: true,
					});
				}

				await reverseIntakeLines(supabase, {
					lines,
					warehouseId: warehouse_id,
					createdUnitIds,
					reference,
				});

				await supabase
					.from("purchase_bills")
					.delete()
					.eq("bill_number", reference);
				await supabase.from("order_items").delete().eq("order_id", order.id);
				await supabase.from("orders").delete().eq("id", order.id);
				throw writeError;
			}

			return NextResponse.json({
				success: true,
				data: {
					reference,
					order,
					...exchange,
					units_received: lines.unitCount,
				},
				message:
					exchange.direction === "shop_pays"
						? `Exchange ${reference} recorded — the trade-in was worth ৳${exchange.shop_owes.toLocaleString("en-BD")} more, credited to ${party.name}.`
						: exchange.customer_due > 0
							? `Exchange ${reference} recorded — ৳${exchange.customer_pays.toLocaleString("en-BD")} collected, ৳${exchange.customer_due.toLocaleString("en-BD")} on due.`
							: `Exchange ${reference} recorded — ৳${exchange.customer_pays.toLocaleString("en-BD")} collected against a ৳${exchange.trade_in.toLocaleString("en-BD")} trade-in.`,
			});
		}

		return badRequest(`"${type}" is not something this endpoint does.`);
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		console.error("Purchase/exchange failed:", message);

		const friendly = message.includes("INSUFFICIENT_STOCK")
			? "Stock ran out while recording this. Nothing was saved."
			: message;

		return NextResponse.json({ success: false, error: friendly }, { status: 500 });
	}
}

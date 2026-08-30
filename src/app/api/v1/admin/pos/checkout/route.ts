import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { customerNetBalance, writeLedgerEntry } from "@/lib/accounting/ledger";
import {
	GATEWAY_BY_METHOD,
	TENDER_TOLERANCE as TOLERANCE,
	computeCartTotals,
	isTenderBalanced,
	lineTotal,
	paymentStatusFor,
	round2,
	summarisePayments,
} from "@/lib/pos/checkout-math";

interface NormalisedItem {
	product_id: string | null;
	product_name: string;
	unit_price: number;
	quantity: number;
	device_unit_id: string | null;
	variation_id: string | null;
	serial_number: string | null;
	imei_1: string | null;
	warranty: string;
	line_total: number;
}

interface NormalisedPayment {
	method: string;
	amount: number;
	reference: string;
	notes: string;
}

function badRequest(error: string, status = 400) {
	return NextResponse.json({ success: false, error }, { status });
}

export async function POST(request: Request) {
	let createdOrderId: string | null = null;
	// Stock we have already taken, so a later failure can put it back.
	const appliedStock: {
		product_id: string;
		variation_id: string | null;
		quantity: number;
	}[] = [];
	const soldDeviceUnitIds: string[] = [];
	let warehouseId: string | null = null;
	const supabase = await getSupabaseServerClient();

	try {
		const body = await request.json();
		const {
			warehouse_id,
			shift_id,
			customer_id,
			customer_name,
			customer_phone,
			customer_email,
			items,
			payments,
			discount_amount,
			pre_booking_id,
			notes,
		} = body;

		// ── 1. Validate the cart ─────────────────────────────────────────────
		if (!Array.isArray(items) || items.length === 0) {
			return badRequest("Cart is empty");
		}

		if (!warehouse_id) {
			return badRequest("A branch must be selected before checkout");
		}
		warehouseId = warehouse_id;

		const normalisedItems: NormalisedItem[] = [];

		for (const it of items) {
			const unitPrice = Number(it.unit_price);
			const quantity = Number(it.quantity);

			if (!Number.isFinite(unitPrice) || unitPrice < 0) {
				return badRequest(
					`"${it.product_name || "Item"}" has an invalid price.`,
				);
			}

			if (!Number.isInteger(quantity) || quantity < 1) {
				return badRequest(
					`"${it.product_name || "Item"}" needs a whole quantity of 1 or more.`,
				);
			}

			if (it.device_unit_id && quantity !== 1) {
				return badRequest(
					`"${it.product_name}" is a serialized unit and can only be sold one at a time.`,
				);
			}

			normalisedItems.push({
				product_id: it.product_id || null,
				product_name: it.product_name,
				unit_price: unitPrice,
				quantity,
				device_unit_id: it.device_unit_id || null,
				variation_id: it.variation_id || null,
				serial_number: it.serial_number || null,
				imei_1: it.imei_1 || null,
				warranty: it.warranty || "1 Year SMSTech Warranty",
				line_total: lineTotal({ unit_price: unitPrice, quantity }),
			});
		}

		if (Number(discount_amount) < 0) {
			return badRequest("Discount cannot be negative.");
		}

		// Same numbers the line items will carry, so the order total always
		// equals the sum of its own rows.
		const { subtotal, discount, finalTotal } = computeCartTotals(
			normalisedItems,
			Number(discount_amount) || 0,
		);

		// ── 2. Validate the tender ───────────────────────────────────────────
		const rawPayments: NormalisedPayment[] = (
			Array.isArray(payments) && payments.length
				? payments
				: [{ method: "cash", amount: finalTotal, reference: "Direct Cash" }]
		).map((p: Record<string, unknown>) => ({
			method: String(p.method || "cash"),
			amount: Number(p.amount),
			reference: String(p.reference || ""),
			notes: String(p.notes || ""),
		}));

		for (const p of rawPayments) {
			if (!GATEWAY_BY_METHOD[p.method]) {
				return badRequest(`"${p.method}" is not a payment method this till accepts.`);
			}
			if (!Number.isFinite(p.amount) || p.amount < 0) {
				return badRequest(`The ${p.method} amount is not a valid figure.`);
			}
		}

		const paymentBreakdown = rawPayments.filter((p) => p.amount > 0);
		if (paymentBreakdown.length === 0) {
			return badRequest("Enter at least one payment before settling.");
		}

		const tender = summarisePayments(paymentBreakdown);
		const totalTendered = tender.totalTendered;

		// This is the check that was previously only enforced in the browser.
		if (!isTenderBalanced(totalTendered, finalTotal)) {
			return badRequest(
				`Payments total ৳${totalTendered.toLocaleString("en-BD")} but the invoice is ৳${finalTotal.toLocaleString("en-BD")}. They must match.`,
			);
		}

		const cashAmount = tender.cash;
		const cardAmount = tender.card;
		const mobileAmount = tender.mobile;
		const walletAmount = tender.wallet;
		const advanceAmount = tender.advance;
		const preBookingAmount = tender.prebooking;
		const dueAmount = tender.due;

		// ── 3. Resolve the customer ──────────────────────────────────────────
		let resolvedCustomerId: string | null = customer_id || null;
		let customerRecord: {
			id: string;
			name: string | null;
			advance_balance: number;
			outstanding_due: number;
			credit_limit: number;
			total_orders: number;
			total_spent: number;
		} | null = null;

		if (resolvedCustomerId) {
			const { data } = await supabase
				.from("customers")
				.select(
					"id, name, advance_balance, outstanding_due, credit_limit, total_orders, total_spent",
				)
				.eq("id", resolvedCustomerId)
				.maybeSingle();
			if (!data) return badRequest("That customer record no longer exists.", 404);
			customerRecord = data;
		} else if (customer_phone) {
			const { data } = await supabase
				.from("customers")
				.select(
					"id, name, advance_balance, outstanding_due, credit_limit, total_orders, total_spent",
				)
				.eq("phone", customer_phone)
				.maybeSingle();
			if (data) {
				customerRecord = data;
				resolvedCustomerId = data.id;
			}
		}

		if ((advanceAmount > 0 || dueAmount > 0) && !customerRecord) {
			return badRequest(
				"Wallet and due payments need a registered customer. Look one up first.",
			);
		}

		// Wallet cannot go overdrawn. Previously this was clamped to zero and
		// the invoice was still written as paid.
		if (customerRecord && advanceAmount > 0) {
			const available = Number(customerRecord.advance_balance) || 0;
			if (advanceAmount > available + TOLERANCE) {
				return badRequest(
					`Wallet holds ৳${available.toLocaleString("en-BD")} but ৳${advanceAmount.toLocaleString("en-BD")} was tendered from it.`,
				);
			}
		}

		// Credit limit is now enforced, not merely displayed.
		if (customerRecord && dueAmount > 0) {
			const currentDue = Number(customerRecord.outstanding_due) || 0;
			const creditLimit = Number(customerRecord.credit_limit) || 0;
			if (currentDue + dueAmount > creditLimit + TOLERANCE) {
				return badRequest(
					`This due takes ${customerRecord.name || "the customer"} to ৳${(currentDue + dueAmount).toLocaleString("en-BD")}, over their ৳${creditLimit.toLocaleString("en-BD")} credit limit.`,
				);
			}
		}

		// ── 4. Validate the pre-booking being settled, if any ────────────────
		let preBooking: {
			id: string;
			booking_number: string;
			advance_paid: number;
			status: string;
			allocated_unit_id: string | null;
		} | null = null;

		if (preBookingAmount > 0) {
			if (!pre_booking_id) {
				return badRequest(
					"A pre-booking payment needs the booking it is settling.",
				);
			}
			const { data } = await supabase
				.from("pre_bookings")
				.select("id, booking_number, advance_paid, status, allocated_unit_id")
				.eq("id", pre_booking_id)
				.maybeSingle();

			if (!data) return badRequest("That pre-booking no longer exists.", 404);
			if (data.status === "fulfilled") {
				return badRequest("That pre-booking has already been collected.");
			}
			if (data.status === "cancelled") {
				return badRequest("That pre-booking was cancelled.");
			}
			if (Math.abs(Number(data.advance_paid) - preBookingAmount) > TOLERANCE) {
				return badRequest(
					`Pre-booking ${data.booking_number} holds ৳${Number(data.advance_paid).toLocaleString("en-BD")} in advance, not ৳${preBookingAmount.toLocaleString("en-BD")}.`,
				);
			}
			preBooking = data;
		}

		// ── 5. Confirm every item is actually available ──────────────────────
		const deviceUnitIds = normalisedItems
			.map((i) => i.device_unit_id)
			.filter((id): id is string => Boolean(id));

		if (new Set(deviceUnitIds).size !== deviceUnitIds.length) {
			return badRequest("The same serialized unit appears twice in the cart.");
		}

		if (deviceUnitIds.length > 0) {
			const { data: units } = await supabase
				.from("device_units")
				.select("id, serial_number, status, warehouse_id")
				.in("id", deviceUnitIds);

			for (const id of deviceUnitIds) {
				const unit = (units || []).find((u) => u.id === id);
				if (!unit) return badRequest("A serialized unit in the cart no longer exists.");

				// 'reserved' units belong to a pre-booking. They may only leave
				// the shop against that booking.
				if (unit.status === "reserved") {
					if (!preBooking || preBooking.allocated_unit_id !== unit.id) {
						return badRequest(
							`Unit ${unit.serial_number} is reserved for a pre-booking and cannot be sold over the counter.`,
						);
					}
				} else if (unit.status !== "in_stock") {
					return badRequest(
						`Unit ${unit.serial_number} is marked "${unit.status}" and is not available to sell.`,
					);
				}

				if (unit.warehouse_id !== warehouse_id) {
					return badRequest(
						`Unit ${unit.serial_number} is held at another branch.`,
					);
				}
			}
		}

		// Pooled (non-serialized) lines draw down the inventory table.
		const pooledItems = normalisedItems.filter(
			(i) => !i.device_unit_id && i.product_id,
		);

		if (pooledItems.length > 0) {
			const { data: stockRows } = await supabase
				.from("inventory")
				.select("product_id, variation_id, available_quantity")
				.eq("warehouse_id", warehouse_id)
				.in(
					"product_id",
					pooledItems.map((i) => i.product_id as string),
				);

			// Several cart lines can point at the same product; check the total.
			const needed = new Map<string, { item: NormalisedItem; qty: number }>();
			for (const item of pooledItems) {
				const key = `${item.product_id}:${item.variation_id ?? ""}`;
				const existing = needed.get(key);
				if (existing) existing.qty += item.quantity;
				else needed.set(key, { item, qty: item.quantity });
			}

			for (const { item, qty } of needed.values()) {
				const row = (stockRows || []).find(
					(s) =>
						s.product_id === item.product_id &&
						(s.variation_id ?? null) === item.variation_id,
				);
				const available = row?.available_quantity ?? 0;
				if (available < qty) {
					return badRequest(
						`Only ${available} of "${item.product_name}" left at this branch — ${qty} were rung up.`,
					);
				}
			}
		}

		// ── 6. Everything checks out. Create the customer if new. ────────────
		// Aggregates start at zero here; the update in step 10 sets the real
		// figures, so a first sale is not counted twice.
		if (!resolvedCustomerId && customer_phone) {
			const custCode = `CUST-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
			const { data: newCust, error: custErr } = await supabase
				.from("customers")
				.insert({
					name: customer_name || "Counter Customer",
					phone: customer_phone,
					email: customer_email || null,
					customer_code: custCode,
					total_orders: 0,
					total_spent: 0,
				})
				.select(
					"id, name, advance_balance, outstanding_due, credit_limit, total_orders, total_spent",
				)
				.single();

			if (custErr) throw custErr;
			customerRecord = newCust;
			resolvedCustomerId = newCust.id;
		}

		// ── 7. Order header ──────────────────────────────────────────────────
		const orderNumber = `POS-${Date.now().toString().slice(-8)}`;
		const amountSettled = tender.amountSettled;

		const { data: order, error: orderErr } = await supabase
			.from("orders")
			.insert({
				order_number: orderNumber,
				customer_id: resolvedCustomerId,
				customer_name: customer_name || "Counter Customer",
				customer_phone: customer_phone || "01700000000",
				customer_email: customer_email || null,
				address_line1: "Counter In-Store Pickup",
				city: "Dhaka",
				shipping_method: "In-Store Counter Handover",
				shipping_amount: 0.0,
				discount_amount: discount,
				subtotal,
				total: finalTotal,
				payment_method:
					paymentBreakdown.length === 1
						? paymentBreakdown[0].method
						: "split_payment",
				payment_status: paymentStatusFor(dueAmount, amountSettled),
				status: "delivered",
				warehouse_id,
				shift_id: shift_id || null,
				invoice_type: preBooking ? "pre_booking" : "pos",
				pre_booking_id: preBooking?.id || null,
				advance_deducted: round2(advanceAmount + preBookingAmount),
				due_amount: dueAmount,
				payment_breakdown: paymentBreakdown,
				notes: notes || "POS In-Store Checkout",
			})
			.select()
			.single();

		if (orderErr) throw orderErr;
		createdOrderId = order.id;

		// ── 8. Line items and stock ──────────────────────────────────────────
		for (const it of normalisedItems) {
			const { error: itemErr } = await supabase.from("order_items").insert({
				order_id: order.id,
				product_id: it.product_id,
				variation_id: it.variation_id,
				product_name: it.product_name,
				unit_price: it.unit_price,
				quantity: it.quantity,
				total: it.line_total,
				device_unit_id: it.device_unit_id,
				serial_number: it.serial_number,
				imei_1: it.imei_1,
				warranty_period: it.warranty,
			});
			if (itemErr) throw itemErr;

			if (it.device_unit_id) {
				const { error: unitErr } = await supabase
					.from("device_units")
					.update({
						status: "sold",
						sold_order_id: order.id,
						sold_at: new Date().toISOString(),
						warranty_expires_at: new Date(
							Date.now() + 365 * 24 * 60 * 60 * 1000,
						).toISOString(),
					})
					.eq("id", it.device_unit_id)
					.in("status", ["in_stock", "reserved"]);
				if (unitErr) throw unitErr;
				soldDeviceUnitIds.push(it.device_unit_id);
			} else if (it.product_id) {
				// Atomic decrement — this is what was missing entirely before.
				const { error: stockErr } = await supabase.rpc("apply_stock_movement", {
					p_product_id: it.product_id,
					p_variation_id: it.variation_id,
					p_warehouse_id: warehouse_id,
					p_delta: -it.quantity,
					p_adjustment_type: "sale",
					p_reason: `POS sale ${orderNumber}`,
					p_order_id: order.id,
					p_user_id: null,
					p_allow_negative: false,
				});
				if (stockErr) throw stockErr;

				appliedStock.push({
					product_id: it.product_id,
					variation_id: it.variation_id,
					quantity: it.quantity,
				});
			}
		}

		// ── 9. Payment rows ──────────────────────────────────────────────────
		for (const p of paymentBreakdown) {
			const { error: payErr } = await supabase
				.from("payment_transactions")
				.insert({
					order_id: order.id,
					shift_id: shift_id || null,
					gateway: GATEWAY_BY_METHOD[p.method],
					transaction_reference: p.reference || orderNumber,
					amount: p.amount,
					status: "completed",
					raw_payload: { method: p.method, notes: p.notes },
				});
			if (payErr) throw payErr;
		}

		// ── 10. Customer balances and aggregates ─────────────────────────────
		if (resolvedCustomerId && customerRecord) {
			let newAdvance = Number(customerRecord.advance_balance) || 0;
			let newDue = Number(customerRecord.outstanding_due) || 0;

			if (advanceAmount > 0) {
				newAdvance = round2(newAdvance - advanceAmount);
				await writeLedgerEntry(supabase, {
					partyType: "customer",
					partyId: resolvedCustomerId,
					partyName: customerRecord.name || customer_name,
					entryType: "debit",
					amount: advanceAmount,
					balanceAfter: customerNetBalance(newDue, newAdvance),
					referenceType: "sales_invoice",
					referenceId: orderNumber,
					notes: `Advance deduction for invoice ${orderNumber}`,
				});
			}

			if (dueAmount > 0) {
				newDue = round2(newDue + dueAmount);
				await writeLedgerEntry(supabase, {
					partyType: "customer",
					partyId: resolvedCustomerId,
					partyName: customerRecord.name || customer_name,
					entryType: "debit",
					amount: dueAmount,
					balanceAfter: customerNetBalance(newDue, newAdvance),
					referenceType: "sales_invoice",
					referenceId: orderNumber,
					notes: `Partial due generated on invoice ${orderNumber}`,
				});
			}

			await supabase
				.from("customers")
				.update({
					advance_balance: newAdvance,
					outstanding_due: newDue,
					total_orders: (Number(customerRecord.total_orders) || 0) + 1,
					total_spent: round2(
						(Number(customerRecord.total_spent) || 0) + finalTotal,
					),
				})
				.eq("id", resolvedCustomerId);
		}

		// ── 11. Close out the pre-booking ────────────────────────────────────
		if (preBooking) {
			await supabase
				.from("pre_bookings")
				.update({
					status: "fulfilled",
					fulfilled_order_id: order.id,
					remaining_due: 0,
				})
				.eq("id", preBooking.id);
		}

		// ── 12. Shift totals (atomic, so two tills cannot clobber each other) ─
		if (shift_id) {
			await supabase.rpc("increment_shift_totals", {
				p_shift_id: shift_id,
				p_cash: cashAmount,
				p_card: cardAmount,
				p_mobile: mobileAmount,
				p_wallet: walletAmount,
				p_dues_created: dueAmount,
				p_dues_collected: 0,
			});
		}

		// Hand back the shift so the till can show live drawer figures without
		// a second round trip.
		let shift = null;
		if (shift_id) {
			const { data } = await supabase
				.from("pos_shifts")
				.select("*")
				.eq("id", shift_id)
				.maybeSingle();
			shift = data;
		}

		return NextResponse.json({
			success: true,
			data: {
				order,
				orderNumber: order.order_number,
				subtotal,
				discount,
				total: finalTotal,
				amountSettled,
				dueAmount,
				advanceDeducted: round2(advanceAmount + preBookingAmount),
				shift,
			},
		});
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);

		// Undo whatever landed before the failure, so a half-written sale does
		// not leave stock missing or an order with no payments against it.
		try {
			for (const s of appliedStock) {
				await supabase.rpc("apply_stock_movement", {
					p_product_id: s.product_id,
					p_variation_id: s.variation_id,
					p_warehouse_id: warehouseId,
					p_delta: s.quantity,
					p_adjustment_type: "adjustment",
					p_reason: "Reversal of failed POS checkout",
					p_order_id: null,
					p_user_id: null,
					p_allow_negative: true,
				});
			}

			if (soldDeviceUnitIds.length > 0) {
				await supabase
					.from("device_units")
					.update({ status: "in_stock", sold_order_id: null, sold_at: null })
					.in("id", soldDeviceUnitIds);
			}

			if (createdOrderId) {
				// order_items and payment_transactions cascade or null out.
				await supabase.from("payment_transactions").delete().eq("order_id", createdOrderId);
				await supabase.from("order_items").delete().eq("order_id", createdOrderId);
				await supabase.from("orders").delete().eq("id", createdOrderId);
			}
		} catch (rollbackError) {
			console.error("POS checkout rollback failed:", rollbackError);
		}

		console.error("POS checkout failed:", message);

		const friendly = message.includes("INSUFFICIENT_STOCK")
			? "Stock ran out while settling this sale. Nothing was charged — check the cart and try again."
			: "Checkout could not be completed. Nothing was charged.";

		return NextResponse.json({ success: false, error: friendly }, { status: 500 });
	}
}

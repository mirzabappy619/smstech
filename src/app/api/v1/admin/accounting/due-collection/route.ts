import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { customerNetBalance, writeLedgerEntry } from "@/lib/accounting/ledger";

const round2 = (n: number) => Math.round(n * 100) / 100;

const GATEWAY_BY_METHOD: Record<string, string> = {
	cash: "cash",
	card: "card",
	bkash: "bkash",
	nagad: "nagad",
};

export async function POST(request: Request) {
	try {
		const body = await request.json();
		const { customer_id, amount, payment_method, reference, notes, shift_id } =
			body;

		const payAmount = Number(amount);

		if (!customer_id || !Number.isFinite(payAmount) || payAmount <= 0) {
			return NextResponse.json(
				{
					success: false,
					error: "A customer and an amount greater than zero are required.",
				},
				{ status: 400 },
			);
		}

		const method = payment_method || "cash";
		if (!GATEWAY_BY_METHOD[method]) {
			return NextResponse.json(
				{ success: false, error: `"${method}" is not a payment method this till accepts.` },
				{ status: 400 },
			);
		}

		const supabase = await getSupabaseServerClient();

		const { data: customer, error: fetchErr } = await supabase
			.from("customers")
			.select("id, name, phone, outstanding_due, advance_balance")
			.eq("id", customer_id)
			.single();

		if (fetchErr || !customer) {
			return NextResponse.json(
				{ success: false, error: "Customer not found" },
				{ status: 404 },
			);
		}

		const currentDue = round2(Number(customer.outstanding_due) || 0);
		const newDue = round2(Math.max(0, currentDue - payAmount));
		const excess = round2(Math.max(0, payAmount - currentDue));
		const currentAdvance = round2(Number(customer.advance_balance) || 0);
		const newAdvance = round2(currentAdvance + excess);

		const receiptNumber = `DUE-RCP-${Date.now().toString().slice(-6)}`;
		const appliedToDue = round2(payAmount - excess);

		// 1. Update the customer first, so the ledger rows below record a
		//    balance that actually matches the customer record.
		const { error: updateErr } = await supabase
			.from("customers")
			.update({ outstanding_due: newDue, advance_balance: newAdvance })
			.eq("id", customer.id);

		if (updateErr) throw updateErr;

		// 2. Ledger — the payment against the debt...
		if (appliedToDue > 0) {
			await writeLedgerEntry(supabase, {
				partyType: "customer",
				partyId: customer.id,
				partyName: customer.name,
				entryType: "credit",
				amount: appliedToDue,
				balanceAfter: customerNetBalance(newDue, currentAdvance),
				referenceType: "due_clearance",
				referenceId: receiptNumber,
				notes:
					notes ||
					`Due collection via ${method}${reference ? ` (Ref: ${reference})` : ""}`,
			});
		}

		// ...and, separately, any overpayment converted to wallet credit. This
		// used to vanish: only the new due figure was recorded.
		if (excess > 0) {
			await writeLedgerEntry(supabase, {
				partyType: "customer",
				partyId: customer.id,
				partyName: customer.name,
				entryType: "credit",
				amount: excess,
				balanceAfter: customerNetBalance(newDue, newAdvance),
				referenceType: "advance_deposit",
				referenceId: receiptNumber,
				notes: `Overpayment on ${receiptNumber} credited to advance wallet`,
			});
		}

		// 3. Record the money itself, so due collections show up in payment
		//    reporting alongside sales.
		await supabase.from("payment_transactions").insert({
			order_id: null,
			shift_id: shift_id || null,
			gateway: GATEWAY_BY_METHOD[method],
			transaction_reference: reference || receiptNumber,
			amount: payAmount,
			status: "completed",
			raw_payload: {
				method,
				kind: "due_collection",
				customer_id: customer.id,
				notes: notes || "",
			},
		});

		// 4. Cash collected against a debt is physically in the drawer, so the
		//    shift has to know about it or the close-out will read short.
		if (shift_id && method === "cash") {
			await supabase.rpc("increment_shift_totals", {
				p_shift_id: shift_id,
				p_cash: 0,
				p_card: 0,
				p_mobile: 0,
				p_wallet: 0,
				p_dues_created: 0,
				p_dues_collected: payAmount,
			});
		}

		return NextResponse.json({
			success: true,
			data: {
				receiptNumber,
				customerName: customer.name,
				amountCollected: payAmount,
				previousDue: currentDue,
				remainingDue: newDue,
				advanceAdded: excess,
				date: new Date().toISOString(),
			},
			message: `Due payment of ৳${payAmount.toLocaleString("en-BD")} received from ${customer.name}. Remaining due: ৳${newDue.toLocaleString("en-BD")}`,
		});
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		console.error("Due collection failed:", message);
		return NextResponse.json({ success: false, error: message }, { status: 500 });
	}
}

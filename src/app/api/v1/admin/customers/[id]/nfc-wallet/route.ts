import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { customerNetBalance, writeLedgerEntry } from "@/lib/accounting/ledger";
import { requirePermission } from "@/lib/rbac/rbac-service";

const round2 = (n: number) => Math.round(n * 100) / 100;

const GATEWAY_BY_METHOD: Record<string, string> = {
	cash: "cash",
	card: "card",
	bkash: "bkash",
	nagad: "nagad",
};

const LOYALTY_TIERS = ["Silver", "Gold", "Platinum", "VIP"];

export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const auth = await requirePermission(request, "accounting:manage");
		if (auth.error) return auth.error;

		const { id } = await params;
		const body = await request.json();
		const {
			action,
			nfc_card_uid,
			loyalty_tier,
			credit_limit,
			advance_deposit,
			payment_method,
			reference,
			shift_id,
			reason,
		} = body;

		const supabase = await getSupabaseServerClient();
		const { data: customer, error: custErr } = await supabase
			.from("customers")
			.select("*")
			.eq("id", id)
			.single();

		if (custErr || !customer) {
			return NextResponse.json(
				{ success: false, error: "Customer not found" },
				{ status: 404 },
			);
		}

		if (action === "bind_nfc") {
			const uid = String(nfc_card_uid || "").trim();
			if (!uid) {
				return NextResponse.json(
					{ success: false, error: "Scan or enter a card UID first." },
					{ status: 400 },
				);
			}

			// nfc_card_uid is UNIQUE, so a clash surfaces as 23505. Report which
			// customer already holds the card rather than a raw database error.
			const { data: holder } = await supabase
				.from("customers")
				.select("id, name, customer_code")
				.eq("nfc_card_uid", uid)
				.maybeSingle();

			if (holder && holder.id !== id) {
				return NextResponse.json(
					{
						success: false,
						error: `That card is already bound to ${holder.name} (${holder.customer_code}). Unbind it there first.`,
					},
					{ status: 409 },
				);
			}

			const { data: updated, error } = await supabase
				.from("customers")
				.update({ nfc_card_uid: uid })
				.eq("id", id)
				.select()
				.single();

			if (error) {
				if (error.code === "23505") {
					return NextResponse.json(
						{ success: false, error: "That card is already bound to another customer." },
						{ status: 409 },
					);
				}
				throw error;
			}

			return NextResponse.json({
				success: true,
				data: updated,
				message: `NFC card ${uid} bound successfully.`,
			});
		}

		if (action === "update_tier") {
			if (loyalty_tier && !LOYALTY_TIERS.includes(loyalty_tier)) {
				return NextResponse.json(
					{
						success: false,
						error: `Tier must be one of: ${LOYALTY_TIERS.join(", ")}.`,
					},
					{ status: 400 },
				);
			}

			let limit = customer.credit_limit;
			if (credit_limit !== undefined) {
				limit = Number(credit_limit);
				if (!Number.isFinite(limit) || limit < 0) {
					return NextResponse.json(
						{ success: false, error: "Credit limit must be zero or more." },
						{ status: 400 },
					);
				}
			}

			const { data: updated, error } = await supabase
				.from("customers")
				.update({
					loyalty_tier: loyalty_tier || customer.loyalty_tier,
					credit_limit: limit,
				})
				.eq("id", id)
				.select()
				.single();

			if (error) throw error;
			return NextResponse.json({ success: true, data: updated });
		}

		if (action === "add_advance") {
			const deposit = Number(advance_deposit);
			if (!Number.isFinite(deposit) || deposit <= 0) {
				return NextResponse.json(
					{ success: false, error: "Enter a deposit greater than zero." },
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

			const newBalance = round2(
				(Number(customer.advance_balance) || 0) + deposit,
			);
			const refId = `DEP-${Date.now().toString().slice(-6)}`;

			const { error: updateErr } = await supabase
				.from("customers")
				.update({ advance_balance: newBalance })
				.eq("id", id);
			if (updateErr) throw updateErr;

			await writeLedgerEntry(supabase, {
				partyType: "customer",
				partyId: customer.id,
				partyName: customer.name,
				entryType: "credit",
				amount: deposit,
				balanceAfter: customerNetBalance(customer.outstanding_due, newBalance),
				referenceType: "advance_deposit",
				referenceId: refId,
				notes: reason || "Advance deposit wallet top-up",
			});

			// A deposit is money taken over the counter, so it belongs in
			// payment reporting and in the drawer count.
			await supabase.from("payment_transactions").insert({
				order_id: null,
				shift_id: shift_id || null,
				gateway: GATEWAY_BY_METHOD[method],
				transaction_reference: reference || refId,
				amount: deposit,
				status: "completed",
				raw_payload: {
					method,
					kind: "advance_deposit",
					customer_id: customer.id,
					notes: reason || "",
				},
			});

			if (shift_id && method === "cash") {
				await supabase.rpc("increment_shift_totals", {
					p_shift_id: shift_id,
					p_cash: 0,
					p_card: 0,
					p_mobile: 0,
					p_wallet: 0,
					p_dues_created: 0,
					p_dues_collected: deposit,
				});
			}

			return NextResponse.json({
				success: true,
				newBalance,
				receiptNumber: refId,
				message: `Added ৳${deposit.toLocaleString("en-BD")} advance deposit.`,
			});
		}

		return NextResponse.json(
			{ success: false, error: "Invalid action" },
			{ status: 400 },
		);
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		console.error("NFC wallet action failed:", message);
		return NextResponse.json({ success: false, error: message }, { status: 500 });
	}
}

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/rbac/rbac-service";
import { writeLedgerEntry } from "@/lib/accounting/ledger";
import {
	PARTY_TYPES,
	parseBalanceAdjustment,
	validatePartyUpdate,
	type PartyType,
} from "@/lib/parties";

const round2 = (n: number) => Math.round(n * 100) / 100;

function badRequest(error: string, status = 400) {
	return NextResponse.json({ success: false, error }, { status });
}

/** Which table a party lives in. Customers and suppliers share an id space. */
function partyTypeFrom(request: NextRequest, body: { party_type?: unknown }): PartyType | null {
	const raw =
		(typeof body.party_type === "string" && body.party_type) ||
		new URL(request.url).searchParams.get("party_type") ||
		"";
	return PARTY_TYPES.includes(raw as PartyType) ? (raw as PartyType) : null;
}

/**
 * GET /api/v1/admin/parties/[id]?party_type=customer|supplier
 */
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const auth = await requirePermission(request, "customers:view");
		if (auth.error) return auth.error;

		const { id } = await params;
		const partyType = partyTypeFrom(request, {});
		if (!partyType) return badRequest("Say whether this is a customer or a supplier.");

		const supabase = await getSupabaseServerClient();
		const { data, error } = await supabase
			.from(partyType === "supplier" ? "suppliers" : "customers")
			.select("*")
			.eq("id", id)
			.maybeSingle();

		if (error) throw error;
		if (!data) return badRequest("That party is not registered.", 404);

		return NextResponse.json({ success: true, data });
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		return NextResponse.json({ success: false, error: message }, { status: 500 });
	}
}

/**
 * PATCH /api/v1/admin/parties/[id]
 * Body: { party_type, name?, phone?, credit_limit?, ..., balance_adjustment?, adjustment_reason? }
 *
 * Only the keys present are changed. A balance is never overwritten from a
 * form — `balance_adjustment` posts a signed ledger entry instead, so the
 * running total and its history stay in agreement.
 */
export async function PATCH(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const auth = await requirePermission(request, "customers:edit");
		if (auth.error) return auth.error;

		const { id } = await params;
		const body = await request.json();

		const partyType = partyTypeFrom(request, body);
		if (!partyType) return badRequest("Say whether this is a customer or a supplier.");

		const isSupplier = partyType === "supplier";
		const table = isSupplier ? "suppliers" : "customers";

		const adjustment = parseBalanceAdjustment(body.balance_adjustment);
		if ("error" in adjustment) return badRequest(adjustment.error);

		// A correction to what someone owes has to say why: the ledger row is
		// the only record of it afterwards.
		const reason =
			typeof body.adjustment_reason === "string" ? body.adjustment_reason.trim() : "";
		if (adjustment.value !== 0 && !reason) {
			return badRequest("A balance correction needs a reason.");
		}

		// An empty patch is fine when the request is only posting an adjustment.
		const validated = validatePartyUpdate(partyType, body);
		if ("error" in validated && !(adjustment.value !== 0 && validated.error === "Nothing to change.")) {
			return badRequest(validated.error);
		}
		const patch = "value" in validated ? validated.value : {};

		const supabase = await getSupabaseServerClient();

		const { data: existing, error: fetchErr } = await supabase
			.from(table)
			.select("*")
			.eq("id", id)
			.maybeSingle();

		if (fetchErr) throw fetchErr;
		if (!existing) return badRequest("That party is not registered.", 404);

		// The two tables spell the same ideas differently.
		const update: Record<string, unknown> = {};
		if (patch.name !== undefined) update.name = patch.name;
		if (patch.phone !== undefined) update.phone = patch.phone;
		if (patch.email !== undefined) update.email = patch.email;
		if (patch.notes !== undefined) update.notes = patch.notes;
		if (patch.address !== undefined) {
			update[isSupplier ? "address" : "address_line1"] = patch.address;
		}

		if (isSupplier) {
			if (patch.contact_person !== undefined) update.contact_person = patch.contact_person;
			if (patch.is_active !== undefined) update.is_active = patch.is_active;
		} else {
			if (patch.company_name !== undefined) update.company_name = patch.company_name;
			if (patch.customer_type !== undefined) update.customer_type = patch.customer_type;
			if (patch.credit_limit !== undefined) update.credit_limit = patch.credit_limit;
		}

		// A credit limit cut below what the party already owes is almost always
		// a mistake, and silently allowing it hides an over-limit account.
		if (patch.credit_limit !== undefined) {
			const owed = round2(Number(existing.outstanding_due) || 0);
			if (patch.credit_limit > 0 && patch.credit_limit < owed && body.force !== true) {
				return badRequest(
					`${existing.name} already owes ৳${owed.toLocaleString("en-BD")}, which is more than the ৳${patch.credit_limit.toLocaleString("en-BD")} limit you are setting. Collect the due first, or resend with force to set it anyway.`,
					409,
				);
			}
		}

		let updated = existing;
		if (Object.keys(update).length > 0) {
			const { data, error } = await supabase
				.from(table)
				.update(update)
				.eq("id", id)
				.select()
				.single();

			if (error) {
				if (error.code === "23505") {
					return badRequest(
						`Another party is already registered under "${patch.name}".`,
						409,
					);
				}
				throw error;
			}
			updated = data;
		}

		// ── Balance correction ───────────────────────────────────────────────
		if (adjustment.value !== 0) {
			const reference = `ADJ-${Date.now().toString().slice(-8)}`;

			if (isSupplier) {
				const { data: latest } = await supabase
					.from("party_ledgers")
					.select("balance_after")
					.eq("party_type", "supplier")
					.eq("party_id", id)
					.order("created_at", { ascending: false })
					.limit(1)
					.maybeSingle();

				const previous = round2(Number(latest?.balance_after) || 0);
				const next = round2(previous + adjustment.value);
				if (next < 0) {
					return badRequest(
						`That correction would take the payable below zero — only ৳${previous.toLocaleString("en-BD")} is outstanding.`,
					);
				}

				await writeLedgerEntry(supabase, {
					partyType: "supplier",
					partyId: id,
					partyName: updated.name,
					// A bigger payable is a credit; paying it down is a debit.
					entryType: adjustment.value > 0 ? "credit" : "debit",
					amount: Math.abs(adjustment.value),
					balanceAfter: next,
					referenceType: "adjustment",
					referenceId: reference,
					notes: reason,
				});
			} else {
				const previous = round2(Number(updated.outstanding_due) || 0);
				const next = round2(previous + adjustment.value);
				if (next < 0) {
					return badRequest(
						`That correction would take the due below zero — only ৳${previous.toLocaleString("en-BD")} is owed.`,
					);
				}

				const { data: rebalanced, error: dueErr } = await supabase
					.from("customers")
					.update({ outstanding_due: next })
					.eq("id", id)
					.select()
					.single();
				if (dueErr) throw dueErr;
				updated = rebalanced;

				await writeLedgerEntry(supabase, {
					partyType: "customer",
					partyId: id,
					partyName: updated.name,
					// More owed is a debit against the customer; less is a credit.
					entryType: adjustment.value > 0 ? "debit" : "credit",
					amount: Math.abs(adjustment.value),
					balanceAfter: next,
					referenceType: "adjustment",
					referenceId: reference,
					notes: reason,
				});
			}
		}

		return NextResponse.json({ success: true, data: updated });
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		console.error("Party update failed:", message);
		return NextResponse.json({ success: false, error: message }, { status: 500 });
	}
}

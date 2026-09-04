import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { buildIlikeOr } from "@/lib/supabase/filters";
import { requirePermission } from "@/lib/rbac/rbac-service";
import { writeLedgerEntry } from "@/lib/accounting/ledger";
import {
	PARTY_TYPES,
	generatePartyCode,
	validateParty,
	type Party,
	type PartyType,
} from "@/lib/parties";

const round2 = (n: number) => Math.round(n * 100) / 100;

function badRequest(error: string, status = 400) {
	return NextResponse.json({ success: false, error }, { status });
}

/**
 * GET /api/v1/admin/parties?type=customer|supplier|all&customer_type=wholesale&q=
 *
 * The unified party list: sell-side parties from `customers`, buy-side from
 * `suppliers`, in one shape so the pickers on the POS, Batch Sell and Batch Buy
 * screens all read the same rows.
 */
export async function GET(request: NextRequest) {
	try {
		const auth = await requirePermission(request, "customers:view");
		if (auth.error) return auth.error;

		const { searchParams } = new URL(request.url);
		const type = searchParams.get("type") || "all";
		const customerType = searchParams.get("customer_type");
		const query = searchParams.get("q")?.trim();
		const limit = Math.min(Number(searchParams.get("limit")) || 100, 500);

		if (type !== "all" && !PARTY_TYPES.includes(type as PartyType)) {
			return badRequest(`"${type}" is not a party type.`);
		}

		const supabase = await getSupabaseServerClient();
		const parties: Party[] = [];

		if (type === "all" || type === "customer") {
			let customerQuery = supabase
				.from("customers")
				.select(
					"id, name, company_name, customer_code, phone, email, address_line1, customer_type, credit_limit, outstanding_due, advance_balance, created_at",
				)
				.order("name")
				.limit(limit);

			if (customerType) customerQuery = customerQuery.eq("customer_type", customerType);

			const filter = buildIlikeOr(["name", "phone", "customer_code", "company_name"], query);
			if (filter) customerQuery = customerQuery.or(filter);

			const { data, error } = await customerQuery;
			if (error) throw error;

			for (const row of data || []) {
				parties.push({
					id: row.id,
					party_type: "customer",
					customer_type: row.customer_type || "retail",
					name: row.name,
					company_name: row.company_name ?? null,
					code: row.customer_code ?? null,
					phone: row.phone ?? null,
					email: row.email ?? null,
					address: row.address_line1 ?? null,
					credit_limit: round2(Number(row.credit_limit) || 0),
					balance: round2(Number(row.outstanding_due) || 0),
					advance_balance: round2(Number(row.advance_balance) || 0),
					is_active: true,
					created_at: row.created_at ?? null,
				});
			}
		}

		if (type === "all" || type === "supplier") {
			let supplierQuery = supabase
				.from("suppliers")
				.select(
					"id, name, supplier_code, contact_person, phone, email, address, opening_balance, is_active, created_at",
				)
				.eq("is_active", true)
				.order("name")
				.limit(limit);

			const filter = buildIlikeOr(["name", "phone", "supplier_code"], query);
			if (filter) supplierQuery = supplierQuery.or(filter);

			const { data, error } = await supplierQuery;
			if (error) throw error;

			// What we owe a supplier is the running total in the ledger, not a
			// column on the row — reading it back keeps one source of truth.
			// Fetched for the whole page in one query: asking per supplier meant
			// a round trip each, which is hundreds of them on a full list.
			const payableByParty = new Map<string, number>();
			const supplierIds = (data || []).map((row) => row.id);

			if (supplierIds.length > 0) {
				const { data: ledgerRows } = await supabase
					.from("party_ledgers")
					.select("party_id, balance_after, created_at")
					.eq("party_type", "supplier")
					.in("party_id", supplierIds)
					.order("created_at", { ascending: false });

				// Rows arrive newest first, so the first one seen for a party is
				// its current running balance.
				for (const entry of ledgerRows || []) {
					if (!payableByParty.has(entry.party_id)) {
						payableByParty.set(entry.party_id, round2(Number(entry.balance_after) || 0));
					}
				}
			}

			for (const row of data || []) {
				parties.push({
					id: row.id,
					party_type: "supplier",
					customer_type: null,
					name: row.name,
					company_name: row.contact_person ?? null,
					code: row.supplier_code ?? null,
					phone: row.phone ?? null,
					email: row.email ?? null,
					address: row.address ?? null,
					credit_limit: 0,
					balance: payableByParty.get(row.id) ?? round2(Number(row.opening_balance) || 0),
					advance_balance: 0,
					is_active: row.is_active,
					created_at: row.created_at ?? null,
				});
			}
		}

		return NextResponse.json({ success: true, data: parties });
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		console.error("Party list failed:", message);
		return NextResponse.json({ success: false, error: message }, { status: 500 });
	}
}

/**
 * POST /api/v1/admin/parties
 * Body: { party_type: "customer" | "supplier", name, phone, ... }
 *
 * Registers a party. An opening balance is posted to the ledger rather than
 * written straight onto the record, so a party that starts life owing money
 * has that showing in its history from the first day.
 */
export async function POST(request: NextRequest) {
	try {
		const auth = await requirePermission(request, "customers:edit");
		if (auth.error) return auth.error;

		const body = await request.json();
		const partyType = body.party_type;

		if (!PARTY_TYPES.includes(partyType)) {
			return badRequest("Choose whether this is a customer or a supplier.");
		}

		const validated = validateParty(partyType, body);
		if ("error" in validated) return badRequest(validated.error);
		const party = validated.value;

		const supabase = await getSupabaseServerClient();
		const code = generatePartyCode(partyType);

		if (partyType === "supplier") {
			const { data: supplier, error } = await supabase
				.from("suppliers")
				.insert({
					name: party.name,
					supplier_code: code,
					contact_person: party.contact_person,
					phone: party.phone,
					email: party.email,
					address: party.address,
					opening_balance: party.opening_balance,
					notes: party.notes,
					is_active: true,
				})
				.select()
				.single();

			if (error) {
				if (error.code === "23505") {
					return badRequest(`A supplier named "${party.name}" is already registered.`, 409);
				}
				throw error;
			}

			if (party.opening_balance > 0) {
				await writeLedgerEntry(supabase, {
					partyType: "supplier",
					partyId: supplier.id,
					partyName: supplier.name,
					entryType: "credit",
					amount: party.opening_balance,
					balanceAfter: party.opening_balance,
					referenceType: "adjustment",
					referenceId: code,
					notes: "Opening balance carried in at registration",
				});
			}

			return NextResponse.json({ success: true, data: supplier }, { status: 201 });
		}

		const { data: customer, error } = await supabase
			.from("customers")
			.insert({
				name: party.name,
				company_name: party.company_name,
				customer_code: code,
				phone: party.phone,
				email: party.email,
				address_line1: party.address,
				customer_type: party.customer_type,
				credit_limit: party.credit_limit,
				outstanding_due: party.opening_balance,
				advance_balance: 0,
				total_orders: 0,
				total_spent: 0,
				notes: party.notes,
			})
			.select()
			.single();

		if (error) {
			if (error.code === "23505") {
				return badRequest("A party with that code already exists. Try again.", 409);
			}
			throw error;
		}

		if (party.opening_balance > 0) {
			await writeLedgerEntry(supabase, {
				partyType: "customer",
				partyId: customer.id,
				partyName: customer.name,
				entryType: "debit",
				amount: party.opening_balance,
				balanceAfter: party.opening_balance,
				referenceType: "adjustment",
				referenceId: code,
				notes: "Opening due carried in at registration",
			});
		}

		return NextResponse.json({ success: true, data: customer }, { status: 201 });
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		console.error("Party create failed:", message);
		return NextResponse.json({ success: false, error: message }, { status: 500 });
	}
}

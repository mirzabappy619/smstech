/**
 * Party ledger helpers.
 *
 * `party_ledgers.balance_after` previously meant five different things
 * depending on which route wrote the row — the customer's wallet in one place,
 * their outstanding due in another, and a bare bill amount in procurement. That
 * made the running balance impossible to reconstruct.
 *
 * One convention now applies everywhere:
 *
 *   customer  balance_after = net receivable = outstanding_due - advance_balance
 *                             (positive: they owe us; negative: we hold their money)
 *   supplier  balance_after = running payable, accumulated across every entry
 *                             (positive: we owe them)
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseLike = any;

export type LedgerReferenceType =
	| "sales_invoice"
	| "purchase_bill"
	| "payment_received"
	| "payment_made"
	| "refund"
	| "advance_deposit"
	| "due_clearance"
	| "adjustment";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Net amount a customer owes, given their two balance columns. */
export function customerNetBalance(
	outstandingDue: number | string | null | undefined,
	advanceBalance: number | string | null | undefined,
): number {
	return round2((Number(outstandingDue) || 0) - (Number(advanceBalance) || 0));
}

/**
 * Current running payable for a supplier, derived from their ledger history.
 * Credits increase what we owe; debits (payments made) reduce it.
 */
export async function supplierRunningBalance(
	supabase: SupabaseLike,
	partyId: string,
): Promise<number> {
	const { data } = await supabase
		.from("party_ledgers")
		.select("balance_after")
		.eq("party_type", "supplier")
		.eq("party_id", partyId)
		.order("created_at", { ascending: false })
		.limit(1)
		.maybeSingle();

	return round2(Number(data?.balance_after) || 0);
}

export interface LedgerEntry {
	partyType: "customer" | "supplier";
	partyId: string;
	partyName: string;
	entryType: "debit" | "credit";
	amount: number;
	balanceAfter: number;
	referenceType: LedgerReferenceType;
	referenceId: string;
	notes?: string;
}

/** Write one ledger row. Amounts must be positive; direction is entryType. */
export async function writeLedgerEntry(
	supabase: SupabaseLike,
	entry: LedgerEntry,
): Promise<void> {
	if (entry.amount <= 0) return;

	const { error } = await supabase.from("party_ledgers").insert({
		party_type: entry.partyType,
		party_id: entry.partyId,
		party_name: entry.partyName,
		entry_type: entry.entryType,
		amount: round2(entry.amount),
		balance_after: round2(entry.balanceAfter),
		reference_type: entry.referenceType,
		reference_id: entry.referenceId,
		notes: entry.notes || null,
	});

	if (error) throw error;
}

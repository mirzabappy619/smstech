/**
 * Parties: everyone the shop owes money to or is owed money by.
 *
 * Sell-side parties live in `customers` — a walk-in and a corporate wholesale
 * account are the same record with the same balance columns, separated only by
 * `customer_type` so each screen can list the ones it cares about.
 * Buy-side parties live in `suppliers`.
 *
 * Both sides post to `party_ledgers` under the conventions in ./accounting/ledger.
 */

export type PartyType = "customer" | "supplier";
export type CustomerType = "retail" | "wholesale";

export const PARTY_TYPES: PartyType[] = ["customer", "supplier"];
export const CUSTOMER_TYPES: CustomerType[] = ["retail", "wholesale"];

const round2 = (n: number) => Math.round(n * 100) / 100;

/** One row of the unified party list the admin screens render. */
export interface Party {
	id: string;
	party_type: PartyType;
	/** retail | wholesale for customers; null for suppliers. */
	customer_type: CustomerType | null;
	name: string;
	company_name: string | null;
	code: string | null;
	phone: string | null;
	email: string | null;
	address: string | null;
	credit_limit: number;
	/** Positive: they owe us (customer) or we owe them (supplier). */
	balance: number;
	/** Money of theirs we are holding. Customers only. */
	advance_balance: number;
	is_active: boolean;
	created_at: string | null;
}

export interface PartyInput {
	name?: unknown;
	company_name?: unknown;
	phone?: unknown;
	email?: unknown;
	address?: unknown;
	contact_person?: unknown;
	credit_limit?: unknown;
	opening_balance?: unknown;
	customer_type?: unknown;
	notes?: unknown;
}

/**
 * Rejects a party that could not be traced back to a person later. A name
 * alone is not enough for a party that can be sold to on credit, so a contact
 * number is required — it is how the shop chases a due.
 */
export function validateParty(
	partyType: PartyType,
	input: PartyInput,
): { error: string } | { value: NormalisedParty } {
	const name = typeof input.name === "string" ? input.name.trim() : "";
	if (!name) return { error: "A name is required." };
	if (name.length > 200) return { error: "That name is too long." };

	const phone = typeof input.phone === "string" ? input.phone.trim() : "";
	if (!phone) {
		return { error: "A contact number is required — it is how a due gets chased." };
	}

	const email = typeof input.email === "string" ? input.email.trim() : "";
	if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		return { error: "That email address is not valid." };
	}

	const customerType =
		typeof input.customer_type === "string" ? input.customer_type : "retail";
	if (partyType === "customer" && !CUSTOMER_TYPES.includes(customerType as CustomerType)) {
		return { error: `"${customerType}" is not a customer type.` };
	}

	const creditLimit = parseMoney(input.credit_limit);
	if (creditLimit === null) {
		return { error: "Credit limit must be zero or more." };
	}

	const openingBalance = parseMoney(input.opening_balance);
	if (openingBalance === null) {
		return { error: "Opening balance must be zero or more." };
	}

	return {
		value: {
			name,
			company_name: trimOrNull(input.company_name),
			phone,
			email: email || null,
			address: trimOrNull(input.address),
			contact_person: trimOrNull(input.contact_person),
			customer_type: partyType === "customer" ? (customerType as CustomerType) : null,
			credit_limit: creditLimit,
			opening_balance: openingBalance,
			notes: trimOrNull(input.notes),
		},
	};
}

/** Fields an edit may change. Balances are deliberately not among them. */
export interface PartyPatch {
	name?: string;
	company_name?: string | null;
	contact_person?: string | null;
	phone?: string;
	email?: string | null;
	address?: string | null;
	customer_type?: CustomerType;
	credit_limit?: number;
	is_active?: boolean;
	notes?: string | null;
}

/**
 * Validates an edit. Only the keys actually present are touched, so a form
 * that submits one field does not blank the rest.
 *
 * `outstanding_due` and the supplier payable are not editable here: a balance
 * is the sum of the party's ledger history, and letting a form overwrite it
 * would put the two permanently out of step. Use `balance_adjustment` for a
 * deliberate correction — it posts an entry instead of rewriting the total.
 */
export function validatePartyUpdate(
	partyType: PartyType,
	input: PartyInput & { is_active?: unknown },
): { error: string } | { value: PartyPatch } {
	const patch: PartyPatch = {};

	if (input.name !== undefined) {
		const name = typeof input.name === "string" ? input.name.trim() : "";
		if (!name) return { error: "A name is required." };
		if (name.length > 200) return { error: "That name is too long." };
		patch.name = name;
	}

	if (input.phone !== undefined) {
		const phone = typeof input.phone === "string" ? input.phone.trim() : "";
		if (!phone) {
			return { error: "A contact number is required — it is how a due gets chased." };
		}
		patch.phone = phone;
	}

	if (input.email !== undefined) {
		const email = typeof input.email === "string" ? input.email.trim() : "";
		if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			return { error: "That email address is not valid." };
		}
		patch.email = email || null;
	}

	if (input.company_name !== undefined) patch.company_name = trimOrNull(input.company_name);
	if (input.contact_person !== undefined) {
		patch.contact_person = trimOrNull(input.contact_person);
	}
	if (input.address !== undefined) patch.address = trimOrNull(input.address);
	if (input.notes !== undefined) patch.notes = trimOrNull(input.notes);

	if (input.customer_type !== undefined) {
		if (partyType !== "customer") {
			return { error: "Only a customer has a retail or wholesale type." };
		}
		const customerType = String(input.customer_type);
		if (!CUSTOMER_TYPES.includes(customerType as CustomerType)) {
			return { error: `"${customerType}" is not a customer type.` };
		}
		patch.customer_type = customerType as CustomerType;
	}

	if (input.credit_limit !== undefined) {
		if (partyType !== "customer") {
			return { error: "A credit limit applies to customers, not suppliers." };
		}
		const creditLimit = parseMoney(input.credit_limit);
		if (creditLimit === null) return { error: "Credit limit must be zero or more." };
		patch.credit_limit = creditLimit;
	}

	if (input.is_active !== undefined) {
		if (typeof input.is_active !== "boolean") {
			return { error: "Active must be true or false." };
		}
		patch.is_active = input.is_active;
	}

	if (Object.keys(patch).length === 0) {
		return { error: "Nothing to change." };
	}

	return { value: patch };
}

/**
 * A deliberate correction to what a party owes — a mistyped opening balance,
 * a written-off remainder. Signed: positive increases what is owed.
 */
export function parseBalanceAdjustment(
	value: unknown,
): { error: string } | { value: number } {
	if (value === undefined || value === null || value === "") return { value: 0 };

	const amount = Number(value);
	if (!Number.isFinite(amount)) {
		return { error: "That adjustment is not a number." };
	}
	return { value: round2(amount) };
}

export interface NormalisedParty {
	name: string;
	company_name: string | null;
	phone: string;
	email: string | null;
	address: string | null;
	contact_person: string | null;
	customer_type: CustomerType | null;
	credit_limit: number;
	opening_balance: number;
	notes: string | null;
}

function trimOrNull(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	return trimmed ? trimmed : null;
}

/** Money from a form field. Returns null when the value is unusable. */
function parseMoney(value: unknown): number | null {
	if (value === undefined || value === null || value === "") return 0;
	const amount = Number(value);
	if (!Number.isFinite(amount) || amount < 0) return null;
	return round2(amount);
}

/**
 * Whether a credit sale of `amount` fits inside a party's remaining headroom.
 * A zero limit means no credit at all, which is the default for a new party —
 * credit is something the shop grants deliberately.
 */
export function creditHeadroom(party: {
	credit_limit?: number | string | null;
	outstanding_due?: number | string | null;
}): number {
	const limit = Number(party.credit_limit) || 0;
	const due = Number(party.outstanding_due) || 0;
	return round2(limit - due);
}

export interface CreditCheck {
	ok: boolean;
	headroom: number;
	message?: string;
}

export function checkCreditLimit(
	party: {
		name?: string | null;
		credit_limit?: number | string | null;
		outstanding_due?: number | string | null;
	},
	amount: number,
	tolerance = 0.01,
): CreditCheck {
	const headroom = creditHeadroom(party);
	if (amount <= headroom + tolerance) return { ok: true, headroom };

	const who = party.name || "This party";
	const limit = Number(party.credit_limit) || 0;
	return {
		ok: false,
		headroom,
		message:
			limit <= 0
				? `${who} has no credit limit set, so nothing can be sold to them on due. Set a limit in Customer Management first.`
				: `That due takes ${who} ৳${round2((Number(party.outstanding_due) || 0) + amount).toLocaleString("en-BD")} over a ৳${limit.toLocaleString("en-BD")} credit limit — only ৳${headroom.toLocaleString("en-BD")} of credit is left.`,
	};
}

/** Short human-facing code for a newly registered party. */
export function generatePartyCode(partyType: PartyType): string {
	const prefix = partyType === "supplier" ? "SUPP" : "CUST";
	const suffix = Math.random().toString(36).substring(2, 8).toUpperCase();
	return `${prefix}-${suffix}`;
}

/**
 * Warranty terms for serialized hardware.
 *
 * The term (in months) is captured when a unit is taken into stock; the clock
 * only starts when the unit is sold. Every sale path must go through
 * `activateWarranty` so a unit's warranty window is derived from its own term
 * rather than from a constant at the call site.
 */

export const DEFAULT_WARRANTY_MONTHS = 12;
export const MAX_WARRANTY_MONTHS = 120;

/**
 * Parse a warranty term coming from a form field or a JSON body.
 * Returns null when the value is not a usable term, so callers can decide
 * between rejecting the request and falling back to the default.
 */
export function parseWarrantyMonths(value: unknown): number | null {
	if (value === undefined || value === null || value === "") return null;
	const months = Number(value);
	if (!Number.isInteger(months)) return null;
	if (months < 0 || months > MAX_WARRANTY_MONTHS) return null;
	return months;
}

/**
 * Add whole months to a date, clamping the day of month so that, for example,
 * 31 Jan + 1 month lands on 28/29 Feb rather than rolling into March the way
 * `setMonth` does on its own.
 */
export function addMonths(from: Date, months: number): Date {
	const result = new Date(from.getTime());
	const targetDay = result.getUTCDate();
	result.setUTCMonth(result.getUTCMonth() + months);
	if (result.getUTCDate() < targetDay) {
		// Overflowed into the next month — step back to its last day.
		result.setUTCDate(0);
	}
	return result;
}

/**
 * The device_units patch that starts a warranty. `months` is the term stored
 * on the unit; a term of 0 sells the unit with no warranty, which is recorded
 * as a start with no expiry rather than as a missing warranty.
 */
export function activateWarranty(
	months: number | null | undefined,
	soldAt: Date = new Date(),
): {
	warranty_months: number;
	warranty_starts_at: string;
	warranty_expires_at: string | null;
} {
	const term =
		months === null || months === undefined ? DEFAULT_WARRANTY_MONTHS : months;

	return {
		warranty_months: term,
		warranty_starts_at: soldAt.toISOString(),
		warranty_expires_at:
			term > 0 ? addMonths(soldAt, term).toISOString() : null,
	};
}

/** Clears a warranty when a sale is rolled back and the unit goes back on the shelf. */
export const CLEARED_WARRANTY = {
	warranty_starts_at: null,
	warranty_expires_at: null,
} as const;

export type WarrantyState = "not_started" | "active" | "expired" | "none";

/**
 * How a unit's warranty should read on screen. `not_started` is the normal
 * state for anything still in stock — the term is known, the clock is not
 * running yet.
 */
export function warrantyState(unit: {
	warranty_months?: number | null;
	warranty_starts_at?: string | null;
	warranty_expires_at?: string | null;
}): WarrantyState {
	if (!unit.warranty_starts_at) return "not_started";
	if (!unit.warranty_expires_at) return "none";
	return new Date(unit.warranty_expires_at).getTime() > Date.now()
		? "active"
		: "expired";
}

/** Whole days left on an active warranty; 0 once it has run out. */
export function warrantyDaysRemaining(expiresAt: string | null | undefined): number {
	if (!expiresAt) return 0;
	const ms = new Date(expiresAt).getTime() - Date.now();
	return ms > 0 ? Math.ceil(ms / (24 * 60 * 60 * 1000)) : 0;
}

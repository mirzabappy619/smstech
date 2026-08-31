/**
 * The `users` table stores a single `full_name` column, while the admin UI and
 * several API responses are built around first/last name pairs. These helpers
 * are the one place that conversion happens, so the two shapes stay in step.
 */

/** Splits a stored full name into a first/last pair. */
export function splitFullName(fullName?: string | null): {
	first_name: string;
	last_name: string;
} {
	const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return { first_name: "", last_name: "" };
	// Everything after the first token is the surname, so "Abu Mirza Bappy"
	// round-trips through joinFullName() unchanged.
	return { first_name: parts[0], last_name: parts.slice(1).join(" ") };
}

/** Builds the stored full name from a first/last pair. */
export function joinFullName(
	firstName?: string | null,
	lastName?: string | null,
): string {
	return [firstName, lastName]
		.map((p) => (p ?? "").trim())
		.filter(Boolean)
		.join(" ");
}

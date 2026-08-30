/**
 * Escaping helpers for PostgREST filter strings.
 *
 * `.or("col.ilike.%TERM%,other.ilike.%TERM%")` is parsed as a comma-separated
 * expression list, so a raw search term containing a comma, parenthesis or
 * quote restructures the filter rather than being matched literally. These
 * routes run under the service-role key, so a malformed filter is not just a
 * 400 — it can widen the match.
 */

/**
 * Make a user-supplied term safe to embed inside a PostgREST `or()` expression.
 * Wraps the pattern in double quotes and escapes the characters that would
 * otherwise terminate it, and neutralises LIKE wildcards the user typed.
 */
export function escapeIlikePattern(term: string): string {
	const escaped = term
		// Backslash first, so later escapes are not double-processed.
		.replace(/\\/g, "\\\\")
		.replace(/"/g, '\\"')
		// LIKE wildcards typed by the user should match literally.
		.replace(/%/g, "\\%")
		.replace(/_/g, "\\_");

	return `"%${escaped}%"`;
}

/**
 * Build an `or()` expression matching `term` against each column with ilike.
 * Returns null when the term is empty, so callers can skip the filter.
 */
export function buildIlikeOr(
	columns: string[],
	term: string | null | undefined,
): string | null {
	const trimmed = (term || "").trim();
	if (!trimmed) return null;

	const pattern = escapeIlikePattern(trimmed);
	return columns.map((c) => `${c}.ilike.${pattern}`).join(",");
}

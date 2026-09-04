/**
 * Which sidebar entry owns the current admin route.
 *
 * Several entries are nested under another entry's path (/admin/inventory and
 * its children, /admin/pos and /admin/pos/orders, /admin/approvals and
 * /admin/approvals/pipelines). A plain `startsWith` lights up the parent and
 * the child at the same time, so the route goes to the most specific entry
 * that matches it, and only that one.
 */
export function resolveActiveNavHref(
	pathname: string,
	allHrefs: readonly string[],
): string | null {
	const matches = allHrefs.filter(
		(href) => pathname === href || pathname.startsWith(href + "/"),
	);
	if (matches.length === 0) return null;

	return matches.reduce((longest, href) =>
		href.length > longest.length ? href : longest,
	);
}

export function isNavItemActive(
	pathname: string,
	href: string,
	allHrefs: readonly string[],
): boolean {
	// The dashboard also answers to the bare /admin route.
	if (href === "/admin/dashboard") {
		return pathname === "/admin/dashboard" || pathname === "/admin";
	}
	return resolveActiveNavHref(pathname, allHrefs) === href;
}

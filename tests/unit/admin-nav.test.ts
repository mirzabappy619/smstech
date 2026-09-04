import { describe, it, expect } from "vitest";
import { isNavItemActive, resolveActiveNavHref } from "@/lib/admin-nav";

// The nested pairs from the real sidebar — these are the ones that used to
// light up two entries at once.
const HREFS = [
	"/admin/dashboard",
	"/admin/pos",
	"/admin/pos/orders",
	"/admin/orders",
	"/admin/approvals",
	"/admin/approvals/pipelines",
	"/admin/products",
	"/admin/inventory",
	"/admin/inventory/warehouse",
	"/admin/inventory/serialized",
	"/admin/inventory/transfers",
	"/admin/inventory/procurement",
	"/admin/settings",
];

const activeCount = (pathname: string) =>
	HREFS.filter((href) => isNavItemActive(pathname, href, HREFS)).length;

describe("Admin sidebar active route", () => {
	it("never lights up more than one entry", () => {
		for (const pathname of [
			"/admin",
			"/admin/dashboard",
			"/admin/pos",
			"/admin/pos/orders",
			"/admin/approvals",
			"/admin/approvals/pipelines",
			"/admin/inventory",
			"/admin/inventory/warehouse",
			"/admin/inventory/serialized",
			"/admin/inventory/transfers",
			"/admin/inventory/procurement",
			"/admin/products",
			"/admin/settings",
		]) {
			expect(activeCount(pathname), pathname).toBe(1);
		}
	});

	it("gives a nested route to the child, not the parent", () => {
		// Branch Transfers lit up alongside Stock Levels before this.
		expect(isNavItemActive("/admin/inventory/transfers", "/admin/inventory", HREFS)).toBe(false);
		expect(isNavItemActive("/admin/inventory/transfers", "/admin/inventory/transfers", HREFS)).toBe(true);

		expect(isNavItemActive("/admin/pos/orders", "/admin/pos", HREFS)).toBe(false);
		expect(isNavItemActive("/admin/approvals/pipelines", "/admin/approvals", HREFS)).toBe(false);
	});

	it("keeps a parent active on its own route and on its unlisted sub-pages", () => {
		expect(isNavItemActive("/admin/inventory", "/admin/inventory", HREFS)).toBe(true);
		// A detail page with no sidebar entry of its own belongs to its parent.
		expect(isNavItemActive("/admin/orders/abc-123", "/admin/orders", HREFS)).toBe(true);
		expect(isNavItemActive("/admin/products/new", "/admin/products", HREFS)).toBe(true);
	});

	it("treats the bare /admin route as the dashboard", () => {
		expect(isNavItemActive("/admin", "/admin/dashboard", HREFS)).toBe(true);
		expect(activeCount("/admin")).toBe(1);
	});

	it("matches on whole path segments, not string prefixes", () => {
		// /admin/orders must not claim /admin/orders-archive.
		expect(resolveActiveNavHref("/admin/orders-archive", HREFS)).toBeNull();
	});

	it("reports no active entry for a route outside the sidebar", () => {
		expect(resolveActiveNavHref("/admin/nowhere", HREFS)).toBeNull();
	});
});

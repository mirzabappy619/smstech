import { describe, it, expect } from "vitest";
import { isNavItemActive, resolveActiveNavHref } from "@/lib/admin-nav";
import { ALL_NAV_HREFS, NAV_GROUPS } from "@/app/admin/admin-layout-client";

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
	"/admin/inventory/procurement/buy",
	"/admin/inventory/procurement/dispatch",
	"/admin/inventory/procurement/exchange",
	"/admin/inventory/procurement/purchases",
	"/admin/inventory/procurement/sales",
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

	it("gives each procurement sub-page its own entry", () => {
		// The five screens used to be tabs on one page. Now that each is a
		// route with a sidebar entry, the parent must step aside for them.
		for (const page of ["buy", "dispatch", "exchange", "purchases", "sales"]) {
			const pathname = `/admin/inventory/procurement/${page}`;
			expect(isNavItemActive(pathname, pathname, HREFS)).toBe(true);
			expect(isNavItemActive(pathname, "/admin/inventory/procurement", HREFS)).toBe(false);
			expect(isNavItemActive(pathname, "/admin/inventory", HREFS)).toBe(false);
			expect(activeCount(pathname)).toBe(1);
		}
	});

	it("keeps the procurement parent active on its own index route", () => {
		// The index redirects to /buy, but it is a real entry until it does.
		expect(isNavItemActive("/admin/inventory/procurement", "/admin/inventory/procurement", HREFS)).toBe(true);
		expect(activeCount("/admin/inventory/procurement")).toBe(1);
	});
});

describe("Sidebar wiring", () => {
	const allItems = NAV_GROUPS.flatMap((group) => group.items);

	it("lists every procurement screen under the procurement entry", () => {
		// The five pages replaced five tabs. If they are not here they are
		// unreachable from the sidebar, which is how they shipped the first time.
		const procurement = allItems.find(
			(item) => item.href === "/admin/inventory/procurement",
		);

		expect(procurement).toBeDefined();
		expect(procurement?.children?.map((child) => child.href)).toEqual([
			"/admin/inventory/procurement/buy",
			"/admin/inventory/procurement/dispatch",
			"/admin/inventory/procurement/exchange",
			"/admin/inventory/procurement/purchases",
			"/admin/inventory/procurement/sales",
		]);
	});

	it("puts every sub-page href in the activation set", () => {
		// The longest-match resolver only sees hrefs it was handed; a child
		// missing here leaves its parent lit on the child's own route.
		for (const item of allItems) {
			for (const child of item.children ?? []) {
				expect(ALL_NAV_HREFS).toContain(child.href);
			}
		}
	});

	it("nests sub-pages under their parent's path", () => {
		for (const item of allItems) {
			for (const child of item.children ?? []) {
				expect(child.href.startsWith(`${item.href}/`)).toBe(true);
			}
		}
	});

	it("gives every sub-page a label and a permission", () => {
		for (const item of allItems) {
			for (const child of item.children ?? []) {
				expect(child.label.trim().length).toBeGreaterThan(0);
				expect(child.permission).toBeTruthy();
			}
		}
	});

	it("has no duplicate hrefs across the whole sidebar", () => {
		expect(new Set(ALL_NAV_HREFS).size).toBe(ALL_NAV_HREFS.length);
	});
});

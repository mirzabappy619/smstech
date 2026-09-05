/**
 * The counter list resolves three overlapping product lists. It used to do
 * that one list at a time — three product queries, three variation queries and
 * three stock queries for what is nearly the same set of rows — which is what
 * made the POS screen slow to settle. These tests pin both the shape of the
 * result and the number of round trips it takes to get there.
 */
import { describe, it, expect } from "vitest";
import {
	attachBranchStock,
	fetchPosProductGroups,
	isSellable,
	type PosProductRow,
} from "@/lib/pos/catalog";

interface Rows {
	products: Record<string, unknown>[];
	product_variations: Record<string, unknown>[];
	inventory: Record<string, unknown>[];
}

/**
 * Minimal stand-in for the Supabase query builder: every chained filter
 * returns itself, awaiting it yields that table's rows, and each `from()` is
 * counted as one round trip.
 */
function fakeClient(rows: Rows) {
	const tables: string[] = [];

	const builder = (table: keyof Rows) => {
		const self: Record<string, unknown> = {};
		for (const method of ["select", "in", "eq", "gt", "gte", "not", "order", "limit"]) {
			self[method] = () => self;
		}
		self.then = (resolve: (v: { data: unknown[] }) => unknown) =>
			resolve({ data: rows[table] ?? [] });
		return self;
	};

	return {
		client: {
			from(table: string) {
				tables.push(table);
				return builder(table as keyof Rows);
			},
		} as never,
		tables,
	};
}

const product = (id: string, name: string) => ({
	id,
	name,
	sku: `SKU-${id}`,
	brand: "Test",
	base_price: 1000,
	images: [],
	warranty: null,
});

describe("branch stock attachment", () => {
	it("keeps pooled and variation stock apart", async () => {
		// The till sells the base product against the pooled row only; stock
		// held on a variation is reachable through the picker, never as the
		// base product. Summing them together reported stock it could not sell.
		const { client } = fakeClient({
			products: [],
			product_variations: [
				{ id: "v1", product_id: "p1", name: "512GB", sku: "S1", price: 1200, attributes: null, images: [] },
			],
			inventory: [
				{ product_id: "p1", variation_id: null, available_quantity: 2 },
				{ product_id: "p1", variation_id: "v1", available_quantity: 5 },
			],
		});

		const [row] = await attachBranchStock(client, [product("p1", "Thing")], "branch-1");

		expect(row.available_quantity).toBe(2);
		expect(row.variation_quantity).toBe(5);
		expect(row.variations[0].available_quantity).toBe(5);
		expect(isSellable(row)).toBe(true);
	});

	it("reads stock in one wave, not one query per product", async () => {
		const { client, tables } = fakeClient({
			products: [],
			product_variations: [],
			inventory: [],
		});

		await attachBranchStock(
			client,
			[product("p1", "One"), product("p2", "Two"), product("p3", "Three")],
			"branch-1",
		);

		expect(tables).toEqual(["product_variations", "inventory"]);
	});

	it("skips the stock query when there is no branch to count against", async () => {
		const { client, tables } = fakeClient({
			products: [],
			product_variations: [],
			inventory: [],
		});

		await attachBranchStock(client, [product("p1", "One")], null);

		expect(tables).toEqual(["product_variations"]);
	});

	it("does not query at all for an empty list", async () => {
		const { client, tables } = fakeClient({ products: [], product_variations: [], inventory: [] });

		expect(await attachBranchStock(client, [], "branch-1")).toEqual([]);
		expect(tables).toEqual([]);
	});
});

describe("counter list hydration", () => {
	const rows: Rows = {
		products: [product("p1", "One"), product("p2", "Two"), product("p3", "Three")],
		product_variations: [],
		inventory: [
			{ product_id: "p1", variation_id: null, available_quantity: 4 },
			{ product_id: "p2", variation_id: null, available_quantity: 1 },
			{ product_id: "p3", variation_id: null, available_quantity: 0 },
		],
	};

	it("resolves three overlapping lists in three queries", async () => {
		const { client, tables } = fakeClient(rows);

		await fetchPosProductGroups(
			client,
			{ recent: ["p1", "p2"], top: ["p2", "p3"], browse: ["p1", "p2", "p3"] },
			"branch-1",
		);

		// One products read for the union, then variations and stock for it.
		// Per-list hydration made this nine.
		expect(tables).toEqual(["products", "product_variations", "inventory"]);
	});

	it("gives each list back in the order it asked for", async () => {
		// "Last sold" is a recency ordering; returning it alphabetised or in
		// whatever order the database felt like would make the row meaningless.
		const { client } = fakeClient(rows);

		const { recent, top } = await fetchPosProductGroups(
			client,
			{ recent: ["p3", "p1", "p2"], top: ["p2", "p1"] },
			"branch-1",
		);

		expect(recent.map((p) => p.id)).toEqual(["p3", "p1", "p2"]);
		expect(top.map((p) => p.id)).toEqual(["p2", "p1"]);
	});

	it("drops ids that no longer resolve to an active product", async () => {
		const { client } = fakeClient(rows);

		const { recent } = await fetchPosProductGroups(
			client,
			{ recent: ["p1", "deleted-product"] },
			"branch-1",
		);

		expect(recent.map((p) => p.id)).toEqual(["p1"]);
	});

	it("returns empty lists without touching the database", async () => {
		const { client, tables } = fakeClient(rows);

		const result = await fetchPosProductGroups(client, { recent: [], top: [] }, "branch-1");

		expect(result).toEqual({ recent: [], top: [] });
		expect(tables).toEqual([]);
	});
});

describe("sellability", () => {
	const base = (over: Partial<PosProductRow>): PosProductRow => ({
		id: "p1",
		name: "Thing",
		sku: "SKU",
		brand: null,
		base_price: 1,
		images: [],
		warranty: null,
		available_quantity: 0,
		variation_quantity: 0,
		variations: [],
		...over,
	});

	it("counts a variation with stock as sellable", () => {
		expect(
			isSellable(
				base({
					variations: [
						{ id: "v1", name: "A", sku: "A", price: 1, attributes: null, images: [], available_quantity: 3 },
					],
				}),
			),
		).toBe(true);
	});

	it("refuses a product with nothing anywhere", () => {
		expect(isSellable(base({}))).toBe(false);
	});
});

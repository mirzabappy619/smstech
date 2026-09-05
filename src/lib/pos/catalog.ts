/**
 * Shared shaping for everything the POS lists: search results, the idle
 * catalogue, "last sold" and "most sold".
 *
 * Two rules the till depends on:
 *
 *  - Stock is per branch and per variation. The pooled row (variation_id IS
 *    NULL) is what the base product sells against; each variation draws down
 *    its own row. Summing them together reported stock the till could not
 *    actually sell.
 *  - A product whose stock is entirely on variations is still sellable — but
 *    only through the variation picker, never as the base product.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** Columns every POS product row needs, wherever it was fetched from. */
export const POS_PRODUCT_COLUMNS =
	"id, name, sku, brand, base_price, compare_at_price, images, warranty, stock_count, track_inventory";

export interface PosVariationRow {
	id: string;
	name: string;
	sku: string;
	price: number;
	attributes: Record<string, unknown> | null;
	images: string[];
	available_quantity: number;
}

export interface PosProductRow {
	id: string;
	name: string;
	sku: string | null;
	brand: string | null;
	base_price: number;
	images: string[];
	warranty: string | null;
	/** On-hand against the pooled row — what the base product can sell. */
	available_quantity: number;
	/** On-hand held against variations, sellable only through the picker. */
	variation_quantity: number;
	variations: PosVariationRow[];
	[key: string]: unknown;
}

type Client = SupabaseClient<any, any, any>;

/**
 * Attach this branch's on-hand figures and the sellable variations to a set of
 * product rows. Runs two queries for the whole page rather than one per
 * product.
 */
export async function attachBranchStock(
	supabase: Client,
	products: Record<string, unknown>[],
	warehouseId: string | null,
): Promise<PosProductRow[]> {
	const base = products.map((p) => ({
		...p,
		available_quantity: 0,
		variation_quantity: 0,
		variations: [] as PosVariationRow[],
	})) as PosProductRow[];

	if (base.length === 0) return base;

	const productIds = base.map((p) => p.id);

	const { data: variationRows } = await supabase
		.from("product_variations")
		.select("id, product_id, name, sku, price, attributes, images")
		.in("product_id", productIds)
		.eq("is_active", true)
		.order("name");

	// Without a branch there is nothing to count against, but the variations
	// are still worth returning so the picker can render.
	const pooled = new Map<string, number>();
	const heldOnVariations = new Map<string, number>();
	const byVariation = new Map<string, number>();

	if (warehouseId) {
		const { data: stockRows } = await supabase
			.from("inventory")
			.select("product_id, variation_id, available_quantity")
			.eq("warehouse_id", warehouseId)
			.in("product_id", productIds);

		for (const row of stockRows || []) {
			const qty = row.available_quantity ?? 0;
			if (row.variation_id) {
				heldOnVariations.set(
					row.product_id,
					(heldOnVariations.get(row.product_id) || 0) + qty,
				);
				byVariation.set(row.variation_id, (byVariation.get(row.variation_id) || 0) + qty);
			} else {
				pooled.set(row.product_id, (pooled.get(row.product_id) || 0) + qty);
			}
		}
	}

	const variationsByProduct = new Map<string, PosVariationRow[]>();
	for (const v of variationRows || []) {
		const list = variationsByProduct.get(v.product_id) || [];
		list.push({
			id: v.id,
			name: v.name,
			sku: v.sku,
			price: Number(v.price) || 0,
			attributes: (v.attributes as Record<string, unknown>) ?? null,
			images: Array.isArray(v.images) ? v.images : [],
			available_quantity: byVariation.get(v.id) ?? 0,
		});
		variationsByProduct.set(v.product_id, list);
	}

	return base.map((p) => ({
		...p,
		available_quantity: pooled.get(p.id) ?? 0,
		variation_quantity: heldOnVariations.get(p.id) ?? 0,
		variations: variationsByProduct.get(p.id) || [],
	}));
}

/**
 * Fetch products by id and shape them for the till, preserving the order the
 * ids were given in — the "last sold" row is meaningless if it comes back
 * alphabetised.
 */
export async function fetchPosProductsByIds(
	supabase: Client,
	productIds: string[],
	warehouseId: string | null,
): Promise<PosProductRow[]> {
	if (productIds.length === 0) return [];

	const { data: products } = await supabase
		.from("products")
		.select(POS_PRODUCT_COLUMNS)
		.in("id", productIds)
		.eq("is_active", true);

	const hydrated = await attachBranchStock(supabase, products || [], warehouseId);
	const byId = new Map(hydrated.map((p) => [p.id, p]));

	return productIds
		.map((id) => byId.get(id))
		.filter((p): p is PosProductRow => Boolean(p));
}

/** True when the till can ring this product up at all, base or variation. */
export function isSellable(product: PosProductRow): boolean {
	return (
		product.available_quantity > 0 ||
		product.variations.some((v) => v.available_quantity > 0)
	);
}

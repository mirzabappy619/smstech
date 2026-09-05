import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission, hasBranchAccess } from "@/lib/rbac/rbac-service";
import {
	POS_PRODUCT_COLUMNS,
	attachBranchStock,
	fetchPosProductGroups,
} from "@/lib/pos/catalog";

/** How far back "most sold" looks. Long enough to be stable, short enough to
 *  follow what the branch is actually shifting this season. */
const TOP_SELLER_WINDOW_DAYS = 90;

const ROW_LIMIT = 12;
const BROWSE_LIMIT = 40;

/** Rows of sales history the best-seller tally reads. Capped because it is a
 *  shortcut on a till screen, not a report. */
const TOP_SELLER_SCAN_LIMIT = 1000;

/** Distinct product ids in the order they were seen, up to a limit. */
function distinctIds(
	rows: { product_id?: string | null }[] | null,
	limit: number,
): string[] {
	const seen = new Set<string>();
	for (const row of rows || []) {
		const id = row.product_id;
		if (id) seen.add(id);
		if (seen.size >= limit) break;
	}
	return [...seen];
}

/**
 * GET /api/v1/admin/pos/catalog?warehouse_id=...
 *
 * What the till shows before anyone types: the branch's recent sales, its best
 * sellers, and the stock it currently holds. Everything is scoped to the
 * selected branch — a product that sold well in Banani is not a shortcut at
 * the Uttara counter.
 */
export async function GET(request: NextRequest) {
	try {
		const auth = await requirePermission(request, "pos:access");
		if (auth.error) return auth.error;

		const { searchParams } = new URL(request.url);
		const warehouseId = searchParams.get("warehouse_id");

		if (warehouseId && !hasBranchAccess(auth.userRBAC.branchContext, warehouseId)) {
			return NextResponse.json(
				{ success: false, error: "You do not have access to this branch." },
				{ status: 403 },
			);
		}

		const supabase = await getSupabaseServerClient();

		// ── Which products go in each row ───────────────────────────────────
		// Three independent lookups that the cashier is waiting on together,
		// so they go out together rather than one after another.
		const since = new Date(
			Date.now() - TOP_SELLER_WINDOW_DAYS * 24 * 60 * 60 * 1000,
		).toISOString();

		// Recently sold: read more rows than the row shows, because the same
		// product sells repeatedly and this is a list of distinct products.
		let recentQuery = supabase
			.from("order_items")
			.select("product_id, created_at, orders!inner(warehouse_id)")
			.not("product_id", "is", null)
			.order("created_at", { ascending: false })
			.limit(200);

		// Best sellers: only the two columns the tally needs. Pulling the row
		// wholesale moved far more over the wire than it summed.
		let topQuery = supabase
			.from("order_items")
			.select("product_id, quantity, orders!inner(warehouse_id)")
			.not("product_id", "is", null)
			.gte("created_at", since)
			.limit(TOP_SELLER_SCAN_LIMIT);

		// What the branch is holding right now, driven off inventory so the
		// browse grid only ever offers stock that is on this shelf.
		let stockedQuery = supabase
			.from("inventory")
			.select("product_id, available_quantity")
			.gt("available_quantity", 0)
			.order("available_quantity", { ascending: false })
			.limit(400);

		if (warehouseId) {
			recentQuery = recentQuery.eq("orders.warehouse_id", warehouseId);
			topQuery = topQuery.eq("orders.warehouse_id", warehouseId);
			stockedQuery = stockedQuery.eq("warehouse_id", warehouseId);
		}

		const [{ data: recentRows }, { data: topRows }, { data: stockedRows }] =
			await Promise.all([
				recentQuery,
				topQuery,
				warehouseId
					? stockedQuery
					: Promise.resolve({ data: [] as { product_id: string }[] }),
			]);

		const recentIds = distinctIds(recentRows, ROW_LIMIT);

		const soldQty = new Map<string, number>();
		for (const row of topRows || []) {
			const id = row.product_id as string;
			if (!id) continue;
			soldQty.set(id, (soldQty.get(id) || 0) + (Number(row.quantity) || 0));
		}

		const topIds = [...soldQty.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, ROW_LIMIT)
			.map(([id]) => id);

		const browseIds = distinctIds(stockedRows, BROWSE_LIMIT);

		// ── Hydrate all three rows from one pass ────────────────────────────
		// The lists overlap heavily — a best seller is usually also in stock —
		// so this resolves the union once instead of three times over.
		const { recent, top, browse } = await fetchPosProductGroups(
			supabase,
			{ recent: recentIds, top: topIds, browse: browseIds },
			warehouseId,
		);

		// The browse grid falls back to the newest active products when the
		// branch has no inventory rows yet, so the screen is never blank.
		let browseProducts = browse;

		if (browseProducts.length === 0) {
			const { data: fallback } = await supabase
				.from("products")
				.select(POS_PRODUCT_COLUMNS)
				.eq("is_active", true)
				.order("created_at", { ascending: false })
				.limit(BROWSE_LIMIT);

			browseProducts = await attachBranchStock(supabase, fallback || [], warehouseId);
		}

		return NextResponse.json({
			success: true,
			data: {
				recent,
				top,
				browse: browseProducts,
				top_seller_window_days: TOP_SELLER_WINDOW_DAYS,
			},
		});
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		console.error("POS catalog failed:", message);
		return NextResponse.json(
			{ success: false, error: "Failed to load the POS catalogue" },
			{ status: 500 },
		);
	}
}

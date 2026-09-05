import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission, hasBranchAccess } from "@/lib/rbac/rbac-service";
import {
	POS_PRODUCT_COLUMNS,
	attachBranchStock,
	fetchPosProductsByIds,
} from "@/lib/pos/catalog";

/** How far back "most sold" looks. Long enough to be stable, short enough to
 *  follow what the branch is actually shifting this season. */
const TOP_SELLER_WINDOW_DAYS = 90;

const ROW_LIMIT = 12;
const BROWSE_LIMIT = 40;

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

		// ── Recently sold at this branch ────────────────────────────────────
		// Read more rows than we need: the same product sells repeatedly, and
		// the row is a list of distinct products, newest first.
		let recentQuery = supabase
			.from("order_items")
			.select("product_id, created_at, orders!inner(warehouse_id)")
			.not("product_id", "is", null)
			.order("created_at", { ascending: false })
			.limit(200);

		if (warehouseId) recentQuery = recentQuery.eq("orders.warehouse_id", warehouseId);

		const { data: recentRows } = await recentQuery;

		const recentIds: string[] = [];
		for (const row of recentRows || []) {
			const id = row.product_id as string;
			if (id && !recentIds.includes(id)) recentIds.push(id);
			if (recentIds.length >= ROW_LIMIT) break;
		}

		// ── Best sellers over the window ────────────────────────────────────
		const since = new Date(
			Date.now() - TOP_SELLER_WINDOW_DAYS * 24 * 60 * 60 * 1000,
		).toISOString();

		let topQuery = supabase
			.from("order_items")
			.select("product_id, quantity, created_at, orders!inner(warehouse_id)")
			.not("product_id", "is", null)
			.gte("created_at", since)
			.limit(2000);

		if (warehouseId) topQuery = topQuery.eq("orders.warehouse_id", warehouseId);

		const { data: topRows } = await topQuery;

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

		// ── What the branch is holding right now ────────────────────────────
		// Driven off inventory rather than the catalogue, so the browse grid
		// only ever offers stock that is actually on the shelf here.
		const browseIds: string[] = [];

		if (warehouseId) {
			const { data: stocked } = await supabase
				.from("inventory")
				.select("product_id, available_quantity")
				.eq("warehouse_id", warehouseId)
				.gt("available_quantity", 0)
				.order("available_quantity", { ascending: false })
				.limit(400);

			for (const row of stocked || []) {
				const id = row.product_id as string;
				if (id && !browseIds.includes(id)) browseIds.push(id);
				if (browseIds.length >= BROWSE_LIMIT) break;
			}
		}

		const [recent, top] = await Promise.all([
			fetchPosProductsByIds(supabase, recentIds, warehouseId),
			fetchPosProductsByIds(supabase, topIds, warehouseId),
		]);

		// The browse grid falls back to the newest active products when the
		// branch has no inventory rows yet, so the screen is never blank.
		let browse = await fetchPosProductsByIds(supabase, browseIds, warehouseId);

		if (browse.length === 0) {
			const { data: fallback } = await supabase
				.from("products")
				.select(POS_PRODUCT_COLUMNS)
				.eq("is_active", true)
				.order("created_at", { ascending: false })
				.limit(BROWSE_LIMIT);

			browse = await attachBranchStock(supabase, fallback || [], warehouseId);
		}

		return NextResponse.json({
			success: true,
			data: {
				recent,
				top,
				browse,
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

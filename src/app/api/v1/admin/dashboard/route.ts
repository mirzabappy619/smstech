import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin, jsonResponse, errorResponse } from "@/lib/api-utils";

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Month boundaries in the store's own timezone.
 *
 * created_at is stored in UTC. Building boundaries with the server's local
 * clock misfiled the first hours of every month, and using `new Date(y, m, 0)`
 * for "end of last month" landed on midnight of the 31st, silently dropping
 * that whole day from the comparison.
 */
const STORE_UTC_OFFSET_HOURS = 6; // Asia/Dhaka, UTC+6

function storeMonthStart(yearsBack: number, monthsBack: number): Date {
	const now = new Date();
	// Shift into store-local time to decide which month we are in.
	const local = new Date(now.getTime() + STORE_UTC_OFFSET_HOURS * 3600_000);
	const year = local.getUTCFullYear() - yearsBack;
	const month = local.getUTCMonth() - monthsBack;
	// Midnight store-local, expressed as the equivalent UTC instant.
	return new Date(
		Date.UTC(year, month, 1, -STORE_UTC_OFFSET_HOURS, 0, 0, 0),
	);
}

export async function GET(request: NextRequest) {
	try {
		const { error: authError } = await requireAdmin(request);
		if (authError) return authError;

		const { searchParams } = new URL(request.url);
		const warehouseParam = searchParams.get("warehouse_id");
		const warehouseId =
			warehouseParam && warehouseParam !== "all" ? warehouseParam : null;

		const supabase = await createAdminClient();

		const startOfThisMonth = storeMonthStart(0, 0);
		const startOfLastMonth = storeMonthStart(0, 1);

		// All aggregates run as SQL. Previously these were unbounded
		// `.select()` calls reduced in JavaScript, which PostgREST silently
		// capped at 1000 rows — so every figure froze once the store passed
		// that many orders.
		const [
			allTime,
			thisMonth,
			lastMonth,
			byStatus,
			customerBalances,
			preBookingStats,
		] = await Promise.all([
			supabase.rpc("admin_order_totals", {
				p_warehouse_id: warehouseId,
				p_from: null,
				p_to: null,
			}),
			supabase.rpc("admin_order_totals", {
				p_warehouse_id: warehouseId,
				p_from: startOfThisMonth.toISOString(),
				p_to: null,
			}),
			supabase.rpc("admin_order_totals", {
				p_warehouse_id: warehouseId,
				p_from: startOfLastMonth.toISOString(),
				// Exclusive upper bound, so the last day of the month is included.
				p_to: startOfThisMonth.toISOString(),
			}),
			supabase.rpc("admin_orders_by_status", { p_warehouse_id: warehouseId }),
			supabase.rpc("admin_customer_balances"),
			supabase.rpc("admin_prebooking_stats"),
		]);

		const first = <T>(res: { data: T[] | null }): T | null =>
			(res.data && res.data[0]) || null;

		const totals = first<{
			order_count: number;
			revenue: number;
			cogs: number;
			items_sold: number;
		}>(allTime);
		const thisMonthTotals = first<{ revenue: number }>(thisMonth);
		const lastMonthTotals = first<{ revenue: number }>(lastMonth);
		const balances = first<{
			customer_count: number;
			dues_receivable: number;
			advance_liabilities: number;
		}>(customerBalances);
		const preBookings = first<{ total: number; converted: number }>(
			preBookingStats,
		);

		const totalRevenue = round2(Number(totals?.revenue) || 0);
		const thisMonthRevenue = round2(Number(thisMonthTotals?.revenue) || 0);
		const lastMonthRevenue = round2(Number(lastMonthTotals?.revenue) || 0);

		const revenueChangePercent =
			lastMonthRevenue > 0
				? Math.round(
						((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100,
					)
				: thisMonthRevenue > 0
					? 100
					: 0;

		// Cost of goods now comes from the cost_price captured on each
		// serialized unit at intake, rather than a hardcoded 78% of revenue
		// that pinned gross margin at 22% forever.
		//
		// It only covers serialized stock, so it is reported alongside the
		// share of revenue it accounts for instead of being passed off as a
		// whole-business margin.
		const knownCOGS = round2(Number(totals?.cogs) || 0);
		const grossProfit = round2(totalRevenue - knownCOGS);
		const grossMarginPct =
			totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 100) : 0;

		const statusCounts: Record<string, number> = {};
		for (const row of (byStatus.data || []) as {
			status: string;
			count: number;
		}[]) {
			statusCounts[row.status] = Number(row.count) || 0;
		}

		const totalOrders = Number(totals?.order_count) || 0;

		const [{ count: totalProducts }, { count: totalSerializedUnits }] =
			await Promise.all([
				supabase
					.from("products")
					.select("*", { count: "exact", head: true })
					.eq("is_active", true),
				(() => {
					let q = supabase
						.from("device_units")
						.select("*", { count: "exact", head: true })
						.eq("status", "in_stock");
					if (warehouseId) q = q.eq("warehouse_id", warehouseId);
					return q;
				})(),
			]);

		let recentQuery = supabase
			.from("orders")
			.select("id, order_number, customer_name, total, status, created_at")
			.order("created_at", { ascending: false })
			.limit(5);
		if (warehouseId) recentQuery = recentQuery.eq("warehouse_id", warehouseId);
		const { data: recentOrders } = await recentQuery;

		// Low stock now reads the inventory table (which POS sales actually
		// move) rather than products.stock_count, a seed value nothing updates.
		let lowStockQuery = supabase
			.from("inventory")
			.select("id, available_quantity, reorder_point, products ( id, name )")
			.order("available_quantity", { ascending: true })
			.limit(5);
		if (warehouseId) lowStockQuery = lowStockQuery.eq("warehouse_id", warehouseId);
		const { data: lowStockRows } = await lowStockQuery;

		return jsonResponse({
			stats: {
				totalOrders,
				totalRevenue,
				totalItemsSold: Number(totals?.items_sold) || 0,
				totalCustomers: Number(balances?.customer_count) || 0,
				totalProducts: totalProducts || 0,
				totalSerializedUnits: totalSerializedUnits || 0,
				thisMonthRevenue,
				lastMonthRevenue,
				revenueChangePercent,
				knownCOGS,
				grossProfit,
				grossMarginPct,
				// Makes clear how much of revenue the COGS figure actually covers.
				cogsCoverageNote:
					"Cost of goods covers serialized units only; bulk stock has no cost price recorded.",
				totalDuesReceivable: round2(Number(balances?.dues_receivable) || 0),
				totalAdvanceLiabilities: round2(
					Number(balances?.advance_liabilities) || 0,
				),
				totalPreBookings: Number(preBookings?.total) || 0,
				preBookingConversionRate:
					Number(preBookings?.total) > 0
						? Math.round(
								(Number(preBookings?.converted) /
									Number(preBookings?.total)) *
									100,
							)
						: 0,
				// Revenue excludes cancelled and refunded orders; these counts
				// are of all orders, so they will not sum to totalOrders.
				ordersByStatus: {
					pending: statusCounts.pending || 0,
					processing: statusCounts.processing || 0,
					shipped: statusCounts.shipped || 0,
					delivered: statusCounts.delivered || 0,
					cancelled: statusCounts.cancelled || 0,
					refunded: statusCounts.refunded || 0,
				},
			},
			recentOrders: (recentOrders || []).map((o) => ({
				id: o.id,
				order_number: o.order_number,
				customer_name: o.customer_name,
				total: Number(o.total),
				status: o.status,
				created_at: o.created_at,
			})),
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			lowStockProducts: (lowStockRows || []).map((r: any) => ({
				id: r.products?.id || r.id,
				name: r.products?.name || "Unknown product",
				stock: r.available_quantity ?? 0,
				reorder_point: r.reorder_point ?? 0,
			})),
		});
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		console.error("Dashboard fetch failed:", message);
		return errorResponse(
			"SERVER_ERROR",
			"Failed to fetch dashboard data",
			500,
		);
	}
}

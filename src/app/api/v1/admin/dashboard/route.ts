import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin, jsonResponse, errorResponse } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
	try {
		const { error: authError } = await requireAdmin(request);
		if (authError) return authError;

		const { searchParams } = new URL(request.url);
		const warehouseId = searchParams.get("warehouse_id");

		const supabase = await createAdminClient();

		const now = new Date();
		const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
		const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
		const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

		let ordersQuery = supabase
			.from("orders")
			.select("id, order_number, total, subtotal, status, created_at, customer_name, warehouse_id");

		if (warehouseId && warehouseId !== "all") {
			ordersQuery = ordersQuery.eq("warehouse_id", warehouseId);
		}

		const { data: allOrders } = await ordersQuery;
		const totalOrders = allOrders?.length || 0;
		const totalRevenue = allOrders?.reduce((s, o) => s + (Number(o.total) || 0), 0) || 0;

		const thisMonthOrders = allOrders?.filter(o => new Date(o.created_at) >= startOfMonth) || [];
		const thisMonthRevenue = thisMonthOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);

		const lastMonthOrders = allOrders?.filter(o => {
			const d = new Date(o.created_at);
			return d >= startOfLastMonth && d <= endOfLastMonth;
		}) || [];
		const lastMonthRevenue = lastMonthOrders.reduce((s, o) => s + (Number(o.total) || 0), 0);

		const revenueChangePercent = lastMonthRevenue > 0
			? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
			: 0;

		const estimatedCOGS = Math.round(totalRevenue * 0.78);
		const grossProfit = totalRevenue - estimatedCOGS;
		const grossMarginPct = totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 100) : 0;

		const { data: customers } = await supabase.from("customers").select("advance_balance, outstanding_due");
		const totalDuesReceivable = customers?.reduce((s, c) => s + (Number(c.outstanding_due) || 0), 0) || 0;
		const totalAdvanceLiabilities = customers?.reduce((s, c) => s + (Number(c.advance_balance) || 0), 0) || 0;

		const { data: preBookings } = await supabase.from("pre_bookings").select("id, status, advance_paid");
		const totalPreBookings = preBookings ? preBookings.length : 0;
		const preBookingConversionRate = (preBookings && preBookings.length > 0)
			? Math.round((preBookings.filter(b => b.status === "fulfilled" || b.status === "allocated").length / preBookings.length) * 100)
			: 0;

		const { count: totalProducts } = await supabase.from("products").select("*", { count: "exact", head: true }).eq("is_active", true);
		const { count: totalSerializedUnits } = await supabase.from("device_units").select("*", { count: "exact", head: true }).eq("status", "in_stock");

		const recentOrders = (allOrders || [])
			.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
			.slice(0, 5)
			.map(o => ({
				id: o.id,
				order_number: o.order_number,
				customer_name: o.customer_name,
				total: Number(o.total),
				status: o.status,
				created_at: o.created_at
			}));

		const { data: lowStockProducts } = await supabase
			.from("products")
			.select("id, name, stock_count")
			.lte("stock_count", 5)
			.limit(5);

		return jsonResponse({
			stats: {
				totalOrders,
				totalRevenue,
				totalCustomers: customers?.length || 0,
				totalProducts: totalProducts || 0,
				totalSerializedUnits: totalSerializedUnits || 0,
				thisMonthRevenue,
				lastMonthRevenue,
				revenueChangePercent,
				estimatedCOGS,
				grossProfit,
				grossMarginPct,
				totalDuesReceivable,
				totalAdvanceLiabilities,
				totalPreBookings,
				preBookingConversionRate,
				ordersByStatus: {
					pending: allOrders?.filter(o => o.status === "pending").length || 0,
					confirmed: allOrders?.filter(o => o.status === "confirmed").length || 0,
					processing: allOrders?.filter(o => o.status === "processing").length || 0,
					shipped: allOrders?.filter(o => o.status === "shipped").length || 0,
					delivered: allOrders?.filter(o => o.status === "delivered").length || 0,
					cancelled: allOrders?.filter(o => o.status === "cancelled").length || 0,
					refunded: allOrders?.filter(o => o.status === "refunded").length || 0,
				}
			},
			recentOrders,
			lowStockProducts: (lowStockProducts || []).map(p => ({
				id: p.id,
				name: p.name,
				stock: p.stock_count || 0
			}))
		});
	} catch (error: any) {
		return errorResponse(error.message || "Failed to fetch dashboard data", "SERVER_ERROR", 500);
	}
}

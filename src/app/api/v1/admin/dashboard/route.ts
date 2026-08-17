/**
 * Admin Dashboard API
 * Returns aggregated dashboard statistics
 */

import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin, jsonResponse, errorResponse } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
	try {
		const { error: authError } = await requireAdmin(request);
		if (authError) return authError;

		const supabase = await createAdminClient();

		// Get current date info
		const now = new Date();
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
		const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
		const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

		// Fetch total orders count
		const { count: totalOrders } = await supabase
			.from("orders")
			.select("*", { count: "exact", head: true });

		// Fetch total revenue (sum of all completed orders)
		const { data: revenueData } = await supabase
			.from("orders")
			.select("total")
			.in("status", ["delivered", "completed", "confirmed", "shipped"]);

		const totalRevenue =
			revenueData?.reduce(
				(sum, order) => sum + (parseFloat(order.total) || 0),
				0,
			) || 0;

		// Fetch this month's revenue
		const { data: monthRevenueData } = await supabase
			.from("orders")
			.select("total")
			.gte("created_at", startOfMonth.toISOString())
			.in("status", ["delivered", "completed", "confirmed", "shipped"]);

		const thisMonthRevenue =
			monthRevenueData?.reduce(
				(sum, order) => sum + (parseFloat(order.total) || 0),
				0,
			) || 0;

		// Fetch last month's revenue
		const { data: lastMonthRevenueData } = await supabase
			.from("orders")
			.select("total")
			.gte("created_at", startOfLastMonth.toISOString())
			.lte("created_at", endOfLastMonth.toISOString())
			.in("status", ["delivered", "completed", "confirmed", "shipped"]);

		const lastMonthRevenue =
			lastMonthRevenueData?.reduce(
				(sum, order) => sum + (parseFloat(order.total) || 0),
				0,
			) || 0;

		// Fetch total customers
		const { count: totalCustomers } = await supabase
			.from("users")
			.select("*", { count: "exact", head: true })
			.eq("role", "customer");

		// Fetch new customers this month
		const { count: newCustomersThisMonth } = await supabase
			.from("users")
			.select("*", { count: "exact", head: true })
			.eq("role", "customer")
			.gte("created_at", startOfMonth.toISOString());

		// Fetch total products
		const { count: totalProducts } = await supabase
			.from("products")
			.select("*", { count: "exact", head: true })
			.eq("is_active", true);

		// Fetch orders by status
		const { data: ordersByStatus } = await supabase
			.from("orders")
			.select("status");

		const orderStatusCounts =
			ordersByStatus?.reduce(
				(acc, order) => {
					acc[order.status] = (acc[order.status] || 0) + 1;
					return acc;
				},
				{} as Record<string, number>,
			) || {};

		// Fetch recent orders
		const { data: recentOrders } = await supabase
			.from("orders")
			.select(
				`
				id,
				order_number,
				total,
				status,
				created_at,
				users (
					first_name,
					last_name,
					email
				)
			`,
			)
			.order("created_at", { ascending: false })
			.limit(10);

		// Fetch low stock products
		const { data: lowStockProducts } = await supabase
			.from("products")
			.select("id, name, stock_quantity")
			.eq("is_active", true)
			.eq("track_inventory", true)
			.lt("stock_quantity", 10)
			.order("stock_quantity", { ascending: true })
			.limit(10);

		// Fetch today's orders
		const { count: todayOrders } = await supabase
			.from("orders")
			.select("*", { count: "exact", head: true })
			.gte("created_at", today.toISOString());

		// Fetch today's revenue
		const { data: todayRevenueData } = await supabase
			.from("orders")
			.select("total")
			.gte("created_at", today.toISOString())
			.in("status", [
				"delivered",
				"completed",
				"confirmed",
				"shipped",
				"pending",
				"processing",
			]);

		const todayRevenue =
			todayRevenueData?.reduce(
				(sum, order) => sum + (parseFloat(order.total) || 0),
				0,
			) || 0;

		// Calculate revenue change percentage
		const revenueChangePercent =
			lastMonthRevenue > 0
				? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
				: thisMonthRevenue > 0
					? 100
					: 0;

		return jsonResponse({
			stats: {
				totalOrders: totalOrders || 0,
				totalRevenue,
				totalCustomers: totalCustomers || 0,
				totalProducts: totalProducts || 0,
				todayOrders: todayOrders || 0,
				todayRevenue,
				thisMonthRevenue,
				lastMonthRevenue,
				revenueChangePercent: parseFloat(revenueChangePercent.toFixed(1)),
				newCustomersThisMonth: newCustomersThisMonth || 0,
				ordersByStatus: {
					pending: orderStatusCounts.pending || 0,
					confirmed: orderStatusCounts.confirmed || 0,
					processing: orderStatusCounts.processing || 0,
					shipped: orderStatusCounts.shipped || 0,
					delivered: orderStatusCounts.delivered || 0,
					cancelled: orderStatusCounts.cancelled || 0,
					refunded: orderStatusCounts.refunded || 0,
				},
			},
			recentOrders: (recentOrders || []).map((order: any) => ({
				id: order.id,
				order_number: order.order_number,
				total: parseFloat(order.total) || 0,
				status: order.status,
				created_at: order.created_at,
				customer_name: order.users
					? `${order.users.first_name || ""} ${order.users.last_name || ""}`.trim() ||
						order.users.email
					: "Guest",
			})),
			lowStockProducts: (lowStockProducts || []).map((product: any) => ({
				id: product.id,
				name: product.name,
				stock: product.stock_quantity,
			})),
		});
	} catch (error) {
		console.error("Dashboard API error:", error);
		return errorResponse(
			"INTERNAL_ERROR",
			"Failed to fetch dashboard data",
			500,
		);
	}
}

/**
 * Admin Analytics API
 * Returns detailed analytics data with time range support
 */

import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin, jsonResponse, errorResponse } from "@/lib/api-utils";

function getDateRange(range: string): { start: Date; end: Date } {
	const end = new Date();
	const start = new Date();

	switch (range) {
		case "7d":
			start.setDate(start.getDate() - 7);
			break;
		case "30d":
			start.setDate(start.getDate() - 30);
			break;
		case "90d":
			start.setDate(start.getDate() - 90);
			break;
		case "12m":
			start.setMonth(start.getMonth() - 12);
			break;
		default:
			start.setDate(start.getDate() - 30);
	}

	return { start, end };
}

export async function GET(request: NextRequest) {
	try {
		const { error: authError } = await requireAdmin(request);
		if (authError) return authError;

		const { searchParams } = new URL(request.url);
		const range = searchParams.get("range") || "30d";

		const supabase = await createAdminClient();
		const { start, end } = getDateRange(range);

		// Revenue data within range
		const { data: ordersInRange } = await supabase
			.from("orders")
			.select("id, total, status, created_at")
			.gte("created_at", start.toISOString())
			.lte("created_at", end.toISOString());

		const completedOrders =
			ordersInRange?.filter((o) =>
				["delivered", "completed", "confirmed", "shipped"].includes(o.status),
			) || [];

		const totalRevenue = completedOrders.reduce(
			(sum, order) => sum + (parseFloat(order.total) || 0),
			0,
		);

		const totalOrders = ordersInRange?.length || 0;
		const completedOrdersCount = completedOrders.length;
		const averageOrderValue =
			completedOrdersCount > 0 ? totalRevenue / completedOrdersCount : 0;

		// Calculate previous period for comparison
		const previousStart = new Date(start);
		previousStart.setTime(
			previousStart.getTime() - (end.getTime() - start.getTime()),
		);

		const { data: previousOrdersInRange } = await supabase
			.from("orders")
			.select("id, total, status, created_at")
			.gte("created_at", previousStart.toISOString())
			.lt("created_at", start.toISOString());

		const previousCompletedOrders =
			previousOrdersInRange?.filter((o) =>
				["delivered", "completed", "confirmed", "shipped"].includes(o.status),
			) || [];

		const previousRevenue = previousCompletedOrders.reduce(
			(sum, order) => sum + (parseFloat(order.total) || 0),
			0,
		);

		const revenueChange =
			previousRevenue > 0
				? ((totalRevenue - previousRevenue) / previousRevenue) * 100
				: totalRevenue > 0
					? 100
					: 0;

		const ordersChange = previousOrdersInRange?.length
			? ((totalOrders - previousOrdersInRange.length) /
					previousOrdersInRange.length) *
				100
			: totalOrders > 0
				? 100
				: 0;

		// New customers in range
		const { count: newCustomers } = await supabase
			.from("users")
			.select("*", { count: "exact", head: true })
			.eq("role", "customer")
			.gte("created_at", start.toISOString())
			.lte("created_at", end.toISOString());

		const { count: previousNewCustomers } = await supabase
			.from("users")
			.select("*", { count: "exact", head: true })
			.eq("role", "customer")
			.gte("created_at", previousStart.toISOString())
			.lt("created_at", start.toISOString());

		const customersChange =
			previousNewCustomers && previousNewCustomers > 0
				? (((newCustomers || 0) - previousNewCustomers) /
						previousNewCustomers) *
					100
				: (newCustomers || 0) > 0
					? 100
					: 0;

		// Order status breakdown
		const orderStatusCounts =
			ordersInRange?.reduce(
				(acc, order) => {
					acc[order.status] = (acc[order.status] || 0) + 1;
					return acc;
				},
				{} as Record<string, number>,
			) || {};

		// Daily revenue breakdown
		const dailyRevenue: { date: string; revenue: number; orders: number }[] =
			[];
		const dayMap = new Map<string, { revenue: number; orders: number }>();

		ordersInRange?.forEach((order) => {
			const date = new Date(order.created_at).toISOString().split("T")[0];
			const current = dayMap.get(date) || { revenue: 0, orders: 0 };
			if (
				["delivered", "completed", "confirmed", "shipped"].includes(
					order.status,
				)
			) {
				current.revenue += parseFloat(order.total) || 0;
			}
			current.orders += 1;
			dayMap.set(date, current);
		});

		// Fill in missing dates
		const currentDate = new Date(start);
		while (currentDate <= end) {
			const dateStr = currentDate.toISOString().split("T")[0];
			const data = dayMap.get(dateStr) || { revenue: 0, orders: 0 };
			dailyRevenue.push({
				date: dateStr,
				revenue: data.revenue,
				orders: data.orders,
			});
			currentDate.setDate(currentDate.getDate() + 1);
		}

		// Top selling products
		const { data: orderItems } = await supabase
			.from("order_items")
			.select(
				`
				quantity,
				price,
				product_id,
				products (
					id,
					name
				),
				orders!inner (
					created_at,
					status
				)
			`,
			)
			.gte("orders.created_at", start.toISOString())
			.lte("orders.created_at", end.toISOString());

		const productSales = new Map<
			string,
			{ name: string; quantity: number; revenue: number }
		>();

		orderItems?.forEach((item: any) => {
			if (
				!item.products ||
				!["delivered", "completed", "confirmed", "shipped"].includes(
					item.orders?.status,
				)
			)
				return;
			const productId = item.product_id;
			const current = productSales.get(productId) || {
				name: item.products.name,
				quantity: 0,
				revenue: 0,
			};
			current.quantity += item.quantity;
			current.revenue += item.quantity * parseFloat(item.price);
			productSales.set(productId, current);
		});

		const topProducts = Array.from(productSales.entries())
			.map(([id, data]) => ({ id, ...data }))
			.sort((a, b) => b.revenue - a.revenue)
			.slice(0, 10);

		// Revenue by category
		const { data: categoryData } = await supabase
			.from("order_items")
			.select(
				`
				quantity,
				price,
				products (
					category_id,
					categories (
						id,
						name
					)
				),
				orders!inner (
					created_at,
					status
				)
			`,
			)
			.gte("orders.created_at", start.toISOString())
			.lte("orders.created_at", end.toISOString());

		const categoryRevenue = new Map<
			string,
			{ name: string; revenue: number }
		>();

		categoryData?.forEach((item: any) => {
			if (
				!item.products?.categories ||
				!["delivered", "completed", "confirmed", "shipped"].includes(
					item.orders?.status,
				)
			)
				return;
			const categoryId = item.products.category_id;
			const current = categoryRevenue.get(categoryId) || {
				name: item.products.categories.name,
				revenue: 0,
			};
			current.revenue += item.quantity * parseFloat(item.price);
			categoryRevenue.set(categoryId, current);
		});

		const revenueByCategory = Array.from(categoryRevenue.entries())
			.map(([id, data]) => ({ id, ...data }))
			.sort((a, b) => b.revenue - a.revenue);

		// Conversion rate (orders / unique visitors estimate using customers with orders)
		const { count: totalCustomersWithOrders } = await supabase
			.from("orders")
			.select("user_id", { count: "exact", head: true })
			.gte("created_at", start.toISOString())
			.lte("created_at", end.toISOString());

		const conversionRate =
			(totalCustomersWithOrders || 0) > 0 && (newCustomers || 0) > 0
				? ((totalCustomersWithOrders || 0) / ((newCustomers || 0) * 10)) * 100 // Estimate: 1 customer = 10 visits
				: 0;

		return jsonResponse({
			range,
			period: {
				start: start.toISOString(),
				end: end.toISOString(),
			},
			metrics: {
				totalRevenue,
				revenueChange: parseFloat(revenueChange.toFixed(1)),
				totalOrders,
				ordersChange: parseFloat(ordersChange.toFixed(1)),
				averageOrderValue: parseFloat(averageOrderValue.toFixed(2)),
				newCustomers: newCustomers || 0,
				customersChange: parseFloat(customersChange.toFixed(1)),
				conversionRate: parseFloat(Math.min(conversionRate, 100).toFixed(1)),
			},
			ordersByStatus: {
				pending: orderStatusCounts.pending || 0,
				confirmed: orderStatusCounts.confirmed || 0,
				processing: orderStatusCounts.processing || 0,
				shipped: orderStatusCounts.shipped || 0,
				delivered: orderStatusCounts.delivered || 0,
				cancelled: orderStatusCounts.cancelled || 0,
				refunded: orderStatusCounts.refunded || 0,
			},
			dailyRevenue,
			topProducts,
			revenueByCategory,
		});
	} catch (error) {
		console.error("Analytics API error:", error);
		return errorResponse(
			"INTERNAL_ERROR",
			"Failed to fetch analytics data",
			500,
		);
	}
}

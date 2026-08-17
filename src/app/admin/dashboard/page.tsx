"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface DashboardStats {
	totalOrders: number;
	totalRevenue: number;
	totalCustomers: number;
	totalProducts: number;
	todayOrders: number;
	todayRevenue: number;
	thisMonthRevenue: number;
	lastMonthRevenue: number;
	revenueChangePercent: number;
	newCustomersThisMonth: number;
	ordersByStatus: {
		pending: number;
		confirmed: number;
		processing: number;
		shipped: number;
		delivered: number;
		cancelled: number;
		refunded: number;
	};
}

interface RecentOrder {
	id: string;
	order_number: string;
	customer_name: string;
	total: number;
	status: string;
	created_at: string;
}

interface LowStockProduct {
	id: string;
	name: string;
	stock: number;
}

interface DashboardData {
	stats: DashboardStats;
	recentOrders: RecentOrder[];
	lowStockProducts: LowStockProduct[];
}

export default function AdminDashboard() {
	const [data, setData] = useState<DashboardData | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

	const fetchDashboard = useCallback(async () => {
		try {
			setError(null);
			const response = await fetch("/api/v1/admin/dashboard");

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(
					errorData.error?.message || "Failed to fetch dashboard data",
				);
			}

			const result = await response.json();
			setData(result.data);
			setLastUpdated(new Date());
		} catch (err) {
			console.error("Dashboard fetch error:", err);
			setError(err instanceof Error ? err.message : "Failed to load dashboard");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchDashboard();

		// Refresh every 30 seconds
		const interval = setInterval(fetchDashboard, 30000);
		return () => clearInterval(interval);
	}, [fetchDashboard]);

	const StatCard = ({
		title,
		value,
		icon,
		trend,
		subValue,
	}: {
		title: string;
		value: string | number;
		icon: string;
		trend?: string;
		subValue?: string;
	}) => (
		<div className="bg-white dark:bg-zinc-900 rounded-xl p-6 border border-zinc-200 dark:border-zinc-800">
			<div className="flex items-center justify-between">
				<div>
					<p className="text-sm text-zinc-500 dark:text-zinc-500">{title}</p>
					<p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">
						{typeof value === "number" && title.includes("Revenue")
							? `BDT ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
							: typeof value === "number"
								? value.toLocaleString()
								: value}
					</p>
					{subValue && (
						<p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
							{subValue}
						</p>
					)}
					{trend && (
						<p
							className={`text-sm mt-1 ${trend.startsWith("+") || trend.startsWith("↑") ? "text-green-600 dark:text-green-400" : trend.startsWith("-") || trend.startsWith("↓") ? "text-red-600 dark:text-red-400" : "text-zinc-500"}`}>
							{trend}
						</p>
					)}
				</div>
				<div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center text-blue-600 dark:text-blue-400">
					{icon === "orders" && (
						<svg
							className="w-6 h-6"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
							/>
						</svg>
					)}
					{icon === "revenue" && (
						<svg
							className="w-6 h-6"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
					)}
					{icon === "customers" && (
						<svg
							className="w-6 h-6"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
							/>
						</svg>
					)}
					{icon === "products" && (
						<svg
							className="w-6 h-6"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
							/>
						</svg>
					)}
				</div>
			</div>
		</div>
	);

	const statusColors: Record<string, string> = {
		pending:
			"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
		confirmed:
			"bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
		processing:
			"bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
		shipped:
			"bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
		delivered:
			"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
		cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
		refunded:
			"bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
	};

	if (loading) {
		return (
			<div className="space-y-6">
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
					{[...Array(4)].map((_, i) => (
						<div
							key={i}
							className="bg-white dark:bg-zinc-900 rounded-xl p-6 animate-pulse">
							<div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/2 mb-3" />
							<div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded w-3/4" />
						</div>
					))}
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="p-4">
				<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
					<div className="flex items-center">
						<svg
							className="w-5 h-5 text-red-400 mr-2"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
							/>
						</svg>
						<span className="text-red-700 dark:text-red-300">{error}</span>
					</div>
					<button
						onClick={() => {
							setLoading(true);
							fetchDashboard();
						}}
						className="mt-2 text-sm text-red-600 dark:text-red-400 hover:text-red-800 underline">
						Retry
					</button>
				</div>
			</div>
		);
	}

	if (!data) return null;

	const { stats, recentOrders, lowStockProducts } = data;
	const pendingOrdersCount =
		stats.ordersByStatus.pending +
		stats.ordersByStatus.confirmed +
		stats.ordersByStatus.processing;

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
					Dashboard
				</h1>
				<div className="text-sm text-zinc-500">
					Last updated:{" "}
					{lastUpdated ? lastUpdated.toLocaleString() : "Loading..."}
					<button
						onClick={() => {
							setLoading(true);
							fetchDashboard();
						}}
						className="ml-2 text-blue-600 hover:text-blue-700 dark:text-blue-400"
						title="Refresh">
						<svg
							className={`w-4 h-4 inline ${loading ? "animate-spin" : ""}`}
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
							/>
						</svg>
					</button>
				</div>
			</div>

			{/* Pending Orders Alert */}
			{pendingOrdersCount > 0 && (
				<div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center">
							<svg
								className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-2"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24">
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
								/>
							</svg>
							<span className="text-yellow-800 dark:text-yellow-200 font-medium">
								You have {pendingOrdersCount} order
								{pendingOrdersCount > 1 ? "s" : ""} requiring attention
							</span>
						</div>
						<Link
							href="/admin/orders?status=pending"
							className="text-yellow-800 dark:text-yellow-200 hover:underline text-sm font-medium">
							View Orders →
						</Link>
					</div>
					<div className="flex gap-4 mt-2 text-sm text-yellow-700 dark:text-yellow-300">
						{stats.ordersByStatus.pending > 0 && (
							<span>Pending: {stats.ordersByStatus.pending}</span>
						)}
						{stats.ordersByStatus.confirmed > 0 && (
							<span>Confirmed: {stats.ordersByStatus.confirmed}</span>
						)}
						{stats.ordersByStatus.processing > 0 && (
							<span>Processing: {stats.ordersByStatus.processing}</span>
						)}
					</div>
				</div>
			)}

			{/* Stats Grid */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
				<StatCard
					title="Total Revenue"
					value={stats.totalRevenue}
					icon="revenue"
					subValue={`Today: BDT ${stats.todayRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
					trend={`${stats.revenueChangePercent >= 0 ? "+" : ""}${stats.revenueChangePercent}% vs last month`}
				/>
				<StatCard
					title="Total Orders"
					value={stats.totalOrders}
					icon="orders"
					subValue={`Today: ${stats.todayOrders}`}
				/>
				<StatCard
					title="Total Customers"
					value={stats.totalCustomers}
					icon="customers"
					subValue={`${stats.newCustomersThisMonth} new this month`}
				/>
				<StatCard
					title="Active Products"
					value={stats.totalProducts}
					icon="products"
					subValue={`${lowStockProducts.length} low stock`}
				/>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* Recent Orders */}
				<div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
					<div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
						<h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
							Recent Orders
						</h2>
						<Link
							href="/admin/orders"
							className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400">
							View All
						</Link>
					</div>
					<div className="divide-y divide-zinc-200 dark:divide-zinc-800">
						{recentOrders.length === 0 ? (
							<div className="p-6 text-center text-zinc-500 dark:text-zinc-400">
								<svg
									className="w-12 h-12 mx-auto text-zinc-300 dark:text-zinc-600 mb-2"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24">
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
									/>
								</svg>
								No orders yet
							</div>
						) : (
							recentOrders.map((order) => (
								<Link
									key={order.id}
									href={`/admin/orders/${order.id}`}
									className="flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
									<div>
										<p className="font-medium text-zinc-900 dark:text-white">
											{order.order_number}
										</p>
										<p className="text-sm text-zinc-500 dark:text-zinc-400">
											{order.customer_name}
										</p>
									</div>
									<div className="text-right">
										<p className="font-medium text-zinc-900 dark:text-white">৳{Math.round(order.total)}</p>
										<span
											className={`inline-block px-2 py-1 text-xs rounded-full ${statusColors[order.status] || "bg-gray-100 text-gray-800"}`}>
											{order.status}
										</span>
									</div>
								</Link>
							))
						)}
					</div>
				</div>

				{/* Low Stock Alert */}
				<div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
					<div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
						<h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
							Low Stock Alert
						</h2>
						<Link
							href="/admin/inventory"
							className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400">
							View Inventory
						</Link>
					</div>
					<div className="divide-y divide-zinc-200 dark:divide-zinc-800">
						{lowStockProducts.length === 0 ? (
							<div className="p-6 text-center text-zinc-500 dark:text-zinc-400">
								<svg
									className="w-12 h-12 mx-auto text-green-300 dark:text-green-600 mb-2"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24">
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
									/>
								</svg>
								All products are well stocked
							</div>
						) : (
							lowStockProducts.map((product) => (
								<Link
									key={product.id}
									href={`/admin/products/${product.id}`}
									className="flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
									<p className="font-medium text-zinc-900 dark:text-white">
										{product.name}
									</p>
									<span
										className={`px-2 py-1 text-xs rounded-full ${
											product.stock === 0
												? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
												: product.stock <= 5
													? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
													: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
										}`}>
										{product.stock === 0
											? "Out of stock"
											: `${product.stock} left`}
									</span>
								</Link>
							))
						)}
					</div>
				</div>
			</div>

			{/* Order Status Summary */}
			<div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
				<h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
					Order Status Overview
				</h2>
				<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
					{Object.entries(stats.ordersByStatus).map(([status, count]) => (
						<div
							key={status}
							className="text-center p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800">
							<p className="text-2xl font-bold text-zinc-900 dark:text-white">
								{count}
							</p>
							<p className="text-xs text-zinc-500 dark:text-zinc-400 capitalize">
								{status}
							</p>
						</div>
					))}
				</div>
			</div>

			{/* Quick Actions */}
			<div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
				<h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
					Quick Actions
				</h2>
				<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
					<Link
						href="/admin/products/new"
						className="flex flex-col items-center gap-2 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
						<svg
							className="w-6 h-6 text-blue-600 dark:text-blue-400"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M12 4v16m8-8H4"
							/>
						</svg>
						<span className="text-sm text-zinc-900 dark:text-white">
							Add Product
						</span>
					</Link>
					<Link
						href="/admin/orders"
						className="flex flex-col items-center gap-2 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
						<svg
							className="w-6 h-6 text-green-600 dark:text-green-400"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
							/>
						</svg>
						<span className="text-sm text-zinc-900 dark:text-white">
							View Orders
						</span>
					</Link>
					<Link
						href="/admin/coupons/new"
						className="flex flex-col items-center gap-2 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
						<svg
							className="w-6 h-6 text-purple-600 dark:text-purple-400"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
							/>
						</svg>
						<span className="text-sm text-zinc-900 dark:text-white">
							Create Coupon
						</span>
					</Link>
					<Link
						href="/admin/analytics"
						className="flex flex-col items-center gap-2 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
						<svg
							className="w-6 h-6 text-orange-600 dark:text-orange-400"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
							/>
						</svg>
						<span className="text-sm text-zinc-900 dark:text-white">
							Analytics
						</span>
					</Link>
				</div>
			</div>
		</div>
	);
}

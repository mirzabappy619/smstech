"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/currency";

interface AnalyticsData {
	range: string;
	period: {
		start: string;
		end: string;
	};
	metrics: {
		totalRevenue: number;
		revenueChange: number;
		totalOrders: number;
		ordersChange: number;
		averageOrderValue: number;
		newCustomers: number;
		customersChange: number;
		conversionRate: number;
	};
	ordersByStatus: {
		pending: number;
		confirmed: number;
		processing: number;
		shipped: number;
		delivered: number;
		cancelled: number;
		refunded: number;
	};
	dailyRevenue: Array<{
		date: string;
		revenue: number;
		orders: number;
	}>;
	topProducts: Array<{
		id: string;
		name: string;
		quantity: number;
		revenue: number;
	}>;
	revenueByCategory: Array<{
		id: string;
		name: string;
		revenue: number;
	}>;
}

export default function AnalyticsPage() {
	const [data, setData] = useState<AnalyticsData | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [timeRange, setTimeRange] = useState("30d");

	const fetchAnalytics = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const response = await fetch(
				`/api/v1/admin/analytics?range=${timeRange}`,
			);

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(
					errorData.error?.message || "Failed to fetch analytics",
				);
			}

			const apiData = await response.json();
			setData(apiData.data);
		} catch (err) {
			console.error("Failed to fetch analytics:", err);
			setError(err instanceof Error ? err.message : "Failed to load analytics");
		} finally {
			setLoading(false);
		}
	}, [timeRange]);

	useEffect(() => {
		fetchAnalytics();
	}, [fetchAnalytics]);

	const MetricCard = ({
		title,
		value,
		change,
		icon,
		color = "blue",
	}: {
		title: string;
		value: string | number;
		change?: number;
		icon: React.ReactNode;
		color?: string;
	}) => {
		const colorClasses: Record<string, string> = {
			blue: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
			green:
				"bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400",
			purple:
				"bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
			orange:
				"bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400",
		};

		return (
			<div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
				<div className="flex items-center justify-between">
					<div className="flex-1">
						<p className="text-sm text-zinc-500 dark:text-zinc-400">{title}</p>
						<p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">
							{value}
						</p>
						{change !== undefined && (
							<p
								className={`text-sm mt-1 flex items-center gap-1 ${
									change >= 0
										? "text-green-600 dark:text-green-400"
										: "text-red-600 dark:text-red-400"
								}`}>
								<svg
									className="w-4 h-4"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24">
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d={
											change >= 0
												? "M5 10l7-7m0 0l7 7m-7-7v18"
												: "M19 14l-7 7m0 0l-7-7m7 7V3"
										}
									/>
								</svg>
								{Math.abs(change).toFixed(1)}% vs last period
							</p>
						)}
					</div>
					<div
						className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
						{icon}
					</div>
				</div>
			</div>
		);
	};

	if (loading) {
		return (
			<div className="space-y-6">
				<div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded w-48 animate-pulse" />
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
					{[...Array(4)].map((_, i) => (
						<div
							key={i}
							className="h-32 bg-zinc-200 dark:bg-zinc-800 rounded-xl animate-pulse"
						/>
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
						onClick={fetchAnalytics}
						className="mt-2 text-sm text-red-600 dark:text-red-400 hover:text-red-800 underline">
						Retry
					</button>
				</div>
			</div>
		);
	}

	if (!data) return null;

	const totalOrders =
		data.ordersByStatus.pending +
		data.ordersByStatus.confirmed +
		data.ordersByStatus.processing +
		data.ordersByStatus.shipped +
		data.ordersByStatus.delivered;
	const completedOrders =
		data.ordersByStatus.delivered + data.ordersByStatus.shipped;

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
						Analytics Dashboard
					</h1>
					<p className="text-zinc-600 dark:text-zinc-400 mt-1">
						{data.period.start && data.period.end ? (
							<>
								Showing data from{" "}
								{new Date(data.period.start).toLocaleDateString()} to{" "}
								{new Date(data.period.end).toLocaleDateString()}
							</>
						) : (
							"Track your store performance and insights"
						)}
					</p>
				</div>
				<div className="flex items-center gap-2">
					<select
						value={timeRange}
						onChange={(e) => setTimeRange(e.target.value)}
						className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
						<option value="7d">Last 7 Days</option>
						<option value="30d">Last 30 Days</option>
						<option value="90d">Last 90 Days</option>
						<option value="12m">Last 12 Months</option>
					</select>
					<button
						onClick={fetchAnalytics}
						className="p-2 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
						title="Refresh">
						<svg
							className={`w-5 h-5 ${loading ? "animate-spin" : ""}`}
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

			{/* Revenue & Orders */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
				<MetricCard
					title="Total Revenue"
					value={formatCurrency(data.metrics.totalRevenue)}
					change={data.metrics.revenueChange}
					color="green"
					icon={
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
					}
				/>

				<MetricCard
					title="Total Orders"
					value={data.metrics.totalOrders}
					change={data.metrics.ordersChange}
					color="blue"
					icon={
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
					}
				/>

				<MetricCard
					title="Average Order Value"
					value={`৳${Math.round(data.metrics.averageOrderValue)}`}
					color="purple"
					icon={
						<svg
							className="w-6 h-6"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
							/>
						</svg>
					}
				/>

				<MetricCard
					title="New Customers"
					value={data.metrics.newCustomers}
					change={data.metrics.customersChange}
					color="orange"
					icon={
						<svg
							className="w-6 h-6"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
							/>
						</svg>
					}
				/>
			</div>

			{/* Revenue Breakdown & Order Status */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
					<h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
						Revenue by Category
					</h2>
					{data.revenueByCategory.length === 0 ? (
						<p className="text-zinc-500 dark:text-zinc-400 text-center py-8">
							No category data available
						</p>
					) : (
						<div className="space-y-4">
							{data.revenueByCategory.slice(0, 5).map((category, index) => {
								const maxRevenue = data.revenueByCategory[0]?.revenue || 1;
								const percentage = (category.revenue / maxRevenue) * 100;
								return (
									<div key={category.id || index}>
										<div className="flex items-center justify-between mb-1">
											<span className="text-zinc-600 dark:text-zinc-400 text-sm">
												{category.name}
											</span>
											<span className="font-semibold text-zinc-900 dark:text-white text-sm">
												{formatCurrency(category.revenue)}
											</span>
										</div>
										<div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2">
											<div
												className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all"
												style={{ width: `${percentage}%` }}></div>
										</div>
									</div>
								);
							})}
						</div>
					)}
				</div>

				<div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
					<h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
						Order Status
					</h2>
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
								<span className="text-zinc-600 dark:text-zinc-400">
									Pending
								</span>
							</div>
							<span className="font-semibold text-zinc-900 dark:text-white">
								{data.ordersByStatus.pending}
							</span>
						</div>
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<div className="w-3 h-3 bg-blue-500 rounded-full"></div>
								<span className="text-zinc-600 dark:text-zinc-400">
									Confirmed
								</span>
							</div>
							<span className="font-semibold text-zinc-900 dark:text-white">
								{data.ordersByStatus.confirmed}
							</span>
						</div>
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<div className="w-3 h-3 bg-indigo-500 rounded-full"></div>
								<span className="text-zinc-600 dark:text-zinc-400">
									Processing
								</span>
							</div>
							<span className="font-semibold text-zinc-900 dark:text-white">
								{data.ordersByStatus.processing}
							</span>
						</div>
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<div className="w-3 h-3 bg-purple-500 rounded-full"></div>
								<span className="text-zinc-600 dark:text-zinc-400">
									Shipped
								</span>
							</div>
							<span className="font-semibold text-zinc-900 dark:text-white">
								{data.ordersByStatus.shipped}
							</span>
						</div>
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<div className="w-3 h-3 bg-green-500 rounded-full"></div>
								<span className="text-zinc-600 dark:text-zinc-400">
									Delivered
								</span>
							</div>
							<span className="font-semibold text-zinc-900 dark:text-white">
								{data.ordersByStatus.delivered}
							</span>
						</div>
						<div className="flex items-center justify-between pt-4 border-t border-zinc-200 dark:border-zinc-800">
							<span className="text-zinc-600 dark:text-zinc-400">Total</span>
							<span className="font-bold text-zinc-900 dark:text-white">
								{totalOrders}
							</span>
						</div>
					</div>
				</div>
			</div>

			{/* Daily Revenue Chart (Simple Bar Representation) */}
			{data.dailyRevenue.length > 0 && (
				<div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
					<h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
						Daily Revenue
					</h2>
					<div className="flex items-end gap-1 h-40">
						{data.dailyRevenue.slice(-14).map((day, index) => {
							const maxRevenue = Math.max(
								...data.dailyRevenue.slice(-14).map((d) => d.revenue),
								1,
							);
							const height = (day.revenue / maxRevenue) * 100;
							return (
								<div
									key={day.date}
									className="flex-1 group relative"
									title={`${day.date}: ৳${Math.round(day.revenue)} (${day.orders} orders)`}>
									<div
										className="w-full bg-blue-500 dark:bg-blue-600 rounded-t transition-all hover:bg-blue-600 dark:hover:bg-blue-500"
										style={{ height: `${Math.max(height, 2)}%` }}></div>
									{index % 2 === 0 && (
										<p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 text-center truncate">
											{new Date(day.date).toLocaleDateString("en-US", {
												month: "short",
												day: "numeric",
											})}
										</p>
									)}
								</div>
							);
						})}
					</div>
				</div>
			)}

			{/* Top Selling Products */}
			<div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
				<div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
					<h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
						Top Selling Products
					</h2>
					<Link
						href="/admin/products"
						className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400">
						View All Products
					</Link>
				</div>
				{data.topProducts.length === 0 ? (
					<div className="p-8 text-center text-zinc-500 dark:text-zinc-400">
						No sales data available for this period
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full">
							<thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
								<tr>
									<th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
										Rank
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
										Product
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
										Quantity Sold
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
										Revenue
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
								{data.topProducts.map((product, index) => (
									<tr
										key={product.id}
										className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
										<td className="px-6 py-4 whitespace-nowrap">
											<div className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold">
												#{index + 1}
											</div>
										</td>
										<td className="px-6 py-4">
											<Link
												href={`/admin/products/${product.id}`}
												className="font-medium text-zinc-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400">
												{product.name}
											</Link>
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-900 dark:text-white">
											{product.quantity} units
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-zinc-900 dark:text-white">
											{formatCurrency(product.revenue)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>

			{/* Quick Stats */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
				<div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
					<h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">
						Conversion Rate
					</h3>
					<p className="text-2xl font-bold text-zinc-900 dark:text-white">
						{data.metrics.conversionRate}%
					</p>
					<p className="text-sm text-zinc-500 mt-1">
						Estimated conversion from visitors to customers
					</p>
				</div>

				<div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
					<h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">
						Completed Orders
					</h3>
					<p className="text-2xl font-bold text-green-600 dark:text-green-400">
						{completedOrders}
					</p>
					<p className="text-sm text-zinc-500 mt-1">
						Orders shipped or delivered
					</p>
				</div>

				<div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
					<h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">
						Cancelled / Refunded
					</h3>
					<p className="text-2xl font-bold text-red-600 dark:text-red-400">
						{data.ordersByStatus.cancelled + data.ordersByStatus.refunded}
					</p>
					<p className="text-sm text-zinc-500 mt-1">
						{data.ordersByStatus.cancelled} cancelled,{" "}
						{data.ordersByStatus.refunded} refunded
					</p>
				</div>
			</div>
		</div>
	);
}

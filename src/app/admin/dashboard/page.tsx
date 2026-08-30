"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface DashboardStats {
	totalOrders: number;
	totalRevenue: number;
	totalCustomers: number;
	totalProducts: number;
	totalSerializedUnits: number;
	thisMonthRevenue: number;
	lastMonthRevenue: number;
	revenueChangePercent: number;
	knownCOGS: number;
	cogsCoverageNote?: string;
	grossProfit: number;
	grossMarginPct: number;
	totalDuesReceivable: number;
	totalAdvanceLiabilities: number;
	totalPreBookings: number;
	preBookingConversionRate: number;
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

interface Warehouse {
	id: string;
	name: string;
	code: string;
}

const fmt = (n: number) => "৳" + (Number(n) || 0).toLocaleString("en-BD");

export default function AdminDashboard() {
	const [data, setData] = useState<DashboardData | null>(null);
	const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
	const [selectedBranch, setSelectedBranch] = useState("all");
	const [loading, setLoading] = useState(true);
	// error state

	const fetchDashboard = useCallback(async () => {
		try {
			// clear error
			const params = new URLSearchParams();
			if (selectedBranch !== "all") params.append("warehouse_id", selectedBranch);

			const [dashRes, whRes] = await Promise.all([
				fetch(`/api/v1/admin/dashboard?${params}`),
				fetch("/api/v1/admin/warehouses")
			]);

			const dashJson = await dashRes.json();
			const whJson = await whRes.json();

			if (dashJson.success) setData(dashJson.data);
			if (whJson.success) setWarehouses(whJson.data || []);
		} catch (err: any) {
			// handle error
		} finally {
			setLoading(false);
		}
	}, [selectedBranch]);

	useEffect(() => {
		fetchDashboard();
	}, [fetchDashboard]);

	if (loading && !data) {
		return (
			<div className="p-12 text-center text-xs text-zinc-400">
				Loading executive analytics dashboard...
			</div>
		);
	}

	const stats = data?.stats;

	return (
		<div className="space-y-6">
			{/* Top Bar with Branch Filter */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
						Executive & Multi-Branch Dashboard
					</h1>
					<p className="text-xs text-zinc-500 mt-1">
						Real-time revenue, gross profit after COGS, cash shifts, and party ledger metrics.
					</p>
				</div>

				<div className="flex items-center gap-3">
					<div className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 rounded-xl">
						<span className="text-xs text-zinc-500 font-bold">Branch View:</span>
						<select
							value={selectedBranch}
							onChange={e => setSelectedBranch(e.target.value)}
							className="bg-transparent text-xs font-black text-zinc-900 dark:text-white focus:outline-none"
						>
							<option value="all">🏢 Global Enterprise (All Branches)</option>
							{warehouses.map(w => (
								<option key={w.id} value={w.id}>{w.name} ({w.code})</option>
							))}
						</select>
					</div>

					<Link
						href="/admin/pos"
						className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-600/30 flex items-center gap-1.5"
					>
						<span>⚡</span> Open POS Terminal
					</Link>
				</div>
			</div>

			{/* Primary Executive Financial Metrics (Gross Profit, COGS, Revenue, Dues) */}
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
				<div className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
					<div className="flex justify-between items-center text-xs text-zinc-500 font-semibold">
						<span>Net Revenue</span>
						<span className="text-emerald-600 font-bold">
							{stats?.revenueChangePercent ? `${stats.revenueChangePercent > 0 ? '+' : ''}${stats.revenueChangePercent}% vs last mo` : 'Active'}
						</span>
					</div>
					<p className="text-2xl font-black text-zinc-900 dark:text-white mt-1">
						{fmt(stats?.totalRevenue || 0)}
					</p>
					<p className="text-[10px] text-zinc-400 mt-1">
						This month: {fmt(stats?.thisMonthRevenue || 0)} · excludes cancelled &amp; refunded
					</p>
				</div>

				<div className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
					<div className="flex justify-between items-center text-xs text-zinc-500 font-semibold">
						<span>Gross Profit (Recorded COGS)</span>
						<span className="text-blue-600 font-bold">{stats?.grossMarginPct ?? 0}% Margin</span>
					</div>
					<p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
						{fmt(stats?.grossProfit || 0)}
					</p>
					<p className="text-[10px] text-zinc-400 mt-1" title={stats?.cogsCoverageNote}>
						Recorded COGS: {fmt(stats?.knownCOGS || 0)} (serialized stock only)
					</p>
				</div>

				<div className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
					<div className="flex justify-between items-center text-xs text-zinc-500 font-semibold">
						<span>Customer Dues Receivable</span>
						<Link href="/admin/accounting/ledger" className="text-rose-600 font-bold hover:underline">Collect →</Link>
					</div>
					<p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
						{fmt(stats?.totalDuesReceivable || 0)}
					</p>
					<p className="text-[10px] text-zinc-400 mt-1">Advance Deposits: {fmt(stats?.totalAdvanceLiabilities || 0)}</p>
				</div>

				<div className="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
					<div className="flex justify-between items-center text-xs text-zinc-500 font-semibold">
						<span>Pre-Booking Conversion</span>
						<Link href="/admin/pre-bookings" className="text-purple-600 font-bold hover:underline">Queue →</Link>
					</div>
					<p className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">
						{stats?.preBookingConversionRate || 0}%
					</p>
					<p className="text-[10px] text-zinc-400 mt-1">{stats?.totalPreBookings || 0} customer pre-bookings</p>
				</div>
			</div>

			{/* Operational Stats: In-Stock Serialized Units, Orders Status Breakdown */}
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{/* Orders Status Distribution */}
				<div className="lg:col-span-1 p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-3">
					<h3 className="font-extrabold text-sm text-zinc-900 dark:text-white">Order Pipeline Status</h3>
					<div className="space-y-2 text-xs">
						{[
							['Delivered / Completed', stats?.ordersByStatus?.delivered || 0, 'text-emerald-600', 'bg-emerald-100 dark:bg-emerald-950'],
							['Processing & Dispatch', stats?.ordersByStatus?.processing || 0, 'text-purple-600', 'bg-purple-100 dark:bg-purple-950'],
							['Pending Confirmation', stats?.ordersByStatus?.pending || 0, 'text-amber-600', 'bg-amber-100 dark:bg-amber-950'],
							['In-Transit Courier', stats?.ordersByStatus?.shipped || 0, 'text-blue-600', 'bg-blue-100 dark:bg-blue-950'],
							['Cancelled / Returned', stats?.ordersByStatus?.cancelled || 0, 'text-zinc-500', 'bg-zinc-100 dark:bg-zinc-800'],
						].map(([lbl, count, txtColor, bgClass]) => (
							<div key={lbl as string} className="flex justify-between items-center p-2 rounded-xl border border-zinc-100 dark:border-zinc-800">
								<span className="font-semibold text-zinc-700 dark:text-zinc-300">{lbl as string}</span>
								<span className={`px-2 py-0.5 rounded-full font-black text-[11px] ${txtColor} ${bgClass}`}>
									{count}
								</span>
							</div>
						))}
					</div>
				</div>

				{/* Recent Store & POS Invoices */}
				<div className="lg:col-span-2 p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-3">
					<div className="flex justify-between items-center">
						<h3 className="font-extrabold text-sm text-zinc-900 dark:text-white">Recent Transactions & Invoices</h3>
						<Link href="/admin/orders" className="text-xs font-bold text-blue-600 hover:underline">View All Orders →</Link>
					</div>

					<div className="overflow-x-auto">
						<table className="w-full text-left text-xs">
							<thead className="text-zinc-400 font-bold uppercase text-[9px] border-b border-zinc-100 dark:border-zinc-800">
								<tr>
									<th className="pb-2">Invoice #</th>
									<th className="pb-2">Customer</th>
									<th className="pb-2">Total Amount</th>
									<th className="pb-2">Status</th>
									<th className="pb-2 text-right">Action</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 font-medium">
								{(data?.recentOrders || []).length === 0 ? (
									<tr>
										<td colSpan={5} className="py-6 text-center text-zinc-400">
											No recent transactions found
										</td>
									</tr>
								) : (
									(data?.recentOrders || []).map(o => (
										<tr key={o.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
											<td className="py-2.5 font-mono font-bold text-blue-600 dark:text-blue-400">{o.order_number || "N/A"}</td>
											<td className="py-2.5 font-bold text-zinc-900 dark:text-white">{o.customer_name || "Customer"}</td>
											<td className="py-2.5 font-black">{fmt(o.total || 0)}</td>
											<td className="py-2.5">
												<span className="px-2 py-0.5 rounded text-[9px] font-bold bg-zinc-100 dark:bg-zinc-800 capitalize">
													{o.status || "pending"}
												</span>
											</td>
											<td className="py-2.5 text-right">
												<Link href={`/admin/orders/${o.id}`} className="text-blue-600 font-bold hover:underline">
													View →
												</Link>
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</div>
	);
}

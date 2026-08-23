"use client";

import { useState } from "react";
import Link from "next/link";
import {
	FraudCheckResult,
	getRiskLevelConfig,
} from "@/lib/fraud-check";
import { isValidBDPhone, normalizeBDPhone, BD_PHONE_ERROR_MESSAGE } from "@/lib/bd-phone-validator";

export default function AdminFraudCheckPage() {
	const [phone, setPhone] = useState("01712345678");
	const [loading, setLoading] = useState(false);
	const [result, setResult] = useState<FraudCheckResult | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [recentSearches, setRecentSearches] = useState<string[]>([
		"01712345678",
		"01812345678",
		"01912345678",
	]);

	const handleSearch = async (targetPhone?: string) => {
		const searchPhone = targetPhone || phone;
		const normalized = normalizeBDPhone(searchPhone);

		if (!normalized || !isValidBDPhone(normalized)) {
			setError(BD_PHONE_ERROR_MESSAGE);
			return;
		}

		setError(null);
		setLoading(true);

		try {
			const res = await fetch(`/api/v1/fraud-check?phone=${encodeURIComponent(normalized)}`);
			const data = await res.json();

			if (!res.ok || !data.success) {
				throw new Error(data.error || "Failed to fetch fraud check data");
			}

			setResult(data);

			// Add to recent searches
			setRecentSearches((prev) => {
				const filtered = prev.filter((p) => p !== normalized);
				return [normalized, ...filtered].slice(0, 6);
			});
		} catch (err) {
			console.error("Fraud check error:", err);
			setError(err instanceof Error ? err.message : "An unexpected error occurred");
			setResult(null);
		} finally {
			setLoading(false);
		}
	};

	const riskConfig = result ? getRiskLevelConfig(result.risk_level) : null;

	return (
		<div className="space-y-6">
			{/* Top Header */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div>
					<div className="flex items-center gap-2">
						<span className="text-2xl">🛡️</span>
						<h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
							Customer Phone Fraud Check
						</h1>
					</div>
					<p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
						Powered by 12oClock Multi-Courier Database (SteadFast, Pathao, RedX, Paperfly, Carrybee)
					</p>
				</div>
				<div className="flex items-center gap-2">
					<span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
						<span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
						Live 12oClock API Connected
					</span>
				</div>
			</div>

			{/* Search Card */}
			<div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6">
				<h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-3">
					Check Phone Number
				</h2>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						handleSearch();
					}}
					className="flex flex-col sm:flex-row gap-3">
					<div className="relative flex-1">
						<div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
							<span>📱</span>
						</div>
						<input
							type="text"
							value={phone}
							onChange={(e) => {
								setPhone(e.target.value);
								if (error) setError(null);
							}}
							placeholder="Enter 11-digit mobile number (e.g. 01712345678)"
							className="w-full pl-10 pr-4 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl text-base text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono tracking-wide"
						/>
					</div>
					<button
						type="submit"
						disabled={loading || !phone.trim()}
						className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2">
						{loading ? (
							<>
								<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
								Checking Courier Records...
							</>
						) : (
							<>
								<span>🔍</span>
								Check Fraud History
							</>
						)}
					</button>
				</form>

				{/* Quick Examples */}
				<div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
					<span className="text-zinc-500 dark:text-zinc-400 font-medium">Quick Test:</span>
					{recentSearches.map((p) => (
						<button
							key={p}
							type="button"
							onClick={() => {
								setPhone(p);
								handleSearch(p);
							}}
							className="px-2.5 py-1 bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-600 font-mono transition-colors">
							{p}
						</button>
					))}
				</div>

				{error && (
					<div className="mt-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
						<span>⚠️</span>
						<span>{error}</span>
					</div>
				)}
			</div>

			{/* Results View */}
			{result && riskConfig && (
				<div className="space-y-6 animate-fadeIn">
					{/* Risk Level Banner */}
					<div
						className={`rounded-2xl border ${riskConfig.border} ${riskConfig.bg} p-6 shadow-sm`}>
						<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
							<div className="space-y-2">
								<div className="flex items-center gap-3">
									<span
										className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold border ${riskConfig.badge}`}>
										<span>{riskConfig.icon}</span>
										{result.risk_level}
									</span>
									<span className="text-sm font-mono font-bold text-zinc-800 dark:text-zinc-200">
										{result.phone}
									</span>
								</div>

								{/* Messages */}
								<p className="text-base font-bold text-zinc-900 dark:text-zinc-100">
									{result.risk_message_bn}
								</p>
								<p className="text-xs text-zinc-600 dark:text-zinc-400">
									{result.risk_message_en}
								</p>
							</div>

							{/* Recommendation badge & action */}
							<div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-white/70 dark:bg-zinc-900/70 p-4 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60 shrink-0">
								<div>
									<p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
										COD Recommendation
									</p>
									<p className={`text-sm font-bold ${riskConfig.color}`}>
										{riskConfig.actionLabelBn} ({riskConfig.actionLabel})
									</p>
								</div>
								<Link
									href={`/admin/orders?search=${encodeURIComponent(result.phone)}`}
									className="px-3.5 py-2 text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white rounded-lg transition-colors shadow-sm">
									View Orders for this Phone →
								</Link>
							</div>
						</div>
					</div>

					{/* Stats Cards */}
					<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
						<div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-5">
							<p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
								Overall Delivery Rate
							</p>
							<div className="flex items-baseline gap-2">
								<span className={`text-3xl font-extrabold ${riskConfig.color}`}>
									{result.delivery_rate}%
								</span>
							</div>
							<div className="w-full bg-zinc-100 dark:bg-zinc-700 h-2 rounded-full mt-3 overflow-hidden">
								<div
									className={`h-full rounded-full transition-all duration-500 ${
										result.delivery_rate >= 75
											? "bg-emerald-500"
											: result.delivery_rate >= 50
											? "bg-blue-500"
											: result.delivery_rate >= 25
											? "bg-amber-500"
											: "bg-red-500"
									}`}
									style={{ width: `${Math.min(result.delivery_rate, 100)}%` }}
								/>
							</div>
						</div>

						<div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-5">
							<p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
								Total Courier Orders
							</p>
							<p className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-100">
								{result.total_orders}
							</p>
							<p className="text-xs text-zinc-400 mt-1">Across all BD couriers</p>
						</div>

						<div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-5">
							<p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">
								Successfully Delivered
							</p>
							<p className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
								{result.total_delivered}
							</p>
							<p className="text-xs text-zinc-400 mt-1">Parcels received by customer</p>
						</div>

						<div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-5">
							<p className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider mb-1">
								Cancelled / Returned
							</p>
							<p className="text-3xl font-extrabold text-red-600 dark:text-red-400">
								{result.total_cancelled}
							</p>
							<p className="text-xs text-zinc-400 mt-1">Refused or return parcels</p>
						</div>
					</div>

					{/* Courier Performance Breakdown */}
					<div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden">
						<div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
							<h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
								Courier-by-Courier History
							</h3>
							<span className="text-xs text-zinc-400">
								Updated: {new Date(result.timestamp).toLocaleTimeString()}
							</span>
						</div>

						{result.couriers.length > 0 ? (
							<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-zinc-200 dark:divide-zinc-700">
								{result.couriers.map((c) => {
									const isStrong = c.orders > 0;
									const badgeColor =
										c.rate >= 75
											? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
											: c.rate >= 50
											? "text-blue-600 bg-blue-50 dark:bg-blue-950/40"
											: c.orders > 0
											? "text-red-600 bg-red-50 dark:bg-red-950/40"
											: "text-zinc-400 bg-zinc-100 dark:bg-zinc-800";

									return (
										<div key={c.name} className="p-5 space-y-3">
											<div className="flex items-center justify-between">
												<div className="font-bold text-zinc-900 dark:text-zinc-100 text-sm flex items-center gap-2">
													<span>{getCourierIcon(c.name)}</span>
													{c.name}
												</div>
												<span
													className={`px-2 py-0.5 rounded text-xs font-bold ${badgeColor}`}>
													{isStrong ? `${c.rate}% Rate` : "No Orders"}
												</span>
											</div>

											<div className="grid grid-cols-3 gap-2 text-center text-xs">
												<div className="bg-zinc-50 dark:bg-zinc-900 p-2 rounded-lg">
													<p className="text-zinc-400 text-[10px]">Total</p>
													<p className="font-bold text-zinc-800 dark:text-zinc-200">
														{c.orders}
													</p>
												</div>
												<div className="bg-emerald-50/60 dark:bg-emerald-950/30 p-2 rounded-lg">
													<p className="text-emerald-600 text-[10px]">Delivered</p>
													<p className="font-bold text-emerald-700 dark:text-emerald-300">
														{c.delivered}
													</p>
												</div>
												<div className="bg-red-50/60 dark:bg-red-950/30 p-2 rounded-lg">
													<p className="text-red-600 text-[10px]">Cancelled</p>
													<p className="font-bold text-red-700 dark:text-red-300">
														{c.cancelled}
													</p>
												</div>
											</div>
										</div>
									);
								})}
							</div>
						) : (
							<div className="p-8 text-center text-zinc-500 dark:text-zinc-400 text-sm">
								No individual courier stats recorded for this phone number.
							</div>
						)}
					</div>

					{/* Risk Level Guide Table */}
					<div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6">
						<h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-3">
							Delivery Risk Standard Reference
						</h3>
						<div className="overflow-x-auto">
							<table className="w-full text-left text-xs">
								<thead className="bg-zinc-50 dark:bg-zinc-900 text-zinc-500 uppercase">
									<tr>
										<th className="px-4 py-2.5 font-semibold">Risk Level</th>
										<th className="px-4 py-2.5 font-semibold">Delivery Rate</th>
										<th className="px-4 py-2.5 font-semibold">Action Recommendation</th>
										<th className="px-4 py-2.5 font-semibold">COD Policy</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
									<tr className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
										<td className="px-4 py-2.5 font-bold text-red-600">🔴 High Risk</td>
										<td className="px-4 py-2.5">0% – 25%</td>
										<td className="px-4 py-2.5">High risk of order rejection/cancellation. Require advance payment.</td>
										<td className="px-4 py-2.5 font-semibold text-red-600">Block COD or Take Advance</td>
									</tr>
									<tr className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
										<td className="px-4 py-2.5 font-bold text-amber-600">🟡 Medium Risk</td>
										<td className="px-4 py-2.5">26% – 50%</td>
										<td className="px-4 py-2.5">Exercise caution before dispatching. Confirm via phone call.</td>
										<td className="px-4 py-2.5 font-semibold text-amber-600">Call to Confirm</td>
									</tr>
									<tr className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
										<td className="px-4 py-2.5 font-bold text-blue-600">🔵 Good</td>
										<td className="px-4 py-2.5">51% – 75%</td>
										<td className="px-4 py-2.5">Customer has reliable delivery history.</td>
										<td className="px-4 py-2.5 font-semibold text-blue-600">Safe for COD</td>
									</tr>
									<tr className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
										<td className="px-4 py-2.5 font-bold text-emerald-600">🟢 Excellent</td>
										<td className="px-4 py-2.5">76% – 100%</td>
										<td className="px-4 py-2.5">High completion history. Safe to ship COD immediately.</td>
										<td className="px-4 py-2.5 font-semibold text-emerald-600">Trusted VIP</td>
									</tr>
								</tbody>
							</table>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

function getCourierIcon(name: string) {
	const lower = name.toLowerCase();
	if (lower.includes("steadfast")) return "⚡";
	if (lower.includes("pathao")) return "🛵";
	if (lower.includes("redx") || lower.includes("redex")) return "📦";
	if (lower.includes("paperfly")) return "✈️";
	if (lower.includes("carrybee")) return "🐝";
	return "🚚";
}

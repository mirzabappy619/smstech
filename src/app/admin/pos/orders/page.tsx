"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
	Banknote,
	CreditCard,
	Download,
	ExternalLink,
	Eye,
	FileText,
	Filter,
	Printer,
	Receipt,
	RotateCcw,
	Search,
	Smartphone,
	Store,
	X,
} from "lucide-react";
import { formatBDT } from "@/lib/currency";

/**
 * POS sales register.
 *
 * POS checkouts land in the same `orders` table as web orders, tagged with
 * invoice_type 'pos' (or 'pre_booking' when a deposit is settled at the
 * counter). /admin/orders shows everything mixed together, so this page is the
 * till-side view: filtered to counter sales, grouped by branch and shift, with
 * the takings split by tender.
 */

type PaymentSplit = { method: string; amount: number };

interface PosOrder {
	id: string;
	order_number: string;
	invoice_type: string | null;
	status: string;
	payment_status: string | null;
	payment_method: string | null;
	payment_breakdown: PaymentSplit[] | null;
	customer_name: string | null;
	customer_phone: string | null;
	subtotal: number | null;
	discount_amount: number | null;
	total: number | null;
	advance_deducted: number | null;
	due_amount: number | null;
	warehouse_id: string | null;
	shift_id: string | null;
	notes: string | null;
	created_at: string;
	items?: { id: string; name: string; quantity: number; unit_price: number }[];
}

interface Warehouse {
	id: string;
	name: string;
	code?: string;
}

const TENDER_ICONS: Record<string, typeof Banknote> = {
	cash: Banknote,
	card: CreditCard,
	bkash: Smartphone,
	nagad: Smartphone,
	split_payment: Receipt,
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const daysAgoISO = (n: number) =>
	new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

const RANGES = [
	{ id: "today", label: "Today", from: todayISO },
	{ id: "7d", label: "Last 7 days", from: () => daysAgoISO(6) },
	{ id: "30d", label: "Last 30 days", from: () => daysAgoISO(29) },
	{ id: "all", label: "All time", from: () => "" },
] as const;

const num = (v: unknown) => Number(v) || 0;

export default function PosOrdersPage() {
	const [orders, setOrders] = useState<PosOrder[]>([]);
	const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const [range, setRange] = useState<(typeof RANGES)[number]["id"]>("today");
	const [branch, setBranch] = useState("all");
	const [tender, setTender] = useState("all");
	const [invoiceType, setInvoiceType] = useState("pos,pre_booking");
	const [search, setSearch] = useState("");
	const [expanded, setExpanded] = useState<string | null>(null);

	useEffect(() => {
		async function loadBranches() {
			try {
				const res = await fetch("/api/v1/admin/warehouses");
				const json = await res.json();
				if (json.success && Array.isArray(json.data)) setWarehouses(json.data);
			} catch {
				/* branch filter simply stays empty */
			}
		}
		loadBranches();
	}, []);

	const fetchOrders = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const params = new URLSearchParams({ limit: "200", invoice_type: invoiceType });
			const from = RANGES.find((r) => r.id === range)?.from() || "";
			if (from) params.set("from", from);
			if (branch !== "all") params.set("warehouse_id", branch);
			if (tender !== "all") params.set("payment_method", tender);
			if (search.trim()) params.set("search", search.trim());

			const res = await fetch(`/api/v1/admin/orders?${params}`);
			const json = await res.json();
			if (!res.ok || json.success === false) {
				throw new Error(json?.error?.message || "Failed to load POS sales");
			}
			setOrders(Array.isArray(json.data) ? json.data : []);
		} catch (err: any) {
			setError(err?.message || "Failed to load POS sales");
			setOrders([]);
		} finally {
			setLoading(false);
		}
	}, [range, branch, tender, invoiceType, search]);

	useEffect(() => {
		const t = setTimeout(fetchOrders, search ? 350 : 0);
		return () => clearTimeout(t);
	}, [fetchOrders, search]);

	const branchName = useCallback(
		(id: string | null) =>
			warehouses.find((w) => w.id === id)?.name ?? (id ? "Unknown branch" : "—"),
		[warehouses],
	);

	// Takings split by tender, counting each leg of a split payment separately.
	const summary = useMemo(() => {
		const byTender: Record<string, number> = {};
		let gross = 0;
		let due = 0;

		for (const o of orders) {
			gross += num(o.total);
			due += num(o.due_amount);

			const legs =
				Array.isArray(o.payment_breakdown) && o.payment_breakdown.length > 0
					? o.payment_breakdown
					: [{ method: o.payment_method || "unknown", amount: num(o.total) - num(o.due_amount) }];

			for (const leg of legs) {
				const key = (leg.method || "unknown").toLowerCase();
				byTender[key] = (byTender[key] || 0) + num(leg.amount);
			}
		}

		return {
			count: orders.length,
			gross,
			due,
			collected: gross - due,
			average: orders.length ? gross / orders.length : 0,
			byTender: Object.entries(byTender).sort((a, b) => b[1] - a[1]),
		};
	}, [orders]);

	const exportCsv = () => {
		const head = [
			"Order",
			"Date",
			"Branch",
			"Customer",
			"Phone",
			"Tender",
			"Subtotal",
			"Discount",
			"Total",
			"Collected",
			"Due",
			"Type",
		];
		const rows = orders.map((o) => [
			o.order_number,
			new Date(o.created_at).toISOString(),
			branchName(o.warehouse_id),
			o.customer_name ?? "",
			o.customer_phone ?? "",
			o.payment_method ?? "",
			num(o.subtotal),
			num(o.discount_amount),
			num(o.total),
			num(o.total) - num(o.due_amount),
			num(o.due_amount),
			o.invoice_type ?? "",
		]);
		const csv = [head, ...rows]
			.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
			.join("\n");

		const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
		const a = document.createElement("a");
		a.href = url;
		a.download = `pos-sales-${range}-${todayISO()}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	};

	const clearFilters = () => {
		setRange("today");
		setBranch("all");
		setTender("all");
		setInvoiceType("pos,pre_booking");
		setSearch("");
	};

	const filtersActive =
		range !== "today" ||
		branch !== "all" ||
		tender !== "all" ||
		invoiceType !== "pos,pre_booking" ||
		Boolean(search);

	const card =
		"p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl";
	const select =
		"h-9 px-3 text-xs font-bold bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:border-blue-500 cursor-pointer";

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
				<div>
					<h1 className="text-xl font-black text-zinc-900 dark:text-white">POS Sales</h1>
					<p className="text-xs text-zinc-500 mt-0.5">
						Counter sales and pre-booking settlements, by branch and till.
					</p>
				</div>
				<div className="flex items-center gap-2">
					<button
						onClick={exportCsv}
						disabled={orders.length === 0}
						className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-bold text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40"
					>
						<Download className="w-3.5 h-3.5" strokeWidth={2} />
						Export CSV
					</button>
					<Link
						href="/admin/pos"
						className="inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700"
					>
						<Store className="w-3.5 h-3.5" strokeWidth={2} />
						Open till
					</Link>
				</div>
			</div>

			{/* KPIs */}
			<div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
				<div className={card}>
					<p className="text-xs font-medium text-zinc-500">Sales</p>
					<p className="text-2xl font-black text-zinc-900 dark:text-white mt-1">
						{summary.count}
					</p>
				</div>
				<div className={card}>
					<p className="text-xs font-medium text-zinc-500">Gross takings</p>
					<p className="text-2xl font-black text-zinc-900 dark:text-white mt-1">
						{formatBDT(summary.gross)}
					</p>
				</div>
				<div className={card}>
					<p className="text-xs font-medium text-zinc-500">Collected</p>
					<p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
						{formatBDT(summary.collected)}
					</p>
				</div>
				<div className={card}>
					<p className="text-xs font-medium text-zinc-500">Outstanding due</p>
					<p
						className={`text-2xl font-black mt-1 ${summary.due > 0 ? "text-rose-600 dark:text-rose-400" : "text-zinc-900 dark:text-white"}`}
					>
						{formatBDT(summary.due)}
					</p>
				</div>
				<div className={card}>
					<p className="text-xs font-medium text-zinc-500">Average sale</p>
					<p className="text-2xl font-black text-zinc-900 dark:text-white mt-1">
						{formatBDT(summary.average)}
					</p>
				</div>
			</div>

			{/* Tender split */}
			{summary.byTender.length > 0 && (
				<div className={`${card} flex flex-wrap items-center gap-x-8 gap-y-3`}>
					<span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
						By tender
					</span>
					{summary.byTender.map(([method, amount]) => {
						const Icon = TENDER_ICONS[method] || Receipt;
						return (
							<span key={method} className="flex items-center gap-2">
								<Icon className="w-4 h-4 text-zinc-400" strokeWidth={2} />
								<span className="text-xs font-bold capitalize text-zinc-500">
									{method.replace(/_/g, " ")}
								</span>
								<span className="text-sm font-black text-zinc-900 dark:text-white">
									{formatBDT(amount)}
								</span>
							</span>
						);
					})}
				</div>
			)}

			{/* Filters */}
			<div className={`${card} flex flex-wrap items-center gap-3`}>
				<Filter className="w-4 h-4 text-zinc-400 shrink-0" strokeWidth={2} />

				<div className="relative flex-1 min-w-52">
					<Search
						className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none"
						strokeWidth={2}
					/>
					<input
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Order number, customer or phone…"
						className="w-full h-9 pl-9 pr-3 text-xs font-medium bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:border-blue-500"
					/>
				</div>

				<select value={range} onChange={(e) => setRange(e.target.value as any)} className={select}>
					{RANGES.map((r) => (
						<option key={r.id} value={r.id}>
							{r.label}
						</option>
					))}
				</select>

				<select value={branch} onChange={(e) => setBranch(e.target.value)} className={select}>
					<option value="all">All branches</option>
					{warehouses.map((w) => (
						<option key={w.id} value={w.id}>
							{w.name}
						</option>
					))}
				</select>

				<select value={tender} onChange={(e) => setTender(e.target.value)} className={select}>
					<option value="all">All tenders</option>
					{["cash", "card", "bkash", "nagad", "split_payment"].map((m) => (
						<option key={m} value={m}>
							{m.replace(/_/g, " ")}
						</option>
					))}
				</select>

				<select
					value={invoiceType}
					onChange={(e) => setInvoiceType(e.target.value)}
					className={select}
				>
					<option value="pos,pre_booking">Counter + pre-booking</option>
					<option value="pos">Counter sales only</option>
					<option value="pre_booking">Pre-booking settlements</option>
				</select>

				{filtersActive && (
					<button
						onClick={clearFilters}
						className="inline-flex items-center gap-1 h-9 px-3 text-xs font-bold text-rose-600 hover:underline"
					>
						<X className="w-3.5 h-3.5" strokeWidth={2.5} />
						Clear
					</button>
				)}
			</div>

			{/* Table */}
			<div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
				{loading ? (
					<div className="p-12 text-center text-xs text-zinc-400">Loading POS sales…</div>
				) : error ? (
					<div className="p-12 text-center">
						<p className="text-sm font-bold text-rose-600">{error}</p>
						<button
							onClick={fetchOrders}
							className="mt-3 px-4 py-2 text-xs font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700"
						>
							Retry
						</button>
					</div>
				) : orders.length === 0 ? (
					<div className="p-12 text-center text-zinc-400">
						<Receipt className="w-8 h-8 mx-auto" strokeWidth={1.5} />
						<p className="font-bold text-sm mt-3 text-zinc-500">No POS sales in this view</p>
						<p className="text-xs mt-1">
							{filtersActive
								? "Try widening the date range or clearing a filter."
								: "Counter sales will appear here as soon as the till rings one up."}
						</p>
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-left text-xs">
							<thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 font-bold uppercase text-[10px]">
								<tr>
									<th className="px-4 py-3.5">Invoice</th>
									<th className="px-4 py-3.5">When</th>
									<th className="px-4 py-3.5">Branch</th>
									<th className="px-4 py-3.5">Customer</th>
									<th className="px-4 py-3.5">Tender</th>
									<th className="px-4 py-3.5 text-right">Total</th>
									<th className="px-4 py-3.5 text-right">Due</th>
									<th className="px-4 py-3.5 text-right">Options</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 font-medium">
								{orders.map((o) => {
									const due = num(o.due_amount);
									const Icon = TENDER_ICONS[(o.payment_method || "").toLowerCase()] || Receipt;
									const isOpen = expanded === o.id;

									return (
										<Fragment key={o.id}>
											<tr className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 align-top">
												<td className="px-4 py-3">
													<p className="font-mono font-bold text-zinc-900 dark:text-white">
														{o.order_number}
													</p>
													{o.invoice_type === "pre_booking" && (
														<span className="inline-block mt-1 px-1.5 py-0.5 text-[9px] font-black uppercase rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
															Pre-booking
														</span>
													)}
												</td>
												<td className="px-4 py-3 text-zinc-500">
													{new Date(o.created_at).toLocaleString("en-BD", {
														dateStyle: "short",
														timeStyle: "short",
													})}
												</td>
												<td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
													{branchName(o.warehouse_id)}
												</td>
												<td className="px-4 py-3">
													<p className="font-bold text-zinc-900 dark:text-white">
														{o.customer_name || "Counter Customer"}
													</p>
													{o.customer_phone && (
														<p className="text-[10px] text-zinc-500 font-mono">
															{o.customer_phone}
														</p>
													)}
												</td>
												<td className="px-4 py-3">
													<span className="inline-flex items-center gap-1.5 capitalize text-zinc-700 dark:text-zinc-300">
														<Icon className="w-3.5 h-3.5 text-zinc-400" strokeWidth={2} />
														{(o.payment_method || "—").replace(/_/g, " ")}
													</span>
												</td>
												<td className="px-4 py-3 text-right font-black text-zinc-900 dark:text-white">
													{formatBDT(num(o.total))}
												</td>
												<td className="px-4 py-3 text-right font-bold">
													{due > 0 ? (
														<span className="text-rose-600 dark:text-rose-400">
															{formatBDT(due)}
														</span>
													) : (
														<span className="text-emerald-600 dark:text-emerald-400">
															Settled
														</span>
													)}
												</td>
												<td className="px-4 py-3">
													<div className="flex items-center justify-end gap-1">
														<button
															onClick={() => setExpanded(isOpen ? null : o.id)}
															title={isOpen ? "Hide details" : "Show details"}
															className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white"
														>
															<Eye className="w-3.5 h-3.5" strokeWidth={2} />
														</button>
														<Link
															href={`/admin/pos/thermal-receipt/${o.id}`}
															target="_blank"
															title="Thermal receipt"
															className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white"
														>
															<Printer className="w-3.5 h-3.5" strokeWidth={2} />
														</Link>
														<Link
															href={`/admin/orders/${o.id}/invoice/print`}
															target="_blank"
															title="A4 invoice"
															className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white"
														>
															<FileText className="w-3.5 h-3.5" strokeWidth={2} />
														</Link>
														<Link
															href={`/admin/orders/${o.id}`}
															title="Open full order"
															className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white"
														>
															<ExternalLink className="w-3.5 h-3.5" strokeWidth={2} />
														</Link>
													</div>
												</td>
											</tr>

											{isOpen && (
												<tr className="bg-zinc-50 dark:bg-zinc-800/40">
													<td colSpan={8} className="px-4 py-4">
														<div className="grid md:grid-cols-3 gap-6">
															<div>
																<p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">
																	Items
																</p>
																{o.items && o.items.length > 0 ? (
																	<ul className="space-y-1.5">
																		{o.items.map((it) => (
																			<li
																				key={it.id}
																				className="flex justify-between gap-4 text-zinc-700 dark:text-zinc-300"
																			>
																				<span>
																					{it.name}{" "}
																					<span className="text-zinc-400">× {it.quantity}</span>
																				</span>
																				<span className="font-bold whitespace-nowrap">
																					{formatBDT(num(it.unit_price) * it.quantity)}
																				</span>
																			</li>
																		))}
																	</ul>
																) : (
																	<p className="text-zinc-400">No line items recorded.</p>
																)}
															</div>

															<div>
																<p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">
																	Payment
																</p>
																<dl className="space-y-1.5 text-zinc-700 dark:text-zinc-300">
																	<div className="flex justify-between gap-4">
																		<dt>Subtotal</dt>
																		<dd className="font-bold">{formatBDT(num(o.subtotal))}</dd>
																	</div>
																	{num(o.discount_amount) > 0 && (
																		<div className="flex justify-between gap-4">
																			<dt>Discount</dt>
																			<dd className="font-bold text-emerald-600">
																				−{formatBDT(num(o.discount_amount))}
																			</dd>
																		</div>
																	)}
																	{num(o.advance_deducted) > 0 && (
																		<div className="flex justify-between gap-4">
																			<dt>Advance applied</dt>
																			<dd className="font-bold text-blue-600">
																				−{formatBDT(num(o.advance_deducted))}
																			</dd>
																		</div>
																	)}
																	{Array.isArray(o.payment_breakdown) &&
																		o.payment_breakdown.map((leg, i) => (
																			<div key={i} className="flex justify-between gap-4">
																				<dt className="capitalize">
																					{leg.method?.replace(/_/g, " ")}
																				</dt>
																				<dd className="font-bold">{formatBDT(num(leg.amount))}</dd>
																			</div>
																		))}
																	<div className="flex justify-between gap-4 pt-1.5 border-t border-zinc-200 dark:border-zinc-700">
																		<dt className="font-bold">Total</dt>
																		<dd className="font-black text-zinc-900 dark:text-white">
																			{formatBDT(num(o.total))}
																		</dd>
																	</div>
																</dl>
															</div>

															<div>
																<p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">
																	Record
																</p>
																<dl className="space-y-1.5 text-zinc-700 dark:text-zinc-300">
																	<div className="flex justify-between gap-4">
																		<dt>Status</dt>
																		<dd className="font-bold capitalize">{o.status}</dd>
																	</div>
																	<div className="flex justify-between gap-4">
																		<dt>Payment status</dt>
																		<dd className="font-bold capitalize">
																			{o.payment_status || "—"}
																		</dd>
																	</div>
																	<div className="flex justify-between gap-4">
																		<dt>Shift</dt>
																		<dd className="font-mono text-[10px]">
																			{o.shift_id ? o.shift_id.slice(0, 8) : "—"}
																		</dd>
																	</div>
																</dl>
																{o.notes && (
																	<p className="mt-3 text-zinc-500 italic">{o.notes}</p>
																)}
																{due > 0 && (
																	<Link
																		href={`/admin/orders/${o.id}`}
																		className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold bg-rose-600 text-white rounded-lg hover:bg-rose-700"
																	>
																		<RotateCcw className="w-3 h-3" strokeWidth={2.5} />
																		Settle {formatBDT(due)}
																	</Link>
																)}
															</div>
														</div>
													</td>
												</tr>
											)}
										</Fragment>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</div>
	);
}

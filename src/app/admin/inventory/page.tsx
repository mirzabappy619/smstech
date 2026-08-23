"use client";

import { useState, useEffect } from "react";
import Link from "next/link";


interface InventoryItem {
	id: string;
	product_id: string;
	variation_id: string | null;
	product_name: string;
	variation_name: string | null;
	sku: string;
	quantity: number;
	reserved_quantity: number;
	available_quantity: number;
	reorder_point: number;
	reorder_quantity: number;
	last_restocked: string | null;
	location: string | null;
}

interface StockAdjustment {
	quantity: number;
	reason: string;
	notes: string;
}

interface LogEntry {
	id: string;
	adjustment_type: string;
	quantity_change: number;
	quantity_before: number;
	quantity_after: number;
	reason: string | null;
	order_id: string | null;
	created_at: string;
	inventory: {
		products: { name: string; sku: string } | null;
		product_variations: { name: string } | null;
	} | null;
}

export default function InventoryPage() {
	const [inventory, setInventory] = useState<InventoryItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [searchQuery, setSearchQuery] = useState("");
	const [stockFilter, setStockFilter] = useState<string>("all");
	const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
	const [showAdjustModal, setShowAdjustModal] = useState(false);
	const [adjustment, setAdjustment] = useState<StockAdjustment>({
		quantity: 0,
		reason: "restock",
		notes: "",
	});
	const [activeTab, setActiveTab] = useState<'inventory' | 'logs'>('inventory');
	const [logs, setLogs] = useState<LogEntry[]>([]);
	const [logPage, setLogPage] = useState(1);
	const [logTotal, setLogTotal] = useState(0);
	const [logTypeFilter, setLogTypeFilter] = useState('');
	const [logDateFrom, setLogDateFrom] = useState('');
	const [logDateTo, setLogDateTo] = useState('');
	const [logLoading, setLogLoading] = useState(false);

	useEffect(() => {
		if (activeTab === 'inventory') {
			fetchInventory();
		} else {
			fetchLogs();
		}
	}, [stockFilter, activeTab]);

	const fetchLogs = async () => {
		setLogLoading(true);
		try {
			const params = new URLSearchParams({ page: String(logPage), limit: "25" });
			if (logTypeFilter) params.append("adjustment_type", logTypeFilter);
			if (logDateFrom) params.append("date_from", new Date(logDateFrom).toISOString());
			if (logDateTo) params.append("date_to", new Date(logDateTo + 'T23:59:59').toISOString());
			const res = await fetch(`/api/v1/admin/inventory/logs?${params}`);
			const data = await res.json();
			if (data && data.success && Array.isArray(data.data)) {
				setLogs(data.data || []);
				setLogTotal(data.meta?.total || 0);
			} else {
				setLogs([]);
				setLogTotal(0);
			}
		} catch (err) {
			console.error("Failed to fetch logs:", err);
			setLogs([]);
			setLogTotal(0);
		} finally {
			setLogLoading(false);
		}
	};

	const fetchInventory = async () => {
		setLoading(true);
		try {
			const params = new URLSearchParams();
			if (searchQuery) params.append("search", searchQuery);
			if (stockFilter === "low") params.append("low_stock", "true");
			if (stockFilter === "out") params.append("out_of_stock", "true");

			const response = await fetch(`/api/v1/admin/inventory?${params}`);
			const data = await response.json();

			if (data && data.success && Array.isArray(data.data)) {
				setInventory(data.data || []);
			} else {
				setInventory([]);
			}
		} catch (err) {
			console.error("Failed to fetch inventory:", err);
			setInventory([]);
		} finally {
			setLoading(false);
		}
	};

	const handleSearch = (e: React.FormEvent) => {
		e.preventDefault();
		fetchInventory();
	};

	const openAdjustModal = (item: InventoryItem) => {
		setSelectedItem(item);
		setAdjustment({
			quantity: 0,
			reason: "restock",
			notes: "",
		});
		setShowAdjustModal(true);
	};

	const handleStockAdjustment = async () => {
		if (!selectedItem || adjustment.quantity === 0) {
			alert("Please enter a valid quantity");
			return;
		}

		try {
			const response = await fetch(
				`/api/v1/admin/inventory/${selectedItem.id}/adjust`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(adjustment),
				},
			);

			if (response.ok) {
				alert("Stock adjusted successfully");
				setShowAdjustModal(false);
				fetchInventory();
			} else {
				const data = await response.json();
				alert(data.error || "Failed to adjust stock");
			}
		} catch (err) {
			alert("Failed to adjust stock");
		}
	};

	const getStockStatus = (item: InventoryItem) => {
		if (item.available_quantity === 0) {
			return {
				label: "Out of Stock",
				color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
			};
		} else if (item.available_quantity <= item.reorder_point) {
			return {
				label: "Low Stock",
				color:
					"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
			};
		}
		return {
			label: "In Stock",
			color:
				"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
		};
	};

	const exportInventory = () => {
		const csv = [
			[
				"SKU",
				"Product",
				"Variation",
				"Quantity",
				"Reserved",
				"Available",
				"Reorder Point",
				"Location",
			],
			...inventory.map((item) => [
				item.sku,
				item.product_name,
				item.variation_name || "-",
				item.quantity,
				item.reserved_quantity,
				item.available_quantity,
				item.reorder_point,
				item.location || "-",
			]),
		]
			.map((row) => row.join(","))
			.join("\n");

		const blob = new Blob([csv], { type: "text/csv" });
		const url = window.URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `inventory-${new Date().toISOString().split("T")[0]}.csv`;
		a.click();
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
						Inventory Management
					</h1>
					<p className="text-zinc-600 dark:text-zinc-400 mt-1">
						Track and manage product stock levels
					</p>
				</div>
				{activeTab === 'inventory' && (
					<>
						<Link href="/admin/inventory/warehouse" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium mr-2">Warehouse Manager</Link>
						<button
							onClick={exportInventory}
							className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2">
							<svg
								className="w-5 h-5"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24">
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
								/>
							</svg>
							Export CSV
						</button>
					</>
				)}
			</div>

			{/* Tab Bar */}
			<div className="border-b border-zinc-200 dark:border-zinc-700">
				<nav className="flex space-x-6">
					{(['inventory', 'logs'] as const).map((tab) => (
						<button
							key={tab}
							onClick={() => {
								setActiveTab(tab);
								if (tab === 'logs') {
									setLogPage(1);
									fetchLogs();
								}
							}}
							className={`pb-3 text-sm font-medium border-b-2 transition-colors capitalize ${
								activeTab === tab
									? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
									: 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
							}`}>
							{tab === 'logs' ? 'Activity Log' : 'Stock Levels'}
						</button>
					))}
				</nav>
			</div>

			{/* Summary Cards - Only show in inventory tab */}
			{activeTab === 'inventory' && (
			<div className="grid grid-cols-1 md:grid-cols-4 gap-6">
				<div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-sm text-zinc-500">Total Items</p>
							<p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">
								{inventory.length}
							</p>
						</div>
						<div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
							<svg
								className="w-6 h-6 text-blue-600 dark:text-blue-400"
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
						</div>
					</div>
				</div>

				<div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-sm text-zinc-500">Low Stock</p>
							<p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">
								{
									inventory.filter(
										(i) =>
											i.available_quantity > 0 &&
											i.available_quantity <= i.reorder_point,
									).length
								}
							</p>
						</div>
						<div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
							<svg
								className="w-6 h-6 text-yellow-600 dark:text-yellow-400"
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
						</div>
					</div>
				</div>

				<div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-sm text-zinc-500">Out of Stock</p>
							<p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
								{inventory.filter((i) => i.available_quantity === 0).length}
							</p>
						</div>
						<div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
							<svg
								className="w-6 h-6 text-red-600 dark:text-red-400"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24">
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M6 18L18 6M6 6l12 12"
								/>
							</svg>
						</div>
					</div>
				</div>

				<div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-sm text-zinc-500">Total Stock</p>
							<p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
								{inventory.reduce(
									(sum, item) => sum + item.available_quantity,
									0,
								)}
							</p>
						</div>
						<div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
							<svg
								className="w-6 h-6 text-green-600 dark:text-green-400"
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
						</div>
					</div>
				</div>
			</div>
			)}

			{/* Filters - Only show in inventory tab */}
			{activeTab === 'inventory' && (
			<div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
				<div className="flex flex-col md:flex-row gap-4">
					<form
						onSubmit={handleSearch}
						className="flex-1 relative">
						<input
							type="text"
							placeholder="Search by product name or SKU..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="w-full pl-10 pr-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500"
						/>
						<svg
							className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
							/>
						</svg>
					</form>

					<select
						value={stockFilter}
						onChange={(e) => setStockFilter(e.target.value)}
						className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500">
						<option value="all">All Items</option>
						<option value="low">Low Stock</option>
						<option value="out">Out of Stock</option>
					</select>

					<button
						onClick={fetchInventory}
						className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
						Search
					</button>
				</div>
			</div>
			)}

			{/* Inventory Table - Only show in inventory tab */}
			{activeTab === 'inventory' && (
			<div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
				{loading ? (
					<div className="p-8 space-y-3">
						{[...Array(5)].map((_, i) => (
							<div
								key={i}
								className="h-16 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse"
							/>
						))}
					</div>
				) : inventory.length === 0 ? (
					<div className="p-12 text-center">
						<svg
							className="w-16 h-16 mx-auto text-zinc-400"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={1.5}
								d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
							/>
						</svg>
						<p className="mt-4 text-zinc-600 dark:text-zinc-400">
							No inventory items found
						</p>
					</div>
				) : (
					<>
						{/* Desktop Table View */}
						<div className="hidden md:block overflow-x-auto">
							<table className="w-full">
								<thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
									<tr>
										<th className="px-6 py-3.5 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
											Product
										</th>
										<th className="px-6 py-3.5 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
											SKU
										</th>
										<th className="px-6 py-3.5 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
											Total Qty
										</th>
										<th className="px-6 py-3.5 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
											Reserved
										</th>
										<th className="px-6 py-3.5 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
											Available
										</th>
										<th className="px-6 py-3.5 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
											Status
										</th>
										<th className="px-6 py-3.5 text-left text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
											Location
										</th>
										<th className="px-6 py-3.5 text-right text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
											Actions
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
									{(inventory || []).map((item) => {
										const status = getStockStatus(item);
										return (
											<tr
												key={item.id}
												className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
												<td className="px-6 py-4">
													<div className="font-semibold text-zinc-900 dark:text-white">
														{item.product_name}
													</div>
													{item.variation_name && (
														<div className="text-xs text-zinc-500 mt-0.5">
															{item.variation_name}
														</div>
													)}
												</td>
												<td className="px-6 py-4 text-xs text-zinc-500 font-mono">
													{item.sku}
												</td>
												<td className="px-6 py-4 font-medium text-zinc-900 dark:text-white">
													{item.quantity}
												</td>
												<td className="px-6 py-4 text-zinc-500">
													{item.reserved_quantity}
												</td>
												<td className="px-6 py-4 font-bold text-zinc-900 dark:text-white">
													{item.available_quantity}
												</td>
												<td className="px-6 py-4">
													<span
														className={`px-2.5 py-1 text-xs font-semibold rounded-full ${status.color}`}>
														{status.label}
													</span>
												</td>
												<td className="px-6 py-4 text-zinc-500 text-xs">
													{item.location || "Default Warehouse"}
												</td>
												<td className="px-6 py-4 text-right">
													<button
														onClick={() => openAdjustModal(item)}
														className="px-3 py-1.5 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-xs font-semibold rounded-lg transition-colors">
														Adjust Stock
													</button>
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>

						{/* Mobile Card View */}
						<div className="md:hidden divide-y divide-zinc-200 dark:divide-zinc-800">
							{(inventory || []).map((item) => {
								const status = getStockStatus(item);
								return (
									<div key={item.id} className="p-4 space-y-3">
										<div className="flex items-start justify-between">
											<div>
												<p className="font-semibold text-sm text-zinc-900 dark:text-white">
													{item.product_name}
												</p>
												{item.variation_name && (
													<p className="text-xs text-zinc-500 mt-0.5">
														{item.variation_name}
													</p>
												)}
												<p className="text-xs text-zinc-400 font-mono mt-0.5">
													{item.sku}
												</p>
											</div>
											<span
												className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-full ${status.color}`}>
												{status.label}
											</span>
										</div>

										<div className="grid grid-cols-3 gap-2 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl p-3 text-center">
											<div>
												<p className="text-[10px] text-zinc-500 uppercase font-semibold">Total</p>
												<p className="text-sm font-bold text-zinc-900 dark:text-white mt-0.5">{item.quantity}</p>
											</div>
											<div>
												<p className="text-[10px] text-zinc-500 uppercase font-semibold">Reserved</p>
												<p className="text-sm font-medium text-zinc-500 mt-0.5">{item.reserved_quantity}</p>
											</div>
											<div>
												<p className="text-[10px] text-zinc-500 uppercase font-semibold">Available</p>
												<p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{item.available_quantity}</p>
											</div>
										</div>

										<div className="flex items-center justify-between pt-1">
											<span className="text-xs text-zinc-500">
												📍 {item.location || "Default Warehouse"}
											</span>
											<button
												onClick={() => openAdjustModal(item)}
												className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs">
												Adjust Stock
											</button>
										</div>
									</div>
								);
							})}
						</div>
					</>
				)}
			</div>
			)}

			{/* Activity Logs - Only show in logs tab */}
			{activeTab === 'logs' && (
			<div className="space-y-4">
				{/* Log Filters */}
				<div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
					<div className="flex flex-col md:flex-row gap-3 items-end">
						<div className="flex-1">
							<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
								Operation Type
							</label>
							<select
								value={logTypeFilter}
								onChange={(e) => setLogTypeFilter(e.target.value)}
								className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-white">
								<option value="">All Types</option>
								<option value="purchase">Purchase</option>
								<option value="sale">Sale</option>
								<option value="adjustment">Adjustment</option>
								<option value="return">Return</option>
								<option value="damage">Damage</option>
								<option value="transfer">Transfer</option>
							</select>
						</div>
						<div>
							<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
								From Date
							</label>
							<input
								type="date"
								value={logDateFrom}
								onChange={(e) => setLogDateFrom(e.target.value)}
								className="px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-white"
							/>
						</div>
						<div>
							<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
								To Date
							</label>
							<input
								type="date"
								value={logDateTo}
								onChange={(e) => setLogDateTo(e.target.value)}
								className="px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-white"
							/>
						</div>
						<button
							onClick={() => fetchLogs()}
							className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
							Apply
						</button>
					</div>
				</div>

				{/* Logs Table */}
				<div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
					{logLoading ? (
						<div className="p-8 text-center">
							<div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
						</div>
					) : logs.length === 0 ? (
						<div className="p-8 text-center text-zinc-500">No activity logs found</div>
					) : (
						<div className="overflow-x-auto">
							<table className="w-full text-sm">
								<thead className="bg-zinc-50 dark:bg-zinc-800/50">
									<tr>
										<th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Date</th>
										<th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Product</th>
										<th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Type</th>
										<th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Change</th>
										<th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Before → After</th>
										<th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase">Reason</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-zinc-100 dark:divide-zinc-700">
									{(logs || []).map((log) => (
										<tr key={log.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
											<td className="px-4 py-3 text-zinc-500">
												{new Date(log.created_at).toLocaleDateString()}<br/>
												<span className="text-xs text-zinc-400">{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
											</td>
											<td className="px-4 py-3 font-medium text-zinc-900 dark:text-white">
												{log.inventory?.products?.name || '—'}
												{log.inventory?.product_variations?.name && (
													<div className="text-xs text-zinc-500">({log.inventory.product_variations.name})</div>
												)}
											</td>
											<td className="px-4 py-3">
												<span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
													log.adjustment_type === 'sale' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
													log.adjustment_type === 'purchase' || log.adjustment_type === 'adjustment' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
													'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
												}`}>
													{log.adjustment_type}
												</span>
											</td>
											<td className={`px-4 py-3 font-medium ${log.quantity_change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
												{log.quantity_change >= 0 ? '+' : ''}{log.quantity_change}
											</td>
											<td className="px-4 py-3 text-zinc-500">
												{log.quantity_before} → {log.quantity_after}
											</td>
											<td className="px-4 py-3 text-zinc-500 max-w-xs truncate">{log.reason || '—'}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</div>

				{/* Pagination */}
				<div className="flex items-center justify-between text-sm text-zinc-500">
					<span>{logTotal} total entries</span>
					<div className="flex gap-2">
						<button
							disabled={logPage === 1}
							onClick={() => { setLogPage(p => p - 1); fetchLogs(); }}
							className="px-3 py-1 border border-zinc-200 dark:border-zinc-700 rounded disabled:opacity-40">
							Previous
						</button>
						<button
							disabled={logPage * 25 >= logTotal}
							onClick={() => { setLogPage(p => p + 1); fetchLogs(); }}
							className="px-3 py-1 border border-zinc-200 dark:border-zinc-700 rounded disabled:opacity-40">
							Next
						</button>
					</div>
				</div>
			</div>
			)}

			{/* Stock Adjustment Modal */}
			{showAdjustModal && selectedItem && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
					<div className="bg-white dark:bg-zinc-900 rounded-xl max-w-md w-full">
						<div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
							<h2 className="text-xl font-bold text-zinc-900 dark:text-white">
								Adjust Stock
							</h2>
							<button
								onClick={() => setShowAdjustModal(false)}
								className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
								<svg
									className="w-6 h-6"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24">
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M6 18L18 6M6 6l12 12"
									/>
								</svg>
							</button>
						</div>
						<div className="p-6 space-y-4">
							<div>
								<p className="text-sm text-zinc-600 dark:text-zinc-400">
									Product
								</p>
								<p className="text-zinc-900 dark:text-white font-medium">
									{selectedItem.product_name}
									{selectedItem.variation_name &&
										` - ${selectedItem.variation_name}`}
								</p>
							</div>
							<div>
								<p className="text-sm text-zinc-600 dark:text-zinc-400">
									Current Stock
								</p>
								<p className="text-2xl font-bold text-zinc-900 dark:text-white">
									{selectedItem.available_quantity}
								</p>
							</div>

							<div>
								<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
									Adjustment Quantity
								</label>
								<input
									type="number"
									value={adjustment.quantity}
									onChange={(e) =>
										setAdjustment({
											...adjustment,
											quantity: parseInt(e.target.value) || 0,
										})
									}
									className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
									placeholder="Enter positive or negative number"
								/>
								<p className="text-sm text-zinc-500 mt-1">
									Use positive numbers to add stock, negative to remove
								</p>
							</div>

							<div>
								<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
									Reason
								</label>
								<select
									value={adjustment.reason}
									onChange={(e) =>
										setAdjustment({ ...adjustment, reason: e.target.value })
									}
									className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
									<option value="restock">Restock</option>
									<option value="return">Customer Return</option>
									<option value="damage">Damaged/Lost</option>
									<option value="correction">Inventory Correction</option>
									<option value="other">Other</option>
								</select>
							</div>

							<div>
								<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
									Notes (Optional)
								</label>
								<textarea
									value={adjustment.notes}
									onChange={(e) =>
										setAdjustment({ ...adjustment, notes: e.target.value })
									}
									className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
									rows={3}
									placeholder="Add any additional notes..."
								/>
							</div>

							<div className="flex gap-3 pt-4">
								<button
									onClick={() => setShowAdjustModal(false)}
									className="flex-1 px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800">
									Cancel
								</button>
								<button
									onClick={handleStockAdjustment}
									className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
									Adjust Stock
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

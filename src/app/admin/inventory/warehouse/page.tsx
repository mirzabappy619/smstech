"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Warehouse {
	id: string;
	name: string;
	code: string;
	type: string;
	address_city?: string;
	is_default: boolean;
	inventory_summary: {
		total_quantity: number;
		total_available: number;
		sku_count: number;
	};
}

interface WarehouseStock {
	inventory_id?: string;
	warehouse_id: string;
	location_name: string;
	location_code: string;
	location_city?: string;
	is_default: boolean;
	quantity: number;
	reserved_quantity: number;
	available_quantity: number;
}

interface MissingWarehouse {
	id: string;
	name: string;
	code: string;
	address_city?: string;
	is_default: boolean;
}

interface Variation {
	id: string;
	name: string;
	sku: string;
	product_name?: string;
	attributes?: Record<string, string>;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function StockBadge({ qty, reserved }: { qty: number; reserved: number }) {
	const available = qty - reserved;
	const color =
		available <= 0
			? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
			: available <= 10
				? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
				: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
	return (
		<span
			className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${color}`}>
			{available <= 0 ? "Out of stock" : available <= 10 ? "Low stock" : "In stock"}
		</span>
	);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WarehouseInventoryPage() {
	const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
	const [selectedVariation, setSelectedVariation] = useState<Variation | null>(null);
	const [warehouseStocks, setWarehouseStocks] = useState<WarehouseStock[]>([]);
	const [missingWarehouses, setMissingWarehouses] = useState<MissingWarehouse[]>([]);
	const [totals, setTotals] = useState({ total_quantity: 0, total_reserved: 0, total_available: 0 });

	const [variationIdInput, setVariationIdInput] = useState("");
	const [editQuantities, setEditQuantities] = useState<Record<string, number>>({});
	const [saving, setSaving] = useState<Record<string, boolean>>({});
	const [successMsg, setSuccessMsg] = useState<Record<string, string>>({});
	const [loading, setLoading] = useState(false);
	const [warehousesLoading, setWarehousesLoading] = useState(true);
	const [notes, setNotes] = useState("");

	// New warehouse form
	const [showNewWarehouseForm, setShowNewWarehouseForm] = useState(false);
	const [newWarehouse, setNewWarehouse] = useState({
		name: "",
		code: "",
		type: "warehouse",
		address_city: "",
		address_state: "",
		address_country: "Bangladesh",
		phone: "",
		latitude: "",
		longitude: "",
		is_default: false,
	});
	const [creatingWarehouse, setCreatingWarehouse] = useState(false);

	// ── Fetch warehouses on mount ──────────────────────────────────────────────
	const fetchWarehouses = useCallback(async () => {
		setWarehousesLoading(true);
		try {
			const res = await fetch("/api/v1/admin/warehouses");
			const data = await res.json();
			if (data.success) setWarehouses(data.data || []);
		} catch (e) {
			console.error(e);
		} finally {
			setWarehousesLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchWarehouses();
	}, [fetchWarehouses]);

	// ── Look up variation inventory ────────────────────────────────────────────
	const lookupVariation = async () => {
		const id = variationIdInput.trim();
		if (!id) return;
		setLoading(true);
		setSelectedVariation(null);
		setWarehouseStocks([]);
		setMissingWarehouses([]);

		try {
			const res = await fetch(`/api/v1/admin/inventory/warehouse?variation_id=${id}`);
			const data = await res.json();
			if (!data.success) {
				alert(data.error?.message || "Failed to fetch inventory");
				return;
			}
			setWarehouseStocks(data.data.warehouses || []);
			setMissingWarehouses(data.data.missing_warehouses || []);
			setTotals(data.data.totals || {});

			// Seed edit quantities
			const qtyMap: Record<string, number> = {};
			(data.data.warehouses || []).forEach((w: WarehouseStock) => {
				qtyMap[w.warehouse_id] = w.quantity;
			});
			setEditQuantities(qtyMap);
			setSelectedVariation({ id, name: "Variation", sku: id });
		} catch (e) {
			console.error(e);
		} finally {
			setLoading(false);
		}
	};

	// ── Save stock for a warehouse ─────────────────────────────────────────────
	const saveStock = async (warehouseId: string) => {
		if (!selectedVariation) return;
		setSaving((s) => ({ ...s, [warehouseId]: true }));
		setSuccessMsg((s) => ({ ...s, [warehouseId]: "" }));

		try {
			const res = await fetch("/api/v1/admin/inventory/warehouse", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					variation_id: selectedVariation.id,
					warehouse_id: warehouseId,
					quantity_in_packages: editQuantities[warehouseId] || 0,
					notes,
				}),
			});
			const data = await res.json();
			if (data.success) {
				setSuccessMsg((s) => ({ ...s, [warehouseId]: "Saved!" }));
				// Re-fetch updated stocks
				lookupVariation();
			} else {
				alert(data.error?.message || "Failed to save");
			}
		} catch (e) {
			console.error(e);
			alert("Network error");
		} finally {
			setSaving((s) => ({ ...s, [warehouseId]: false }));
			setTimeout(() => setSuccessMsg((s) => ({ ...s, [warehouseId]: "" })), 3000);
		}
	};

	// ── Create warehouse ───────────────────────────────────────────────────────
	const createWarehouse = async (e: React.FormEvent) => {
		e.preventDefault();
		setCreatingWarehouse(true);
		try {
			const payload = {
				...newWarehouse,
				code: newWarehouse.code.toUpperCase(),
				latitude: newWarehouse.latitude ? parseFloat(newWarehouse.latitude) : undefined,
				longitude: newWarehouse.longitude ? parseFloat(newWarehouse.longitude) : undefined,
			};

			const res = await fetch("/api/v1/admin/warehouses", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			const data = await res.json();
			if (data.success) {
				setShowNewWarehouseForm(false);
				setNewWarehouse({
					name: "", code: "", type: "warehouse", address_city: "",
					address_state: "", address_country: "Bangladesh", phone: "",
					latitude: "", longitude: "", is_default: false,
				});
				fetchWarehouses();
			} else {
				alert(data.error?.message || "Failed to create warehouse");
			}
		} catch (e) {
			console.error(e);
		} finally {
			setCreatingWarehouse(false);
		}
	};

	// ─── Render ────────────────────────────────────────────────────────────────
	return (
		<div className="space-y-8">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
						Warehouse Inventory
					</h1>
					<p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
						Manage stock levels per warehouse location
					</p>
				</div>
				<div className="flex gap-3">
					<Link
						href="/admin/inventory"
						className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-700 transition">
						← All Inventory
					</Link>
					<button
						onClick={() => setShowNewWarehouseForm(true)}
						className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition">
						+ Add Warehouse
					</button>
				</div>
			</div>

			{/* ── Warehouse Overview Grid ── */}
			<section>
				<h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
					Warehouses
				</h2>
				{warehousesLoading ? (
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
						{[1, 2, 3].map((i) => (
							<div key={i} className="h-32 bg-gray-100 dark:bg-zinc-800 rounded-xl animate-pulse" />
						))}
					</div>
				) : warehouses.length === 0 ? (
					<div className="text-center py-12 bg-white dark:bg-zinc-800 rounded-xl border border-dashed border-gray-300 dark:border-zinc-700">
						<p className="text-zinc-500 dark:text-zinc-400 text-sm">No warehouses configured yet.</p>
					</div>
				) : (
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
						{warehouses.map((wh) => (
							<div
								key={wh.id}
								className="bg-white dark:bg-zinc-800 rounded-xl border border-gray-200 dark:border-zinc-700 p-5 shadow-sm hover:shadow-md transition">
								<div className="flex items-start justify-between">
									<div>
										<p className="font-semibold text-zinc-900 dark:text-zinc-100">{wh.name}</p>
										<p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
											{wh.code} · {wh.address_city || "N/A"}
										</p>
									</div>
									{wh.is_default && (
										<span className="text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-0.5 rounded-full">
											Default
										</span>
									)}
								</div>
								<div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
									<div className="bg-gray-50 dark:bg-zinc-700/50 rounded-lg p-2">
										<p className="font-bold text-lg text-zinc-900 dark:text-zinc-100">
											{wh.inventory_summary.total_quantity}
										</p>
										<p className="text-zinc-500 dark:text-zinc-400">Total</p>
									</div>
									<div className="bg-gray-50 dark:bg-zinc-700/50 rounded-lg p-2">
										<p className="font-bold text-lg text-emerald-600 dark:text-emerald-400">
											{wh.inventory_summary.total_available}
										</p>
										<p className="text-zinc-500 dark:text-zinc-400">Available</p>
									</div>
									<div className="bg-gray-50 dark:bg-zinc-700/50 rounded-lg p-2">
										<p className="font-bold text-lg text-zinc-900 dark:text-zinc-100">
											{wh.inventory_summary.sku_count}
										</p>
										<p className="text-zinc-500 dark:text-zinc-400">SKUs</p>
									</div>
								</div>
							</div>
						))}
					</div>
				)}
			</section>

			{/* ── Look up a Variation ── */}
			<section className="bg-white dark:bg-zinc-800 rounded-xl border border-gray-200 dark:border-zinc-700 p-6 shadow-sm">
				<h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
					Lookup Stock by Variation
				</h2>
				<div className="flex gap-3">
					<input
						type="text"
						value={variationIdInput}
						onChange={(e) => setVariationIdInput(e.target.value)}
						onKeyDown={(e) => e.key === "Enter" && lookupVariation()}
						placeholder="Paste variation UUID..."
						className="flex-1 px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
					/>
					<button
						onClick={lookupVariation}
						disabled={loading || !variationIdInput.trim()}
						className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition">
						{loading ? "Loading…" : "Lookup"}
					</button>
				</div>
				<p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
					Tip: Find variation IDs on the product detail page or via the Inventory list.
				</p>
			</section>

			{/* ── Per-Warehouse Stock Table ── */}
			{selectedVariation && (
				<section className="bg-white dark:bg-zinc-800 rounded-xl border border-gray-200 dark:border-zinc-700 shadow-sm overflow-hidden">
					<div className="px-6 py-4 border-b border-gray-200 dark:border-zinc-700 flex items-center justify-between">
						<div>
							<h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
								Stock per Warehouse
							</h2>
							<p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
								Variation: <code className="font-mono">{selectedVariation.id}</code>
							</p>
						</div>
						{/* Totals */}
						<div className="flex gap-4 text-sm">
							<div className="text-center">
								<p className="font-bold text-zinc-900 dark:text-zinc-100">{totals.total_quantity}</p>
								<p className="text-xs text-zinc-500">Total</p>
							</div>
							<div className="text-center">
								<p className="font-bold text-amber-600">{totals.total_reserved}</p>
								<p className="text-xs text-zinc-500">Reserved</p>
							</div>
							<div className="text-center">
								<p className="font-bold text-emerald-600">{totals.total_available}</p>
								<p className="text-xs text-zinc-500">Available</p>
							</div>
						</div>
					</div>

					{/* Notes field */}
					<div className="px-6 py-3 bg-gray-50 dark:bg-zinc-700/30 border-b border-gray-200 dark:border-zinc-700">
						<label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
							Adjustment notes (optional, applied to all saves)
						</label>
						<input
							type="text"
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
							placeholder="e.g. Monthly stock count"
							className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:ring-1 focus:ring-blue-500 focus:outline-none"
						/>
					</div>

					<table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
						<thead className="bg-gray-50 dark:bg-zinc-700/50">
							<tr>
								{["Warehouse", "Status", "Current Stock", "Reserved", "Available", "New Qty", "Action"].map((h) => (
									<th key={h} className="px-4 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
										{h}
									</th>
								))}
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-100 dark:divide-zinc-700">
							{/* Existing records */}
							{warehouseStocks.map((ws) => (
								<tr key={ws.warehouse_id} className="hover:bg-gray-50 dark:hover:bg-zinc-700/30">
									<td className="px-4 py-3">
										<p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
											{ws.location_name}
											{ws.is_default && <span className="ml-1 text-xs text-blue-500">(default)</span>}
										</p>
										<p className="text-xs text-zinc-400">{ws.location_code}</p>
									</td>
									<td className="px-4 py-3">
										<StockBadge qty={ws.quantity} reserved={ws.reserved_quantity} />
									</td>
									<td className="px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100">{ws.quantity}</td>
									<td className="px-4 py-3 text-sm text-amber-600">{ws.reserved_quantity}</td>
									<td className="px-4 py-3 text-sm text-emerald-600">{ws.available_quantity}</td>
									<td className="px-4 py-3">
										<input
											type="number"
											min={0}
											value={editQuantities[ws.warehouse_id] ?? ws.quantity}
											onChange={(e) =>
												setEditQuantities((q) => ({
													...q,
													[ws.warehouse_id]: parseInt(e.target.value) || 0,
												}))
											}
											className="w-24 px-2 py-1 text-sm border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:ring-1 focus:ring-blue-500 focus:outline-none"
										/>
									</td>
									<td className="px-4 py-3">
										<div className="flex items-center gap-2">
											<button
												onClick={() => saveStock(ws.warehouse_id)}
												disabled={saving[ws.warehouse_id]}
												className="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition">
												{saving[ws.warehouse_id] ? "Saving…" : "Save"}
											</button>
											{successMsg[ws.warehouse_id] && (
												<span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
													✓ {successMsg[ws.warehouse_id]}
												</span>
											)}
										</div>
									</td>
								</tr>
							))}

							{/* Warehouses without existing records */}
							{missingWarehouses.map((mw) => (
								<tr key={mw.id} className="hover:bg-gray-50 dark:hover:bg-zinc-700/30 opacity-60">
									<td className="px-4 py-3">
										<p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
											{mw.name}
											{mw.is_default && <span className="ml-1 text-xs text-blue-500">(default)</span>}
										</p>
										<p className="text-xs text-zinc-400">{mw.code}</p>
									</td>
									<td className="px-4 py-3">
										<span className="text-xs text-zinc-400">No record</span>
									</td>
									<td className="px-4 py-3 text-sm text-zinc-400">—</td>
									<td className="px-4 py-3 text-sm text-zinc-400">—</td>
									<td className="px-4 py-3 text-sm text-zinc-400">—</td>
									<td className="px-4 py-3">
										<input
											type="number"
											min={0}
											value={editQuantities[mw.id] ?? 0}
											onChange={(e) =>
												setEditQuantities((q) => ({
													...q,
													[mw.id]: parseInt(e.target.value) || 0,
												}))
											}
											className="w-24 px-2 py-1 text-sm border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:ring-1 focus:ring-blue-500 focus:outline-none"
										/>
									</td>
									<td className="px-4 py-3">
										<div className="flex items-center gap-2">
											<button
												onClick={() => saveStock(mw.id)}
												disabled={saving[mw.id] || !editQuantities[mw.id]}
												className="px-3 py-1 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg transition">
												{saving[mw.id] ? "Adding…" : "Add Stock"}
											</button>
											{successMsg[mw.id] && (
												<span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
													✓
												</span>
											)}
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>

					{warehouseStocks.length === 0 && missingWarehouses.length === 0 && (
						<div className="text-center py-8 text-zinc-500 dark:text-zinc-400 text-sm">
							No warehouses found. Create a warehouse first.
						</div>
					)}
				</section>
			)}

			{/* ── New Warehouse Modal ── */}
			{showNewWarehouseForm && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
					<div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
						<div className="px-6 py-4 border-b border-gray-200 dark:border-zinc-700 flex items-center justify-between">
							<h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
								Add Warehouse
							</h3>
							<button
								onClick={() => setShowNewWarehouseForm(false)}
								className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-2xl leading-none">
								×
							</button>
						</div>
						<form onSubmit={createWarehouse} className="p-6 space-y-4">
							<div className="grid grid-cols-2 gap-4">
								<div className="col-span-2">
									<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
										Name *
									</label>
									<input
										required
										value={newWarehouse.name}
										onChange={(e) => setNewWarehouse((w) => ({ ...w, name: e.target.value }))}
										className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
										placeholder="e.g. Dhaka Central Warehouse"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
										Code *
									</label>
									<input
										required
										value={newWarehouse.code}
										onChange={(e) =>
											setNewWarehouse((w) => ({ ...w, code: e.target.value.toUpperCase() }))
										}
										className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-sm text-zinc-900 dark:text-zinc-100 font-mono uppercase focus:ring-2 focus:ring-blue-500 focus:outline-none"
										placeholder="e.g. DKA-WH1"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
										Type
									</label>
									<select
										value={newWarehouse.type}
										onChange={(e) => setNewWarehouse((w) => ({ ...w, type: e.target.value }))}
										className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:outline-none">
										<option value="warehouse">Warehouse</option>
										<option value="store">Store</option>
										<option value="fulfillment_center">Fulfillment Center</option>
									</select>
								</div>
								<div>
									<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
										City
									</label>
									<input
										value={newWarehouse.address_city}
										onChange={(e) => setNewWarehouse((w) => ({ ...w, address_city: e.target.value }))}
										className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
										placeholder="Dhaka"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
										Phone
									</label>
									<input
										value={newWarehouse.phone}
										onChange={(e) => setNewWarehouse((w) => ({ ...w, phone: e.target.value }))}
										className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
										placeholder="+880..."
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
										Latitude
									</label>
									<input
										type="number"
										step="any"
										value={newWarehouse.latitude}
										onChange={(e) => setNewWarehouse((w) => ({ ...w, latitude: e.target.value }))}
										className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
										placeholder="23.8103"
									/>
								</div>
								<div>
									<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
										Longitude
									</label>
									<input
										type="number"
										step="any"
										value={newWarehouse.longitude}
										onChange={(e) => setNewWarehouse((w) => ({ ...w, longitude: e.target.value }))}
										className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
										placeholder="90.4125"
									/>
								</div>
								<div className="col-span-2">
									<label className="flex items-center gap-2 cursor-pointer">
										<input
											type="checkbox"
											checked={newWarehouse.is_default}
											onChange={(e) => setNewWarehouse((w) => ({ ...w, is_default: e.target.checked }))}
											className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
										/>
										<span className="text-sm text-zinc-700 dark:text-zinc-300">
											Set as default warehouse
										</span>
									</label>
								</div>
							</div>
							<div className="flex justify-end gap-3 pt-2">
								<button
									type="button"
									onClick={() => setShowNewWarehouseForm(false)}
									className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 border border-gray-300 dark:border-zinc-600 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-700 transition">
									Cancel
								</button>
								<button
									type="submit"
									disabled={creatingWarehouse}
									className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition">
									{creatingWarehouse ? "Creating…" : "Create Warehouse"}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}

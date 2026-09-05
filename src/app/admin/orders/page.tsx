"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { isValidBDPhone, BD_PHONE_ERROR_MESSAGE, normalizeBDPhone } from "@/lib/bd-phone-validator";
import { FraudCheckResult, getRiskLevelConfig } from "@/lib/fraud-check";
import { formatBDT } from "@/lib/currency";
import { notify } from "@/components/ui/toast";

interface OrderItem {
	id: string;
	quantity: number;
	product_name: string;
	variation_name: string | null;
	total_price: number;
	unit_price?: number;
}

interface Order {
	id: string;
	order_number: string;
	status: string;
	total: number;
	subtotal?: number;
	shipping_amount?: number;
	discount_amount?: number;
	items_count: number;
	items: OrderItem[];
	customer_email: string;
	customer_name: string;
	customer_phone: string | null;
	payment_method: string | null;
	payment_status?: string;
	shipping_method?: string;
	created_at: string;
}

interface AvailableProduct {
	id: string;
	name: string;
	base_price: number;
	product_variations?: Array<{
		id: string;
		name: string;
		price: number;
	}>;
}

interface DraftOrderItem {
	product_id: string;
	product_name: string;
	variation_id: string | null;
	variation_name: string | null;
	quantity: number;
	unit_price: number;
}

const statusColors: Record<string, string> = {
	pending:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	processing:
		"bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	shipped:
		"bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
	delivered:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
	refunded: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-400",
};

export default function AdminOrdersPage() {
	const [orders, setOrders] = useState<Order[]>([]);
	const [loading, setLoading] = useState(true);
	const [statusFilter, setStatusFilter] = useState("all");
	const [search, setSearch] = useState("");
	const [totalOrders, setTotalOrders] = useState(0);

	// Create Order Modal State
	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
	const [availableProducts, setAvailableProducts] = useState<AvailableProduct[]>([]);
	const [loadingProducts, setLoadingProducts] = useState(false);
	const [creatingOrder, setCreatingOrder] = useState(false);
	const [createError, setCreateError] = useState<string | null>(null);

	// Form State
	const [custName, setCustName] = useState("");
	const [custPhone, setCustPhone] = useState("");
	const [custEmail, setCustEmail] = useState("");
	const [addressLine1, setAddressLine1] = useState("");
	const [city, setCity] = useState("Dhaka");
	const [shippingMethod, setShippingMethod] = useState("Inside Dhaka Delivery");
	const [shippingAmount, setShippingAmount] = useState<number>(60);
	const [discountAmount, setDiscountAmount] = useState<number>(0);
	const [paymentMethod, setPaymentMethod] = useState("cash_on_delivery");
	const [paymentStatus, setPaymentStatus] = useState("pending");
	const [notes, setNotes] = useState("");

	// Item selection draft
	const [selectedProdId, setSelectedProdId] = useState("");
	const [selectedVarId, setSelectedVarId] = useState("");
	const [itemQty, setItemQty] = useState(1);
	const [customPrice, setCustomPrice] = useState<number | "">("");
	const [draftItems, setDraftItems] = useState<DraftOrderItem[]>([]);

	// Modal live fraud check state
	const [modalFraudResult, setModalFraudResult] = useState<FraudCheckResult | null>(null);
	const [modalFraudLoading, setModalFraudLoading] = useState(false);

	const checkModalPhoneFraud = async (targetPhone?: string) => {
		const rawPhone = targetPhone || custPhone;
		const normalized = normalizeBDPhone(rawPhone);
		if (!normalized || !isValidBDPhone(normalized)) {
			setModalFraudResult(null);
			return;
		}
		setModalFraudLoading(true);
		try {
			const res = await fetch(`/api/v1/fraud-check?phone=${encodeURIComponent(normalized)}`);
			const data = await res.json();
			if (data.success) {
				setModalFraudResult(data);
			} else {
				setModalFraudResult(null);
			}
		} catch {
			setModalFraudResult(null);
		} finally {
			setModalFraudLoading(false);
		}
	};

	const fetchOrders = async () => {
		try {
			setLoading(true);
			const params = new URLSearchParams({
				limit: "100",
				page: "1",
			});

			if (statusFilter !== "all") {
				params.append("status", statusFilter);
			}

			if (search) {
				params.append("search", search);
			}

			const response = await fetch(`/api/v1/admin/orders?${params}`, {
				credentials: "include",
			});
			if (!response.ok) {
				const errorText = await response.text();
				console.error("API Error:", response.status, errorText);
				setOrders([]);
				setTotalOrders(0);
				return;
			}

			const result = await response.json();
			if (result && result.success && Array.isArray(result.data)) {
				setOrders(result.data || []);
				setTotalOrders(result.meta?.total ?? result.data?.length ?? 0);
			} else {
				setOrders([]);
				setTotalOrders(0);
			}
		} catch (error) {
			console.error("Error fetching orders:", error);
			setOrders([]);
			setTotalOrders(0);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchOrders();
	}, [statusFilter, search]);

	const loadProducts = async () => {
		if (availableProducts && availableProducts.length > 0) return;
		setLoadingProducts(true);
		try {
			const res = await fetch("/api/v1/products?show_all=true&limit=100", { credentials: "include" });
			if (res.ok) {
				const json = await res.json();
				if (json && json.success && Array.isArray(json.data)) {
					setAvailableProducts(json.data || []);
				} else {
					setAvailableProducts([]);
				}
			} else {
				setAvailableProducts([]);
			}
		} catch (err) {
			console.error("Failed to load products for order creation:", err);
			setAvailableProducts([]);
		} finally {
			setLoadingProducts(false);
		}
	};

	const openCreateModal = () => {
		setIsCreateModalOpen(true);
		setCreateError(null);
		loadProducts();
	};

	const addDraftItem = () => {
		if (!selectedProdId) {
			notify.warning("Please select a product");
			return;
		}
		const prod = availableProducts.find((p) => p.id === selectedProdId);
		if (!prod) return;

		let varName: string | null = null;
		let unitPrice = Number(prod.base_price) || 0;

		if (selectedVarId && prod.product_variations) {
			const v = prod.product_variations.find((v) => v.id === selectedVarId);
			if (v) {
				varName = v.name;
				unitPrice = Number(v.price) || unitPrice;
			}
		}

		if (customPrice !== "" && !isNaN(Number(customPrice))) {
			unitPrice = Number(customPrice);
		}

		setDraftItems((prev) => [
			...prev,
			{
				product_id: prod.id,
				product_name: prod.name,
				variation_id: selectedVarId || null,
				variation_name: varName,
				quantity: itemQty,
				unit_price: unitPrice,
			},
		]);

		// Reset item picker
		setSelectedProdId("");
		setSelectedVarId("");
		setItemQty(1);
		setCustomPrice("");
	};

	const removeDraftItem = (index: number) => {
		setDraftItems((prev) => prev.filter((_, i) => i !== index));
	};

	const handleShippingMethodChange = (method: string) => {
		setShippingMethod(method);
		if (method.includes("Inside Dhaka")) {
			setShippingAmount(60);
			setCity("Dhaka");
		} else if (method.includes("Outside Dhaka")) {
			setShippingAmount(120);
		} else if (method.includes("Express")) {
			setShippingAmount(150);
		}
	};

	const draftSubtotal = draftItems.reduce((acc, item) => acc + item.unit_price * item.quantity, 0);
	const draftTotal = Math.max(0, draftSubtotal + Number(shippingAmount || 0) - Number(discountAmount || 0));

	const handleCreateOrderSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setCreateError(null);

		if (!custName.trim()) {
			setCreateError("Customer name is required");
			return;
		}
		if (!custPhone.trim() || !isValidBDPhone(custPhone)) {
			setCreateError(BD_PHONE_ERROR_MESSAGE);
			return;
		}
		if (!addressLine1.trim()) {
			setCreateError("Delivery address is required");
			return;
		}
		if (draftItems.length === 0) {
			setCreateError("Please add at least one item to the order");
			return;
		}

		setCreatingOrder(true);
		try {
			const res = await fetch("/api/v1/admin/orders", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({
					customer_name: custName.trim(),
					customer_phone: custPhone.trim(),
					customer_email: custEmail.trim() || undefined,
					address_line1: addressLine1.trim(),
					city: city.trim() || "Dhaka",
					shipping_method: shippingMethod,
					shipping_amount: Number(shippingAmount || 0),
					discount_amount: Number(discountAmount || 0),
					payment_method: paymentMethod,
					payment_status: paymentStatus,
					status: "pending",
					notes: notes.trim() || undefined,
					items: draftItems.map((item) => ({
						product_id: item.product_id,
						variation_id: item.variation_id || undefined,
						quantity: item.quantity,
						unit_price: item.unit_price,
					})),
				}),
			});

			const json = await res.json();
			if (!res.ok || !json.success) {
				throw new Error(json.error?.message || "Failed to create order");
			}

			// Success! Reset form and refresh orders list
			setIsCreateModalOpen(false);
			setDraftItems([]);
			setCustName("");
			setCustPhone("");
			setCustEmail("");
			setAddressLine1("");
			setNotes("");
			fetchOrders();
		} catch (err: any) {
			console.error("Create Order Submit Error:", err);
			setCreateError(err.message || "Failed to create order");
		} finally {
			setCreatingOrder(false);
		}
	};

	const stats = {
		total: orders?.length || 0,
		pending: (orders || []).filter((o) => o?.status === "pending").length,
		processing: (orders || []).filter((o) => o?.status === "processing").length,
		shipped: (orders || []).filter((o) => o?.status === "shipped").length,
		delivered: (orders || []).filter((o) => o?.status === "delivered").length,
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
						Orders
					</h1>
					<p className="text-zinc-500 text-sm mt-1">{totalOrders || 0} total orders in system</p>
				</div>
				<div className="flex items-center gap-3">
					<button
						onClick={openCreateModal}
						className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg shadow-sm flex items-center gap-2 transition-colors">
						<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
						</svg>
						Create Order
					</button>
					<button
						onClick={fetchOrders}
						className="px-3.5 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium text-sm flex items-center gap-2">
						<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
						</svg>
						Refresh
					</button>
				</div>
			</div>

			{/* Stats */}
			<div className="grid grid-cols-2 md:grid-cols-5 gap-4">
				{[
					{ label: "Total", value: stats.total, color: "blue" },
					{ label: "Pending", value: stats.pending, color: "yellow" },
					{ label: "Processing", value: stats.processing, color: "blue" },
					{ label: "Shipped", value: stats.shipped, color: "purple" },
					{ label: "Delivered", value: stats.delivered, color: "green" },
				].map((stat) => (
					<div
						key={stat.label}
						className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
						<p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{stat.label}</p>
						<p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">
							{stat.value || 0}
						</p>
					</div>
				))}
			</div>

			{/* Search & Filters */}
			<div className="flex flex-col sm:flex-row gap-4">
				<div className="relative flex-1">
					<input
						type="text"
						placeholder="Search by order #, customer name, phone, or email..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="w-full pl-10 pr-4 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
					<svg
						className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400"
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
				</div>
				<select
					value={statusFilter}
					onChange={(e) => setStatusFilter(e.target.value)}
					className="px-4 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium">
					<option value="all">All Status</option>
					<option value="pending">Pending</option>
					<option value="processing">Processing</option>
					<option value="shipped">Shipped</option>
					<option value="delivered">Delivered</option>
					<option value="cancelled">Cancelled</option>
				</select>
			</div>

			{/* Orders Table Container */}
			<div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xs">
				{loading ? (
					<div className="p-12 text-center">
						<div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
						<p className="text-sm text-zinc-500 mt-3 font-medium">Loading orders...</p>
					</div>
				) : (orders || []).length === 0 ? (
					<div className="p-12 text-center text-zinc-500">
						<svg className="w-12 h-12 mx-auto text-zinc-300 dark:text-zinc-700 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
						</svg>
						No orders found matching search criteria
					</div>
				) : (
					<>
						{/* Desktop Table View */}
						<div className="hidden md:block overflow-x-auto">
							<table className="w-full">
								<thead className="bg-zinc-50 dark:bg-zinc-800/50 text-left border-b border-zinc-200 dark:border-zinc-800">
									<tr>
										<th className="px-4 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
											Order Number
										</th>
										<th className="px-4 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
											Customer Details
										</th>
										<th className="px-4 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
											Items & Quantity
										</th>
										<th className="px-4 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
											Payment
										</th>
										<th className="px-4 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
											Total Amount
										</th>
										<th className="px-4 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
											Status
										</th>
										<th className="px-4 py-3.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
											Date
										</th>
										<th className="px-4 py-3.5 text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider">
											Actions
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
									{(orders || []).map((order) => (
										<tr
											key={order.id}
											className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
											<td className="px-4 py-4">
												<Link
													href={`/admin/orders/${order.id}`}
													className="font-bold text-blue-600 dark:text-blue-400 hover:underline">
													{order.order_number || "N/A"}
												</Link>
											</td>
											<td className="px-4 py-4">
												<div>
													<p className="font-semibold text-zinc-900 dark:text-white">
														{order.customer_name || "Guest Customer"}
													</p>
													{order.customer_phone && (
														<div className="flex items-center gap-1.5 mt-0.5">
															<span className="text-xs text-zinc-600 dark:text-zinc-400 font-medium font-mono">
																📱 {order.customer_phone}
															</span>
															<Link
																href={`/admin/fraud-check?phone=${encodeURIComponent(order.customer_phone)}`}
																title="Check Delivery & Fraud History"
																className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-900/60 transition-colors">
																🛡️ Risk
															</Link>
														</div>
													)}
													<p className="text-xs text-zinc-500 dark:text-zinc-500 mt-0.5">
														{order.customer_email || "No Email"}
													</p>
												</div>
											</td>
											<td className="px-4 py-4">
												<div className="space-y-1">
													{(order.items || []).slice(0, 2).map((item, idx) => (
														<p key={item.id || idx} className="text-xs text-zinc-700 dark:text-zinc-300 truncate max-w-xs">
															<span className="font-semibold">{item.quantity || 1}x</span> {item.product_name || "Product"}
															{item.variation_name ? ` (${item.variation_name})` : ""}
														</p>
													))}
													{(order.items || []).length > 2 && (
														<p className="text-xs text-zinc-400 italic">
															+ {(order.items || []).length - 2} more item(s)
														</p>
													)}
													{(order.items || []).length === 0 && (
														<p className="text-xs text-zinc-400 italic">
															{order.items_count || 0} item(s)
														</p>
													)}
												</div>
											</td>
											<td className="px-4 py-4">
												<div>
													<span className="inline-block px-2 py-0.5 text-xs rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-300 capitalize font-medium">
														{(order.payment_method || "COD").replace(/_/g, " ")}
													</span>
													<p className="text-xs text-zinc-500 mt-0.5 capitalize">
														{order.payment_status || "pending"}
													</p>
												</div>
											</td>
											<td className="px-4 py-4 font-bold text-zinc-900 dark:text-white">
												{formatBDT(order.total || 0)}
											</td>
											<td className="px-4 py-4">
												<span
													className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
														statusColors[order.status] || "bg-zinc-100 text-zinc-800"
													}`}>
													{order.status || "pending"}
												</span>
											</td>
											<td className="px-4 py-4 text-xs text-zinc-500 whitespace-nowrap">
												{order.created_at ? new Date(order.created_at).toLocaleDateString("en-US", {
													month: "short",
													day: "numeric",
													year: "numeric",
												}) : "N/A"}
											</td>
											<td className="px-4 py-4 text-right">
												<Link
													href={`/admin/orders/${order.id}`}
													className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1">
													View Order
												</Link>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>

						{/* Mobile Card View */}
						<div className="md:hidden divide-y divide-zinc-200 dark:divide-zinc-800">
							{(orders || []).map((order) => (
								<div key={order.id} className="p-4 space-y-3">
									<div className="flex items-center justify-between">
										<Link
											href={`/admin/orders/${order.id}`}
											className="font-bold text-sm text-blue-600 dark:text-blue-400 hover:underline">
											{order.order_number || "Order #" + order.id.slice(0, 8)}
										</Link>
										<span
											className={`px-2 py-0.5 text-[11px] font-semibold rounded-full ${
												statusColors[order.status] || "bg-zinc-100 text-zinc-800"
											}`}>
											{order.status || "pending"}
										</span>
									</div>

									<div className="flex items-start justify-between text-xs">
										<div>
											<p className="font-semibold text-zinc-900 dark:text-white">
												{order.customer_name || "Guest Customer"}
											</p>
											{order.customer_phone && (
												<p className="text-zinc-500 font-mono mt-0.5">
													📱 {order.customer_phone}
												</p>
											)}
										</div>
										<div className="text-right">
											<span className="font-bold text-sm text-zinc-900 dark:text-white">
												{formatBDT(order.total || 0)}
											</span>
											<p className="text-zinc-400 text-[10px] capitalize">
												{(order.payment_method || "COD").replace(/_/g, " ")} • {order.payment_status || "pending"}
											</p>
										</div>
									</div>

									{order.items && order.items.length > 0 && (
										<div className="bg-zinc-50 dark:bg-zinc-800/60 rounded-lg p-2.5 text-xs text-zinc-600 dark:text-zinc-400 space-y-0.5">
											{order.items.slice(0, 2).map((item, idx) => (
												<p key={item.id || idx} className="truncate">
													<span className="font-semibold text-zinc-800 dark:text-zinc-200">{item.quantity || 1}x</span> {item.product_name}
												</p>
											))}
											{order.items.length > 2 && (
												<p className="text-[10px] text-zinc-400 italic">+ {order.items.length - 2} more items</p>
											)}
										</div>
									)}

									<div className="flex items-center justify-between pt-1 text-xs">
										<span className="text-zinc-400">
											{order.created_at ? new Date(order.created_at).toLocaleDateString("en-US", {
												month: "short",
												day: "numeric",
												year: "numeric",
											}) : ""}
										</span>
										<Link
											href={`/admin/orders/${order.id}`}
											className="px-3 py-1 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-100 font-semibold rounded-lg transition-colors">
											View Order →
										</Link>
									</div>
								</div>
							))}
						</div>
					</>
				)}
			</div>

			{/* ========================================================================= */}
			{/* CREATE ORDER MODAL */}
			{/* ========================================================================= */}
			{isCreateModalOpen && (
				<div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
					<div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
						{/* Modal Header */}
						<div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50">
							<div>
								<h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
									<span>📦</span> Create New Order (Admin)
								</h2>
								<p className="text-xs text-zinc-500 mt-0.5">Manually place an order for a customer</p>
							</div>
							<button
								onClick={() => setIsCreateModalOpen(false)}
								className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700">
								✕
							</button>
						</div>

						{/* Modal Content */}
						<form onSubmit={handleCreateOrderSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
							{createError && (
								<div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 text-sm font-semibold">
									⚠️ {createError}
								</div>
							)}

							<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
								{/* Left Column: Customer & Delivery Details */}
								<div className="space-y-4">
									<h3 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-200 dark:border-zinc-800 pb-2">
										👤 Customer & Delivery Info
									</h3>

									<div>
										<label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
											Customer Name <span className="text-red-500">*</span>
										</label>
										<input
											type="text"
											required
											placeholder="e.g. Rahim Ahmed"
											value={custName}
											onChange={(e) => setCustName(e.target.value)}
											className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
										/>
									</div>

									<div className="grid grid-cols-2 gap-3">
										<div>
											<div className="flex items-center justify-between mb-1">
												<label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
													BD Phone Number <span className="text-red-500">*</span>
												</label>
												{custPhone.trim().length >= 11 && (
													<button
														type="button"
														onClick={() => checkModalPhoneFraud()}
														disabled={modalFraudLoading}
														className="text-[10px] text-blue-600 dark:text-blue-400 font-bold hover:underline">
														{modalFraudLoading ? "Checking..." : "🛡️ Check Risk"}
													</button>
												)}
											</div>
											<input
												type="tel"
												required
												placeholder="017XXXXXXXX"
												value={custPhone}
												onBlur={() => {
													if (custPhone.trim().length >= 11) checkModalPhoneFraud();
												}}
												onChange={(e) => {
													setCustPhone(e.target.value);
													if (modalFraudResult) setModalFraudResult(null);
												}}
												className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white font-mono"
											/>
											{modalFraudResult && (
												(() => {
													const cfg = getRiskLevelConfig(modalFraudResult.risk_level);
													return (
														<div className={`mt-1.5 p-2 rounded-lg border ${cfg.border} ${cfg.bg} text-[11px] space-y-1`}>
															<div className="flex items-center justify-between">
																<span className={`font-bold inline-flex items-center gap-1 ${cfg.color}`}>
																	<span>{cfg.icon}</span> {modalFraudResult.risk_level}
																</span>
																<span className="font-extrabold text-zinc-800 dark:text-zinc-200">
																	{modalFraudResult.delivery_rate}% dlvd
																</span>
															</div>
															<p className="text-[10px] text-zinc-600 dark:text-zinc-400 leading-tight">
																{modalFraudResult.risk_message_bn}
															</p>
														</div>
													);
												})()
											)}
										</div>
										<div>
											<label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
												Email Address
											</label>
											<input
												type="email"
												placeholder="customer@example.com"
												value={custEmail}
												onChange={(e) => setCustEmail(e.target.value)}
												className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
											/>
										</div>
									</div>

									<div>
										<label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
											Delivery Address <span className="text-red-500">*</span>
										</label>
										<textarea
											rows={2}
											required
											placeholder="House #, Road #, Sector/Block, Area"
											value={addressLine1}
											onChange={(e) => setAddressLine1(e.target.value)}
											className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
										/>
									</div>

									<div className="grid grid-cols-2 gap-3">
										<div>
											<label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
												City
											</label>
											<input
												type="text"
												value={city}
												onChange={(e) => setCity(e.target.value)}
												className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
											/>
										</div>
										<div>
											<label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
												Shipping Option
											</label>
											<select
												value={shippingMethod}
												onChange={(e) => handleShippingMethodChange(e.target.value)}
												className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
												<option value="Inside Dhaka Delivery">Inside Dhaka (৳60)</option>
												<option value="Outside Dhaka Delivery">Outside Dhaka (৳120)</option>
												<option value="Express Delivery">Express (৳150)</option>
											</select>
										</div>
									</div>

									<div className="grid grid-cols-2 gap-3">
										<div>
											<label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
												Payment Method
											</label>
											<select
												value={paymentMethod}
												onChange={(e) => setPaymentMethod(e.target.value)}
												className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
												<option value="cash_on_delivery">Cash on Delivery (COD)</option>
												<option value="bkash">bKash</option>
												<option value="nagad">Nagad</option>
												<option value="card">Credit/Debit Card</option>
												<option value="bank_transfer">Bank Transfer</option>
											</select>
										</div>
										<div>
											<label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
												Payment Status
											</label>
											<select
												value={paymentStatus}
												onChange={(e) => setPaymentStatus(e.target.value)}
												className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold">
												<option value="pending">Pending</option>
												<option value="paid">Paid</option>
											</select>
										</div>
									</div>

									<div>
										<label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
											Order Notes (Optional)
										</label>
										<input
											type="text"
											placeholder="Special instructions..."
											value={notes}
											onChange={(e) => setNotes(e.target.value)}
											className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
										/>
									</div>
								</div>

								{/* Right Column: Order Items & Pricing */}
								<div className="space-y-4 flex flex-col justify-between">
									<div>
										<h3 className="text-sm font-bold text-zinc-900 dark:text-white border-b border-zinc-200 dark:border-zinc-800 pb-2 mb-3">
											🛒 Select Products
										</h3>

										{/* Product Add Card */}
										<div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-700 rounded-xl space-y-3">
											<div>
												<label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
													Select Product
												</label>
												<select
													value={selectedProdId}
													disabled={loadingProducts}
													onChange={(e) => {
														setSelectedProdId(e.target.value);
														setSelectedVarId("");
													}}
													className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
													<option value="">-- Choose Product --</option>
													{availableProducts.map((p) => (
														<option key={p.id} value={p.id}>
															{p.name} ({formatBDT(p.base_price)})
														</option>
													))}
												</select>
											</div>

											{selectedProdId && (
												<>
													{/* Variation Select if available */}
													{(() => {
														const prod = availableProducts.find((p) => p.id === selectedProdId);
														if (prod?.product_variations && prod.product_variations.length > 0) {
															return (
																<div>
																	<label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
																		Select Variation
																	</label>
																	<select
																		value={selectedVarId}
																		onChange={(e) => setSelectedVarId(e.target.value)}
																		className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
																		<option value="">Default Variation</option>
																		{prod.product_variations.map((v) => (
																			<option key={v.id} value={v.id}>
																				{v.name} ({formatBDT(v.price)})
																			</option>
																		))}
																	</select>
																</div>
															);
														}
														return null;
													})()}

													<div className="grid grid-cols-3 gap-2">
														<div>
															<label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
																Quantity
															</label>
															<input
																type="number"
																min={1}
																value={itemQty}
																onChange={(e) => setItemQty(Math.max(1, parseInt(e.target.value) || 1))}
																className="w-full px-3 py-1.5 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
															/>
														</div>
														<div>
															<label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
																Custom Price
															</label>
															<input
																type="number"
																placeholder="Default"
																value={customPrice}
																onChange={(e) => setCustomPrice(e.target.value === "" ? "" : Number(e.target.value))}
																className="w-full px-3 py-1.5 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
															/>
														</div>
														<div className="flex items-end">
															<button
																type="button"
																onClick={addDraftItem}
																className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-sm">
																+ Add Item
															</button>
														</div>
													</div>
												</>
											)}
										</div>

										{/* Items List Table */}
										<div className="mt-3 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
											<table className="w-full text-xs text-left">
												<thead className="bg-zinc-100 dark:bg-zinc-800 font-semibold text-zinc-600 dark:text-zinc-300">
													<tr>
														<th className="p-2.5">Item</th>
														<th className="p-2.5">Qty</th>
														<th className="p-2.5">Price</th>
														<th className="p-2.5 text-right">Total</th>
														<th className="p-2.5 text-center"></th>
													</tr>
												</thead>
												<tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
													{draftItems.length === 0 ? (
														<tr>
															<td colSpan={5} className="p-4 text-center text-zinc-400 italic">
																No items added yet. Pick a product above.
															</td>
														</tr>
													) : (
														draftItems.map((item, idx) => (
															<tr key={idx} className="bg-white dark:bg-zinc-900">
																<td className="p-2.5 font-medium text-zinc-900 dark:text-white">
																	{item.product_name}
																	{item.variation_name && <span className="text-zinc-500 font-normal"> ({item.variation_name})</span>}
																</td>
																<td className="p-2.5 font-bold">{item.quantity}</td>
																<td className="p-2.5">{formatBDT(item.unit_price)}</td>
																<td className="p-2.5 text-right font-bold">{formatBDT(item.unit_price * item.quantity)}</td>
																<td className="p-2.5 text-center">
																	<button
																		type="button"
																		onClick={() => removeDraftItem(idx)}
																		className="text-red-500 hover:text-red-700 font-bold px-1.5 py-0.5 rounded">
																		✕
																	</button>
																</td>
															</tr>
														))
													)}
												</tbody>
											</table>
										</div>
									</div>

									{/* Total & Summary Card */}
									<div className="bg-zinc-50 dark:bg-zinc-800/40 p-4 border border-zinc-200 dark:border-zinc-700 rounded-xl space-y-2 text-xs">
										<div className="flex justify-between text-zinc-600 dark:text-zinc-400">
											<span>Subtotal:</span>
											<span className="font-semibold text-zinc-900 dark:text-white">{formatBDT(draftSubtotal)}</span>
										</div>
										<div className="flex justify-between items-center text-zinc-600 dark:text-zinc-400">
											<span>Shipping Fee (৳):</span>
											<input
												type="number"
												min={0}
												value={shippingAmount}
												onChange={(e) => setShippingAmount(Number(e.target.value) || 0)}
												className="w-20 px-2 py-1 text-right text-xs border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 font-semibold"
											/>
										</div>
										<div className="flex justify-between items-center text-zinc-600 dark:text-zinc-400">
											<span>Discount (৳):</span>
											<input
												type="number"
												min={0}
												value={discountAmount}
												onChange={(e) => setDiscountAmount(Number(e.target.value) || 0)}
												className="w-20 px-2 py-1 text-right text-xs border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 font-semibold"
											/>
										</div>
										<div className="border-t border-zinc-300 dark:border-zinc-700 pt-2 flex justify-between text-sm font-bold text-zinc-900 dark:text-white">
											<span>Total Receivable:</span>
											<span className="text-blue-600 dark:text-blue-400">{formatBDT(draftTotal)}</span>
										</div>
									</div>
								</div>
							</div>

							{/* Modal Footer Actions */}
							<div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 flex items-center justify-end gap-3">
								<button
									type="button"
									onClick={() => setIsCreateModalOpen(false)}
									className="px-4 py-2 text-sm font-semibold border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
									Cancel
								</button>
								<button
									type="submit"
									disabled={creatingOrder || draftItems.length === 0}
									className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg shadow-md disabled:opacity-50 transition-colors flex items-center gap-2">
									{creatingOrder ? (
										<>
											<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
											Creating Order...
										</>
									) : (
										"Place Order Now"
									)}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}

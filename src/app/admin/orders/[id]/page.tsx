"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FraudCheckResult, getRiskLevelConfig } from "@/lib/fraud-check";
import { formatCurrency as formatMoney, DEFAULT_CURRENCY } from "@/lib/currency";

interface OrderItem {
	id: string;
	product_name: string;
	variation_name: string | null;
	quantity: number;
	unit_price: number;
	total_price: number;
	image_url: string | null;
}

interface Order {
	id: string;
	order_number: string;
	status: string;
	payment_status: string;
	subtotal: number;
	tax_amount: number;
	shipping_amount: number;
	discount_amount: number;
	total_amount: number;
	currency: string;
	shipping_method: string;
	tracking_number: string | null;
	created_at: string;
	updated_at: string;
	customer: {
		id: string;
		first_name: string;
		last_name: string;
		email: string;
		phone: string | null;
	} | null;
	shipping_address: {
		name?: string;
		first_name: string;
		last_name: string;
		address_line1: string;
		address_line2: string | null;
		city: string;
		state: string;
		postal_code: string;
		country: string;
		phone: string | null;
		email?: string;
	} | null;
	billing_address: {
		first_name: string;
		last_name: string;
		address_line1: string;
		address_line2: string | null;
		city: string;
		state: string;
		postal_code: string;
		country: string;
	} | null;
	items: OrderItem[];
	notes: string | null;
	internal_notes: string | null;
	payment_method: string;
	source: string | null;
	courier_provider: string | null;
	courier_consignment_id: string | null;
	courier_tracking_code: string | null;
	courier_status: string | null;
	courier_delivery_fee: number | null;
	courier_sent_at: string | null;
}

const statusColors: Record<string, string> = {
	pending: "bg-yellow-100 text-yellow-800",
	confirmed: "bg-blue-100 text-blue-800",
	processing: "bg-purple-100 text-purple-800",
	shipped: "bg-indigo-100 text-indigo-800",
	delivered: "bg-green-100 text-green-800",
	cancelled: "bg-red-100 text-red-800",
	refunded: "bg-gray-100 text-gray-800",
};

const paymentStatusColors: Record<string, string> = {
	pending: "bg-yellow-100 text-yellow-800",
	paid: "bg-green-100 text-green-800",
	failed: "bg-red-100 text-red-800",
	refunded: "bg-gray-100 text-gray-800",
	partially_refunded: "bg-orange-100 text-orange-800",
};

export default function OrderDetailPage() {
	const params = useParams();
	const orderId = params.id as string;

	const [order, setOrder] = useState<Order | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isUpdating, setIsUpdating] = useState(false);
	const [showStatusModal, setShowStatusModal] = useState(false);
	const [newStatus, setNewStatus] = useState("");
	const [trackingNumber, setTrackingNumber] = useState("");
	const [internalNote, setInternalNote] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [downloadingInvoice, setDownloadingInvoice] = useState(false);
	const [downloadingSlip, setDownloadingSlip] = useState(false);
	const [storeCurrency, setStoreCurrency] = useState(DEFAULT_CURRENCY);

	const [showCourierModal, setShowCourierModal] = useState(false);
	const [courierProvider, setCourierProvider] = useState<'pathao' | 'steadfast'>('pathao');
	const [courierStoreId, setCourierStoreId] = useState<number | null>(null);
	const [courierStores, setCourierStores] = useState<Array<{store_id: number, store_name: string}>>([]);
	const [courierWeight, setCourierWeight] = useState('0.5');
	const [courierDeliveryType, setCourierDeliveryType] = useState('48');
	const [courierInstruction, setCourierInstruction] = useState('');
	const [isSendingCourier, setIsSendingCourier] = useState(false);
	const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);
	const [courierError, setCourierError] = useState<string | null>(null);
	const [courierSuccess, setCourierSuccess] = useState<string | null>(null);

	// Phone Fraud Check state
	const [fraudResult, setFraudResult] = useState<FraudCheckResult | null>(null);
	const [fraudLoading, setFraudLoading] = useState(false);
	const [fraudError, setFraudError] = useState<string | null>(null);

	useEffect(() => {
		fetchOrder();
		fetchStoreCurrency();
	}, [orderId]);

	const fetchStoreCurrency = async () => {
		try {
			const res = await fetch('/api/v1/store/currency', {
				credentials: 'include',
			});
			if (res.ok) {
				const data = await res.json();
				setStoreCurrency(data.currency_code || DEFAULT_CURRENCY);
			}
		} catch (err) {
			console.error('Failed to fetch store currency:', err);
		}
	};

	const fetchOrder = async () => {
		setIsLoading(true);
		setError(null);
		try {
			const response = await fetch(`/api/v1/admin/orders/${orderId}`, {
				credentials: "include",
			});

			const result = await response.json();
			console.log("Order API response:", { status: response.status, result });

			if (!response.ok) {
				if (response.status === 404) {
					setError("Order not found");
					setOrder(null);
					return;
				} else if (response.status === 401 || response.status === 403) {
					setError(
						"You don't have permission to view this order. Please make sure you're logged in as an admin.",
					);
					setOrder(null);
					return;
				}
				throw new Error(
					result.error?.message ||
						`Failed to fetch order: ${response.statusText}`,
				);
			}

			if (!result.success || result.error) {
				throw new Error(result.error?.message || "Failed to fetch order");
			}

			// Extract order data from the API response wrapper
			const data = result.data;

			// Transform API response to match component state
			const orderData: Order = {
				id: data.id,
				order_number: data.order_number,
				status: data.status,
				payment_status: data.payment_status,
				total_amount: data.total_amount,
				subtotal: data.subtotal ?? data.items?.reduce((s: number, i: OrderItem) => s + i.total_price, 0) ?? 0,
				tax_amount: data.tax_amount ?? 0,
				shipping_amount: data.shipping_amount ?? 0,
				discount_amount: data.discount_amount ?? 0,
				currency: data.currency || DEFAULT_CURRENCY,
				shipping_method: data.shipping_method,
				tracking_number: data.tracking_number,
				created_at: data.created_at,
				updated_at: data.updated_at,
				customer: data.customer,
				shipping_address: data.shipping_address,
				billing_address: data.billing_address,
				items: data.items,
				notes: data.notes,
				internal_notes: null,
				payment_method: data.payment_method,
				source: data.source,
				courier_provider: data.courier_provider || null,
				courier_consignment_id: data.courier_consignment_id || null,
				courier_tracking_code: data.courier_tracking_code || null,
				courier_status: data.courier_status || null,
				courier_delivery_fee: data.courier_delivery_fee || null,
				courier_sent_at: data.courier_sent_at || null,
			};

			setOrder(orderData);
			setNewStatus(orderData.status);
			setTrackingNumber(orderData.tracking_number || "");

			// Auto-run Fraud Check for customer phone
			const customerPhone = orderData.customer?.phone || orderData.shipping_address?.phone;
			if (customerPhone) {
				runFraudCheck(customerPhone);
			}
		} catch (error) {
			console.error("Error fetching order:", error);
			setError(error instanceof Error ? error.message : "Failed to load order");
			setOrder(null);
		} finally {
			setIsLoading(false);
		}
	};

	const runFraudCheck = async (phoneNumber?: string) => {
		const targetPhone = phoneNumber || order?.customer?.phone || order?.shipping_address?.phone;
		if (!targetPhone) return;

		setFraudLoading(true);
		setFraudError(null);
		try {
			const res = await fetch(`/api/v1/fraud-check?phone=${encodeURIComponent(targetPhone)}`);
			const data = await res.json();
			if (data.success) {
				setFraudResult(data);
			} else {
				setFraudError(data.error || "Could not complete fraud check");
			}
		} catch (err) {
			console.error("Fraud check failed:", err);
			setFraudError(err instanceof Error ? err.message : "Failed to connect to fraud check service");
		} finally {
			setFraudLoading(false);
		}
	};

	const updateOrderStatus = async () => {
		if (!order) return;
		setIsUpdating(true);

		try {
			// API call to update order status
			const response = await fetch(`/api/v1/admin/orders/${orderId}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({
					status: newStatus,
					tracking_number: trackingNumber || null,
				}),
			});

			if (!response.ok) {
				throw new Error("Failed to update order status");
			}

			// Parse response but we use the local state values
			await response.json();

			setOrder({
				...order,
				status: newStatus,
				tracking_number: trackingNumber,
			});
			setShowStatusModal(false);
		} catch (error) {
			console.error("Error updating order:", error);
			alert("Failed to update order status. Please try again.");
		} finally {
			setIsUpdating(false);
		}
	};

	const refreshCourierStatus = async () => {
		if (!order || !order.courier_consignment_id) return;
		setIsRefreshingStatus(true);
		try {
			const res = await fetch(`/api/v1/admin/courier/status/${orderId}`);
			if (res.ok) {
				const data = await res.json();
				if (data.success) {
					// re-fetch order to get updated status
					await fetchOrder();
				}
			}
		} catch (err) {
			console.error("Error refreshing courier status:", err);
		} finally {
			setIsRefreshingStatus(false);
		}
	};

	const openCourierModal = async (providerOverride?: 'pathao' | 'steadfast') => {
		const targetProvider = providerOverride || courierProvider;
		setShowCourierModal(true);
		setCourierError(null);

		// Prefill instruction & weight from order details
		if (order) {
			const itemSummary = (order.items || [])
				.map((i) => `${i.quantity}x ${i.product_name}${i.variation_name ? ` (${i.variation_name})` : ""}`)
				.join(", ");
			const prefilledNote = order.notes || (itemSummary ? `Items: ${itemSummary}` : 'Handle with care. Call before delivery.');
			setCourierInstruction(prefilledNote);
		}

		if (targetProvider === 'pathao') {
			try {
				const res = await fetch('/api/v1/admin/courier/pathao/stores', { credentials: 'include' });
				if (res.ok) {
					const json = await res.json();
					if (json.success && json.data) {
						const storeList = Array.isArray(json.data.data) ? json.data.data : Array.isArray(json.data) ? json.data : [];
						const formattedStores = storeList.map((s: any) => ({
							store_id: s.store_id,
							store_name: s.store_name,
						}));
						setCourierStores(formattedStores);
						
						const targetStore = formattedStores.find((s: any) => s.store_id === 388178) || formattedStores[0];
						if (targetStore) {
							setCourierStoreId(targetStore.store_id);
						} else {
							setCourierStoreId(388178);
						}
					}
				}
			} catch (err) {
				console.error("Failed to fetch stores for courier modal:", err);
				setCourierStoreId(388178);
			}
		}
	};

	const sendToCourier = async () => {
		setIsSendingCourier(true);
		setCourierError(null);
		try {
			const selectedStore = courierStoreId || 388178;
			const payload = {
				orderId: order?.id,
				provider: courierProvider,
				storeId: selectedStore,
				store_id: selectedStore,
				itemWeight: parseFloat(courierWeight) || 0.5,
				deliveryType: parseInt(courierDeliveryType) || 48,
				specialInstruction: courierInstruction,
			};
			
			const res = await fetch('/api/v1/admin/courier/send', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			
			const data = await res.json();
			if (!res.ok || !data.success) {
				throw new Error(data.error?.message || 'Failed to send to courier');
			}
			
			const consignmentId = data.data?.consignment_id || data.data?.consignmentId || data.data?.tracking_code || '';
			const providerName = courierProvider === 'pathao' ? 'Pathao Courier' : 'Steadfast Courier';
			setCourierSuccess(
				`Successfully created delivery order via ${providerName}! ${consignmentId ? `Consignment ID / Tracking Code: ${consignmentId}` : ''}`
			);
			setShowCourierModal(false);
			await fetchOrder();
		} catch (err) {
			setCourierError(err instanceof Error ? err.message : 'An error occurred');
		} finally {
			setIsSendingCourier(false);
		}
	};

	const addInternalNote = async () => {
		if (!internalNote.trim()) return;

		try {
			// API call to add note
			await fetch(`/api/v1/admin/orders/${orderId}/notes`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({ note: internalNote }),
			});

			if (order) {
				setOrder({
					...order,
					internal_notes: order.internal_notes
						? `${order.internal_notes}\n\n${new Date().toLocaleString()}: ${internalNote}`
						: `${new Date().toLocaleString()}: ${internalNote}`,
				});
			}
			setInternalNote("");
		} catch (error) {
			console.error("Error adding note:", error);
		}
	};

	const handleDownloadInvoice = async () => {
		setDownloadingInvoice(true);
		try {
			const res = await fetch(`/api/v1/admin/orders/${orderId}/invoice`, {
				credentials: 'include',
			});
			if (!res.ok) throw new Error('Failed to generate invoice');
			const blob = await res.blob();
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `invoice-${order?.order_number}.pdf`;
			document.body.appendChild(a);
			a.click();
			a.remove();
			window.URL.revokeObjectURL(url);
		} catch (err) {
			console.error('Failed to download invoice:', err);
			alert('Failed to generate invoice');
		} finally {
			setDownloadingInvoice(false);
		}
	};

	const handleDownloadPackingSlip = async () => {
		setDownloadingSlip(true);
		try {
			const res = await fetch(`/api/v1/admin/orders/${orderId}/packing-slip`, {
				credentials: 'include',
			});
			if (!res.ok) throw new Error('Failed to generate packing slip');
			const blob = await res.blob();
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `packing-slip-${order?.order_number}.pdf`;
			document.body.appendChild(a);
			a.click();
			a.remove();
			window.URL.revokeObjectURL(url);
		} catch (err) {
			console.error('Failed to download packing slip:', err);
			alert('Failed to generate packing slip');
		} finally {
			setDownloadingSlip(false);
		}
	};

	const formatCurrency = (amount: number) => formatMoney(amount, storeCurrency);

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString("en-US", {
			year: "numeric",
			month: "long",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-64">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
			</div>
		);
	}

	if (error || !order) {
		return (
			<div className="text-center py-12">
				<div className="mb-4">
					<svg
						className="mx-auto h-12 w-12 text-gray-400"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor">
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
				</div>
				<h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
					{error || "Order not found"}
				</h2>
				<p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
					{error === "Order not found"
						? "The order you're looking for doesn't exist or may have been deleted."
						: "There was a problem loading the order details."}
				</p>
				<Link
					href="/admin/orders"
					className="text-blue-600 hover:underline mt-2 inline-block">
					← Back to Orders
				</Link>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Success Alert Banner */}
			{courierSuccess && (
				<div className="p-4 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 rounded-xl flex items-center justify-between shadow-sm animate-fade-in">
					<div className="flex items-center gap-3">
						<span className="text-2xl">🎉</span>
						<div>
							<h4 className="font-bold text-sm">Delivery Created Successfully!</h4>
							<p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">{courierSuccess}</p>
						</div>
					</div>
					<button
						onClick={() => setCourierSuccess(null)}
						className="text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-emerald-100 text-sm font-bold px-2 py-1">
						✕
					</button>
				</div>
			)}

			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<div className="flex items-center gap-2">
						<Link
							href="/admin/orders"
							className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
							<svg
								className="w-5 h-5"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor">
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M15 19l-7-7 7-7"
								/>
							</svg>
						</Link>
						<h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
							{order.order_number}
						</h1>
					</div>
					<p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
						Placed on {formatDate(order.created_at)}
					</p>
				</div>
				<div className="flex items-center gap-3">
					{!order.courier_consignment_id && (
						<button
							onClick={() => openCourierModal()}
							className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 flex items-center gap-1.5 shadow-sm transition-colors">
							🚚 Create Delivery
						</button>
					)}
					<button 
						onClick={() => window.open(`/admin/orders/${orderId}/invoice/print`, '_blank')}
						className="px-4 py-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors">
						🖨️ Print Invoice
					</button>
					<button 
						onClick={handleDownloadInvoice}
						disabled={downloadingInvoice}
						className="px-4 py-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors">
						{downloadingInvoice ? '⏳ Generating...' : '📄 PDF Invoice'}
					</button>
					<button
						onClick={() => setShowStatusModal(true)}
						className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
						Update Status
					</button>
				</div>
			</div>

			{/* Status Cards */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				<div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-700 p-4">
					<p className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">
						Order Status
					</p>
					<span
						className={`inline-flex px-3 py-1 rounded-full text-sm font-medium capitalize ${statusColors[order.status] || "bg-gray-100 text-gray-800"}`}>
						{order.status}
					</span>
				</div>
				<div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-700 p-4">
					<p className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">
						Payment Status
					</p>
					<span
						className={`inline-flex px-3 py-1 rounded-full text-sm font-medium capitalize ${paymentStatusColors[order.payment_status] || "bg-gray-100 text-gray-800"}`}>
						{order.payment_status}
					</span>
				</div>
				<div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-700 p-4">
					<p className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">
						Order Total
					</p>
					<p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
						{formatCurrency(order.total_amount)}
					</p>
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{/* Main Content */}
				<div className="lg:col-span-2 space-y-6">
					{/* Order Items */}
					<div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-700">
						<div className="px-6 py-4 border-b border-gray-200">
							<h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
								Order Items ({order.items.length})
							</h2>
						</div>
						<div className="divide-y divide-gray-200">
							{order.items.map((item) => (
								<div
									key={item.id}
									className="px-6 py-4 flex items-center gap-4">
									<div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
										{item.image_url ? (
											<img
												src={item.image_url}
												alt={item.product_name}
												className="w-full h-full object-cover rounded-lg"
											/>
										) : (
											<svg
												className="w-8 h-8 text-gray-400"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor">
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={1.5}
													d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
												/>
											</svg>
										)}
									</div>
									<div className="flex-1 min-w-0">
										<p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
											{item.product_name}
										</p>
										{item.variation_name && (
											<p className="text-sm text-zinc-500 dark:text-zinc-400">
												{item.variation_name}
											</p>
										)}
										<p className="text-sm text-zinc-500 dark:text-zinc-400">
											Qty: {item.quantity}
										</p>
									</div>
									<div className="text-right">
										<p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
											{formatCurrency(item.total_price)}
										</p>
										<p className="text-xs text-zinc-500 dark:text-zinc-400">
											{formatCurrency(item.unit_price)} each
										</p>
									</div>
								</div>
							))}
						</div>
						<div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
							<div className="space-y-2">
								<div className="flex justify-between text-sm">
									<span className="text-zinc-500 dark:text-zinc-400">
										Subtotal
									</span>
									<span className="text-zinc-900 dark:text-zinc-100">
										{formatCurrency(order.subtotal)}
									</span>
								</div>
								<div className="flex justify-between text-sm">
									<span className="text-zinc-500 dark:text-zinc-400">
										Shipping ({order.shipping_method})
									</span>
									<span className="text-zinc-900 dark:text-zinc-100">
										{formatCurrency(order.shipping_amount)}
									</span>
								</div>
								<div className="flex justify-between text-sm">
									<span className="text-zinc-500 dark:text-zinc-400">Tax</span>
									<span className="text-zinc-900 dark:text-zinc-100">
										{formatCurrency(order.tax_amount)}
									</span>
								</div>
								{order.discount_amount > 0 && (
									<div className="flex justify-between text-sm">
										<span className="text-zinc-500 dark:text-zinc-400">
											Discount
										</span>
										<span className="text-green-600">
											-{formatCurrency(order.discount_amount)}
										</span>
									</div>
								)}
								<div className="flex justify-between text-base font-medium pt-2 border-t border-gray-200">
									<span className="text-zinc-900 dark:text-zinc-100">
										Total
									</span>
									<span className="text-zinc-900 dark:text-zinc-100">
										{formatCurrency(order.total_amount)}
									</span>
								</div>
							</div>
						</div>
					</div>

					{/* Shipping Info */}
					{order.tracking_number && (
						<div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-700 p-6">
							<h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-4">
								Shipping Information
							</h2>
							<div className="flex items-center justify-between">
								<div>
									<p className="text-sm text-zinc-500 dark:text-zinc-400">
										Tracking Number
									</p>
									<p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
										{order.tracking_number}
									</p>
								</div>
								<button className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100">
									Track Package
								</button>
							</div>
						</div>
					)}

					{/* Notes */}
					<div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-700 p-6">
						<h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-4">
							Notes
						</h2>

						{order.notes && (
							<div className="mb-4">
								<p className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">
									Customer Notes
								</p>
								<p className="text-sm text-zinc-900 dark:text-zinc-100 bg-gray-50 p-3 rounded-lg">
									{order.notes}
								</p>
							</div>
						)}

						<div>
							<p className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">
								Internal Notes
							</p>
							{order.internal_notes && (
								<pre className="text-sm text-zinc-900 dark:text-zinc-100 bg-yellow-50 p-3 rounded-lg whitespace-pre-wrap mb-3">
									{order.internal_notes}
								</pre>
							)}
							<div className="flex gap-2">
								<input
									type="text"
									value={internalNote}
									onChange={(e) => setInternalNote(e.target.value)}
									placeholder="Add an internal note..."
									className="flex-1 px-3 py-2 border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
								/>
								<button
									onClick={addInternalNote}
									disabled={!internalNote.trim()}
									className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
									Add Note
								</button>
							</div>
						</div>
					</div>
				</div>

				{/* Sidebar */}
				<div className="space-y-6">
					{/* Courier Tracking */}
					{order.courier_consignment_id && (
						<div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-700 p-6">
							<div className="flex items-center justify-between mb-4">
								<h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
									Courier Tracking
									{order.courier_provider === 'pathao' && <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded">Pathao</span>}
									{order.courier_provider === 'steadfast' && <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded">Steadfast</span>}
								</h2>
							</div>
							<div className="space-y-3 text-sm">
								<div className="flex justify-between">
									<span className="text-zinc-500 dark:text-zinc-400">Consignment ID:</span>
									<span className="font-medium text-zinc-900 dark:text-zinc-100">{order.courier_consignment_id}</span>
								</div>
								{order.courier_tracking_code && (
									<div className="flex justify-between">
										<span className="text-zinc-500 dark:text-zinc-400">Tracking Code:</span>
										<span className="font-medium text-zinc-900 dark:text-zinc-100">{order.courier_tracking_code}</span>
									</div>
								)}
								<div className="flex justify-between items-center">
									<span className="text-zinc-500 dark:text-zinc-400">Status:</span>
									<span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${
										['pending', 'in_review'].includes(order.courier_status || '') ? 'bg-yellow-100 text-yellow-800' :
										['delivered'].includes(order.courier_status || '') ? 'bg-green-100 text-green-800' :
										['cancelled', 'returned'].includes(order.courier_status || '') ? 'bg-red-100 text-red-800' :
										'bg-blue-100 text-blue-800'
									}`}>
										{order.courier_status || 'Unknown'}
									</span>
								</div>
								{order.courier_delivery_fee !== null && (
									<div className="flex justify-between">
										<span className="text-zinc-500 dark:text-zinc-400">Delivery Fee:</span>
										<span className="font-medium text-zinc-900 dark:text-zinc-100">{formatCurrency(order.courier_delivery_fee)}</span>
									</div>
								)}
								{order.courier_sent_at && (
									<div className="flex justify-between">
										<span className="text-zinc-500 dark:text-zinc-400">Sent At:</span>
										<span className="font-medium text-zinc-900 dark:text-zinc-100">{formatDate(order.courier_sent_at)}</span>
									</div>
								)}
								<button 
									onClick={refreshCourierStatus}
									disabled={isRefreshingStatus}
									className="w-full mt-2 px-4 py-2 text-sm font-medium text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-600 disabled:opacity-50">
									{isRefreshingStatus ? 'Refreshing...' : 'Refresh Status'}
								</button>
							</div>
						</div>
					)}

					{/* Customer */}
					<div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-700 p-6">
						<h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-4">
							Customer
						</h2>
						{(() => {
							const cName = order.customer
								? `${order.customer.first_name || ""} ${order.customer.last_name || ""}`.trim()
								: order.shipping_address?.name ||
									`${order.shipping_address?.first_name || ""} ${order.shipping_address?.last_name || ""}`.trim() ||
									"Guest Customer";
							const cEmail = order.customer?.email || order.shipping_address?.email || "No Email";
							const cPhone = order.customer?.phone || order.shipping_address?.phone || null;
							const initial = cName[0] || "C";

							return (
								<>
									<div className="flex items-center gap-3 mb-3">
										<div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full flex items-center justify-center font-bold text-base">
											{initial}
										</div>
										<div>
											<p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
												{cName}
											</p>
											<p className="text-xs text-zinc-500 dark:text-zinc-400">
												{cEmail}
											</p>
										</div>
									</div>
									{cPhone && (
										<p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1 mb-3">
											<span>📱</span> {cPhone}
										</p>
									)}
									{order.customer?.id ? (
										<Link
											href={`/admin/customers/${order.customer.id}`}
											className="text-xs font-medium text-blue-600 hover:underline">
											View Customer Profile →
										</Link>
									) : (
										<span className="text-xs text-zinc-400 font-medium">Guest Checkout</span>
									)}
								</>
							);
						})()}
					</div>

					{/* Customer Delivery Risk & Fraud Check */}
					<div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-700 p-6">
						<div className="flex items-center justify-between mb-4">
							<h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
								<span>🛡️</span> Fraud & Risk Check
							</h2>
							<button
								onClick={() => runFraudCheck()}
								disabled={fraudLoading}
								className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold flex items-center gap-1 disabled:opacity-50">
								{fraudLoading ? "Checking..." : "↻ Re-check"}
							</button>
						</div>

						{fraudLoading ? (
							<div className="py-6 text-center text-xs text-zinc-500 dark:text-zinc-400 flex flex-col items-center gap-2">
								<div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
								<span>Checking 12oClock Courier Database...</span>
							</div>
						) : fraudResult ? (
							(() => {
								const config = getRiskLevelConfig(fraudResult.risk_level);
								const isCodHighRisk =
									order.payment_method === "cash_on_delivery" &&
									["High Risk", "Medium Risk"].includes(fraudResult.risk_level);

								return (
									<div className="space-y-4">
										{/* Risk Badge & Rate */}
										<div className={`p-3.5 rounded-xl border ${config.border} ${config.bg}`}>
											<div className="flex items-center justify-between mb-1.5">
												<span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${config.badge}`}>
													<span>{config.icon}</span> {fraudResult.risk_level}
												</span>
												<span className={`text-base font-extrabold ${config.color}`}>
													{fraudResult.delivery_rate}% Success
												</span>
											</div>

											{/* Progress Bar */}
											<div className="w-full bg-zinc-200 dark:bg-zinc-700 h-2 rounded-full overflow-hidden my-2">
												<div
													className={`h-full rounded-full transition-all duration-500 ${
														fraudResult.delivery_rate >= 75
															? "bg-emerald-500"
															: fraudResult.delivery_rate >= 50
															? "bg-blue-500"
															: fraudResult.delivery_rate >= 25
															? "bg-amber-500"
															: "bg-red-500"
													}`}
													style={{ width: `${Math.min(fraudResult.delivery_rate, 100)}%` }}
												/>
											</div>

											{/* Stats Row */}
											<div className="grid grid-cols-3 gap-2 text-center text-xs mt-2.5 pt-2 border-t border-zinc-200/60 dark:border-zinc-700/60">
												<div>
													<p className="text-[10px] text-zinc-400">Total Orders</p>
													<p className="font-bold text-zinc-800 dark:text-zinc-200">{fraudResult.total_orders}</p>
												</div>
												<div>
													<p className="text-[10px] text-emerald-600 dark:text-emerald-400">Delivered</p>
													<p className="font-bold text-emerald-700 dark:text-emerald-300">{fraudResult.total_delivered}</p>
												</div>
												<div>
													<p className="text-[10px] text-red-600 dark:text-red-400">Cancelled</p>
													<p className="font-bold text-red-700 dark:text-red-300">{fraudResult.total_cancelled}</p>
												</div>
											</div>
										</div>

										{/* High Risk Callout for COD orders */}
										{isCodHighRisk && (
											<div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs space-y-1">
												<p className="font-bold text-red-800 dark:text-red-200 flex items-center gap-1">
													<span>⚠️</span> High Cancellation Risk on COD
												</p>
												<p className="text-red-700 dark:text-red-300">
													Customer has low delivery rate ({fraudResult.delivery_rate}%). Collect advance delivery charge (e.g. ৳120 via bKash) before parcel dispatch.
												</p>
											</div>
										)}

										{/* Courier Breakdown */}
										{fraudResult.couriers && fraudResult.couriers.length > 0 && (
											<div className="space-y-1.5">
												<p className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
													Courier Breakdown
												</p>
												<div className="space-y-1">
													{fraudResult.couriers.map((c) => (
														<div
															key={c.name}
															className="flex items-center justify-between text-xs py-1 px-2 bg-zinc-50 dark:bg-zinc-900 rounded-md">
															<span className="text-zinc-700 dark:text-zinc-300 font-medium">{c.name}</span>
															<div className="flex items-center gap-2">
																<span className="text-zinc-400 text-[10px]">{c.delivered}/{c.orders} dlvd</span>
																<span
																	className={`font-bold text-[11px] ${
																		c.rate >= 75
																			? "text-emerald-600 dark:text-emerald-400"
																			: c.rate >= 50
																			? "text-blue-600 dark:text-blue-400"
																			: c.orders > 0
																			? "text-red-600 dark:text-red-400"
																			: "text-zinc-400"
																	}`}>
																	{c.orders > 0 ? `${c.rate}%` : "-"}
																</span>
															</div>
														</div>
													))}
												</div>
											</div>
										)}

										{/* Message */}
										<div className="text-[11px] text-zinc-500 dark:text-zinc-400 italic bg-zinc-50 dark:bg-zinc-900/50 p-2.5 rounded-lg border border-zinc-100 dark:border-zinc-800">
											&ldquo;{fraudResult.risk_message_bn}&rdquo;
										</div>
									</div>
								);
							})()
						) : fraudError ? (
							<div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300 space-y-2">
								<p>⚠️ {fraudError}</p>
								<button
									onClick={() => runFraudCheck()}
									className="text-xs font-semibold text-blue-600 dark:text-blue-400 underline">
									Try again
								</button>
							</div>
						) : (
							<div className="text-center py-4">
								<button
									onClick={() => runFraudCheck()}
									className="px-3 py-1.5 text-xs font-semibold bg-zinc-100 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors">
									Check Phone Fraud History
								</button>
							</div>
						)}
					</div>

					{/* Shipping Address */}
					<div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-700 p-6">
						<h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-4">
							Shipping Address
						</h2>
						{order.shipping_address ? (
							<address className="not-italic text-sm text-gray-600 space-y-1">
								<p className="font-medium text-zinc-900 dark:text-zinc-100">
									{order.shipping_address.first_name}{" "}
									{order.shipping_address.last_name}
								</p>
								<p>{order.shipping_address.address_line1}</p>
								{order.shipping_address.address_line2 && (
									<p>{order.shipping_address.address_line2}</p>
								)}
								<p>
									{order.shipping_address.city}, {order.shipping_address.state}{" "}
									{order.shipping_address.postal_code}
								</p>
								<p>{order.shipping_address.country}</p>
								{order.shipping_address.phone && (
									<p className="pt-2">{order.shipping_address.phone}</p>
								)}
							</address>
						) : (
							<p className="text-sm text-zinc-500 dark:text-zinc-400">
								No shipping address provided
							</p>
						)}
					</div>

					{/* Billing Address */}
					<div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-700 p-6">
						<h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-4">
							Billing Address
						</h2>
						{order.billing_address ? (
							<address className="not-italic text-sm text-gray-600 space-y-1">
								<p className="font-medium text-zinc-900 dark:text-zinc-100">
									{order.billing_address.first_name}{" "}
									{order.billing_address.last_name}
								</p>
								<p>{order.billing_address.address_line1}</p>
								{order.billing_address.address_line2 && (
									<p>{order.billing_address.address_line2}</p>
								)}
								<p>
									{order.billing_address.city}, {order.billing_address.state}{" "}
									{order.billing_address.postal_code}
								</p>
								<p>{order.billing_address.country}</p>
							</address>
						) : (
							<p className="text-sm text-zinc-500 dark:text-zinc-400">
								No billing address provided
							</p>
						)}
					</div>

					{/* Actions */}
					<div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-gray-200 dark:border-zinc-700 p-6">
						<h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-4">
							Actions
						</h2>
						<div className="space-y-3">
							<button className="w-full px-4 py-2 text-sm font-medium text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-700 text-left disabled:opacity-50">
								📧 Send Order Confirmation
							</button>
							<button
							onClick={handleDownloadInvoice}
							disabled={downloadingInvoice}
							className="w-full px-4 py-2 text-sm font-medium text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-700 text-left disabled:opacity-50">
								{downloadingInvoice ? '⏳ Generating...' : '📄 Generate Invoice'}
							</button>
							<button
							onClick={handleDownloadPackingSlip}
							disabled={downloadingSlip}
							className="w-full px-4 py-2 text-sm font-medium text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-700 text-left disabled:opacity-50">
								{downloadingSlip ? '⏳ Generating...' : '📦 Generate Packing Slip'}
							</button>
							{!order.courier_consignment_id ? (
								<button 
									onClick={() => openCourierModal()}
									className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-emerald-600 border border-transparent rounded-lg hover:bg-emerald-700 text-left flex items-center justify-between shadow-sm transition-colors">
									<span>🚚 Create Delivery</span>
									<span className="text-xs bg-emerald-700 px-2 py-0.5 rounded font-normal">Pathao / Steadfast</span>
								</button>
							) : (
								<div className="w-full px-4 py-2.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center justify-between">
									<span>🚚 Sent to {order.courier_provider?.toUpperCase()}</span>
									<span className="font-mono">{order.courier_consignment_id}</span>
								</div>
							)}
							<button className="w-full px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-300 rounded-lg hover:bg-red-50 text-left">
								❌ Cancel Order
							</button>
						</div>
					</div>
				</div>
			</div>

			{/* Update Status Modal */}
			{showStatusModal && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
					<div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl max-w-md w-full mx-4">
						<div className="px-6 py-4 border-b border-gray-200">
							<h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
								Update Order Status
							</h3>
						</div>
						<div className="px-6 py-4 space-y-4">
							<div>
								<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
									Status
								</label>
								<select
									value={newStatus}
									onChange={(e) => setNewStatus(e.target.value)}
									className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
									<option value="pending">Pending</option>
									<option value="confirmed">Confirmed</option>
									<option value="processing">Processing</option>
									<option value="shipped">Shipped</option>
									<option value="delivered">Delivered</option>
									<option value="cancelled">Cancelled</option>
									<option value="refunded">Refunded</option>
								</select>
							</div>

							{(newStatus === "shipped" || newStatus === "delivered") && (
								<div>
									<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">
										Tracking Number
									</label>
									<input
										type="text"
										value={trackingNumber}
										onChange={(e) => setTrackingNumber(e.target.value)}
										placeholder="Enter tracking number"
										className="w-full px-3 py-2 border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
									/>
								</div>
							)}
						</div>
						<div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
							<button
								onClick={() => setShowStatusModal(false)}
								className="px-4 py-2 text-sm font-medium text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-700">
								Cancel
							</button>
							<button
								onClick={updateOrderStatus}
								disabled={isUpdating}
								className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
								{isUpdating ? "Updating..." : "Update Status"}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Send to Courier Modal */}
			{showCourierModal && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
					<div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl max-w-md w-full mx-4">
						<div className="px-6 py-4 border-b border-gray-200 dark:border-zinc-700">
							<h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
								Send to Courier
							</h3>
						</div>
						<div className="px-6 py-4 space-y-4">
							{courierError && (
								<div className="p-3 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 text-sm rounded-lg">
									{courierError}
								</div>
							)}
							
							{/* Prefilled Order Summary Card */}
							{order && (
								<div className="p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl space-y-1 text-xs">
									<div className="flex justify-between font-bold text-zinc-900 dark:text-white">
										<span>Recipient: {order.shipping_address?.name || `${order.shipping_address?.first_name || ""} ${order.shipping_address?.last_name || ""}`.trim() || order.customer?.first_name || "Customer"}</span>
										<span className="text-blue-600 font-bold">COD: {formatCurrency(order.payment_status === 'pending' || order.payment_method === 'cash_on_delivery' ? (order.total_amount || order.subtotal) : 0)}</span>
									</div>
									<p className="text-zinc-600 dark:text-zinc-400">📱 {order.shipping_address?.phone || order.customer?.phone || "No phone"}</p>
									<p className="text-zinc-500 dark:text-zinc-500 truncate">📍 {order.shipping_address?.address_line1}, {order.shipping_address?.city}</p>
								</div>
							)}

							<div>
								<label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">
									Courier Provider
								</label>
								<div className="flex gap-4">
									<label className="flex items-center gap-2 cursor-pointer">
										<input type="radio" value="pathao" checked={courierProvider === 'pathao'} onChange={() => { setCourierProvider('pathao'); openCourierModal('pathao'); }} className="text-blue-600 focus:ring-blue-500" />
										<span className="text-zinc-900 dark:text-zinc-100 font-semibold">Pathao Courier</span>
									</label>
									<label className="flex items-center gap-2 cursor-pointer">
										<input type="radio" value="steadfast" checked={courierProvider === 'steadfast'} onChange={() => { setCourierProvider('steadfast'); openCourierModal('steadfast'); }} className="text-blue-600 focus:ring-blue-500" />
										<span className="text-zinc-900 dark:text-zinc-100 font-semibold">Steadfast Courier</span>
									</label>
								</div>
							</div>

							{courierProvider === 'pathao' && (
								<>
									<div>
										<label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Select Pathao Store</label>
										<select value={courierStoreId || 388178} onChange={(e) => setCourierStoreId(Number(e.target.value))} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg">
											{courierStores.length > 0 ? (
												courierStores.map(store => (
													<option key={store.store_id} value={store.store_id}>{store.store_name} ({store.store_id})</option>
												))
											) : (
												<option value={388178}>SMS Tech BD (388178)</option>
											)}
										</select>
									</div>
									<div className="flex gap-4">
										<div className="flex-1">
											<label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Item Weight (kg)</label>
											<input type="number" step="0.1" min="0.5" value={courierWeight} onChange={(e) => setCourierWeight(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg" />
										</div>
										<div className="flex-1">
											<label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Delivery Type</label>
											<select value={courierDeliveryType} onChange={(e) => setCourierDeliveryType(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg">
												<option value="48">Normal 48 Hours</option>
												<option value="12">On Demand 12 Hours</option>
											</select>
										</div>
									</div>
								</>
							)}

							<div>
								<label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Special Instruction & Description</label>
								<textarea value={courierInstruction} onChange={(e) => setCourierInstruction(e.target.value)} rows={2} className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg"></textarea>
							</div>
						</div>
						<div className="px-6 py-4 border-t border-gray-200 dark:border-zinc-700 flex justify-end gap-3">
							<button onClick={() => setShowCourierModal(false)} className="px-4 py-2 text-sm font-medium text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-700 border border-gray-300 dark:border-zinc-600 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-700">Cancel</button>
							<button onClick={sendToCourier} disabled={isSendingCourier} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
								{isSendingCourier ? "Sending..." : "Confirm"}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

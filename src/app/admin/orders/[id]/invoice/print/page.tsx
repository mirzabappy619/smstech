"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface OrderDetail {
	id: string;
	order_number: string;
	created_at: string;
	status: string;
	payment_status: string;
	payment_method: string;
	shipping_method: string;
	subtotal: number;
	shipping_amount: number;
	discount_amount: number;
	total_amount: number;
	notes?: string;
	customer: {
		first_name: string;
		last_name: string;
		email: string;
		phone: string | null;
	} | null;
	shipping_address: {
		name?: string;
		first_name?: string;
		last_name?: string;
		address_line1: string;
		address_line2?: string | null;
		city: string;
		state?: string;
		postal_code?: string;
		phone?: string;
		email?: string;
	} | null;
	items: Array<{
		id: string;
		product_name: string;
		variation_name: string | null;
		quantity: number;
		unit_price: number;
		total_price: number;
	}>;
}

export default function PrintInvoicePage() {
	const params = useParams();
	const orderId = params.id as string;
	const [order, setOrder] = useState<OrderDetail | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const fetchOrder = async () => {
			try {
				const res = await fetch(`/api/v1/admin/orders/${orderId}`, { credentials: "include" });
				if (!res.ok) throw new Error("Failed to load order details");
				const json = await res.json();
				if (json.success && json.data) {
					setOrder(json.data);
				} else {
					throw new Error(json.error?.message || "Order not found");
				}
			} catch (err: any) {
				setError(err.message || "Failed to load order");
			} finally {
				setLoading(false);
			}
		};
		if (orderId) fetchOrder();
	}, [orderId]);

	useEffect(() => {
		if (!order || loading) return;
		const timer = setTimeout(() => {
			window.print();
		}, 600);
		return () => clearTimeout(timer);
	}, [order, loading]);

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-white text-zinc-600 font-sans">
				<div className="text-center space-y-3">
					<div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" />
					<p className="text-sm font-medium">Preparing printable invoice...</p>
				</div>
			</div>
		);
	}

	if (error || !order) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-white text-red-600 p-6 font-sans">
				<div className="text-center space-y-2">
					<p className="text-lg font-bold">⚠️ Error Loading Invoice</p>
					<p className="text-sm text-zinc-600">{error || "Order not found"}</p>
				</div>
			</div>
		);
	}

	const addr = order.shipping_address;
	const cust = order.customer;
	const customerName =
		cust ? `${cust.first_name || ""} ${cust.last_name || ""}`.trim() :
		addr?.name || `${addr?.first_name || ""} ${addr?.last_name || ""}`.trim() ||
		"Customer";

	const customerPhone = cust?.phone || addr?.phone || "";
	const customerEmail = cust?.email || addr?.email || "";

	return (
		<div className="bg-white text-zinc-900 min-h-screen p-8 max-w-4xl mx-auto font-sans print:p-0">
			{/* Print Action Bar (Hidden when printing) */}
			<div className="mb-6 pb-4 border-b border-zinc-200 flex items-center justify-between print:hidden">
				<div>
					<h1 className="text-lg font-bold text-zinc-900">Invoice #{order.order_number}</h1>
					<p className="text-xs text-zinc-500">Print or save as PDF via your browser printer</p>
				</div>
				<div className="flex gap-3">
					<button
						onClick={() => window.print()}
						className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-lg shadow-sm flex items-center gap-2">
						🖨️ Print Invoice
					</button>
					<button
						onClick={() => window.close()}
						className="px-4 py-2 border border-zinc-300 hover:bg-zinc-100 text-zinc-700 text-sm font-semibold rounded-lg">
						Close Window
					</button>
				</div>
			</div>

			{/* Printable Invoice Header */}
			<div className="flex justify-between items-start border-b border-zinc-300 pb-6 mb-6">
				<div>
					<h2 className="text-2xl font-black tracking-tight text-zinc-900">SMSTECH BD</h2>
					<p className="text-xs text-zinc-600 mt-1">Premier Electronics & Tech Store</p>
					<p className="text-xs text-zinc-500">Dhaka, Bangladesh</p>
					<p className="text-xs text-zinc-500">Support: info@smstech.bd</p>
				</div>
				<div className="text-right">
					<h3 className="text-3xl font-black text-zinc-900 uppercase tracking-widest">INVOICE</h3>
					<p className="text-sm font-bold text-blue-600 mt-1">#{order.order_number}</p>
					<p className="text-xs text-zinc-500 mt-1">
						Date: {new Date(order.created_at).toLocaleDateString("en-US", {
							year: "numeric",
							month: "short",
							day: "numeric",
						})}
					</p>
					<span className="inline-block mt-2 px-2.5 py-0.5 text-xs font-bold rounded-full bg-zinc-100 border border-zinc-300 uppercase">
						{(order.payment_method || "COD").replace(/_/g, " ")} • {order.payment_status || "Pending"}
					</span>
				</div>
			</div>

			{/* Customer & Shipping Info */}
			<div className="grid grid-cols-2 gap-6 mb-8 text-sm">
				<div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200">
					<p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">BILLED TO (CUSTOMER)</p>
					<p className="font-bold text-base text-zinc-900">{customerName}</p>
					{customerPhone && <p className="text-xs text-zinc-700 mt-1 font-semibold">📱 Phone: {customerPhone}</p>}
					{customerEmail && <p className="text-xs text-zinc-600 mt-0.5">✉️ Email: {customerEmail}</p>}
				</div>

				<div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200">
					<p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">SHIPPING ADDRESS</p>
					{addr ? (
						<div className="text-xs text-zinc-700 space-y-0.5">
							<p className="font-semibold">{addr.address_line1}</p>
							{addr.address_line2 && <p>{addr.address_line2}</p>}
							<p>{addr.city}{addr.postal_code ? `, ${addr.postal_code}` : ""}</p>
							<p className="font-semibold text-zinc-900 mt-1">Method: {order.shipping_method || "Standard Delivery"}</p>
						</div>
					) : (
						<p className="text-xs text-zinc-500 italic">No shipping address recorded</p>
					)}
				</div>
			</div>

			{/* Items Table */}
			<div className="border border-zinc-300 rounded-xl overflow-hidden mb-6">
				<table className="w-full text-left text-xs border-collapse">
					<thead className="bg-zinc-100 font-bold text-zinc-700 border-b border-zinc-300">
						<tr>
							<th className="p-3">#</th>
							<th className="p-3">ITEM DESCRIPTION</th>
							<th className="p-3 text-center">QTY</th>
							<th className="p-3 text-right">UNIT PRICE</th>
							<th className="p-3 text-right">TOTAL</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-zinc-200">
						{(order.items || []).map((item, idx) => (
							<tr key={idx} className="hover:bg-zinc-50">
								<td className="p-3 font-semibold text-zinc-400">{idx + 1}</td>
								<td className="p-3">
									<p className="font-bold text-zinc-900">{item.product_name}</p>
									{item.variation_name && (
										<p className="text-zinc-500 text-[11px] font-medium">Variation: {item.variation_name}</p>
									)}
								</td>
								<td className="p-3 text-center font-bold text-zinc-800">{item.quantity}</td>
								<td className="p-3 text-right font-medium">BDT {Number(item.unit_price || 0).toLocaleString()}</td>
								<td className="p-3 text-right font-bold text-zinc-900">BDT {Number(item.total_price || 0).toLocaleString()}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			{/* Totals Summary */}
			<div className="flex justify-end mb-8">
				<div className="w-64 space-y-2 text-xs">
					<div className="flex justify-between text-zinc-600">
						<span>Subtotal:</span>
						<span className="font-semibold text-zinc-900">BDT {Number(order.subtotal || 0).toLocaleString()}</span>
					</div>
					<div className="flex justify-between text-zinc-600">
						<span>Shipping Fee:</span>
						<span className="font-semibold text-zinc-900">BDT {Number(order.shipping_amount || 0).toLocaleString()}</span>
					</div>
					{order.discount_amount > 0 && (
						<div className="flex justify-between text-green-700 font-semibold">
							<span>Discount:</span>
							<span>- BDT {Number(order.discount_amount).toLocaleString()}</span>
						</div>
					)}
					<div className="border-t-2 border-zinc-900 pt-2 flex justify-between text-sm font-extrabold text-zinc-900">
						<span>TOTAL (BDT):</span>
						<span className="text-blue-700">BDT {Number(order.total_amount || 0).toLocaleString()}</span>
					</div>
				</div>
			</div>

			{/* Footer Notes */}
			<div className="border-t border-zinc-200 pt-6 text-center text-xs text-zinc-500 space-y-1">
				<p className="font-semibold text-zinc-700">Thank you for shopping with SMSTech BD!</p>
				<p>This is a computer generated invoice and requires no physical signature.</p>
			</div>
		</div>
	);
}

"use client";

import { useState, useEffect } from "react";
import { formatBDT } from "@/lib/currency";
import { notify } from "@/components/ui/toast";

interface Coupon {
	id: string;
	code: string;
	description: string | null;
	discount_type: "percentage" | "fixed";
	discount_value: number;
	min_purchase_amount: number | null;
	max_discount_amount: number | null;
	usage_limit: number | null;
	usage_count: number;
	valid_from: string;
	valid_until: string | null;
	is_active: boolean;
	created_at: string;
}

export default function CouponsPage() {
	const [coupons, setCoupons] = useState<Coupon[]>([]);
	const [loading, setLoading] = useState(true);
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
	const [formData, setFormData] = useState({
		code: "",
		description: "",
		discount_type: "percentage" as "percentage" | "fixed",
		discount_value: 0,
		min_purchase_amount: "",
		max_discount_amount: "",
		usage_limit: "",
		valid_from: new Date().toISOString().split("T")[0],
		valid_until: "",
		is_active: true,
	});

	useEffect(() => {
		fetchCoupons();
	}, []);

	const fetchCoupons = async () => {
		setLoading(true);
		try {
			const response = await fetch("/api/v1/admin/coupons");
			const data = await response.json();

			if (data && data.success && Array.isArray(data.data)) {
				setCoupons(data.data || []);
			} else {
				setCoupons([]);
			}
		} catch (err) {
			console.error("Failed to fetch coupons:", err);
			setCoupons([]);
		} finally {
			setLoading(false);
		}
	};

	const handleCreateCoupon = async (e: React.FormEvent) => {
		e.preventDefault();

		try {
			const payload = {
				...formData,
				min_purchase_amount: formData.min_purchase_amount
					? parseFloat(formData.min_purchase_amount)
					: null,
				max_discount_amount: formData.max_discount_amount
					? parseFloat(formData.max_discount_amount)
					: null,
				usage_limit: formData.usage_limit
					? parseInt(formData.usage_limit)
					: null,
				valid_until: formData.valid_until || null,
			};

			const response = await fetch("/api/v1/admin/coupons", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});

			if (response.ok) {
				notify.success("Coupon created successfully");
				setShowCreateModal(false);
				resetForm();
				fetchCoupons();
			} else {
				const data = await response.json();
				notify.error(data.error || "Failed to create coupon");
			}
		} catch (err) {
			notify.error("Failed to create coupon");
		}
	};

	const handleUpdateCoupon = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!editingCoupon) return;

		try {
			const payload = {
				...formData,
				min_purchase_amount: formData.min_purchase_amount
					? parseFloat(formData.min_purchase_amount)
					: null,
				max_discount_amount: formData.max_discount_amount
					? parseFloat(formData.max_discount_amount)
					: null,
				usage_limit: formData.usage_limit
					? parseInt(formData.usage_limit)
					: null,
				valid_until: formData.valid_until || null,
			};

			const response = await fetch(
				`/api/v1/admin/coupons/${editingCoupon.id}`,
				{
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(payload),
				},
			);

			if (response.ok) {
				notify.success("Coupon updated successfully");
				setEditingCoupon(null);
				resetForm();
				fetchCoupons();
			} else {
				const data = await response.json();
				notify.error(data.error || "Failed to update coupon");
			}
		} catch (err) {
			notify.error("Failed to update coupon");
		}
	};

	const handleDeleteCoupon = async (couponId: string) => {
		if (!confirm("Are you sure you want to delete this coupon?")) return;

		try {
			const response = await fetch(`/api/v1/admin/coupons/${couponId}`, {
				method: "DELETE",
			});

			if (response.ok) {
				notify.success("Coupon deleted successfully");
				fetchCoupons();
			}
		} catch (err) {
			notify.error("Failed to delete coupon");
		}
	};

	const openEditModal = (coupon: Coupon) => {
		setEditingCoupon(coupon);
		setFormData({
			code: coupon.code,
			description: coupon.description || "",
			discount_type: coupon.discount_type,
			discount_value: coupon.discount_value,
			min_purchase_amount: coupon.min_purchase_amount?.toString() || "",
			max_discount_amount: coupon.max_discount_amount?.toString() || "",
			usage_limit: coupon.usage_limit?.toString() || "",
			valid_from: coupon.valid_from.split("T")[0],
			valid_until: coupon.valid_until ? coupon.valid_until.split("T")[0] : "",
			is_active: coupon.is_active,
		});
	};

	const resetForm = () => {
		setFormData({
			code: "",
			description: "",
			discount_type: "percentage",
			discount_value: 0,
			min_purchase_amount: "",
			max_discount_amount: "",
			usage_limit: "",
			valid_from: new Date().toISOString().split("T")[0],
			valid_until: "",
			is_active: true,
		});
	};

	const getStatusBadge = (coupon: Coupon) => {
		const now = new Date();
		const validFrom = new Date(coupon.valid_from);
		const validUntil = coupon.valid_until ? new Date(coupon.valid_until) : null;

		if (!coupon.is_active) {
			return (
				<span className="px-2 py-1 text-xs font-medium rounded-full bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-400">
					Inactive
				</span>
			);
		} else if (validUntil && now > validUntil) {
			return (
				<span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
					Expired
				</span>
			);
		} else if (now < validFrom) {
			return (
				<span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
					Scheduled
				</span>
			);
		} else {
			return (
				<span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
					Active
				</span>
			);
		}
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
						Coupons
					</h1>
					<p className="text-zinc-600 dark:text-zinc-400 mt-1">
						Create and manage discount coupons
					</p>
				</div>
				<button
					onClick={() => {
						resetForm();
						setShowCreateModal(true);
					}}
					className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
					<svg
						className="w-5 h-5"
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
					Create Coupon
				</button>
			</div>

			{/* Statistics */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
				<div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-sm text-zinc-500">Total Coupons</p>
							<p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">
								{coupons.length}
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
									d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
								/>
							</svg>
						</div>
					</div>
				</div>

				<div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-sm text-zinc-500">Active Coupons</p>
							<p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
								{coupons.filter((c) => c.is_active).length}
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

				<div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-sm text-zinc-500">Total Usage</p>
							<p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
								{coupons.reduce((sum, c) => sum + c.usage_count, 0)}
							</p>
						</div>
						<div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
							<svg
								className="w-6 h-6 text-purple-600 dark:text-purple-400"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24">
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
								/>
							</svg>
						</div>
					</div>
				</div>
			</div>

			{/* Coupons List */}
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
				) : coupons.length === 0 ? (
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
								d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
							/>
						</svg>
						<p className="mt-4 text-zinc-600 dark:text-zinc-400">
							No coupons created yet
						</p>
						<button
							onClick={() => {
								resetForm();
								setShowCreateModal(true);
							}}
							className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
							Create Your First Coupon
						</button>
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full">
							<thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
								<tr>
									<th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
										Code
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
										Discount
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
										Usage
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
										Valid Until
									</th>
									<th className="px-6 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
										Status
									</th>
									<th className="px-6 py-3 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
										Actions
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
								{(coupons || []).map((coupon) => (
									<tr
										key={coupon.id}
										className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
										<td className="px-6 py-4 whitespace-nowrap">
											<div className="font-mono font-bold text-zinc-900 dark:text-white">
												{coupon.code}
											</div>
											{coupon.description && (
												<div className="text-sm text-zinc-500 line-clamp-1">
													{coupon.description}
												</div>
											)}
										</td>
										<td className="px-6 py-4 whitespace-nowrap">
											<div className="text-sm font-semibold text-zinc-900 dark:text-white">
												{coupon.discount_type === "percentage"
													? `${coupon.discount_value}%`
													: formatBDT(coupon.discount_value)}{" "}
												off
											</div>
											{coupon.min_purchase_amount && (
												<div className="text-xs text-zinc-500">
													Min: {formatBDT(coupon.min_purchase_amount)}
												</div>
											)}
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-900 dark:text-white">
											{coupon.usage_count}
											{coupon.usage_limit ? ` / ${coupon.usage_limit}` : ""}
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-500">
											{coupon.valid_until
												? new Date(coupon.valid_until).toLocaleDateString()
												: "No expiry"}
										</td>
										<td className="px-6 py-4 whitespace-nowrap">
											{getStatusBadge(coupon)}
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
											<button
												onClick={() => openEditModal(coupon)}
												className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
												Edit
											</button>
											<button
												onClick={() => handleDeleteCoupon(coupon.id)}
												className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300">
												Delete
											</button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>

			{/* Create/Edit Modal */}
			{(showCreateModal || editingCoupon) && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
					<div className="bg-white dark:bg-zinc-900 rounded-xl max-w-2xl w-full my-8">
						<div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
							<h2 className="text-xl font-bold text-zinc-900 dark:text-white">
								{editingCoupon ? "Edit Coupon" : "Create New Coupon"}
							</h2>
							<button
								onClick={() => {
									setShowCreateModal(false);
									setEditingCoupon(null);
									resetForm();
								}}
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
						<form
							onSubmit={editingCoupon ? handleUpdateCoupon : handleCreateCoupon}
							className="p-6 space-y-4">
							<div className="grid grid-cols-2 gap-4">
								<div className="col-span-2">
									<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
										Coupon Code *
									</label>
									<input
										type="text"
										required
										value={formData.code}
										onChange={(e) =>
											setFormData({
												...formData,
												code: e.target.value.toUpperCase(),
											})
										}
										className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white font-mono"
										placeholder="SAVE20"
									/>
								</div>

								<div className="col-span-2">
									<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
										Description
									</label>
									<textarea
										value={formData.description}
										onChange={(e) =>
											setFormData({ ...formData, description: e.target.value })
										}
										className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
										rows={2}
										placeholder="Optional description"
									/>
								</div>

								<div>
									<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
										Discount Type *
									</label>
									<select
										required
										value={formData.discount_type}
										onChange={(e) =>
											setFormData({
												...formData,
												discount_type: e.target.value as "percentage" | "fixed",
											})
										}
										className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white">
										<option value="percentage">Percentage (%)</option>
									<option value="fixed">Fixed Amount (BDT)</option>
									</select>
								</div>

								<div>
									<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
										Discount Value *
									</label>
									<input
										type="number"
										required
										min="0"
										step="0.01"
										value={formData.discount_value}
										onChange={(e) =>
											setFormData({
												...formData,
												discount_value: parseFloat(e.target.value) || 0,
											})
										}
										className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
									/>
								</div>

								<div>
									<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
										Min Purchase Amount
									</label>
									<input
										type="number"
										min="0"
										step="0.01"
										value={formData.min_purchase_amount}
										onChange={(e) =>
											setFormData({
												...formData,
												min_purchase_amount: e.target.value,
											})
										}
										className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
										placeholder="Optional"
									/>
								</div>

								<div>
									<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
										Max Discount Amount
									</label>
									<input
										type="number"
										min="0"
										step="0.01"
										value={formData.max_discount_amount}
										onChange={(e) =>
											setFormData({
												...formData,
												max_discount_amount: e.target.value,
											})
										}
										className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
										placeholder="Optional"
									/>
								</div>

								<div>
									<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
										Usage Limit
									</label>
									<input
										type="number"
										min="0"
										value={formData.usage_limit}
										onChange={(e) =>
											setFormData({ ...formData, usage_limit: e.target.value })
										}
										className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
										placeholder="Unlimited"
									/>
								</div>

								<div>
									<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
										Valid From *
									</label>
									<input
										type="date"
										required
										value={formData.valid_from}
										onChange={(e) =>
											setFormData({ ...formData, valid_from: e.target.value })
										}
										className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
									/>
								</div>

								<div>
									<label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
										Valid Until
									</label>
									<input
										type="date"
										value={formData.valid_until}
										onChange={(e) =>
											setFormData({ ...formData, valid_until: e.target.value })
										}
										className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white"
										placeholder="No expiry"
									/>
								</div>

								<div className="col-span-2 flex items-center gap-2">
									<input
										type="checkbox"
										id="is_active"
										checked={formData.is_active}
										onChange={(e) =>
											setFormData({ ...formData, is_active: e.target.checked })
										}
										className="w-4 h-4 text-blue-600 rounded"
									/>
									<label
										htmlFor="is_active"
										className="text-sm text-zinc-700 dark:text-zinc-300">
										Active (coupon can be used immediately)
									</label>
								</div>
							</div>

							<div className="flex gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
								<button
									type="button"
									onClick={() => {
										setShowCreateModal(false);
										setEditingCoupon(null);
										resetForm();
									}}
									className="flex-1 px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800">
									Cancel
								</button>
								<button
									type="submit"
									className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
									{editingCoupon ? "Update Coupon" : "Create Coupon"}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}

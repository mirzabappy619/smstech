"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Customer {
	id: string;
	first_name: string;
	last_name: string;
	email: string;
	phone: string | null;
	role: string;
	created_at: string;
	total_orders: number;
	total_spent: number;
	last_order_date: string | null;
	is_disabled: boolean;
	disabled_reason?: string;
	fraud_status: "clean" | "suspicious" | "spam" | "fraud" | "blacklisted";
	fraud_reason?: string;
	admin_notes?: string;
}

interface PaginationInfo {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
}

export default function CustomersPage() {
	const [customers, setCustomers] = useState<Customer[]>([]);
	const [loading, setLoading] = useState(true);
	const [searchQuery, setSearchQuery] = useState("");
	const [roleFilter, setRoleFilter] = useState<string>("all");
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [fraudFilter, setFraudFilter] = useState<string>("all");

	const [pagination, setPagination] = useState<PaginationInfo>({
		page: 1,
		limit: 20,
		total: 0,
		totalPages: 0,
	});

	// Modals State
	const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
	const [showSetPasswordModal, setShowSetPasswordModal] = useState(false);
	const [showResetLinkModal, setShowResetLinkModal] = useState(false);
	const [showDisableModal, setShowDisableModal] = useState(false);
	const [showFraudModal, setShowFraudModal] = useState(false);

	// Action Form Inputs
	const [newPassword, setNewPassword] = useState("");
	const [actionLoading, setActionLoading] = useState(false);
	const [generatedResetLink, setGeneratedResetLink] = useState("");
	const [disableReasonInput, setDisableReasonInput] = useState("");
	const [selectedFraudStatus, setSelectedFraudStatus] = useState<Customer["fraud_status"]>("clean");
	const [fraudReasonInput, setFraudReasonInput] = useState("");
	const [copiedLink, setCopiedLink] = useState(false);

	useEffect(() => {
		fetchCustomers();
	}, [pagination.page, roleFilter, statusFilter, fraudFilter]);

	const fetchCustomers = async () => {
		setLoading(true);
		try {
			const params = new URLSearchParams({
				page: pagination.page.toString(),
				limit: pagination.limit.toString(),
			});

			if (searchQuery) params.append("search", searchQuery);
			if (roleFilter !== "all") params.append("role", roleFilter);
			if (statusFilter !== "all") params.append("status", statusFilter);
			if (fraudFilter !== "all") params.append("fraud_status", fraudFilter);

			const response = await fetch(`/api/v1/admin/customers?${params}`);
			const data = await response.json();

			if (data && data.success && Array.isArray(data.data)) {
				setCustomers(data.data || []);
				setPagination((prev) => ({
					...prev,
					total: data.meta?.total ?? data.data?.length ?? 0,
					totalPages: data.meta?.totalPages ?? 1,
				}));
			} else {
				setCustomers([]);
			}
		} catch (err) {
			console.error("Failed to fetch customers:", err);
			setCustomers([]);
		} finally {
			setLoading(false);
		}
	};

	const handleSearch = (e: React.FormEvent) => {
		e.preventDefault();
		setPagination((prev) => ({ ...prev, page: 1 }));
		fetchCustomers();
	};

	// ── ACTION HANDLERS ───────────────────────────────────────────────────

	const handleSetPassword = async () => {
		if (!selectedCustomer || !newPassword || newPassword.length < 6) {
			alert("Password must be at least 6 characters long.");
			return;
		}
		setActionLoading(true);
		try {
			const res = await fetch(`/api/v1/admin/customers/${selectedCustomer.id}/set-password`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ password: newPassword }),
			});
			const json = await res.json();
			if (res.ok && json.success) {
				alert(`Password for ${selectedCustomer.email} updated successfully!`);
				setShowSetPasswordModal(false);
				setNewPassword("");
			} else {
				alert(json.error?.message || "Failed to set password.");
			}
		} catch (err: any) {
			alert(err.message || "Failed to set password.");
		} finally {
			setActionLoading(false);
		}
	};

	const handleGenerateResetLink = async (customer: Customer) => {
		setSelectedCustomer(customer);
		setActionLoading(true);
		setGeneratedResetLink("");
		setCopiedLink(false);
		try {
			const res = await fetch(`/api/v1/admin/customers/${customer.id}/reset-password`, {
				method: "POST",
			});
			const json = await res.json();
			if (res.ok && json.success) {
				setGeneratedResetLink(json.data?.reset_link || "");
				setShowResetLinkModal(true);
			} else {
				alert(json.error?.message || "Failed to generate password reset link.");
			}
		} catch (err: any) {
			alert(err.message || "Failed to generate reset link.");
		} finally {
			setActionLoading(false);
		}
	};

	const handleToggleDisable = async () => {
		if (!selectedCustomer) return;
		const nextDisabledState = !selectedCustomer.is_disabled;
		setActionLoading(true);
		try {
			const res = await fetch(`/api/v1/admin/customers/${selectedCustomer.id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					is_disabled: nextDisabledState,
					disabled_reason: nextDisabledState ? disableReasonInput : "",
				}),
			});
			const json = await res.json();
			if (res.ok && json.success) {
				setShowDisableModal(false);
				setDisableReasonInput("");
				fetchCustomers();
				alert(`Customer login ${nextDisabledState ? "DISABLED" : "ENABLED"} successfully.`);
			} else {
				alert(json.error?.message || "Failed to update account status.");
			}
		} catch (err: any) {
			alert(err.message || "Failed to update status.");
		} finally {
			setActionLoading(false);
		}
	};

	const handleUpdateFraudStatus = async () => {
		if (!selectedCustomer) return;
		setActionLoading(true);
		try {
			const res = await fetch(`/api/v1/admin/customers/${selectedCustomer.id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					fraud_status: selectedFraudStatus,
					fraud_reason: fraudReasonInput,
				}),
			});
			const json = await res.json();
			if (res.ok && json.success) {
				setShowFraudModal(false);
				setFraudReasonInput("");
				fetchCustomers();
				alert(`Customer risk status updated to '${selectedFraudStatus.toUpperCase()}'.`);
			} else {
				alert(json.error?.message || "Failed to update risk status.");
			}
		} catch (err: any) {
			alert(err.message || "Failed to update risk status.");
		} finally {
			setActionLoading(false);
		}
	};

	// ── BADGE HELPERS ─────────────────────────────────────────────────────

	const getRoleBadge = (role: string) => {
		const colors: Record<string, string> = {
			customer: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
			admin: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
			owner: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
		};
		return colors[role] || colors.customer;
	};

	const getFraudBadge = (status: Customer["fraud_status"]) => {
		switch (status) {
			case "fraud":
				return <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 flex items-center gap-1 w-max">🚨 FRAUD</span>;
			case "blacklisted":
				return <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-zinc-900 text-white dark:bg-zinc-700 flex items-center gap-1 w-max">⛔ BLACKLISTED</span>;
			case "spam":
				return <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 flex items-center gap-1 w-max">⚠️ SPAMMER</span>;
			case "suspicious":
				return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 flex items-center gap-1 w-max">🟡 SUSPICIOUS</span>;
			default:
				return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 flex items-center gap-1 w-max">✓ Normal</span>;
		}
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
						Customer Management
					</h1>
					<p className="text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">
						Manage user accounts, password security, access controls, and fraud prevention
					</p>
				</div>
				<div className="text-sm text-zinc-500 font-medium">
					Total Registered: <span className="text-zinc-900 dark:text-white font-bold">{pagination.total}</span>
				</div>
			</div>

			{/* Filters Bar */}
			<div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm">
				<div className="flex flex-col lg:flex-row gap-3">
					<form onSubmit={handleSearch} className="flex-1 relative">
						<input
							type="text"
							placeholder="Search by name, email, or mobile phone..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="w-full pl-10 pr-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
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
					</form>

					<select
						value={roleFilter}
						onChange={(e) => { setRoleFilter(e.target.value); setPagination((prev) => ({ ...prev, page: 1 })); }}
						className="px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500">
						<option value="all">All Roles</option>
						<option value="customer">Customer</option>
						<option value="admin">Admin</option>
						<option value="owner">Owner</option>
					</select>

					<select
						value={statusFilter}
						onChange={(e) => { setStatusFilter(e.target.value); setPagination((prev) => ({ ...prev, page: 1 })); }}
						className="px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500">
						<option value="all">All Login Status</option>
						<option value="active">🟢 Active Users</option>
						<option value="disabled">🚫 Disabled Users</option>
					</select>

					<select
						value={fraudFilter}
						onChange={(e) => { setFraudFilter(e.target.value); setPagination((prev) => ({ ...prev, page: 1 })); }}
						className="px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500">
						<option value="all">All Risk Levels</option>
						<option value="clean">✓ Normal / Clean</option>
						<option value="suspicious">🟡 Suspicious</option>
						<option value="spam">⚠️ Spammer</option>
						<option value="fraud">🚨 Fraudulent</option>
						<option value="blacklisted">⛔ Blacklisted</option>
					</select>

					<button
						onClick={fetchCustomers}
						className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors">
						Search
					</button>
				</div>
			</div>

			{/* Customers Table */}
			<div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
				{loading ? (
					<div className="p-8 space-y-3">
						{[...Array(5)].map((_, i) => (
							<div key={i} className="h-16 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
						))}
					</div>
				) : customers.length === 0 ? (
					<div className="p-12 text-center">
						<p className="text-zinc-600 dark:text-zinc-400 font-medium">No customers found matching your criteria.</p>
					</div>
				) : (
					<>
						{/* Desktop Table View */}
						<div className="hidden md:block overflow-x-auto">
							<table className="w-full text-left text-xs">
								<thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 uppercase font-semibold">
									<tr>
										<th className="px-6 py-3.5">Customer</th>
										<th className="px-6 py-3.5">Contact</th>
										<th className="px-6 py-3.5">Login Status</th>
										<th className="px-6 py-3.5">Risk Level</th>
										<th className="px-6 py-3.5">Orders / Spent</th>
										<th className="px-6 py-3.5 text-right">Quick Management Actions</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
									{customers.map((customer) => (
										<tr key={customer.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
											<td className="px-6 py-4 whitespace-nowrap">
												<div className="flex items-center gap-3">
													<div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-xs">
														{customer.first_name?.[0] || "C"}
														{customer.last_name?.[0] || ""}
													</div>
													<div>
														<Link href={`/admin/customers/${customer.id}`} className="font-bold text-zinc-900 dark:text-white hover:text-blue-600 text-sm block">
															{customer.first_name} {customer.last_name}
														</Link>
														<span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-full ${getRoleBadge(customer.role)} uppercase tracking-wider`}>
															{customer.role}
														</span>
													</div>
												</div>
											</td>

											<td className="px-6 py-4 whitespace-nowrap">
												<p className="font-semibold text-zinc-900 dark:text-white">{customer.email}</p>
												{customer.phone && <p className="text-zinc-500 text-xs">📱 {customer.phone}</p>}
											</td>

											<td className="px-6 py-4 whitespace-nowrap">
												{customer.is_disabled ? (
													<div>
														<span className="px-2.5 py-1 text-xs font-bold rounded-full bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 inline-block">
															🚫 Login Disabled
														</span>
														{customer.disabled_reason && (
															<p className="text-[11px] text-red-600 dark:text-red-400 mt-1 max-w-xs truncate" title={customer.disabled_reason}>
																Reason: {customer.disabled_reason}
															</p>
														)}
													</div>
												) : (
													<span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 inline-block">
														🟢 Active
													</span>
												)}
											</td>

											<td className="px-6 py-4 whitespace-nowrap">
												{getFraudBadge(customer.fraud_status)}
												{customer.fraud_reason && (
													<p className="text-[11px] text-zinc-500 mt-1 max-w-xs truncate" title={customer.fraud_reason}>
														{customer.fraud_reason}
													</p>
												)}
											</td>

											<td className="px-6 py-4 whitespace-nowrap">
												<p className="font-bold text-zinc-900 dark:text-white">{customer.total_orders || 0} Orders</p>
												<p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">৳{Math.round(customer.total_spent || 0).toLocaleString()}</p>
											</td>

											<td className="px-6 py-4 whitespace-nowrap text-right">
												<div className="flex items-center justify-end gap-1.5">
													{/* Set Password */}
													<button
														onClick={() => { setSelectedCustomer(customer); setNewPassword(""); setShowSetPasswordModal(true); }}
														title="Set New Password"
														className="px-2.5 py-1.5 text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-lg transition-colors flex items-center gap-1 border border-zinc-300 dark:border-zinc-700">
														🔑 Password
													</button>

													{/* Reset Link */}
													<button
														onClick={() => handleGenerateResetLink(customer)}
														title="Send Reset Password Link"
														className="px-2.5 py-1.5 text-xs font-semibold bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-lg transition-colors border border-blue-200 dark:border-blue-800">
														📩 Link
													</button>

													{/* Disable / Enable Login */}
													<button
														onClick={() => { setSelectedCustomer(customer); setDisableReasonInput(customer.disabled_reason || ""); setShowDisableModal(true); }}
														title={customer.is_disabled ? "Enable Login Access" : "Disable Login Access"}
														className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors border ${
															customer.is_disabled
																? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100"
																: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700 hover:bg-red-100"
														}`}>
														{customer.is_disabled ? "🟢 Enable" : "🚫 Disable"}
													</button>

													{/* Fraud / Spam Flag */}
													<button
														onClick={() => {
															setSelectedCustomer(customer);
															setSelectedFraudStatus(customer.fraud_status || "clean");
															setFraudReasonInput(customer.fraud_reason || "");
															setShowFraudModal(true);
														}}
														title="Flag Fraud / Spam Risk Status"
														className="px-2.5 py-1.5 text-xs font-semibold bg-orange-50 dark:bg-orange-950/40 hover:bg-orange-100 dark:hover:bg-orange-900/50 text-orange-700 dark:text-orange-300 rounded-lg transition-colors border border-orange-200 dark:border-orange-800">
														🚨 Risk
													</button>
												</div>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>

						{/* Mobile Card View */}
						<div className="md:hidden divide-y divide-zinc-200 dark:divide-zinc-800">
							{customers.map((customer) => (
								<div key={customer.id} className="p-4 space-y-3">
									<div className="flex items-start justify-between gap-3">
										<div className="flex items-center gap-3">
											<div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-xs shrink-0">
												{customer.first_name?.[0] || "C"}
												{customer.last_name?.[0] || ""}
											</div>
											<div>
												<Link href={`/admin/customers/${customer.id}`} className="font-bold text-zinc-900 dark:text-white text-sm hover:text-blue-600 block">
													{customer.first_name} {customer.last_name}
												</Link>
												<span className={`inline-block px-2 py-0.2 text-[10px] font-bold rounded-full ${getRoleBadge(customer.role)} uppercase tracking-wider`}>
													{customer.role}
												</span>
											</div>
										</div>
										<div className="text-right shrink-0">
											<p className="font-bold text-xs text-zinc-900 dark:text-white">{customer.total_orders || 0} Orders</p>
											<p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">৳{Math.round(customer.total_spent || 0).toLocaleString()}</p>
										</div>
									</div>

									<div className="text-xs text-zinc-500 space-y-0.5">
										<p className="text-zinc-700 dark:text-zinc-300 font-medium">{customer.email}</p>
										{customer.phone && <p>📱 {customer.phone}</p>}
									</div>

									<div className="flex items-center gap-2 flex-wrap text-xs">
										{customer.is_disabled ? (
											<span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
												🚫 Disabled
											</span>
										) : (
											<span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
												🟢 Active
											</span>
										)}
										{getFraudBadge(customer.fraud_status)}
									</div>

									<div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-[11px]">
										<button
											onClick={() => { setSelectedCustomer(customer); setNewPassword(""); setShowSetPasswordModal(true); }}
											className="py-1.5 px-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-semibold rounded-lg text-center transition-colors">
											🔑 Pass
										</button>
										<button
											onClick={() => handleGenerateResetLink(customer)}
											className="py-1.5 px-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold rounded-lg text-center transition-colors">
											📩 Link
										</button>
										<button
											onClick={() => { setSelectedCustomer(customer); setDisableReasonInput(customer.disabled_reason || ""); setShowDisableModal(true); }}
											className={`py-1.5 px-1 font-semibold rounded-lg text-center transition-colors ${
												customer.is_disabled
													? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
													: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
											}`}>
											{customer.is_disabled ? "🟢 Enable" : "🚫 Block"}
										</button>
										<button
											onClick={() => {
												setSelectedCustomer(customer);
												setSelectedFraudStatus(customer.fraud_status || "clean");
												setFraudReasonInput(customer.fraud_reason || "");
												setShowFraudModal(true);
											}}
											className="py-1.5 px-1 bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 font-semibold rounded-lg text-center transition-colors">
											🚨 Risk
										</button>
									</div>
								</div>
							))}
						</div>
					</>
				)}

				{/* Pagination */}
				{pagination.totalPages > 1 && (
					<div className="px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
						<div className="text-xs text-zinc-500">
							Page {pagination.page} of {pagination.totalPages}
						</div>
						<div className="flex gap-2">
							<button
								onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
								disabled={pagination.page === 1}
								className="px-3 py-1 border border-zinc-300 dark:border-zinc-700 rounded text-xs disabled:opacity-50 hover:bg-zinc-100 dark:hover:bg-zinc-800">
								Previous
							</button>
							<button
								onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
								disabled={pagination.page === pagination.totalPages}
								className="px-3 py-1 border border-zinc-300 dark:border-zinc-700 rounded text-xs disabled:opacity-50 hover:bg-zinc-100 dark:hover:bg-zinc-800">
								Next
							</button>
						</div>
					</div>
				)}
			</div>

			{/* ── MODALS ───────────────────────────────────────────────────────── */}

			{/* 🔑 Set Password Modal */}
			{showSetPasswordModal && selectedCustomer && (
				<div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
					<div className="bg-white dark:bg-zinc-900 rounded-xl max-w-md w-full p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4">
						<h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
							<span>🔑</span> Set Password for {selectedCustomer.first_name}
						</h3>
						<p className="text-xs text-zinc-500">
							Directly update password for account <strong className="text-zinc-800 dark:text-zinc-200">{selectedCustomer.email}</strong>.
						</p>

						<div>
							<label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">New Password (Min 6 chars)</label>
							<input
								type="password"
								placeholder="Enter new password"
								value={newPassword}
								onChange={(e) => setNewPassword(e.target.value)}
								className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500"
							/>
						</div>

						<div className="flex justify-end gap-3 pt-2">
							<button
								onClick={() => setShowSetPasswordModal(false)}
								className="px-4 py-2 text-xs font-semibold border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
								Cancel
							</button>
							<button
								onClick={handleSetPassword}
								disabled={actionLoading || newPassword.length < 6}
								className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50">
								{actionLoading ? "Updating..." : "Set Password"}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* 📩 Reset Link Modal */}
			{showResetLinkModal && selectedCustomer && (
				<div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
					<div className="bg-white dark:bg-zinc-900 rounded-xl max-w-lg w-full p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4">
						<h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
							<span>📩</span> Password Reset Link Generated
						</h3>
						<p className="text-xs text-zinc-500">
							A secure password recovery URL has been generated for <strong className="text-zinc-800 dark:text-zinc-200">{selectedCustomer.email}</strong>.
						</p>

						<div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
							<label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Generated Reset URL</label>
							<textarea
								readOnly
								rows={3}
								value={generatedResetLink}
								className="w-full text-xs font-mono bg-transparent text-blue-600 dark:text-blue-400 border-0 focus:ring-0 select-all resize-none"></textarea>
						</div>

						<div className="flex justify-between items-center pt-2">
							<button
								onClick={() => {
									navigator.clipboard.writeText(generatedResetLink);
									setCopiedLink(true);
									setTimeout(() => setCopiedLink(false), 2000);
								}}
								className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1.5">
								{copiedLink ? "✓ Copied to Clipboard!" : "📋 Copy Link"}
							</button>
							<button
								onClick={() => setShowResetLinkModal(false)}
								className="px-4 py-2 text-xs font-semibold border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
								Close
							</button>
						</div>
					</div>
				</div>
			)}

			{/* 🚫 Disable / Enable Login Modal */}
			{showDisableModal && selectedCustomer && (
				<div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
					<div className="bg-white dark:bg-zinc-900 rounded-xl max-w-md w-full p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4">
						<h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
							<span>{selectedCustomer.is_disabled ? "🟢 Enable Account Login" : "🚫 Disable Account Login"}</span>
						</h3>
						<p className="text-xs text-zinc-500">
							{selectedCustomer.is_disabled
								? `Restore login access for ${selectedCustomer.email}? The customer will be able to log in again.`
								: `Block login access for ${selectedCustomer.email}? The customer will be prevented from logging into their storefront account.`}
						</p>

						{!selectedCustomer.is_disabled && (
							<div>
								<label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Reason for Disabling Access (Optional)</label>
								<textarea
									rows={2}
									placeholder="e.g. Terms violation, abusive behavior, non-payment"
									value={disableReasonInput}
									onChange={(e) => setDisableReasonInput(e.target.value)}
									className="w-full px-3 py-2 text-xs border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-red-500"
								/>
							</div>
						)}

						<div className="flex justify-end gap-3 pt-2">
							<button
								onClick={() => setShowDisableModal(false)}
								className="px-4 py-2 text-xs font-semibold border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
								Cancel
							</button>
							<button
								onClick={handleToggleDisable}
								disabled={actionLoading}
								className={`px-4 py-2 text-xs font-bold text-white rounded-lg disabled:opacity-50 ${
									selectedCustomer.is_disabled ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"
								}`}>
								{actionLoading ? "Updating..." : selectedCustomer.is_disabled ? "Enable Login Access" : "Disable Login Access"}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* 🚨 Fraud / Spam Flag Modal */}
			{showFraudModal && selectedCustomer && (
				<div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
					<div className="bg-white dark:bg-zinc-900 rounded-xl max-w-md w-full p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4">
						<h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
							<span>🚨</span> Fraud & Risk Prevention Flag
						</h3>
						<p className="text-xs text-zinc-500">
							Update risk classification and security notes for <strong className="text-zinc-800 dark:text-zinc-200">{selectedCustomer.first_name} {selectedCustomer.last_name}</strong>.
						</p>

						<div>
							<label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Risk Level Classification</label>
							<select
								value={selectedFraudStatus}
								onChange={(e) => setSelectedFraudStatus(e.target.value as any)}
								className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-orange-500">
								<option value="clean">✓ Normal / Trusted Customer</option>
								<option value="suspicious">🟡 Suspicious (Requires Review)</option>
								<option value="spam">⚠️ Spammer (Fake inquiries/orders)</option>
								<option value="fraud">🚨 Fraudulent (Fake COD / Non-payment)</option>
								<option value="blacklisted">⛔ Blacklisted (Permanently Banned)</option>
							</select>
						</div>

						<div>
							<label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Fraud / Risk Reason & Internal Notes</label>
							<textarea
								rows={3}
								placeholder="e.g. Placed 3 fake COD orders with unreachable phone numbers"
								value={fraudReasonInput}
								onChange={(e) => setFraudReasonInput(e.target.value)}
								className="w-full px-3 py-2 text-xs border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-orange-500"
							/>
						</div>

						<div className="flex justify-end gap-3 pt-2">
							<button
								onClick={() => setShowFraudModal(false)}
								className="px-4 py-2 text-xs font-semibold border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
								Cancel
							</button>
							<button
								onClick={handleUpdateFraudStatus}
								disabled={actionLoading}
								className="px-4 py-2 text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white rounded-lg disabled:opacity-50">
								{actionLoading ? "Updating..." : "Save Risk Flag"}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

interface CustomerDetail {
	id: string;
	first_name: string;
	last_name: string;
	email: string;
	phone: string | null;
	role: string;
	created_at: string;
	is_disabled: boolean;
	disabled_reason?: string;
	disabled_at?: string;
	fraud_status: "clean" | "suspicious" | "spam" | "fraud" | "blacklisted";
	fraud_reason?: string;
	fraud_flagged_at?: string;
	admin_notes?: string;
	total_orders: number;
	total_spent: number;
	orders: Array<{
		id: string;
		order_number: string;
		total: number;
		status: string;
		created_at: string;
		payment_method: string;
		payment_status: string;
	}>;
}

export default function CustomerDetailPage() {
	const params = useParams();
	const customerId = params.id as string;

	const [customer, setCustomer] = useState<CustomerDetail | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Modals
	const [showSetPasswordModal, setShowSetPasswordModal] = useState(false);
	const [showResetLinkModal, setShowResetLinkModal] = useState(false);
	const [showDisableModal, setShowDisableModal] = useState(false);
	const [showFraudModal, setShowFraudModal] = useState(false);

	// Inputs
	const [newPassword, setNewPassword] = useState("");
	const [generatedResetLink, setGeneratedResetLink] = useState("");
	const [copiedLink, setCopiedLink] = useState(false);
	const [disableReasonInput, setDisableReasonInput] = useState("");
	const [selectedFraudStatus, setSelectedFraudStatus] = useState<CustomerDetail["fraud_status"]>("clean");
	const [fraudReasonInput, setFraudReasonInput] = useState("");
	const [adminNotesInput, setAdminNotesInput] = useState("");
	const [actionLoading, setActionLoading] = useState(false);

	useEffect(() => {
		fetchCustomerDetail();
	}, [customerId]);

	const fetchCustomerDetail = async () => {
		setLoading(true);
		try {
			const res = await fetch(`/api/v1/admin/customers/${customerId}`, { credentials: "include" });
			const json = await res.json();
			if (res.ok && json.success) {
				setCustomer(json.data);
				setSelectedFraudStatus(json.data.fraud_status || "clean");
				setFraudReasonInput(json.data.fraud_reason || "");
				setDisableReasonInput(json.data.disabled_reason || "");
				setAdminNotesInput(json.data.admin_notes || "");
			} else {
				throw new Error(json.error?.message || "Customer not found");
			}
		} catch (err: any) {
			setError(err.message || "Failed to load customer details");
		} finally {
			setLoading(false);
		}
	};

	const handleSetPassword = async () => {
		if (!customer || newPassword.length < 6) {
			alert("Password must be at least 6 characters");
			return;
		}
		setActionLoading(true);
		try {
			const res = await fetch(`/api/v1/admin/customers/${customer.id}/set-password`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ password: newPassword }),
			});
			const json = await res.json();
			if (res.ok && json.success) {
				alert(`Password updated for ${customer.email}!`);
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

	const handleGenerateResetLink = async () => {
		if (!customer) return;
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
		if (!customer) return;
		const nextDisabled = !customer.is_disabled;
		setActionLoading(true);
		try {
			const res = await fetch(`/api/v1/admin/customers/${customer.id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					is_disabled: nextDisabled,
					disabled_reason: nextDisabled ? disableReasonInput : "",
				}),
			});
			const json = await res.json();
			if (res.ok && json.success) {
				setShowDisableModal(false);
				fetchCustomerDetail();
				alert(`Account login ${nextDisabled ? "DISABLED" : "ENABLED"} successfully.`);
			} else {
				alert(json.error?.message || "Failed to update account status.");
			}
		} catch (err: any) {
			alert(err.message || "Failed to update status.");
		} finally {
			setActionLoading(false);
		}
	};

	const handleSaveRiskAndNotes = async () => {
		if (!customer) return;
		setActionLoading(true);
		try {
			const res = await fetch(`/api/v1/admin/customers/${customer.id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					fraud_status: selectedFraudStatus,
					fraud_reason: fraudReasonInput,
					admin_notes: adminNotesInput,
				}),
			});
			const json = await res.json();
			if (res.ok && json.success) {
				setShowFraudModal(false);
				fetchCustomerDetail();
				alert("Risk classification and internal notes saved successfully.");
			} else {
				alert(json.error?.message || "Failed to save risk details.");
			}
		} catch (err: any) {
			alert(err.message || "Failed to save details.");
		} finally {
			setActionLoading(false);
		}
	};

	const getRoleBadge = (role: string) => {
		const colors: Record<string, string> = {
			customer: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
			admin: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
			owner: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
		};
		return colors[role] || colors.customer;
	};

	const getFraudBadge = (status: CustomerDetail["fraud_status"]) => {
		switch (status) {
			case "fraud":
				return <span className="px-3 py-1 text-xs font-bold rounded-full bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border border-red-300">🚨 FRAUDULENT</span>;
			case "blacklisted":
				return <span className="px-3 py-1 text-xs font-bold rounded-full bg-zinc-900 text-white dark:bg-zinc-700">⛔ BLACKLISTED</span>;
			case "spam":
				return <span className="px-3 py-1 text-xs font-bold rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 border border-orange-300">⚠️ SPAMMER</span>;
			case "suspicious":
				return <span className="px-3 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 border border-yellow-300">🟡 SUSPICIOUS</span>;
			default:
				return <span className="px-3 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-300">✓ TRUSTED / NORMAL</span>;
		}
	};

	if (loading) {
		return (
			<div className="p-12 text-center text-zinc-500">
				<div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" />
				<p className="text-sm font-medium">Loading customer profile...</p>
			</div>
		);
	}

	if (error || !customer) {
		return (
			<div className="p-12 text-center text-red-600 space-y-3">
				<p className="text-lg font-bold">⚠️ Customer Profile Error</p>
				<p className="text-sm text-zinc-600">{error || "Customer not found"}</p>
				<Link href="/admin/customers" className="text-blue-600 hover:underline text-sm inline-block">
					← Return to Customers List
				</Link>
			</div>
		);
	}

	return (
		<div className="space-y-6 max-w-6xl mx-auto">
			{/* Back Link */}
			<div>
				<Link href="/admin/customers" className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center gap-1">
					← Back to Customers Management
				</Link>
			</div>

			{/* Top Banner Card */}
			<div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
				<div className="flex items-center gap-4">
					<div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-md">
						{customer.first_name?.[0] || "C"}{customer.last_name?.[0] || ""}
					</div>
					<div className="space-y-1">
						<div className="flex items-center gap-3">
							<h1 className="text-2xl font-black text-zinc-900 dark:text-white">{customer.first_name} {customer.last_name}</h1>
							<span className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${getRoleBadge(customer.role)} uppercase tracking-wider`}>
								{customer.role}
							</span>
						</div>
						<p className="text-xs text-zinc-500 font-medium">✉️ {customer.email} {customer.phone ? `• 📱 ${customer.phone}` : ""}</p>
						<p className="text-[11px] text-zinc-400">Member since: {new Date(customer.created_at).toLocaleDateString()}</p>
					</div>
				</div>

				{/* Badges & Stats */}
				<div className="flex flex-wrap md:flex-col items-start md:items-end gap-2">
					<div className="flex items-center gap-2">
						{customer.is_disabled ? (
							<span className="px-3 py-1 text-xs font-bold rounded-full bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border border-red-300">
								🚫 Login Disabled
							</span>
						) : (
							<span className="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-300">
								🟢 Login Active
							</span>
						)}
						{getFraudBadge(customer.fraud_status)}
					</div>
					<div className="text-right text-xs mt-1">
						<span className="font-extrabold text-zinc-900 dark:text-white text-base">৳{Math.round(customer.total_spent || 0).toLocaleString()}</span>
						<span className="text-zinc-500 ml-1">({customer.total_orders} Orders)</span>
					</div>
				</div>
			</div>

			{/* Management Action Bar */}
			<div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm space-y-4">
				<h2 className="text-sm font-extrabold uppercase tracking-wider text-zinc-500">Security & Account Management Controls</h2>
				
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
					{/* 🔑 Set Password */}
					<button
						onClick={() => { setNewPassword(""); setShowSetPasswordModal(true); }}
						className="p-3 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700/80 border border-zinc-200 dark:border-zinc-700 rounded-xl text-left transition-colors flex items-center gap-3">
						<span className="text-xl">🔑</span>
						<div>
							<p className="text-xs font-bold text-zinc-900 dark:text-white">Set Password</p>
							<p className="text-[10px] text-zinc-500">Directly set a new password</p>
						</div>
					</button>

					{/* 📩 Reset Link */}
					<button
						onClick={handleGenerateResetLink}
						className="p-3 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 rounded-xl text-left transition-colors flex items-center gap-3">
						<span className="text-xl">📩</span>
						<div>
							<p className="text-xs font-bold text-blue-900 dark:text-blue-300">Reset Link</p>
							<p className="text-[10px] text-blue-600 dark:text-blue-400">Generate password recovery link</p>
						</div>
					</button>

					{/* 🚫 Disable / Enable Login */}
					<button
						onClick={() => { setDisableReasonInput(customer.disabled_reason || ""); setShowDisableModal(true); }}
						className={`p-3 border rounded-xl text-left transition-colors flex items-center gap-3 ${
							customer.is_disabled
								? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100"
								: "bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-700 hover:bg-red-100"
						}`}>
						<span className="text-xl">{customer.is_disabled ? "🟢" : "🚫"}</span>
						<div>
							<p className={`text-xs font-bold ${customer.is_disabled ? "text-emerald-900 dark:text-emerald-300" : "text-red-900 dark:text-red-300"}`}>
								{customer.is_disabled ? "Enable Login Access" : "Disable Login Access"}
							</p>
							<p className="text-[10px] text-zinc-500">{customer.is_disabled ? "Allow user to sign in" : "Block user from logging in"}</p>
						</div>
					</button>

					{/* 🚨 Fraud / Spam Flag */}
					<button
						onClick={() => {
							setSelectedFraudStatus(customer.fraud_status || "clean");
							setFraudReasonInput(customer.fraud_reason || "");
							setAdminNotesInput(customer.admin_notes || "");
							setShowFraudModal(true);
						}}
						className="p-3 bg-orange-50 dark:bg-orange-950/40 hover:bg-orange-100 dark:hover:bg-orange-900/50 border border-orange-200 dark:border-orange-800 rounded-xl text-left transition-colors flex items-center gap-3">
						<span className="text-xl">🚨</span>
						<div>
							<p className="text-xs font-bold text-orange-900 dark:text-orange-300">Fraud / Risk Flag</p>
							<p className="text-[10px] text-orange-600 dark:text-orange-400">Classify fraud or spam risk</p>
						</div>
					</button>
				</div>
			</div>

			{/* Account Status Notes (If disabled or flagged) */}
			{(customer.disabled_reason || customer.fraud_reason || customer.admin_notes) && (
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					{customer.is_disabled && customer.disabled_reason && (
						<div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl space-y-1 text-xs">
							<p className="font-bold text-red-900 dark:text-red-300 uppercase tracking-wider">🚫 Account Disable Reason</p>
							<p className="text-red-700 dark:text-red-400">{customer.disabled_reason}</p>
						</div>
					)}
					{customer.fraud_reason && (
						<div className="p-4 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-xl space-y-1 text-xs">
							<p className="font-bold text-orange-900 dark:text-orange-300 uppercase tracking-wider">🚨 Risk & Fraud Notes</p>
							<p className="text-orange-800 dark:text-orange-300">{customer.fraud_reason}</p>
						</div>
					)}
				</div>
			)}

			{/* Order History */}
			<div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
				<div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
					<h3 className="font-bold text-sm text-zinc-900 dark:text-white">Customer Order History</h3>
					<span className="text-xs text-zinc-500">{customer.total_orders} total orders placed</span>
				</div>

				{customer.orders.length === 0 ? (
					<div className="p-8 text-center text-xs text-zinc-500">No orders placed by this customer yet.</div>
				) : (
					<table className="w-full text-left text-xs">
						<thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 uppercase font-semibold border-b border-zinc-200 dark:border-zinc-800">
							<tr>
								<th className="p-3 px-6">Order #</th>
								<th className="p-3 px-6">Date</th>
								<th className="p-3 px-6">Payment Method</th>
								<th className="p-3 px-6">Status</th>
								<th className="p-3 px-6 text-right">Total</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
							{customer.orders.map((ord) => (
								<tr key={ord.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
									<td className="p-3 px-6 font-bold text-blue-600">
										<Link href={`/admin/orders/${ord.id}`} className="hover:underline">
											#{ord.order_number}
										</Link>
									</td>
									<td className="p-3 px-6 text-zinc-500">{new Date(ord.created_at).toLocaleDateString()}</td>
									<td className="p-3 px-6 uppercase font-semibold text-zinc-700 dark:text-zinc-300">{(ord.payment_method || "COD").replace(/_/g, " ")}</td>
									<td className="p-3 px-6 capitalize">
										<span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
											{ord.status}
										</span>
									</td>
									<td className="p-3 px-6 text-right font-bold text-zinc-900 dark:text-white">৳{Math.round(ord.total || 0).toLocaleString()}</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>

			{/* ── MODALS ───────────────────────────────────────────────────────── */}

			{/* 🔑 Set Password Modal */}
			{showSetPasswordModal && (
				<div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
					<div className="bg-white dark:bg-zinc-900 rounded-xl max-w-md w-full p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4">
						<h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
							<span>🔑</span> Set Password for {customer.first_name}
						</h3>
						<p className="text-xs text-zinc-500">
							Set a new login password directly for <strong className="text-zinc-800 dark:text-zinc-200">{customer.email}</strong>.
						</p>

						<div>
							<label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">New Password (Min 6 characters)</label>
							<input
								type="password"
								placeholder="Enter new password"
								value={newPassword}
								onChange={(e) => setNewPassword(e.target.value)}
								className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500"
							/>
						</div>

						<div className="flex justify-end gap-3 pt-2">
							<button onClick={() => setShowSetPasswordModal(false)} className="px-4 py-2 text-xs font-semibold border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
								Cancel
							</button>
							<button onClick={handleSetPassword} disabled={actionLoading || newPassword.length < 6} className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50">
								{actionLoading ? "Updating..." : "Set Password"}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* 📩 Reset Link Modal */}
			{showResetLinkModal && (
				<div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
					<div className="bg-white dark:bg-zinc-900 rounded-xl max-w-lg w-full p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4">
						<h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
							<span>📩</span> Password Reset Link
						</h3>
						<p className="text-xs text-zinc-500">
							Generated recovery URL for <strong className="text-zinc-800 dark:text-zinc-200">{customer.email}</strong>.
						</p>

						<div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
							<label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Recovery Link</label>
							<textarea readOnly rows={3} value={generatedResetLink} className="w-full text-xs font-mono bg-transparent text-blue-600 dark:text-blue-400 border-0 focus:ring-0 select-all resize-none"></textarea>
						</div>

						<div className="flex justify-between items-center pt-2">
							<button onClick={() => { navigator.clipboard.writeText(generatedResetLink); setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000); }} className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1.5">
								{copiedLink ? "✓ Copied!" : "📋 Copy Link"}
							</button>
							<button onClick={() => setShowResetLinkModal(false)} className="px-4 py-2 text-xs font-semibold border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
								Close
							</button>
						</div>
					</div>
				</div>
			)}

			{/* 🚫 Disable / Enable Login Modal */}
			{showDisableModal && (
				<div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
					<div className="bg-white dark:bg-zinc-900 rounded-xl max-w-md w-full p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4">
						<h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
							<span>{customer.is_disabled ? "🟢 Enable Account Login" : "🚫 Disable Account Login"}</span>
						</h3>
						<p className="text-xs text-zinc-500">
							{customer.is_disabled ? `Allow ${customer.email} to sign into their account?` : `Block ${customer.email} from logging into the storefront?`}
						</p>

						{!customer.is_disabled && (
							<div>
								<label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Reason for Disabling (Optional)</label>
								<textarea rows={2} placeholder="Reason for blocking user access" value={disableReasonInput} onChange={(e) => setDisableReasonInput(e.target.value)} className="w-full px-3 py-2 text-xs border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-red-500" />
							</div>
						)}

						<div className="flex justify-end gap-3 pt-2">
							<button onClick={() => setShowDisableModal(false)} className="px-4 py-2 text-xs font-semibold border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
								Cancel
							</button>
							<button onClick={handleToggleDisable} disabled={actionLoading} className={`px-4 py-2 text-xs font-bold text-white rounded-lg disabled:opacity-50 ${customer.is_disabled ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}>
								{actionLoading ? "Updating..." : customer.is_disabled ? "Enable Login" : "Disable Login"}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* 🚨 Fraud / Spam Flag Modal */}
			{showFraudModal && (
				<div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
					<div className="bg-white dark:bg-zinc-900 rounded-xl max-w-md w-full p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4">
						<h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
							<span>🚨</span> Risk & Fraud Prevention Flag
						</h3>
						<p className="text-xs text-zinc-500">
							Update risk classification and notes for <strong className="text-zinc-800 dark:text-zinc-200">{customer.first_name} {customer.last_name}</strong>.
						</p>

						<div>
							<label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Risk Level</label>
							<select value={selectedFraudStatus} onChange={(e) => setSelectedFraudStatus(e.target.value as any)} className="w-full px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-orange-500">
								<option value="clean">✓ Normal / Trusted Customer</option>
								<option value="suspicious">🟡 Suspicious</option>
								<option value="spam">⚠️ Spammer</option>
								<option value="fraud">🚨 Fraudulent</option>
								<option value="blacklisted">⛔ Blacklisted</option>
							</select>
						</div>

						<div>
							<label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Reason & Risk Notes</label>
							<textarea rows={3} placeholder="Details about suspicious orders or behavior" value={fraudReasonInput} onChange={(e) => setFraudReasonInput(e.target.value)} className="w-full px-3 py-2 text-xs border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white focus:ring-2 focus:ring-orange-500" />
						</div>

						<div className="flex justify-end gap-3 pt-2">
							<button onClick={() => setShowFraudModal(false)} className="px-4 py-2 text-xs font-semibold border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
								Cancel
							</button>
							<button onClick={handleSaveRiskAndNotes} disabled={actionLoading} className="px-4 py-2 text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white rounded-lg disabled:opacity-50">
								{actionLoading ? "Saving..." : "Save Risk Flag"}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

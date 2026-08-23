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
	customer_code?: string;
	nfc_card_uid?: string | null;
	loyalty_tier?: string;
	advance_balance?: number;
	outstanding_due?: number;
	credit_limit?: number;
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
	ledgers?: Array<{
		id: string;
		entry_type: "debit" | "credit";
		amount: number;
		balance_after: number;
		reference_type: string;
		reference_id: string;
		notes: string;
		created_at: string;
	}>;
}

const fmt = (n: number) => "৳" + (Number(n) || 0).toLocaleString("en-BD");

export default function CustomerDetailPage() {
	const params = useParams();
	const customerId = params.id as string;

	const [customer, setCustomer] = useState<CustomerDetail | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Modals
	const [showDisableModal, setShowDisableModal] = useState(false);
	const [showFraudModal, setShowFraudModal] = useState(false);
	const [showNfcModal, setShowNfcModal] = useState(false);
	const [showWalletModal, setShowWalletModal] = useState(false);

	// Inputs
	const [disableReasonInput, setDisableReasonInput] = useState("");
	const [selectedFraudStatus, setSelectedFraudStatus] = useState<CustomerDetail["fraud_status"]>("clean");
	const [fraudReasonInput, setFraudReasonInput] = useState("");
	const [adminNotesInput, setAdminNotesInput] = useState("");
	const [nfcUidInput, setNfcUidInput] = useState("");
	const [tierInput, setTierInput] = useState("Silver");
	const [walletAmountInput, setWalletAmountInput] = useState("");
	const [walletTypeInput, setWalletTypeInput] = useState<"advance_topup" | "due_collection">("advance_topup");
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
				setNfcUidInput(json.data.nfc_card_uid || "");
				setTierInput(json.data.loyalty_tier || "Silver");
			} else {
				throw new Error(json.error?.message || "Customer not found");
			}
		} catch (err: any) {
			setError(err.message || "Failed to load customer details");
		} finally {
			setLoading(false);
		}
	};

	const handleSaveNfcAndTier = async () => {
		if (!customer) return;
		setActionLoading(true);
		try {
			const res = await fetch(`/api/v1/admin/customers/${customer.id}/nfc-wallet`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					nfc_card_uid: nfcUidInput.trim(),
					loyalty_tier: tierInput
				}),
			});
			const json = await res.json();
			if (json.success) {
				alert(json.message);
				setShowNfcModal(false);
				fetchCustomerDetail();
			} else {
				alert(json.error || "Failed to update NFC credentials");
			}
		} catch (err: any) {
			alert(err.message);
		} finally {
			setActionLoading(false);
		}
	};

	const handleWalletOperation = async () => {
		if (!customer || !walletAmountInput) return;
		setActionLoading(true);
		try {
			if (walletTypeInput === "advance_topup") {
				const res = await fetch(`/api/v1/admin/customers/${customer.id}/nfc-wallet`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						topup_amount: Number(walletAmountInput)
					}),
				});
				const json = await res.json();
				if (json.success) {
					alert(json.message);
					setShowWalletModal(false);
					setWalletAmountInput("");
					fetchCustomerDetail();
				}
			} else {
				const res = await fetch(`/api/v1/admin/accounting/due-collection`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						customer_id: customer.id,
						amount_received: Number(walletAmountInput),
						payment_method: "cash"
					}),
				});
				const json = await res.json();
				if (json.success) {
					alert(json.message);
					setShowWalletModal(false);
					setWalletAmountInput("");
					fetchCustomerDetail();
				}
			}
		} catch (err: any) {
			alert(err.message);
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
			}
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
				alert("Risk classification and notes saved.");
			}
		} finally {
			setActionLoading(false);
		}
	};

	if (loading) {
		return (
			<div className="p-12 text-center text-zinc-500">
				<div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" />
				<p className="text-xs font-bold">Loading customer profile & party ledger...</p>
			</div>
		);
	}

	if (error || !customer) {
		return (
			<div className="p-12 text-center text-red-600 space-y-3">
				<p className="text-lg font-bold">⚠️ Customer Profile Error</p>
				<p className="text-xs text-zinc-500">{error || "Customer not found"}</p>
				<Link href="/admin/customers" className="text-blue-600 font-bold text-xs">
					← Return to Customers List
				</Link>
			</div>
		);
	}

	return (
		<div className="space-y-6 max-w-6xl mx-auto">
			<div>
				<Link href="/admin/customers" className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center gap-1">
					← Back to Customers Management
				</Link>
			</div>

			{/* Top Banner Card */}
			<div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
				<div className="flex items-center gap-4">
					<div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-md">
						{customer.first_name?.[0] || "C"}{customer.last_name?.[0] || ""}
					</div>
					<div className="space-y-1">
						<div className="flex items-center gap-3">
							<h1 className="text-2xl font-black text-zinc-900 dark:text-white">
								{customer.first_name} {customer.last_name}
							</h1>
							<span className="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-mono">
								{customer.customer_code}
							</span>
							<span className="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
								⭐ {customer.loyalty_tier || "Silver"}
							</span>
						</div>
						<p className="text-xs text-zinc-500 font-medium">✉️ {customer.email} {customer.phone ? `• 📱 ${customer.phone}` : ""}</p>
						<p className="text-[11px] text-zinc-400">NFC UID: <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300">{customer.nfc_card_uid || "Not Assigned"}</span></p>
					</div>
				</div>

				{/* Financial Position Cards */}
				<div className="flex gap-3">
					<div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-center min-w-28">
						<p className="text-[10px] text-emerald-800 dark:text-emerald-300 font-bold">Advance Wallet</p>
						<p className="text-base font-black text-emerald-700 dark:text-emerald-300 mt-0.5">{fmt(customer.advance_balance || 0)}</p>
					</div>
					<div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-center min-w-28">
						<p className="text-[10px] text-rose-800 dark:text-rose-300 font-bold">Outstanding Due</p>
						<p className="text-base font-black text-rose-600 dark:text-rose-400 mt-0.5">{fmt(customer.outstanding_due || 0)}</p>
					</div>
				</div>
			</div>

			{/* Management Action Bar */}
			<div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm space-y-4">
				<h2 className="text-xs font-black uppercase tracking-wider text-zinc-500">Party Account & Hardware Controls</h2>
				
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
					<button
						onClick={() => setShowNfcModal(true)}
						className="p-3 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded-xl text-left flex items-center gap-3"
					>
						<span className="text-xl">💳</span>
						<div>
							<p className="text-xs font-bold text-zinc-900 dark:text-white">Bind NFC Card & Tier</p>
							<p className="text-[10px] text-zinc-500">Tap physical card / set loyalty</p>
						</div>
					</button>

					<button
						onClick={() => setShowWalletModal(true)}
						className="p-3 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded-xl text-left flex items-center gap-3"
					>
						<span className="text-xl">💰</span>
						<div>
							<p className="text-xs font-bold text-zinc-900 dark:text-white">Deposit / Due Collect</p>
							<p className="text-[10px] text-zinc-500">Adjust wallet / settle due</p>
						</div>
					</button>

					<button
						onClick={() => setShowFraudModal(true)}
						className="p-3 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded-xl text-left flex items-center gap-3"
					>
						<span className="text-xl">🛡️</span>
						<div>
							<p className="text-xs font-bold text-zinc-900 dark:text-white">Risk & Notes</p>
							<p className="text-[10px] text-zinc-500">Fraud check status & flags</p>
						</div>
					</button>

					<button
						onClick={() => setShowDisableModal(true)}
						className="p-3 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded-xl text-left flex items-center gap-3"
					>
						<span className="text-xl">🚫</span>
						<div>
							<p className="text-xs font-bold text-zinc-900 dark:text-white">{customer.is_disabled ? "Enable Account" : "Disable Login"}</p>
							<p className="text-[10px] text-zinc-500">Block storefront checkout</p>
						</div>
					</button>
				</div>
			</div>

			{/* Double-Entry Ledger Audit Trail */}
			<div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm space-y-4">
				<div className="flex justify-between items-center">
					<h2 className="text-sm font-extrabold text-zinc-900 dark:text-white">Party Accounting Ledger History</h2>
					<Link href="/admin/accounting/ledger" className="text-xs font-bold text-blue-600 hover:underline">Full General Ledger →</Link>
				</div>

				{!customer.ledgers || customer.ledgers.length === 0 ? (
					<p className="text-xs text-zinc-400 py-6 text-center">No ledger transaction entries yet.</p>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-left text-xs">
							<thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 font-bold uppercase text-[10px]">
								<tr>
									<th className="px-4 py-3">Date</th>
									<th className="px-4 py-3">Type</th>
									<th className="px-4 py-3">Reference</th>
									<th className="px-4 py-3">Notes</th>
									<th className="px-4 py-3">Amount</th>
									<th className="px-4 py-3 text-right">Balance After</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
								{customer.ledgers.map((l) => (
									<tr key={l.id}>
										<td className="px-4 py-3 text-zinc-500">{new Date(l.created_at).toLocaleDateString()}</td>
										<td className="px-4 py-3">
											<span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
												l.entry_type === "credit" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
											}`}>
												{l.entry_type}
											</span>
										</td>
										<td className="px-4 py-3 font-mono font-bold">{l.reference_id || l.reference_type}</td>
										<td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{l.notes}</td>
										<td className={`px-4 py-3 font-black ${l.entry_type === "credit" ? "text-emerald-600" : "text-rose-600"}`}>
											{fmt(l.amount)}
										</td>
										<td className="px-4 py-3 font-black text-right">{fmt(l.balance_after)}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>

			{/* NFC Card Binding Modal */}
			{showNfcModal && (
				<div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
					<div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
						<div className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-800 pb-3">
							<h3 className="font-extrabold text-base text-zinc-900 dark:text-white">NFC Membership & Loyalty Tier</h3>
							<button onClick={() => setShowNfcModal(false)} className="text-zinc-400 font-bold">✕</button>
						</div>

						<div className="space-y-3 text-xs">
							<div>
								<label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">NFC Card UID (Tap Card on Reader) *</label>
								<input
									type="text"
									value={nfcUidInput}
									onChange={e => setNfcUidInput(e.target.value)}
									placeholder="e.g. 04A1B2C3D4E5F6"
									className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl font-mono uppercase font-bold"
								/>
							</div>

							<div>
								<label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Loyalty Tier</label>
								<select
									value={tierInput}
									onChange={e => setTierInput(e.target.value)}
									className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl font-bold"
								>
									<option value="Silver">Silver Tier (Default)</option>
									<option value="Gold">Gold Tier (5% Discount)</option>
									<option value="Platinum">Platinum VIP (10% Discount)</option>
								</select>
							</div>
						</div>

						<button
							onClick={handleSaveNfcAndTier}
							disabled={actionLoading}
							className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-600/30"
						>
							{actionLoading ? "Saving..." : "Save NFC Card Credentials"}
						</button>
					</div>
				</div>
			)}

			{/* Wallet & Due Modal */}
			{showWalletModal && (
				<div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
					<div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
						<div className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-800 pb-3">
							<h3 className="font-extrabold text-base text-zinc-900 dark:text-white">Customer Financial Adjustment</h3>
							<button onClick={() => setShowWalletModal(false)} className="text-zinc-400 font-bold">✕</button>
						</div>

						<div className="space-y-3 text-xs">
							<div>
								<label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Operation Type</label>
								<div className="grid grid-cols-2 gap-2">
									<button
										type="button"
										onClick={() => setWalletTypeInput("advance_topup")}
										className={`py-2 px-3 rounded-xl font-bold text-center border-2 ${
											walletTypeInput === "advance_topup" ? "border-emerald-600 bg-emerald-50 text-emerald-800 font-black" : "border-zinc-200"
										}`}
									>
										Top-Up Advance
									</button>
									<button
										type="button"
										onClick={() => setWalletTypeInput("due_collection")}
										className={`py-2 px-3 rounded-xl font-bold text-center border-2 ${
											walletTypeInput === "due_collection" ? "border-rose-600 bg-rose-50 text-rose-800 font-black" : "border-zinc-200"
										}`}
									>
										Collect Due
									</button>
								</div>
							</div>

							<div>
								<label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Amount (BDT) *</label>
								<input
									type="number"
									value={walletAmountInput}
									onChange={e => setWalletAmountInput(e.target.value)}
									placeholder="e.g. 5000"
									className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl font-black text-sm"
								/>
							</div>
						</div>

						<button
							onClick={handleWalletOperation}
							disabled={actionLoading}
							className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-600/30"
						>
							{actionLoading ? "Processing..." : "Confirm & Post Ledger Entry"}
						</button>
					</div>
				</div>
			)}

			{/* Risk & Fraud Classification Modal */}
			{showFraudModal && (
				<div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
					<div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
						<div className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-800 pb-3">
							<h3 className="font-extrabold text-base text-zinc-900 dark:text-white">Fraud Risk & Internal Notes</h3>
							<button onClick={() => setShowFraudModal(false)} className="text-zinc-400 font-bold">✕</button>
						</div>

						<div className="space-y-3 text-xs">
							<div>
								<label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Risk Status</label>
								<select
									value={selectedFraudStatus}
									onChange={e => setSelectedFraudStatus(e.target.value as any)}
									className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl font-bold"
								>
									<option value="clean">Clean (Trusted)</option>
									<option value="suspicious">Suspicious</option>
									<option value="spam">Spam</option>
									<option value="fraud">Fraudulent</option>
									<option value="blacklisted">Blacklisted</option>
								</select>
							</div>

							<div>
								<label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Risk / Flag Reason</label>
								<input
									type="text"
									value={fraudReasonInput}
									onChange={e => setFraudReasonInput(e.target.value)}
									placeholder="Reason for risk status..."
									className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl"
								/>
							</div>

							<div>
								<label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Internal Admin Notes</label>
								<textarea
									value={adminNotesInput}
									onChange={e => setAdminNotesInput(e.target.value)}
									placeholder="Notes visible only to admins..."
									rows={3}
									className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl"
								/>
							</div>
						</div>

						<button
							onClick={handleSaveRiskAndNotes}
							disabled={actionLoading}
							className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-600/30"
						>
							{actionLoading ? "Saving..." : "Save Risk Settings"}
						</button>
					</div>
				</div>
			)}

			{/* Account Disable Modal */}
			{showDisableModal && (
				<div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
					<div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
						<div className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-800 pb-3">
							<h3 className="font-extrabold text-base text-zinc-900 dark:text-white">
								{customer.is_disabled ? "Enable Customer Account" : "Disable Customer Login"}
							</h3>
							<button onClick={() => setShowDisableModal(false)} className="text-zinc-400 font-bold">✕</button>
						</div>

						{!customer.is_disabled && (
							<div className="space-y-1 text-xs">
								<label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">Reason for Disabling Account</label>
								<input
									type="text"
									value={disableReasonInput}
									onChange={e => setDisableReasonInput(e.target.value)}
									placeholder="e.g. Non-payment of dues, abusive conduct"
									className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl"
								/>
							</div>
						)}

						<button
							onClick={handleToggleDisable}
							disabled={actionLoading}
							className={`w-full py-3 rounded-xl font-bold text-xs text-white shadow-md ${
								customer.is_disabled ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"
							}`}
						>
							{actionLoading ? "Updating..." : customer.is_disabled ? "Re-Enable Account" : "Confirm Disable Account"}
						</button>
					</div>
				</div>
			)}
		</div>
	);
}

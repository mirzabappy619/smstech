"use client";

import { useCallback, useEffect, useState } from "react";
import { formatBDT } from "@/lib/currency";
import type { Party, PartyType } from "@/lib/parties";

const fmt = (n: number) => formatBDT(n);

const emptyForm = {
	party_type: "customer" as PartyType,
	customer_type: "retail",
	name: "",
	company_name: "",
	phone: "",
	email: "",
	address: "",
	contact_person: "",
	credit_limit: "0",
	opening_balance: "0",
	notes: "",
};

/**
 * Sell-side parties (walk-in customers and wholesale accounts) and buy-side
 * parties (suppliers) in one list, since both are people the shop owes money to
 * or is owed money by. Login accounts are a separate concern and stay on the
 * other tab — a party does not need to be able to sign in.
 */
export function PartiesPanel() {
	const [parties, setParties] = useState<Party[]>([]);
	const [loading, setLoading] = useState(true);
	const [typeFilter, setTypeFilter] = useState<"all" | PartyType>("all");
	const [search, setSearch] = useState("");
	const [showAddModal, setShowAddModal] = useState(false);
	const [form, setForm] = useState(emptyForm);
	const [saving, setSaving] = useState(false);
	const [formError, setFormError] = useState("");

	const fetchParties = useCallback(async () => {
		setLoading(true);
		try {
			const params = new URLSearchParams({ limit: "300" });
			if (typeFilter !== "all") params.set("type", typeFilter);
			if (search.trim()) params.set("q", search.trim());

			const res = await fetch(`/api/v1/admin/parties?${params}`);
			const json = await res.json();
			if (json.success) setParties(json.data || []);
		} catch (err) {
			console.error(err);
		} finally {
			setLoading(false);
		}
	}, [typeFilter, search]);

	useEffect(() => {
		fetchParties();
	}, [typeFilter]); // eslint-disable-line react-hooks/exhaustive-deps

	const handleCreate = async (e: React.FormEvent) => {
		e.preventDefault();
		setFormError("");
		setSaving(true);
		try {
			const res = await fetch("/api/v1/admin/parties", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(form),
			});
			const json = await res.json();
			if (json.success) {
				setShowAddModal(false);
				setForm(emptyForm);
				fetchParties();
			} else {
				setFormError(json.error || "Could not save this party.");
			}
		} catch {
			setFormError("Could not reach the server.");
		} finally {
			setSaving(false);
		}
	};

	const isSupplier = form.party_type === "supplier";
	const fieldClass =
		"w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-sm font-semibold text-zinc-900 dark:text-white";
	const labelClass = "block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1";

	const customers = parties.filter((p) => p.party_type === "customer");
	const suppliers = parties.filter((p) => p.party_type === "supplier");
	const totalReceivable = customers.reduce((sum, p) => sum + p.balance, 0);
	const totalPayable = suppliers.reduce((sum, p) => sum + p.balance, 0);

	return (
		<div className="space-y-4">
			{/* Summary */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
				<div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
					<p className="text-xs font-medium text-zinc-500">Customers &amp; Parties</p>
					<p className="text-2xl font-black text-zinc-900 dark:text-white mt-1">
						{customers.length}
					</p>
				</div>
				<div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
					<p className="text-xs font-medium text-zinc-500">Suppliers</p>
					<p className="text-2xl font-black text-zinc-900 dark:text-white mt-1">
						{suppliers.length}
					</p>
				</div>
				<div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
					<p className="text-xs font-medium text-zinc-500">Owed To Us</p>
					<p className="text-2xl font-black text-rose-600 mt-1">{fmt(totalReceivable)}</p>
				</div>
				<div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
					<p className="text-xs font-medium text-zinc-500">Owed By Us</p>
					<p className="text-2xl font-black text-amber-600 mt-1">{fmt(totalPayable)}</p>
				</div>
			</div>

			{/* Controls */}
			<div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 flex flex-wrap items-center gap-3">
				<form
					onSubmit={(e) => {
						e.preventDefault();
						fetchParties();
					}}
					className="flex-1 min-w-[200px]"
				>
					<input
						type="text"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Search by name, phone or code..."
						className={fieldClass}
					/>
				</form>

				<select
					value={typeFilter}
					onChange={(e) => setTypeFilter(e.target.value as "all" | PartyType)}
					className="px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-sm font-bold text-zinc-900 dark:text-white"
				>
					<option value="all">All Parties</option>
					<option value="customer">Customers &amp; Wholesale</option>
					<option value="supplier">Suppliers</option>
				</select>

				<button
					onClick={fetchParties}
					className="px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl text-xs font-bold"
				>
					Search
				</button>

				<button
					onClick={() => {
						setForm(emptyForm);
						setFormError("");
						setShowAddModal(true);
					}}
					className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-600/30"
				>
					+ Add Customer / Party
				</button>
			</div>

			{/* Table */}
			<div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
				{loading ? (
					<div className="p-12 text-center text-xs text-zinc-400">Loading parties...</div>
				) : parties.length === 0 ? (
					<div className="p-12 text-center">
						<p className="font-bold text-sm text-zinc-700 dark:text-zinc-300">
							No parties registered yet
						</p>
						<p className="text-xs text-zinc-500 mt-1">
							Add a customer or supplier to sell to them on due and track what is owed.
						</p>
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-left text-xs">
							<thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 font-bold uppercase text-[10px]">
								<tr>
									<th className="px-4 py-3.5">Party</th>
									<th className="px-4 py-3.5">Type</th>
									<th className="px-4 py-3.5">Contact</th>
									<th className="px-4 py-3.5">Credit Limit</th>
									<th className="px-4 py-3.5">Balance</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 font-medium">
								{parties.map((party) => (
									<tr
										key={`${party.party_type}-${party.id}`}
										className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
									>
										<td className="px-4 py-3">
											<p className="font-extrabold text-zinc-900 dark:text-white">
												{party.name}
											</p>
											<p className="text-[10px] text-zinc-500 font-mono">
												{party.code || "—"}
												{party.company_name ? ` · ${party.company_name}` : ""}
											</p>
										</td>
										<td className="px-4 py-3">
											<span
												className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
													party.party_type === "supplier"
														? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
														: party.customer_type === "wholesale"
															? "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300"
															: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
												}`}
											>
												{party.party_type === "supplier"
													? "Supplier"
													: party.customer_type === "wholesale"
														? "Wholesale"
														: "Retail"}
											</span>
										</td>
										<td className="px-4 py-3 font-mono text-zinc-500">
											<div>{party.phone || "—"}</div>
											{party.email && (
												<div className="text-[10px] text-zinc-400">{party.email}</div>
											)}
										</td>
										<td className="px-4 py-3 font-bold text-zinc-700 dark:text-zinc-300">
											{party.party_type === "supplier" ? "—" : fmt(party.credit_limit)}
										</td>
										<td className="px-4 py-3">
											{party.balance > 0 ? (
												<span
													className={`font-extrabold ${
														party.party_type === "supplier"
															? "text-amber-600"
															: "text-rose-600"
													}`}
												>
													{fmt(party.balance)}
													<span className="block text-[10px] font-medium text-zinc-400">
														{party.party_type === "supplier" ? "we owe" : "they owe"}
													</span>
												</span>
											) : party.advance_balance > 0 ? (
												<span className="font-extrabold text-emerald-600">
													{fmt(party.advance_balance)}
													<span className="block text-[10px] font-medium text-zinc-400">
														advance held
													</span>
												</span>
											) : (
												<span className="text-zinc-400">Settled</span>
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>

			{/* Add modal */}
			{showAddModal && (
				<div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
					<div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
						<div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
							<h2 className="text-lg font-black text-zinc-900 dark:text-white">
								Add Customer / Party
							</h2>
							<button
								onClick={() => setShowAddModal(false)}
								className="text-zinc-400 hover:text-zinc-600 font-bold"
							>
								✕
							</button>
						</div>

						<form onSubmit={handleCreate} className="space-y-3">
							<div className="grid grid-cols-2 gap-3">
								<div>
									<label className={labelClass}>Party Type *</label>
									<select
										value={form.party_type}
										onChange={(e) =>
											setForm({ ...form, party_type: e.target.value as PartyType })
										}
										className={fieldClass}
									>
										<option value="customer">Customer / Wholesale buyer</option>
										<option value="supplier">Supplier</option>
									</select>
								</div>
								{!isSupplier && (
									<div>
										<label className={labelClass}>Customer Type</label>
										<select
											value={form.customer_type}
											onChange={(e) =>
												setForm({ ...form, customer_type: e.target.value })
											}
											className={fieldClass}
										>
											<option value="retail">Retail / walk-in</option>
											<option value="wholesale">Wholesale / corporate</option>
										</select>
									</div>
								)}
							</div>

							<div className="grid grid-cols-2 gap-3">
								<div>
									<label className={labelClass}>Name *</label>
									<input
										type="text"
										value={form.name}
										onChange={(e) => setForm({ ...form, name: e.target.value })}
										placeholder={isSupplier ? "Star Tech Supply" : "Rahim Uddin"}
										className={fieldClass}
										required
									/>
								</div>
								<div>
									<label className={labelClass}>Phone *</label>
									<input
										type="text"
										value={form.phone}
										onChange={(e) => setForm({ ...form, phone: e.target.value })}
										placeholder="01XXXXXXXXX"
										className={fieldClass}
										required
									/>
								</div>
							</div>

							<div className="grid grid-cols-2 gap-3">
								<div>
									<label className={labelClass}>
										{isSupplier ? "Contact Person" : "Company (optional)"}
									</label>
									<input
										type="text"
										value={isSupplier ? form.contact_person : form.company_name}
										onChange={(e) =>
											setForm(
												isSupplier
													? { ...form, contact_person: e.target.value }
													: { ...form, company_name: e.target.value },
											)
										}
										className={fieldClass}
									/>
								</div>
								<div>
									<label className={labelClass}>Email (optional)</label>
									<input
										type="email"
										value={form.email}
										onChange={(e) => setForm({ ...form, email: e.target.value })}
										className={fieldClass}
									/>
								</div>
							</div>

							<div>
								<label className={labelClass}>Address (optional)</label>
								<input
									type="text"
									value={form.address}
									onChange={(e) => setForm({ ...form, address: e.target.value })}
									className={fieldClass}
								/>
							</div>

							<div className="grid grid-cols-2 gap-3">
								{!isSupplier && (
									<div>
										<label className={labelClass}>Credit Limit (BDT)</label>
										<input
											type="number"
											min={0}
											value={form.credit_limit}
											onChange={(e) =>
												setForm({ ...form, credit_limit: e.target.value })
											}
											className={fieldClass}
										/>
										<p className="text-[10px] text-zinc-500 mt-1">
											The most this party may owe at once. 0 means no credit — they
											cannot be sold to on due.
										</p>
									</div>
								)}
								<div>
									<label className={labelClass}>
										{isSupplier ? "Opening Payable (BDT)" : "Opening Due (BDT)"}
									</label>
									<input
										type="number"
										min={0}
										value={form.opening_balance}
										onChange={(e) =>
											setForm({ ...form, opening_balance: e.target.value })
										}
										className={fieldClass}
									/>
									<p className="text-[10px] text-zinc-500 mt-1">
										Balance carried in from before. Posted to the ledger so it shows in
										their history.
									</p>
								</div>
							</div>

							<div>
								<label className={labelClass}>Notes</label>
								<input
									type="text"
									value={form.notes}
									onChange={(e) => setForm({ ...form, notes: e.target.value })}
									className={fieldClass}
								/>
							</div>

							{formError && (
								<p className="text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 rounded-lg p-2.5">
									{formError}
								</p>
							)}

							<div className="flex gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
								<button
									type="button"
									onClick={() => setShowAddModal(false)}
									className="flex-1 py-2.5 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300"
								>
									Cancel
								</button>
								<button
									type="submit"
									disabled={saving}
									className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-blue-600/30 disabled:opacity-50"
								>
									{saving ? "Saving..." : "Save Party"}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	);
}

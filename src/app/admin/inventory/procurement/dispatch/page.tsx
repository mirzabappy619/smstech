"use client";

import { useMemo, useState } from "react";
import { useRBAC } from "@/lib/rbac/rbac-context";
import { notify } from "@/components/ui/toast";
import { SearchableSelect } from "@/components/ui";
import { PartyPicker } from "../party-picker";
import {
	FIELD,
	LABEL,
	SellLinesEditor,
	emptySellLine,
	fmt,
	sellLineTotal,
	useProcurementData,
	type SellLine,
} from "../shared";

/** How the order is settled. Credit is a first-class choice, not a checkbox. */
type Terms = "full" | "part" | "credit";

const TERMS: { value: Terms; label: string; hint: string }[] = [
	{ value: "full", label: "Paid in full", hint: "Settled on dispatch" },
	{ value: "part", label: "Part payment", hint: "Some now, rest on due" },
	{ value: "credit", label: "Full credit", hint: "Whole order on due" },
];

export default function WholesaleDispatchPage() {
	const { hasPermission } = useRBAC();
	const canRegister = hasPermission("customers:edit");

	const { products, warehouses, parties, warehouseId, setWarehouseId, refreshParties } =
		useProcurementData();

	const [partyId, setPartyId] = useState("");
	const [clientName, setClientName] = useState("");
	const [clientPhone, setClientPhone] = useState("");
	const [lines, setLines] = useState<SellLine[]>([emptySellLine()]);
	const [terms, setTerms] = useState<Terms>("full");
	const [amountPaid, setAmountPaid] = useState("");
	const [notes, setNotes] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const customerParties = useMemo(
		() => parties.filter((p) => p.party_type === "customer"),
		[parties],
	);
	const selectedParty = useMemo(
		() => customerParties.find((p) => p.id === partyId) || null,
		[customerParties, partyId],
	);

	const total = useMemo(() => lines.reduce((sum, l) => sum + sellLineTotal(l), 0), [lines]);

	const paidNow =
		terms === "full" ? total : terms === "credit" ? 0 : Math.min(total, Number(amountPaid) || 0);
	const dueNow = Math.max(0, Math.round((total - paidNow) * 100) / 100);

	const headroom = selectedParty ? selectedParty.credit_limit - selectedParty.balance : 0;
	const overLimit = dueNow > 0 && selectedParty !== null && dueNow > headroom + 0.01;
	// A due has to be owed by someone the shop can look up later.
	const creditNeedsParty = dueNow > 0 && !selectedParty;

	const resolvedName = selectedParty?.name || clientName;

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!resolvedName) {
			notify.warning("Pick a registered party, or type the client's name.");
			return;
		}
		if (!warehouseId) {
			notify.warning("Choose the branch the stock is leaving from.");
			return;
		}
		if (creditNeedsParty) {
			notify.warning(
				"Selling on credit needs a registered party — pick one, or register them here.",
			);
			return;
		}
		if (overLimit) {
			notify.warning(
				`That due is over ${selectedParty?.name}'s remaining credit of ${fmt(headroom)}.`,
			);
			return;
		}

		const items = [];
		for (const [index, line] of lines.entries()) {
			const position = `Line ${index + 1}`;
			if (!line.product_id) {
				notify.warning(`${position}: choose a product.`);
				return;
			}
			const quantity = Number(line.quantity);
			const unitPrice = Number(line.unit_price);
			if (!Number.isInteger(quantity) || quantity < 1) {
				notify.warning(`${position}: quantity must be a whole number of 1 or more.`);
				return;
			}
			if (!Number.isFinite(unitPrice) || unitPrice < 0) {
				notify.warning(`${position}: enter a unit price.`);
				return;
			}
			items.push({
				product_id: line.product_id,
				product_name: products.find((p) => p.id === line.product_id)?.name || "Wholesale item",
				quantity,
				unit_price: unitPrice,
			});
		}

		setIsSubmitting(true);
		try {
			const res = await fetch("/api/v1/admin/inventory/procurement", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					type: "batch_sell",
					customer_id: selectedParty?.id || undefined,
					customer_name: resolvedName,
					customer_phone: selectedParty?.phone || clientPhone || "01700000000",
					warehouse_id: warehouseId,
					amount_paid: paidNow,
					notes,
					items,
				}),
			});
			const json = await res.json();

			if (json.success) {
				notify.success(`Wholesale Order Created: ${json.message}`);
				setLines([emptySellLine()]);
				setClientName("");
				setClientPhone("");
				setPartyId("");
				setAmountPaid("");
				setTerms("full");
				setNotes("");
				refreshParties();
			} else {
				notify.error(json.error || "Batch sell dispatch failed");
			}
		} catch {
			notify.error("Error submitting wholesale dispatch");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<form
			onSubmit={handleSubmit}
			className="max-w-5xl space-y-5 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
		>
			<div>
				<h2 className="text-lg font-black text-zinc-900 dark:text-white">
					Corporate / Wholesale Dispatch
				</h2>
				<p className="mt-0.5 text-xs text-zinc-500">
					Goods out against payment, or on the party&rsquo;s credit line.
				</p>
			</div>

			<div className="grid grid-cols-1 gap-4 text-xs md:grid-cols-3">
				<PartyPicker
					side="customer"
					parties={customerParties}
					value={partyId}
					onChange={setPartyId}
					label="Registered Party"
					emptyLabel="-- Not registered / walk-in --"
					canRegister={canRegister}
					onRegistered={refreshParties}
					required={creditNeedsParty}
				/>

				<div>
					<label className={LABEL}>
						{selectedParty ? "Party (from record)" : "Client Name *"}
					</label>
					<input
						type="text"
						value={selectedParty?.name || clientName}
						onChange={(e) => setClientName(e.target.value)}
						disabled={!!selectedParty}
						placeholder="e.g. Brac Bank IT Procurement"
						className={`${FIELD} disabled:opacity-60`}
					/>
				</div>

				<div>
					<label className={LABEL}>Dispatch From Branch *</label>
					<SearchableSelect
						options={warehouses.map((w) => ({ value: w.id, label: w.name, hint: w.code }))}
						value={warehouseId}
						onChange={setWarehouseId}
						placeholder="Search branches…"
						aria-label="Dispatch from branch"
					/>
				</div>
			</div>

			{!selectedParty && (
				<div className="max-w-xs text-xs">
					<label className={LABEL}>Client Phone</label>
					<input
						type="text"
						value={clientPhone}
						onChange={(e) => setClientPhone(e.target.value)}
						placeholder="01XXXXXXXXX"
						className={FIELD}
					/>
				</div>
			)}

			<SellLinesEditor lines={lines} setLines={setLines} products={products} />

			{/* ── Settlement ─────────────────────────────────────────────────── */}
			<div className="space-y-3 rounded-xl border border-zinc-200 p-4 text-xs dark:border-zinc-800">
				<p className="font-black uppercase tracking-wider text-zinc-500">Payment terms</p>

				<div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
					{TERMS.map((option) => (
						<button
							key={option.value}
							type="button"
							onClick={() => {
								setTerms(option.value);
								if (option.value !== "part") setAmountPaid("");
							}}
							aria-pressed={terms === option.value}
							className={`rounded-xl border p-3 text-left transition-all ${
								terms === option.value
									? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
									: "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700"
							}`}
						>
							<span className="block font-black text-zinc-900 dark:text-white">
								{option.label}
							</span>
							<span className="mt-0.5 block text-[11px] font-semibold text-zinc-500">
								{option.hint}
							</span>
						</button>
					))}
				</div>

				{terms === "part" && (
					<div className="max-w-xs">
						<label className={LABEL}>Paid Now (BDT)</label>
						<input
							type="number"
							min={0}
							max={total || undefined}
							value={amountPaid}
							onChange={(e) => setAmountPaid(e.target.value)}
							placeholder={`Up to ${fmt(total)}`}
							className={FIELD}
						/>
					</div>
				)}

				{dueNow > 0 && selectedParty && (
					<p className={`font-bold ${overLimit ? "text-rose-600" : "text-zinc-500"}`}>
						{selectedParty.name} owes {fmt(selectedParty.balance)} of a{" "}
						{fmt(selectedParty.credit_limit)} limit — {fmt(headroom)} of credit left.
						{overLimit && ` This due of ${fmt(dueNow)} is over that.`}
					</p>
				)}
			</div>

			<div className="text-xs">
				<label className={LABEL}>Dispatch Notes</label>
				<input
					type="text"
					value={notes}
					onChange={(e) => setNotes(e.target.value)}
					placeholder="e.g. PO #4471, deliver to Gulshan office"
					className={FIELD}
				/>
			</div>

			<div className="space-y-1 rounded-xl bg-zinc-100 p-3 text-xs font-bold dark:bg-zinc-800">
				<div className="flex items-center justify-between">
					<span>{lines.length} line(s) — Order Total:</span>
					<span className="text-sm font-black text-blue-600">{fmt(total)}</span>
				</div>
				{dueNow > 0 && (
					<>
						<div className="flex items-center justify-between text-emerald-600">
							<span>Paid now:</span>
							<span>{fmt(paidNow)}</span>
						</div>
						<div className="flex items-center justify-between text-rose-600">
							<span>On due:</span>
							<span>{fmt(dueNow)}</span>
						</div>
					</>
				)}
			</div>

			<button
				type="submit"
				disabled={isSubmitting || overLimit || creditNeedsParty}
				className="w-full rounded-xl bg-emerald-600 py-3 text-xs font-black text-white shadow-lg shadow-emerald-600/30 transition-all hover:bg-emerald-700 disabled:opacity-50"
			>
				{isSubmitting
					? "Dispatching…"
					: dueNow > 0
						? `Dispatch — ${fmt(dueNow)} on credit`
						: "Dispatch Wholesale Order"}
			</button>
		</form>
	);
}

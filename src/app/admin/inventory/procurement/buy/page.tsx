"use client";

import { useMemo, useState } from "react";
import { useRBAC } from "@/lib/rbac/rbac-context";
import { notify } from "@/components/ui/toast";
import { SearchableSelect } from "@/components/ui";
import { PartyPicker } from "../party-picker";
import {
	BuyLinesEditor,
	FIELD,
	LABEL,
	buildIntakeItems,
	buyLineTotal,
	buyLineUnits,
	emptyBuyLine,
	fmt,
	useProcurementData,
	type BuyLine,
} from "../shared";

/**
 * How the bill is settled. "Credit" is the whole point of the split: goods can
 * come in against a supplier's ledger with nothing paid today, which the single
 * "paid in full" checkbox made look like an edge case rather than normal trade.
 */
type Terms = "full" | "part" | "credit";

const TERMS: { value: Terms; label: string; hint: string }[] = [
	{ value: "full", label: "Pay in full", hint: "Settled now, nothing owed" },
	{ value: "part", label: "Part payment", hint: "Pay some now, rest on account" },
	{ value: "credit", label: "Full credit", hint: "Nothing now, all on account" },
];

export default function BuyStockPage() {
	const { hasPermission } = useRBAC();
	const canRegister = hasPermission("customers:edit");

	const { products, warehouses, parties, warehouseId, setWarehouseId, refreshParties } =
		useProcurementData();

	const [buyFrom, setBuyFrom] = useState<"supplier" | "customer" | "walk_in">("supplier");
	const [partyId, setPartyId] = useState("");
	const [partyName, setPartyName] = useState("");
	const [lines, setLines] = useState<BuyLine[]>([emptyBuyLine()]);
	const [terms, setTerms] = useState<Terms>("full");
	const [paidNow, setPaidNow] = useState("");
	const [notes, setNotes] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const suppliers = useMemo(
		() => parties.filter((p) => p.party_type === "supplier"),
		[parties],
	);
	const customerParties = useMemo(
		() => parties.filter((p) => p.party_type === "customer"),
		[parties],
	);
	const partyList = buyFrom === "supplier" ? suppliers : customerParties;
	const selectedParty = useMemo(
		() => partyList.find((p) => p.id === partyId) || null,
		[partyList, partyId],
	);

	const total = useMemo(() => lines.reduce((sum, l) => sum + buyLineTotal(l), 0), [lines]);
	const units = useMemo(() => lines.reduce((sum, l) => sum + buyLineUnits(l), 0), [lines]);

	const paid =
		terms === "full" ? total : terms === "credit" ? 0 : Math.min(total, Number(paidNow) || 0);
	const onAccount = Math.max(0, Math.round((total - paid) * 100) / 100);

	// A walk-in has no ledger. A typed-in supplier name does get one, so an
	// unregistered supplier can still be bought from on credit.
	const creditNeedsParty = onAccount > 0 && buyFrom !== "supplier" && !selectedParty;
	const walkInOnCredit = onAccount > 0 && buyFrom === "walk_in";

	const resolvedName = selectedParty?.name || partyName;

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!warehouseId) {
			notify.warning("Choose the branch this stock is landing in.");
			return;
		}
		if (!resolvedName) {
			notify.warning("Say who these goods are coming from.");
			return;
		}
		if (creditNeedsParty) {
			notify.warning(
				"Part of this purchase is unpaid, so it has to be owed to a registered party. Pick one, register them, or pay in full.",
			);
			return;
		}

		const built = buildIntakeItems(lines);
		if ("error" in built) {
			notify.error(built.error);
			return;
		}

		setIsSubmitting(true);
		try {
			const res = await fetch("/api/v1/admin/inventory/purchases", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					type: "purchase",
					party_type: buyFrom,
					party_id: selectedParty?.id || undefined,
					party_name: resolvedName,
					warehouse_id: warehouseId,
					amount_paid: paid,
					notes,
					items: built.items,
				}),
			});
			const json = await res.json();

			if (json.success) {
				notify.success(json.message);
				setLines([emptyBuyLine()]);
				setNotes("");
				setPaidNow("");
				setTerms("full");
				refreshParties();
			} else {
				notify.error(json.error || "Purchase failed");
			}
		} catch {
			notify.error("Error recording the purchase");
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
				<h2 className="text-lg font-black text-zinc-900 dark:text-white">Receive Stock</h2>
				<p className="mt-0.5 text-xs text-zinc-500">
					Goods in, paid for now or carried on the supplier&rsquo;s account.
				</p>
			</div>

			<div className="grid grid-cols-1 gap-4 text-xs md:grid-cols-4">
				<div>
					<label className={LABEL}>Buying From *</label>
					<select
						value={buyFrom}
						onChange={(e) => {
							setBuyFrom(e.target.value as typeof buyFrom);
							setPartyId("");
						}}
						className={FIELD}
					>
						<option value="supplier">Supplier</option>
						<option value="customer">Registered customer / party</option>
						<option value="walk_in">Walk-in (not registered)</option>
					</select>
				</div>

				{buyFrom !== "walk_in" && (
					<PartyPicker
						side={buyFrom === "supplier" ? "supplier" : "customer"}
						parties={partyList}
						value={partyId}
						onChange={setPartyId}
						label={buyFrom === "supplier" ? "Registered Supplier" : "Registered Party"}
						emptyLabel={
							buyFrom === "supplier" ? "-- One-off / not registered --" : "-- Choose --"
						}
						canRegister={canRegister}
						onRegistered={refreshParties}
						required={creditNeedsParty}
					/>
				)}

				<div>
					<label className={LABEL}>{selectedParty ? "Name (from record)" : "Name *"}</label>
					<input
						type="text"
						value={selectedParty?.name || partyName}
						onChange={(e) => setPartyName(e.target.value)}
						disabled={!!selectedParty}
						placeholder="e.g. Star Tech Supply / Rahim Uddin"
						className={`${FIELD} disabled:opacity-60`}
					/>
				</div>

				<div>
					<label className={LABEL}>Destination Branch *</label>
					<SearchableSelect
						options={warehouses.map((w) => ({ value: w.id, label: w.name, hint: w.code }))}
						value={warehouseId}
						onChange={setWarehouseId}
						placeholder="Search branches…"
						aria-label="Destination branch"
					/>
				</div>
			</div>

			<BuyLinesEditor
				lines={lines}
				setLines={setLines}
				products={products}
				costLabel="Price Paid Per Unit"
			/>

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
								if (option.value !== "part") setPaidNow("");
							}}
							aria-pressed={terms === option.value}
							className={`rounded-xl border p-3 text-left transition-all ${
								terms === option.value
									? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
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
							value={paidNow}
							onChange={(e) => setPaidNow(e.target.value)}
							placeholder={`Up to ${fmt(total)}`}
							className={FIELD}
						/>
					</div>
				)}

				{onAccount > 0 && (
					<p className="font-bold text-zinc-500">
						{buyFrom === "customer" && selectedParty
							? `${fmt(onAccount)} will be credited to ${selectedParty.name} — set against the ${fmt(selectedParty.balance)} they owe first, the rest held as credit.`
							: `${fmt(onAccount)} will be left owed to ${resolvedName || "them"}.`}
					</p>
				)}

				{walkInOnCredit && (
					<p className="font-bold text-amber-600">
						A walk-in has no account to owe against. Pay in full, or switch
						&ldquo;Buying From&rdquo; to a registered party.
					</p>
				)}
			</div>

			<div className="text-xs">
				<label className={LABEL}>Notes / Bill Ref</label>
				<input
					type="text"
					value={notes}
					onChange={(e) => setNotes(e.target.value)}
					placeholder="e.g. Invoice #DXB-994, or condition notes on a used device"
					className={FIELD}
				/>
			</div>

			<div className="space-y-1 rounded-xl bg-zinc-100 p-3 text-xs font-bold dark:bg-zinc-800">
				<div className="flex items-center justify-between">
					<span>
						{lines.length} line(s) · {units} unit(s) — Total:
					</span>
					<span className="text-sm font-black text-blue-600">{fmt(total)}</span>
				</div>
				{paid > 0 && onAccount > 0 && (
					<div className="flex items-center justify-between text-emerald-600">
						<span>Paid now:</span>
						<span>{fmt(paid)}</span>
					</div>
				)}
				{onAccount > 0 && (
					<div className="flex items-center justify-between text-amber-600">
						<span>On account:</span>
						<span>{fmt(onAccount)}</span>
					</div>
				)}
			</div>

			<button
				type="submit"
				disabled={isSubmitting || walkInOnCredit || creditNeedsParty}
				className="w-full rounded-xl bg-blue-600 py-3 text-xs font-black text-white shadow-lg shadow-blue-600/30 transition-all hover:bg-blue-700 disabled:opacity-50"
			>
				{isSubmitting
					? "Recording…"
					: onAccount > 0
						? `Receive Stock — ${fmt(onAccount)} on credit`
						: "Receive Stock"}
			</button>
		</form>
	);
}

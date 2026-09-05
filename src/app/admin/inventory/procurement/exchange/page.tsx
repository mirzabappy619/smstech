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
	SellLinesEditor,
	buildIntakeItems,
	buyLineTotal,
	emptyBuyLine,
	emptySellLine,
	fmt,
	sellLineTotal,
	useProcurementData,
	type BuyLine,
	type SellLine,
} from "../shared";

export default function ExchangePage() {
	const { hasPermission } = useRBAC();
	const canRegister = hasPermission("customers:edit");

	const { products, warehouses, parties, warehouseId, setWarehouseId, refreshParties } =
		useProcurementData();

	const [partyId, setPartyId] = useState("");
	const [partyName, setPartyName] = useState("");
	const [partyPhone, setPartyPhone] = useState("");
	const [inLines, setInLines] = useState<BuyLine[]>([emptyBuyLine()]);
	const [outLines, setOutLines] = useState<SellLine[]>([emptySellLine()]);
	const [collectedNow, setCollectedNow] = useState("");
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

	const tradeIn = useMemo(() => inLines.reduce((sum, l) => sum + buyLineTotal(l), 0), [inLines]);
	const goodsOut = useMemo(
		() => outLines.reduce((sum, l) => sum + sellLineTotal(l), 0),
		[outLines],
	);

	const net = Math.round((goodsOut - tradeIn) * 100) / 100;
	const collected = net > 0 ? Math.min(Number(collectedNow) || 0, net) : 0;
	const due = net > 0 ? Math.round((net - collected) * 100) / 100 : 0;
	const shopOwes = net < 0 ? Math.abs(net) : 0;

	const headroom = selectedParty ? selectedParty.credit_limit - selectedParty.balance : 0;
	const overLimit = due > 0 && selectedParty !== null && due > headroom + 0.01;
	// Either side of the balance has to land on somebody's ledger.
	const needsParty = (due > 0 || shopOwes > 0) && !selectedParty;

	const resolvedName = selectedParty?.name || partyName;

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!resolvedName) {
			notify.warning("Say who is trading in.");
			return;
		}
		if (!warehouseId) {
			notify.warning("Choose the branch.");
			return;
		}
		if (needsParty) {
			notify.warning(
				due > 0
					? "The balance after the trade-in is unpaid, so it has to be owed by a registered party."
					: "The trade-in is worth more than the goods going out, so the difference has to be credited to a registered party.",
			);
			return;
		}
		if (overLimit) {
			notify.warning(
				`That balance is over ${selectedParty?.name}'s remaining credit of ${fmt(headroom)}.`,
			);
			return;
		}

		const built = buildIntakeItems(inLines);
		if ("error" in built) {
			notify.error(`Trade-in ${built.error.charAt(0).toLowerCase()}${built.error.slice(1)}`);
			return;
		}

		const sellItems = [];
		for (const [index, line] of outLines.entries()) {
			const position = `Outgoing line ${index + 1}`;
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
			sellItems.push({
				product_id: line.product_id,
				product_name: products.find((p) => p.id === line.product_id)?.name || "Exchange item",
				quantity,
				unit_price: unitPrice,
			});
		}

		setIsSubmitting(true);
		try {
			const res = await fetch("/api/v1/admin/inventory/purchases", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					type: "exchange",
					party_type: selectedParty ? "customer" : "walk_in",
					party_id: selectedParty?.id || undefined,
					party_name: resolvedName,
					party_phone: selectedParty?.phone || partyPhone || undefined,
					warehouse_id: warehouseId,
					amount_paid: collected,
					notes,
					items: built.items,
					sell_items: sellItems,
				}),
			});
			const json = await res.json();

			if (json.success) {
				notify.success(json.message);
				setInLines([emptyBuyLine()]);
				setOutLines([emptySellLine()]);
				setCollectedNow("");
				setNotes("");
				setPartyName("");
				setPartyPhone("");
				setPartyId("");
				refreshParties();
			} else {
				notify.error(json.error || "Exchange failed");
			}
		} catch {
			notify.error("Error recording the exchange");
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
				<h2 className="text-lg font-black text-zinc-900 dark:text-white">Part-Exchange</h2>
				<p className="mt-0.5 text-xs text-zinc-500">
					The customer&rsquo;s device is valued and set against what they are buying. Only
					the difference changes hands.
				</p>
			</div>

			<div className="grid grid-cols-1 gap-4 text-xs md:grid-cols-4">
				<PartyPicker
					side="customer"
					parties={customerParties}
					value={partyId}
					onChange={setPartyId}
					label="Registered Party"
					emptyLabel="-- Walk-in (not registered) --"
					canRegister={canRegister}
					onRegistered={refreshParties}
					required={needsParty}
				/>

				<div>
					<label className={LABEL}>
						{selectedParty ? "Customer (from record)" : "Customer Name *"}
					</label>
					<input
						type="text"
						value={selectedParty?.name || partyName}
						onChange={(e) => setPartyName(e.target.value)}
						disabled={!!selectedParty}
						placeholder="e.g. Rahim Uddin"
						className={`${FIELD} disabled:opacity-60`}
					/>
				</div>

				{!selectedParty && (
					<div>
						<label className={LABEL}>Phone</label>
						<input
							type="text"
							value={partyPhone}
							onChange={(e) => setPartyPhone(e.target.value)}
							placeholder="01XXXXXXXXX"
							className={FIELD}
						/>
					</div>
				)}

				<div>
					<label className={LABEL}>Branch *</label>
					<SearchableSelect
						options={warehouses.map((w) => ({ value: w.id, label: w.name, hint: w.code }))}
						value={warehouseId}
						onChange={setWarehouseId}
						placeholder="Search branches…"
						aria-label="Branch"
					/>
				</div>
			</div>

			<div className="space-y-3">
				<h3 className="text-xs font-black uppercase tracking-wider text-amber-600">
					Taken in — the customer&rsquo;s device(s)
				</h3>
				<BuyLinesEditor
					lines={inLines}
					setLines={setInLines}
					products={products}
					costLabel="Trade-In Value Per Unit"
				/>
			</div>

			<div className="space-y-3">
				<h3 className="text-xs font-black uppercase tracking-wider text-emerald-600">
					Going out — what they are buying
				</h3>
				<SellLinesEditor lines={outLines} setLines={setOutLines} products={products} />
			</div>

			{net > 0 && (
				<div className="space-y-3 rounded-xl border border-zinc-200 p-4 text-xs dark:border-zinc-800">
					<div className="max-w-xs">
						<label className={LABEL}>Collected Now (BDT)</label>
						<input
							type="number"
							min={0}
							max={net}
							value={collectedNow}
							onChange={(e) => setCollectedNow(e.target.value)}
							placeholder={`Up to ${fmt(net)}`}
							className={FIELD}
						/>
					</div>
					{due > 0 && selectedParty && (
						<p className={`font-bold ${overLimit ? "text-rose-600" : "text-zinc-500"}`}>
							{fmt(due)} will be left on {selectedParty.name}&rsquo;s account —{" "}
							{fmt(headroom)} of credit available.
							{overLimit && " That is over their limit."}
						</p>
					)}
				</div>
			)}

			{shopOwes > 0 && (
				<p className="rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-600 dark:bg-amber-950/30">
					The trade-in is worth {fmt(shopOwes)} more than the goods going out. That
					difference is credited to the customer&rsquo;s account — clearing anything they
					owe first — so it needs a registered party.
				</p>
			)}

			<div className="text-xs">
				<label className={LABEL}>Exchange Notes</label>
				<input
					type="text"
					value={notes}
					onChange={(e) => setNotes(e.target.value)}
					placeholder="e.g. Screen has a hairline crack, box and charger included"
					className={FIELD}
				/>
			</div>

			<div className="space-y-1 rounded-xl bg-zinc-100 p-3 text-xs font-bold dark:bg-zinc-800">
				<div className="flex items-center justify-between text-emerald-600">
					<span>Goods going out:</span>
					<span>{fmt(goodsOut)}</span>
				</div>
				<div className="flex items-center justify-between text-amber-600">
					<span>Trade-in allowance:</span>
					<span>− {fmt(tradeIn)}</span>
				</div>
				<div className="flex items-center justify-between border-t border-zinc-300 pt-1 dark:border-zinc-700">
					<span>{net >= 0 ? "Customer pays:" : "Shop owes customer:"}</span>
					<span className="text-sm font-black text-blue-600">{fmt(Math.abs(net))}</span>
				</div>
				{due > 0 && (
					<div className="flex items-center justify-between text-rose-600">
						<span>Of which on credit:</span>
						<span>{fmt(due)}</span>
					</div>
				)}
			</div>

			<button
				type="submit"
				disabled={isSubmitting || overLimit || needsParty}
				className="w-full rounded-xl bg-amber-600 py-3 text-xs font-black text-white shadow-lg shadow-amber-600/30 transition-all hover:bg-amber-700 disabled:opacity-50"
			>
				{isSubmitting ? "Recording…" : "Record Exchange"}
			</button>
		</form>
	);
}

"use client";

/**
 * Choosing — or registering — whoever is on the other side of the trade.
 *
 * Credit is the reason this exists. Anything left unpaid has to be owed to or
 * by somebody the shop can look up later, so the screens used to refuse a
 * credit purchase or a due sale and send the user off to Customer Management
 * to create the record, losing the half-filled form on the way. The dialog
 * here registers the party in place and selects them.
 */

import { useState } from "react";
import { notify } from "@/components/ui/toast";
import { SearchableSelect } from "@/components/ui";
import { FIELD, LABEL, fmt, type PartyOption } from "./shared";

type PartySide = "customer" | "supplier";

/** What a party owes, or is owed, rendered as the second line of an option. */
function balanceHint(party: PartyOption): string {
	const bits: string[] = [];
	if (party.code) bits.push(party.code);
	if (party.phone) bits.push(party.phone);

	if (party.balance > 0) {
		bits.push(party.party_type === "supplier" ? `owed ${fmt(party.balance)}` : `owes ${fmt(party.balance)}`);
	}
	if (party.advance_balance > 0) bits.push(`${fmt(party.advance_balance)} on account`);
	if (party.party_type === "customer" && party.credit_limit > 0) {
		bits.push(`${fmt(Math.max(0, party.credit_limit - party.balance))} credit left`);
	}

	return bits.join(" · ");
}

export function partyOptions(parties: PartyOption[]) {
	return parties.map((p) => ({
		value: p.id,
		label: p.company_name ? `${p.name} (${p.company_name})` : p.name,
		hint: balanceHint(p),
		keywords: `${p.code ?? ""} ${p.phone ?? ""} ${p.company_name ?? ""}`,
	}));
}

interface PickerProps {
	side: PartySide;
	parties: PartyOption[];
	value: string;
	onChange: (id: string) => void;
	label: string;
	emptyLabel: string;
	/** Whether the signed-in user may create parties. */
	canRegister: boolean;
	onRegistered: () => Promise<void> | void;
	/** Surfaced when credit is in play and no party is chosen. */
	required?: boolean;
}

export function PartyPicker({
	side,
	parties,
	value,
	onChange,
	label,
	emptyLabel,
	canRegister,
	onRegistered,
	required,
}: PickerProps) {
	const [dialogOpen, setDialogOpen] = useState(false);

	return (
		<div>
			<div className="flex items-baseline justify-between gap-2">
				<label className={LABEL}>{label}</label>
				{canRegister && (
					<button
						type="button"
						onClick={() => setDialogOpen(true)}
						className="mb-1 text-[11px] font-black text-blue-600 hover:text-blue-700"
					>
						+ New {side}
					</button>
				)}
			</div>

			<SearchableSelect
				options={partyOptions(parties)}
				value={value}
				onChange={onChange}
				emptyLabel={emptyLabel}
				placeholder="Type a name, code or phone…"
				aria-label={label}
			/>

			{required && !value && (
				<p className="mt-1 text-[11px] font-bold text-amber-600">
					Credit has to be owed by someone on file.
					{canRegister
						? " Pick a party above, or register one."
						: " Pick a party above."}
				</p>
			)}

			{dialogOpen && (
				<NewPartyDialog
					side={side}
					onClose={() => setDialogOpen(false)}
					onCreated={async (id) => {
						await onRegistered();
						onChange(id);
						setDialogOpen(false);
					}}
				/>
			)}
		</div>
	);
}

interface DialogProps {
	side: PartySide;
	onClose: () => void;
	onCreated: (id: string) => void | Promise<void>;
}

export function NewPartyDialog({ side, onClose, onCreated }: DialogProps) {
	const [form, setForm] = useState({
		name: "",
		company_name: "",
		phone: "",
		email: "",
		address: "",
		credit_limit: "",
		opening_balance: "",
		customer_type: "retail" as "retail" | "wholesale",
	});
	const [saving, setSaving] = useState(false);

	const set = (key: keyof typeof form) => (value: string) =>
		setForm((prev) => ({ ...prev, [key]: value }));

	const submit = async (event: React.FormEvent) => {
		event.preventDefault();

		if (!form.name.trim()) {
			notify.warning("Give the party a name.");
			return;
		}
		if (!form.phone.trim()) {
			notify.warning("A contact number is required — it is how a due gets chased.");
			return;
		}

		setSaving(true);
		try {
			const res = await fetch("/api/v1/admin/parties", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					party_type: side,
					name: form.name,
					company_name: form.company_name || undefined,
					phone: form.phone,
					email: form.email || undefined,
					address: form.address || undefined,
					credit_limit: form.credit_limit || 0,
					opening_balance: form.opening_balance || 0,
					...(side === "customer" ? { customer_type: form.customer_type } : {}),
				}),
			});
			const json = await res.json();

			if (json.success && json.data?.id) {
				notify.success(`${json.data.name} registered.`);
				await onCreated(json.data.id);
			} else {
				notify.error(json.error || `Could not register that ${side}`);
			}
		} catch {
			notify.error(`Could not register that ${side}`);
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
			<form
				onSubmit={submit}
				className="w-full max-w-md space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
			>
				<div className="flex items-start justify-between gap-3">
					<div>
						<h2 className="text-lg font-black text-zinc-900 dark:text-white">
							New {side}
						</h2>
						<p className="text-xs text-zinc-500">
							{side === "supplier"
								? "Registered so an unpaid bill has a ledger to sit against."
								: "Registered so a due has an account to sit against."}
						</p>
					</div>
					<button
						type="button"
						onClick={onClose}
						aria-label="Close"
						className="font-bold text-zinc-400 hover:text-zinc-600"
					>
						✕
					</button>
				</div>

				<div className="space-y-3 text-xs">
					<div>
						<label className={LABEL}>Name *</label>
						<input
							autoFocus
							value={form.name}
							onChange={(e) => set("name")(e.target.value)}
							placeholder={side === "supplier" ? "e.g. Star Tech Supply" : "e.g. Rahim Uddin"}
							className={FIELD}
						/>
					</div>

					<div className="grid grid-cols-2 gap-3">
						<div>
							<label className={LABEL}>Phone *</label>
							<input
								value={form.phone}
								onChange={(e) => set("phone")(e.target.value)}
								placeholder="01XXXXXXXXX"
								className={FIELD}
							/>
						</div>
						<div>
							<label className={LABEL}>
								{side === "supplier" ? "Opening balance owed" : "Credit limit"}
							</label>
							<input
								type="number"
								min={0}
								value={side === "supplier" ? form.opening_balance : form.credit_limit}
								onChange={(e) =>
									set(side === "supplier" ? "opening_balance" : "credit_limit")(e.target.value)
								}
								placeholder="0"
								className={FIELD}
							/>
						</div>
					</div>

					<div className="grid grid-cols-2 gap-3">
						<div>
							<label className={LABEL}>Company</label>
							<input
								value={form.company_name}
								onChange={(e) => set("company_name")(e.target.value)}
								placeholder="Optional"
								className={FIELD}
							/>
						</div>
						{side === "customer" ? (
							<div>
								<label className={LABEL}>Account type</label>
								<select
									value={form.customer_type}
									onChange={(e) =>
										setForm((prev) => ({
											...prev,
											customer_type: e.target.value as "retail" | "wholesale",
										}))
									}
									className={FIELD}
								>
									<option value="retail">Retail</option>
									<option value="wholesale">Wholesale</option>
								</select>
							</div>
						) : (
							<div>
								<label className={LABEL}>Email</label>
								<input
									type="email"
									value={form.email}
									onChange={(e) => set("email")(e.target.value)}
									placeholder="Optional"
									className={FIELD}
								/>
							</div>
						)}
					</div>

					<div>
						<label className={LABEL}>Address</label>
						<input
							value={form.address}
							onChange={(e) => set("address")(e.target.value)}
							placeholder="Optional"
							className={FIELD}
						/>
					</div>
				</div>

				<div className="flex gap-2 pt-1">
					<button
						type="button"
						onClick={onClose}
						className="flex-1 rounded-xl border border-zinc-300 py-2 text-xs font-bold text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={saving}
						className="flex-1 rounded-xl bg-blue-600 py-2 text-xs font-black text-white hover:bg-blue-700 disabled:opacity-50"
					>
						{saving ? "Registering…" : "Register & select"}
					</button>
				</div>
			</form>
		</div>
	);
}

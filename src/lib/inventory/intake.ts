/**
 * Bringing goods into stock.
 *
 * One path for everything the shop receives — a supplier batch, a device
 * bought over the counter, a unit taken in part-exchange — so provenance,
 * warranty terms and duplicate-serial checks work the same however the goods
 * arrived. Serialized lines become `device_units`; bulk lines go through
 * `apply_stock_movement` against the pooled inventory row.
 */

import {
	DEFAULT_WARRANTY_MONTHS,
	MAX_WARRANTY_MONTHS,
	parseWarrantyMonths,
} from "@/lib/warranty";
import type { TradePartyType } from "@/lib/trade";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = any;

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface SerialInput {
	serial: string;
	imei1?: string | null;
	imei2?: string | null;
	battery_health?: number | string | null;
	cycles?: number | string | null;
	grade?: string | null;
	variant?: string | null;
}

export interface SerialLine {
	product_id: string;
	unit_cost: number;
	selling_price: number;
	warranty_months: number;
	serials: SerialInput[];
}

export interface BulkLine {
	product_id: string;
	variation_id: string | null;
	quantity: number;
	unit_cost: number;
}

export interface IntakeLines {
	serialLines: SerialLine[];
	bulkLines: BulkLine[];
	total: number;
	unitCount: number;
}

/** Who the goods came from, recorded on every unit taken in. */
export interface Acquisition {
	from_type: TradePartyType;
	party_id?: string | null;
	party_name?: string | null;
	reference: string;
	/** Set when the unit arrived against a part-exchange sale. */
	order_id?: string | null;
}

/**
 * Validates every line before anything is written. Returns an error message
 * rather than throwing, so the caller decides the status code.
 */
export function validateIntakeLines(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	items: any[],
): { error: string } | { value: IntakeLines } {
	if (!Array.isArray(items) || items.length === 0) {
		return { error: "At least one line item is required." };
	}

	const serialLines: SerialLine[] = [];
	const bulkLines: BulkLine[] = [];
	let total = 0;
	let unitCount = 0;

	for (const it of items) {
		if (!it.product_id) {
			return { error: "Every line needs a product." };
		}

		const unitCost = Number(it.unit_cost);
		if (!Number.isFinite(unitCost) || unitCost < 0) {
			return { error: "Every line needs a valid unit cost." };
		}

		if (it.serial_numbers && Array.isArray(it.serial_numbers)) {
			if (it.serial_numbers.length === 0) {
				return { error: "A serialized line needs at least one serial number." };
			}

			const sellingPrice = Number(it.selling_price);
			if (!Number.isFinite(sellingPrice) || sellingPrice <= 0) {
				return {
					error:
						"Serialized lines need an explicit selling price — it is no longer guessed from cost.",
				};
			}

			const serials: SerialInput[] = it.serial_numbers.map(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				(sn: any) => (typeof sn === "string" ? { serial: sn } : sn),
			);

			for (const sn of serials) {
				if (!sn.serial || !String(sn.serial).trim()) {
					return { error: "Every serialized unit needs a serial number." };
				}
				if (
					sn.battery_health !== undefined &&
					sn.battery_health !== null &&
					sn.battery_health !== ""
				) {
					const bh = Number(sn.battery_health);
					if (!Number.isFinite(bh) || bh < 0 || bh > 100) {
						return {
							error: `Battery health for ${sn.serial} must be between 0 and 100.`,
						};
					}
				}
			}

			// One term covers the whole line — a batch of the same model from
			// the same source carries the same warranty.
			const lineWarranty =
				it.warranty_months === undefined ||
				it.warranty_months === null ||
				it.warranty_months === ""
					? DEFAULT_WARRANTY_MONTHS
					: parseWarrantyMonths(it.warranty_months);
			if (lineWarranty === null) {
				return {
					error: `Warranty must be a whole number of months between 0 and ${MAX_WARRANTY_MONTHS}.`,
				};
			}

			serialLines.push({
				product_id: it.product_id,
				unit_cost: unitCost,
				selling_price: sellingPrice,
				warranty_months: lineWarranty,
				serials,
			});
			total += unitCost * serials.length;
			unitCount += serials.length;
		} else {
			const quantity = Number(it.quantity);
			if (!Number.isInteger(quantity) || quantity < 1) {
				return { error: "Bulk lines need a whole quantity of 1 or more." };
			}
			bulkLines.push({
				product_id: it.product_id,
				variation_id: it.variation_id || null,
				quantity,
				unit_cost: unitCost,
			});
			total += unitCost * quantity;
			unitCount += quantity;
		}
	}

	// A serial appearing twice is one device counted twice.
	const allSerials = serialLines.flatMap((l) =>
		l.serials.map((s) => String(s.serial).trim()),
	);
	const dupInBatch = allSerials.find((s, i) => allSerials.indexOf(s) !== i);
	if (dupInBatch) {
		return { error: `Serial "${dupInBatch}" appears twice in this batch.` };
	}

	return {
		value: { serialLines, bulkLines, total: round2(total), unitCount },
	};
}

/** Serials already on the books, which must never be taken in a second time. */
export async function findExistingSerials(
	supabase: Supabase,
	lines: IntakeLines,
): Promise<string[]> {
	const allSerials = lines.serialLines.flatMap((l) =>
		l.serials.map((s) => String(s.serial).trim()),
	);
	if (allSerials.length === 0) return [];

	const { data } = await supabase
		.from("device_units")
		.select("serial_number")
		.in("serial_number", allSerials);

	return (data || []).map((row: { serial_number: string }) => row.serial_number);
}

/**
 * Writes validated lines into stock. Throws on the first failure so the caller
 * can roll the surrounding transaction back — it does not clean up after
 * itself.
 */
export async function writeIntakeLines(
	supabase: Supabase,
	options: {
		lines: IntakeLines;
		warehouseId: string;
		acquisition: Acquisition;
		movementReason?: string;
	},
): Promise<{ createdUnitIds: string[] }> {
	const { lines, warehouseId, acquisition } = options;
	const reason = options.movementReason || `Intake ${acquisition.reference}`;
	const createdUnitIds: string[] = [];

	for (const line of lines.serialLines) {
		const rows = line.serials.map((sn) => ({
			product_id: line.product_id,
			warehouse_id: warehouseId,
			serial_number: String(sn.serial).trim(),
			imei_1: sn.imei1 || null,
			imei_2: sn.imei2 || null,
			battery_health_pct:
				sn.battery_health !== undefined &&
				sn.battery_health !== null &&
				sn.battery_health !== ""
					? Number(sn.battery_health)
					: 100,
			battery_cycles: Number(sn.cycles) || 0,
			cosmetic_grade: sn.grade || "Brand New",
			regional_variant: sn.variant || "Official",
			cost_price: line.unit_cost,
			selling_price: line.selling_price,
			status: "in_stock",
			// Term only; the clock starts when the unit is sold.
			warranty_months: line.warranty_months,
			acquired_from_type: acquisition.from_type,
			acquired_from_party_id: acquisition.party_id || null,
			acquired_from_name: acquisition.party_name || null,
			acquired_order_id: acquisition.order_id || null,
			acquisition_ref: acquisition.reference,
		}));

		const { data: inserted, error } = await supabase
			.from("device_units")
			.insert(rows)
			.select("id");

		if (error) throw error;
		for (const row of inserted || []) createdUnitIds.push(row.id);
	}

	for (const line of lines.bulkLines) {
		const { error } = await supabase.rpc("apply_stock_movement", {
			p_product_id: line.product_id,
			p_variation_id: line.variation_id,
			p_warehouse_id: warehouseId,
			p_delta: line.quantity,
			p_adjustment_type: "purchase",
			p_reason: reason,
			p_order_id: acquisition.order_id || null,
			p_user_id: null,
			p_allow_negative: false,
		});
		if (error) throw error;
	}

	return { createdUnitIds };
}

/**
 * Records the bill for an intake, and links the units received to it.
 *
 * Sales leave an order behind; a purchase left nothing, so nothing could list
 * what had been bought. This is written by every intake path — supplier batch,
 * counter purchase, part-exchange — so the purchase history is complete rather
 * than reconstructed from ledger lines that only exist when a bill went unpaid.
 */
export async function writePurchaseBill(
	supabase: Supabase,
	options: {
		lines: IntakeLines;
		warehouseId: string;
		acquisition: Acquisition;
		amountPaid: number;
		dueAmount: number;
		createdUnitIds: string[];
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		productNames?: Map<string, string>;
		notes?: string | null;
		createdBy?: string | null;
	},
): Promise<{ id: string; bill_number: string } | null> {
	const { lines, acquisition, createdUnitIds } = options;

	const { data: bill, error } = await supabase
		.from("purchase_bills")
		.insert({
			bill_number: acquisition.reference,
			party_type: acquisition.from_type,
			party_id: acquisition.party_id || null,
			party_name: acquisition.party_name || "Unknown",
			warehouse_id: options.warehouseId,
			subtotal: lines.total,
			amount_paid: round2(options.amountPaid),
			due_amount: round2(options.dueAmount),
			unit_count: lines.unitCount,
			exchange_order_id: acquisition.order_id || null,
			notes: options.notes || null,
			created_by: options.createdBy || null,
		})
		.select("id, bill_number")
		.single();

	if (error) throw error;

	const nameFor = (productId: string) =>
		options.productNames?.get(productId) || "Item";

	const items = [
		...lines.serialLines.map((line) => ({
			bill_id: bill.id,
			product_id: line.product_id,
			variation_id: null,
			product_name: nameFor(line.product_id),
			is_serialized: true,
			quantity: line.serials.length,
			unit_cost: line.unit_cost,
			line_total: round2(line.unit_cost * line.serials.length),
		})),
		...lines.bulkLines.map((line) => ({
			bill_id: bill.id,
			product_id: line.product_id,
			variation_id: line.variation_id,
			product_name: nameFor(line.product_id),
			is_serialized: false,
			quantity: line.quantity,
			unit_cost: line.unit_cost,
			line_total: round2(line.unit_cost * line.quantity),
		})),
	];

	if (items.length > 0) {
		const { error: itemErr } = await supabase.from("purchase_bill_items").insert(items);
		if (itemErr) throw itemErr;
	}

	if (createdUnitIds.length > 0) {
		await supabase
			.from("device_units")
			.update({ purchase_bill_id: bill.id })
			.in("id", createdUnitIds);
	}

	return bill;
}

/** Product names for the bill lines, so a later rename cannot rewrite history. */
export async function fetchProductNames(
	supabase: Supabase,
	lines: IntakeLines,
): Promise<Map<string, string>> {
	const ids = [
		...new Set([
			...lines.serialLines.map((l) => l.product_id),
			...lines.bulkLines.map((l) => l.product_id),
		]),
	];
	if (ids.length === 0) return new Map();

	const { data } = await supabase.from("products").select("id, name").in("id", ids);
	return new Map((data || []).map((p: { id: string; name: string }) => [p.id, p.name]));
}

/** Undoes `writeIntakeLines` when a later step of the same operation fails. */
export async function reverseIntakeLines(
	supabase: Supabase,
	options: {
		lines: IntakeLines;
		warehouseId: string;
		createdUnitIds: string[];
		reference: string;
	},
): Promise<void> {
	const { lines, warehouseId, createdUnitIds, reference } = options;

	if (createdUnitIds.length > 0) {
		await supabase.from("device_units").delete().in("id", createdUnitIds);
	}

	for (const line of lines.bulkLines) {
		await supabase.rpc("apply_stock_movement", {
			p_product_id: line.product_id,
			p_variation_id: line.variation_id,
			p_warehouse_id: warehouseId,
			p_delta: -line.quantity,
			p_adjustment_type: "adjustment",
			p_reason: `Reversal of failed intake ${reference}`,
			p_order_id: null,
			p_user_id: null,
			p_allow_negative: true,
		});
	}
}

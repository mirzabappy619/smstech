/**
 * Tests for buying and exchanging.
 *
 * The rule that matters here: when the shop owes a customer money, anything
 * that person already owes gets cleared first. Handing back cash while an
 * invoice of theirs is outstanding is how a debt quietly disappears.
 */
import { describe, it, expect } from "vitest";
import {
	adHocSupplierId,
	applyCreditToCustomer,
	settleExchange,
	settlePurchase,
	validateTradeInValue,
} from "@/lib/trade";
import { validateIntakeLines } from "@/lib/inventory/intake";

describe("Crediting a customer", () => {
	it("clears what they owe before anything becomes store credit", () => {
		const applied = applyCreditToCustomer(10000, 4000, 0);
		expect(applied.applied_to_due).toBe(4000);
		expect(applied.to_advance).toBe(6000);
		expect(applied.new_due).toBe(0);
		expect(applied.new_advance).toBe(6000);
	});

	it("puts the whole amount against the due when the due is larger", () => {
		const applied = applyCreditToCustomer(3000, 8000, 0);
		expect(applied.applied_to_due).toBe(3000);
		expect(applied.to_advance).toBe(0);
		expect(applied.new_due).toBe(5000);
	});

	it("adds to existing credit when they owe nothing", () => {
		const applied = applyCreditToCustomer(2500, 0, 1000);
		expect(applied.applied_to_due).toBe(0);
		expect(applied.new_advance).toBe(3500);
	});

	it("treats missing balances as zero", () => {
		const applied = applyCreditToCustomer(500, null, undefined);
		expect(applied.new_advance).toBe(500);
		expect(applied.new_due).toBe(0);
	});
});

describe("Settling a purchase", () => {
	it("leaves the unpaid remainder on the party's account", () => {
		const result = settlePurchase(50000, 20000);
		expect("value" in result && result.value).toEqual({
			total: 50000,
			paid_now: 20000,
			on_account: 30000,
		});
	});

	it("puts the whole bill on account when nothing is handed over", () => {
		const result = settlePurchase(50000, "");
		expect("value" in result && result.value.on_account).toBe(50000);
	});

	it("settles fully when the whole amount is paid", () => {
		const result = settlePurchase(50000, 50000);
		expect("value" in result && result.value.on_account).toBe(0);
	});

	it("refuses paying more than the goods are worth", () => {
		expect(settlePurchase(50000, 60000)).toHaveProperty("error");
	});

	it("refuses a negative payment", () => {
		expect(settlePurchase(50000, -1)).toHaveProperty("error");
	});
});

describe("Settling an exchange", () => {
	it("collects only the difference when the new item costs more", () => {
		const result = settleExchange(95000, 40000, 55000);
		expect("value" in result && result.value).toMatchObject({
			net: 55000,
			customer_pays: 55000,
			customer_due: 0,
			shop_owes: 0,
			direction: "customer_pays",
		});
	});

	it("leaves the uncollected difference as a due", () => {
		const result = settleExchange(95000, 40000, 20000);
		expect("value" in result && result.value.customer_due).toBe(35000);
	});

	it("owes the customer back when the trade-in is worth more", () => {
		const result = settleExchange(40000, 55000, 0);
		expect("value" in result && result.value).toMatchObject({
			shop_owes: 15000,
			customer_pays: 0,
			customer_due: 0,
			direction: "shop_pays",
		});
	});

	it("settles to nothing when the two sides are equal", () => {
		const result = settleExchange(50000, 50000, 0);
		expect("value" in result && result.value.direction).toBe("even");
		expect("value" in result && result.value.shop_owes).toBe(0);
	});

	it("refuses collecting more than the post-trade-in balance", () => {
		// Taking 95,000 when only 55,000 is payable would silently overcharge.
		const result = settleExchange(95000, 40000, 95000);
		expect(result).toHaveProperty("error");
	});

	it("refuses a negative valuation on either side", () => {
		expect(settleExchange(-1, 100, 0)).toHaveProperty("error");
		expect(settleExchange(100, -1, 0)).toHaveProperty("error");
	});
});

describe("Valuing a device taken in", () => {
	it("requires a figure rather than defaulting to nothing", () => {
		expect(validateTradeInValue("")).toHaveProperty("error");
		expect(validateTradeInValue(undefined)).toHaveProperty("error");
	});

	it("refuses paying more for a device than it would resell for", () => {
		expect(validateTradeInValue(50000, 45000)).toHaveProperty("error");
		expect(validateTradeInValue(40000, 45000)).toEqual({ value: 40000 });
	});

	it("allows a zero valuation, which is a giveaway not an error", () => {
		expect(validateTradeInValue(0, 45000)).toEqual({ value: 0 });
	});
});

describe("Ad-hoc supplier identity", () => {
	it("gives one unregistered name a stable ledger bucket", () => {
		expect(adHocSupplierId("Star Tech")).toBe(adHocSupplierId("Star Tech"));
	});

	it("produces a usable uuid", () => {
		expect(adHocSupplierId("Star Tech")).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
		);
	});
});

describe("Intake lines", () => {
	const serialLine = {
		product_id: "p1",
		unit_cost: 40000,
		selling_price: 55000,
		serial_numbers: [{ serial: "SN1" }, { serial: "SN2" }],
	};

	it("totals serialized lines by unit count", () => {
		const result = validateIntakeLines([serialLine]);
		expect("value" in result && result.value.total).toBe(80000);
		expect("value" in result && result.value.unitCount).toBe(2);
	});

	it("totals bulk lines by quantity", () => {
		const result = validateIntakeLines([
			{ product_id: "p1", unit_cost: 1000, quantity: 5 },
		]);
		expect("value" in result && result.value.total).toBe(5000);
		expect("value" in result && result.value.unitCount).toBe(5);
	});

	it("catches the same serial entered twice in one batch", () => {
		const result = validateIntakeLines([
			{ ...serialLine, serial_numbers: [{ serial: "SN1" }, { serial: "SN1" }] },
		]);
		expect(result).toHaveProperty("error");
	});

	it("catches a duplicate across two lines of the same batch", () => {
		const result = validateIntakeLines([serialLine, serialLine]);
		expect(result).toHaveProperty("error");
	});

	it("requires a selling price on serialized lines", () => {
		const { selling_price, ...withoutPrice } = serialLine;
		void selling_price;
		expect(validateIntakeLines([withoutPrice])).toHaveProperty("error");
	});

	it("rejects an impossible battery health", () => {
		const result = validateIntakeLines([
			{ ...serialLine, serial_numbers: [{ serial: "SN9", battery_health: 140 }] },
		]);
		expect(result).toHaveProperty("error");
	});

	it("rejects a fractional bulk quantity", () => {
		expect(
			validateIntakeLines([{ product_id: "p1", unit_cost: 100, quantity: 2.5 }]),
		).toHaveProperty("error");
	});

	it("defaults the warranty term when a line does not name one", () => {
		const result = validateIntakeLines([serialLine]);
		expect("value" in result && result.value.serialLines[0].warranty_months).toBe(12);
	});

	it("refuses an empty batch", () => {
		expect(validateIntakeLines([])).toHaveProperty("error");
	});
});

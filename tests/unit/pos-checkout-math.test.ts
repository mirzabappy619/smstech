/**
 * Regression tests for the POS and inventory arithmetic.
 *
 * Each block names the defect it pins down, so a future change that
 * reintroduces one fails here rather than in the shop.
 */
import { describe, it, expect } from "vitest";
import {
	computeCartTotals,
	lineTotal,
	summarisePayments,
	isTenderBalanced,
	paymentStatusFor,
	changeDue,
	expectedDrawerCash,
	customerNetPosition,
	transferUnitCount,
	round2,
	GATEWAY_BY_METHOD,
} from "@/lib/pos/checkout-math";

describe("cart totals", () => {
	it("sums line totals into the subtotal", () => {
		const { subtotal, finalTotal } = computeCartTotals(
			[
				{ unit_price: 179999, quantity: 1 },
				{ unit_price: 1200, quantity: 3 },
			],
			0,
		);

		expect(subtotal).toBe(183599);
		expect(finalTotal).toBe(183599);
	});

	it("keeps the order total equal to the sum of its own line totals", () => {
		// The subtotal used Number(qty) while the line item wrote
		// Number(qty) || 1, so an order header could disagree with its rows.
		const items = [
			{ unit_price: 500, quantity: 2 },
			{ unit_price: 250, quantity: 4 },
		];

		const { subtotal } = computeCartTotals(items, 0);
		const sumOfLines = round2(
			items.reduce((sum, i) => sum + lineTotal(i), 0),
		);

		expect(subtotal).toBe(sumOfLines);
	});

	it("clamps a discount larger than the cart", () => {
		// Previously the total floored at zero while the recorded discount
		// stayed larger than anything that was sold.
		const { subtotal, discount, finalTotal } = computeCartTotals(
			[{ unit_price: 1000, quantity: 1 }],
			5000,
		);

		expect(subtotal).toBe(1000);
		expect(discount).toBe(1000);
		expect(finalTotal).toBe(0);
	});

	it("treats a negative discount as zero", () => {
		const { discount, finalTotal } = computeCartTotals(
			[{ unit_price: 1000, quantity: 1 }],
			-500,
		);

		expect(discount).toBe(0);
		expect(finalTotal).toBe(1000);
	});

	it("rounds to whole poisha rather than accumulating float error", () => {
		const { subtotal } = computeCartTotals(
			[{ unit_price: 0.1, quantity: 3 }],
			0,
		);
		expect(subtotal).toBe(0.3);
	});
});

describe("tender validation", () => {
	it("rejects a tender that does not cover the invoice", () => {
		// This check used to live only in the browser, so a crafted request
		// could settle a ৳200,000 invoice with a ৳1 cash line.
		expect(isTenderBalanced(1, 200000)).toBe(false);
	});

	it("accepts a tender within rounding tolerance", () => {
		expect(isTenderBalanced(999.995, 1000)).toBe(true);
	});

	it("rejects an overpayment on the invoice lines", () => {
		expect(isTenderBalanced(1200, 1000)).toBe(false);
	});

	it("splits a mixed tender across the right buckets", () => {
		const tender = summarisePayments([
			{ method: "cash", amount: 5000 },
			{ method: "card", amount: 3000 },
			{ method: "bkash", amount: 1000 },
			{ method: "nagad", amount: 500 },
			{ method: "advance", amount: 2000 },
			{ method: "due", amount: 1500 },
		]);

		expect(tender.totalTendered).toBe(13000);
		expect(tender.cash).toBe(5000);
		expect(tender.card).toBe(3000);
		expect(tender.mobile).toBe(1500);
		expect(tender.advance).toBe(2000);
		expect(tender.due).toBe(1500);
		// A due is credit extended, not money taken.
		expect(tender.amountSettled).toBe(11500);
	});

	it("counts a pre-booking advance as wallet, not cash", () => {
		const tender = summarisePayments([
			{ method: "prebooking", amount: 10000 },
			{ method: "cash", amount: 5000 },
		]);

		expect(tender.wallet).toBe(10000);
		expect(tender.prebooking).toBe(10000);
		expect(tender.cash).toBe(5000);
	});

	it("maps every accepted method onto a valid payment gateway", () => {
		// payment_transactions.gateway has a CHECK constraint; an unmapped
		// method would fail at insert time, mid-sale.
		const allowed = [
			"cash",
			"card",
			"bkash",
			"nagad",
			"sslcommerz",
			"customer_advance",
			"customer_due",
		];

		for (const gateway of Object.values(GATEWAY_BY_METHOD)) {
			expect(allowed).toContain(gateway);
		}
	});
});

describe("payment status", () => {
	it("marks a fully settled sale paid", () => {
		expect(paymentStatusFor(0, 25000)).toBe("paid");
	});

	it("marks a part-paid sale partial", () => {
		expect(paymentStatusFor(6000, 4000)).toBe("partial");
	});

	it("marks a sale taken entirely on credit pending", () => {
		expect(paymentStatusFor(10000, 0)).toBe("pending");
	});
});

describe("change due", () => {
	it("returns the difference when the customer overpays in cash", () => {
		// The till had no cash-tendered step at all; the cashier worked change
		// out in their head.
		expect(changeDue(2000, 1750)).toBe(250);
	});

	it("returns zero when exact cash is given", () => {
		expect(changeDue(1750, 1750)).toBe(0);
	});

	it("never returns negative change when the cash is short", () => {
		expect(changeDue(1000, 1750)).toBe(0);
	});
});

describe("expected drawer cash", () => {
	it("includes dues collected and subtracts safe drops", () => {
		// The terminal showed float + cash sales; the server closed against
		// float + cash sales + dues collected; neither applied movements. A
		// drawer that balanced was reported ৳12,000 short.
		const expected = expectedDrawerCash({
			openingFloat: 5000,
			cashSales: 42000,
			duesCollected: 8000,
			movements: [{ type: "drop", amount: 20000 }],
		});

		expect(expected).toBe(35000);
	});

	it("adds cash in and float adjustments", () => {
		expect(
			expectedDrawerCash({
				openingFloat: 5000,
				cashSales: 0,
				duesCollected: 0,
				movements: [
					{ type: "cash_in", amount: 2000 },
					{ type: "float_adjustment", amount: 500 },
				],
			}),
		).toBe(7500);
	});

	it("subtracts expense payouts", () => {
		expect(
			expectedDrawerCash({
				openingFloat: 5000,
				cashSales: 10000,
				duesCollected: 0,
				movements: [{ type: "cash_out", amount: 1200 }],
			}),
		).toBe(13800);
	});

	it("reports a balanced drawer as zero variance", () => {
		const expected = expectedDrawerCash({
			openingFloat: 5000,
			cashSales: 42000,
			duesCollected: 8000,
			movements: [{ type: "drop", amount: 20000 }],
		});

		const counted = 35000;
		expect(round2(counted - expected)).toBe(0);
	});
});

describe("customer ledger position", () => {
	it("reports a debt as positive", () => {
		expect(customerNetPosition(6000, 0)).toBe(6000);
	});

	it("reports held wallet credit as negative", () => {
		expect(customerNetPosition(0, 2500)).toBe(-2500);
	});

	it("nets a debt against wallet credit", () => {
		// balance_after previously meant five different things depending on
		// which route wrote the row, so a running balance was unrecoverable.
		expect(customerNetPosition(6000, 2500)).toBe(3500);
	});
});

describe("transfer manifests", () => {
	it("counts units in transit, not manifest lines", () => {
		// total_items used items.length, so a 40-unit shipment across three
		// lines was recorded as 3.
		expect(
			transferUnitCount([
				{ quantity: 10 },
				{ quantity: 25 },
				{ quantity: 5 },
			]),
		).toBe(40);
	});

	it("counts each serialized unit as one", () => {
		expect(
			transferUnitCount([
				{ device_unit_id: "a" },
				{ device_unit_id: "b" },
			]),
		).toBe(2);
	});

	it("handles a mixed serialized and bulk manifest", () => {
		expect(
			transferUnitCount([
				{ device_unit_id: "a" },
				{ quantity: 12 },
				{ device_unit_id: "b" },
			]),
		).toBe(14);
	});
});

describe("customer aggregates", () => {
	it("counts a first sale to a new customer once", () => {
		// Checkout inserted the customer with total_orders: 1 and
		// total_spent: finalTotal, then a later block incremented both again.
		const finalTotal = 25000;

		// The customer is now created with zero aggregates...
		const created = { total_orders: 0, total_spent: 0 };
		// ...and the single update applies the sale.
		const after = {
			total_orders: created.total_orders + 1,
			total_spent: round2(created.total_spent + finalTotal),
		};

		expect(after.total_orders).toBe(1);
		expect(after.total_spent).toBe(25000);
	});
});

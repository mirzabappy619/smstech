/**
 * Tests for party registration and credit limits.
 *
 * The rule that matters here is that credit is granted deliberately: a party
 * with no limit set cannot be sold to on due, however the sale is worded.
 */
import { describe, it, expect } from "vitest";
import {
	checkCreditLimit,
	creditHeadroom,
	generatePartyCode,
	parseBalanceAdjustment,
	validateParty,
	validatePartyUpdate,
} from "@/lib/parties";

describe("Party registration", () => {
	it("requires a name and a contact number", () => {
		expect(validateParty("customer", { phone: "01711111111" })).toHaveProperty("error");
		expect(validateParty("customer", { name: "Rahim" })).toHaveProperty("error");

		const ok = validateParty("customer", { name: "Rahim", phone: "01711111111" });
		expect(ok).not.toHaveProperty("error");
	});

	it("trims the name and rejects a blank one", () => {
		expect(validateParty("customer", { name: "   ", phone: "01711111111" })).toHaveProperty(
			"error",
		);

		const result = validateParty("customer", { name: "  Rahim  ", phone: "01711111111" });
		expect("value" in result && result.value.name).toBe("Rahim");
	});

	it("rejects a malformed email but allows none at all", () => {
		expect(
			validateParty("customer", { name: "Rahim", phone: "01711111111", email: "not-an-email" }),
		).toHaveProperty("error");

		const result = validateParty("customer", {
			name: "Rahim",
			phone: "01711111111",
			email: "",
		});
		expect("value" in result && result.value.email).toBeNull();
	});

	it("refuses a negative credit limit or opening balance", () => {
		expect(
			validateParty("customer", { name: "Rahim", phone: "01711111111", credit_limit: -1 }),
		).toHaveProperty("error");
		expect(
			validateParty("customer", { name: "Rahim", phone: "01711111111", opening_balance: -5 }),
		).toHaveProperty("error");
	});

	it("defaults a customer to retail and leaves suppliers untyped", () => {
		const customer = validateParty("customer", { name: "Rahim", phone: "01711111111" });
		expect("value" in customer && customer.value.customer_type).toBe("retail");

		const supplier = validateParty("supplier", { name: "Star Tech", phone: "01711111111" });
		expect("value" in supplier && supplier.value.customer_type).toBeNull();
	});

	it("rejects a customer type it does not know", () => {
		expect(
			validateParty("customer", {
				name: "Rahim",
				phone: "01711111111",
				customer_type: "vip",
			}),
		).toHaveProperty("error");
	});

	it("prefixes generated codes by party type", () => {
		expect(generatePartyCode("customer")).toMatch(/^CUST-[A-Z0-9]{6}$/);
		expect(generatePartyCode("supplier")).toMatch(/^SUPP-[A-Z0-9]{6}$/);
	});
});

describe("Credit limits on a due sale", () => {
	it("measures headroom as limit minus what is already owed", () => {
		expect(creditHeadroom({ credit_limit: 50000, outstanding_due: 20000 })).toBe(30000);
		expect(creditHeadroom({ credit_limit: 0, outstanding_due: 0 })).toBe(0);
	});

	it("allows a due that fits inside the headroom", () => {
		const party = { name: "Brac IT", credit_limit: 50000, outstanding_due: 20000 };
		expect(checkCreditLimit(party, 30000).ok).toBe(true);
		expect(checkCreditLimit(party, 10000).ok).toBe(true);
	});

	it("refuses a due that runs past the limit", () => {
		const party = { name: "Brac IT", credit_limit: 50000, outstanding_due: 20000 };
		const result = checkCreditLimit(party, 30001);
		expect(result.ok).toBe(false);
		expect(result.message).toContain("Brac IT");
	});

	it("refuses any credit to a party with no limit set", () => {
		// A new party starts at zero: credit is something the shop grants.
		const result = checkCreditLimit({ name: "Walk-in", credit_limit: 0 }, 1);
		expect(result.ok).toBe(false);
		expect(result.message).toContain("no credit limit");
	});

	it("does not trip on a rounding-sized overshoot", () => {
		const party = { credit_limit: 50000, outstanding_due: 20000 };
		expect(checkCreditLimit(party, 30000.005).ok).toBe(true);
	});

	it("treats missing balances as zero rather than throwing", () => {
		expect(checkCreditLimit({ credit_limit: 1000 }, 500).ok).toBe(true);
		expect(checkCreditLimit({}, 500).ok).toBe(false);
	});
});

describe("Editing a party", () => {
	it("changes only the keys that were sent", () => {
		const result = validatePartyUpdate("customer", { credit_limit: 75000 });
		expect("value" in result && result.value).toEqual({ credit_limit: 75000 });
	});

	it("refuses an edit that would blank the name or phone", () => {
		expect(validatePartyUpdate("customer", { name: "  " })).toHaveProperty("error");
		expect(validatePartyUpdate("customer", { phone: "" })).toHaveProperty("error");
	});

	it("does not accept a credit limit or customer type on a supplier", () => {
		// A supplier is owed money by us; a credit limit makes no sense there.
		expect(validatePartyUpdate("supplier", { credit_limit: 1000 })).toHaveProperty("error");
		expect(
			validatePartyUpdate("supplier", { customer_type: "wholesale" }),
		).toHaveProperty("error");
	});

	it("lets a customer be reclassified between retail and wholesale", () => {
		const result = validatePartyUpdate("customer", { customer_type: "wholesale" });
		expect("value" in result && result.value.customer_type).toBe("wholesale");
	});

	it("reports an empty patch rather than issuing a no-op write", () => {
		expect(validatePartyUpdate("customer", {})).toEqual({ error: "Nothing to change." });
	});

	it("never carries a balance in the patch", () => {
		// Balances are the sum of ledger history; a form must not overwrite one.
		const result = validatePartyUpdate("customer", {
			credit_limit: 1000,
			// @ts-expect-error deliberately passing a field the patch must ignore
			outstanding_due: 999999,
		});
		expect("value" in result && result.value).not.toHaveProperty("outstanding_due");
	});
});

describe("Balance corrections", () => {
	it("accepts a signed amount in either direction", () => {
		expect(parseBalanceAdjustment(5000)).toEqual({ value: 5000 });
		expect(parseBalanceAdjustment("-2500")).toEqual({ value: -2500 });
	});

	it("treats an absent value as no adjustment", () => {
		expect(parseBalanceAdjustment("")).toEqual({ value: 0 });
		expect(parseBalanceAdjustment(undefined)).toEqual({ value: 0 });
		expect(parseBalanceAdjustment(null)).toEqual({ value: 0 });
	});

	it("rejects something that is not a number", () => {
		expect(parseBalanceAdjustment("five thousand")).toHaveProperty("error");
	});
});

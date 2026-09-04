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
	validateParty,
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

/**
 * Filtering for the searchable dropdowns. The rule that matters: every term
 * the user typed has to appear somewhere in the row, so "macbook 256" narrows
 * rather than falling back to matching either word.
 */
import { describe, it, expect } from "vitest";
import { matches, type SearchableOption } from "@/components/ui/searchable-select";

const product: SearchableOption = {
	value: "p1",
	label: "Apple MacBook Air M3 (8GB / 256GB)",
	hint: "SKU MBA-M3-256 · ৳149,000",
	keywords: "MBA-M3-256",
};

describe("dropdown filtering", () => {
	it("shows everything when nothing is typed", () => {
		expect(matches(product, "")).toBe(true);
	});

	it("matches on the label, case-insensitively", () => {
		expect(matches(product, "macbook")).toBe(true);
		expect(matches(product, "MACBOOK")).toBe(true);
	});

	it("matches on a SKU the label never shows", () => {
		// The point of keywords: a cashier reads the SKU off a box, and the
		// product name does not contain it.
		expect(matches(product, "MBA-M3")).toBe(true);
	});

	it("matches on the hint line", () => {
		expect(matches(product, "149")).toBe(true);
	});

	it("requires every term, not any of them", () => {
		expect(matches(product, "macbook 256")).toBe(true);
		expect(matches(product, "macbook 512")).toBe(false);
	});

	it("ignores the spacing between terms", () => {
		expect(matches(product, "  apple   air  ")).toBe(true);
	});

	it("rejects a term that appears nowhere", () => {
		expect(matches(product, "lenovo")).toBe(false);
	});

	it("copes with a row that has no hint or keywords", () => {
		const bare: SearchableOption = { value: "x", label: "Plain row" };
		expect(matches(bare, "plain")).toBe(true);
		expect(matches(bare, "missing")).toBe(false);
	});
});

import { describe, it, expect } from "vitest";
import {
	CLEARED_WARRANTY,
	DEFAULT_WARRANTY_MONTHS,
	activateWarranty,
	addMonths,
	parseWarrantyMonths,
	warrantyDaysRemaining,
	warrantyState,
} from "@/lib/warranty";

describe("Serialized hardware warranty", () => {
	describe("parseWarrantyMonths", () => {
		it("accepts a whole number of months, including zero", () => {
			expect(parseWarrantyMonths(12)).toBe(12);
			expect(parseWarrantyMonths("6")).toBe(6);
			expect(parseWarrantyMonths(0)).toBe(0);
		});

		it("rejects fractions, negatives and absurd terms", () => {
			expect(parseWarrantyMonths(1.5)).toBeNull();
			expect(parseWarrantyMonths(-1)).toBeNull();
			expect(parseWarrantyMonths(121)).toBeNull();
			expect(parseWarrantyMonths("twelve")).toBeNull();
		});

		it("reports an absent value as null so callers can apply their own default", () => {
			expect(parseWarrantyMonths(undefined)).toBeNull();
			expect(parseWarrantyMonths(null)).toBeNull();
			expect(parseWarrantyMonths("")).toBeNull();
		});
	});

	describe("addMonths", () => {
		it("clamps to the last day when the target month is shorter", () => {
			// 31 Jan + 1 month must not roll into March.
			const result = addMonths(new Date("2026-01-31T00:00:00Z"), 1);
			expect(result.toISOString().slice(0, 10)).toBe("2026-02-28");
		});

		it("keeps the day of month when it exists in the target month", () => {
			const result = addMonths(new Date("2026-03-15T10:30:00Z"), 12);
			expect(result.toISOString()).toBe("2027-03-15T10:30:00.000Z");
		});
	});

	describe("activateWarranty", () => {
		it("starts the clock at the sale, not at intake", () => {
			const soldAt = new Date("2026-09-04T12:00:00Z");
			const patch = activateWarranty(12, soldAt);

			expect(patch.warranty_starts_at).toBe(soldAt.toISOString());
			expect(patch.warranty_expires_at).toBe("2027-09-04T12:00:00.000Z");
			expect(patch.warranty_months).toBe(12);
		});

		it("honours the unit's own term instead of assuming a year", () => {
			const soldAt = new Date("2026-09-04T12:00:00Z");
			expect(activateWarranty(6, soldAt).warranty_expires_at).toBe(
				"2027-03-04T12:00:00.000Z",
			);
		});

		it("records a zero-month term as sold with no expiry, not as no warranty record", () => {
			const soldAt = new Date("2026-09-04T12:00:00Z");
			const patch = activateWarranty(0, soldAt);

			expect(patch.warranty_starts_at).toBe(soldAt.toISOString());
			expect(patch.warranty_expires_at).toBeNull();
		});

		it("falls back to the default term when a unit carries none", () => {
			expect(activateWarranty(null).warranty_months).toBe(DEFAULT_WARRANTY_MONTHS);
		});
	});

	describe("warrantyState", () => {
		it("reads a unit still in stock as not started", () => {
			expect(
				warrantyState({ warranty_months: 12, warranty_starts_at: null }),
			).toBe("not_started");
		});

		it("reads a live warranty as active and a lapsed one as expired", () => {
			const future = new Date(Date.now() + 86_400_000).toISOString();
			const past = new Date(Date.now() - 86_400_000).toISOString();

			expect(
				warrantyState({
					warranty_starts_at: "2026-01-01T00:00:00Z",
					warranty_expires_at: future,
				}),
			).toBe("active");

			expect(
				warrantyState({
					warranty_starts_at: "2020-01-01T00:00:00Z",
					warranty_expires_at: past,
				}),
			).toBe("expired");
		});

		it("distinguishes a unit sold without warranty from one still on the shelf", () => {
			expect(
				warrantyState({
					warranty_months: 0,
					warranty_starts_at: "2026-01-01T00:00:00Z",
					warranty_expires_at: null,
				}),
			).toBe("none");
		});
	});

	describe("warrantyDaysRemaining", () => {
		it("counts whole days left and never goes negative", () => {
			const inTenDays = new Date(Date.now() + 10 * 86_400_000).toISOString();
			expect(warrantyDaysRemaining(inTenDays)).toBe(10);
			expect(warrantyDaysRemaining(new Date(Date.now() - 1000).toISOString())).toBe(0);
			expect(warrantyDaysRemaining(null)).toBe(0);
		});
	});

	it("clears both ends of the window when a sale is rolled back", () => {
		expect(CLEARED_WARRANTY).toEqual({
			warranty_starts_at: null,
			warranty_expires_at: null,
		});
	});
});

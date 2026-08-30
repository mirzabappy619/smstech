// Unit Tests for E-Commerce Application
// Run with: npm test

import { describe, it, expect, beforeEach, vi } from "vitest";
import { z } from "zod";

// These were previously pulled in with require() inside each describe block.
// CJS require() cannot resolve TypeScript specifiers under Vitest's ESM
// runtime, so the whole file failed to collect.
import {
	emailSchema,
	passwordSchema,
	registerSchema,
	createProductSchema,
	addToCartSchema,
	createOrderSchema,
} from "./schemas";
import { Money, Email, Address } from "./entities";
import config, { formatCurrency } from "./config";
import {
	successResponse,
	errorResponse,
	validationErrorResponse,
	notFoundResponse,
	getPaginationMeta,
	validateRequest,
} from "./api-utils";
import { NextRequest } from "next/server";
import { jobQueue } from "./jobs";

// ==============================================
// MOCK IMPORTS (since modules need setup)
// ==============================================

// Mock Supabase client
vi.mock("@/lib/supabase/server", () => ({
	createClient: vi.fn(() => ({
		auth: {
			getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
			signInWithPassword: vi.fn(),
			signOut: vi.fn(),
		},
		from: vi.fn(() => ({
			select: vi.fn().mockReturnThis(),
			insert: vi.fn().mockReturnThis(),
			update: vi.fn().mockReturnThis(),
			delete: vi.fn().mockReturnThis(),
			eq: vi.fn().mockReturnThis(),
			single: vi.fn().mockResolvedValue({ data: null, error: null }),
		})),
	})),
	createServerSupabaseClient: vi.fn(),
	createAdminClient: vi.fn(),
}));

// ==============================================
// VALIDATION SCHEMA TESTS
// ==============================================
describe("Validation Schemas", () => {
	describe("emailSchema", () => {
		it("should accept valid email addresses", () => {
			expect(() => emailSchema.parse("test@example.com")).not.toThrow();
			expect(() =>
				emailSchema.parse("user.name+tag@domain.co.uk"),
			).not.toThrow();
		});

		it("should reject invalid email addresses", () => {
			expect(() => emailSchema.parse("invalid")).toThrow();
			expect(() => emailSchema.parse("missing@domain")).toThrow();
			expect(() => emailSchema.parse("@nodomain.com")).toThrow();
		});
	});

	describe("passwordSchema", () => {
		it("should accept valid passwords", () => {
			expect(() => passwordSchema.parse("password123")).not.toThrow();
			expect(() => passwordSchema.parse("MySecureP@ssw0rd!")).not.toThrow();
		});

		it("should reject passwords shorter than 8 characters", () => {
			expect(() => passwordSchema.parse("short")).toThrow();
			expect(() => passwordSchema.parse("1234567")).toThrow();
		});
	});

	describe("registerSchema", () => {
		const validData = {
			email: "test@example.com",
			password: "password123",
			firstName: "John",
			lastName: "Doe",
		};

		it("should accept valid registration data", () => {
			expect(() => registerSchema.parse(validData)).not.toThrow();
		});

		it("should accept registration with phone", () => {
			const dataWithPhone = { ...validData, phone: "+12025551234" };
			expect(() => registerSchema.parse(dataWithPhone)).not.toThrow();
		});

		it("should reject registration without required fields", () => {
			expect(() =>
				registerSchema.parse({ email: "test@example.com" }),
			).toThrow();
			expect(() =>
				registerSchema.parse({ ...validData, email: undefined }),
			).toThrow();
		});
	});

	describe("createProductSchema", () => {
		const validProduct = {
			name: "Test Product",
			slug: "test-product",
			description: "A test product description",
			sku: "TEST-001",
			categoryId: "11111111-1111-1111-1111-111111111111",
			basePrice: 99.99,
		};

		it("should accept valid product data", () => {
			expect(() => createProductSchema.parse(validProduct)).not.toThrow();
		});

		it("should reject invalid slug format", () => {
			const invalidSlug = { ...validProduct, slug: "Invalid Slug!" };
			expect(() => createProductSchema.parse(invalidSlug)).toThrow();
		});

		it("should reject negative prices", () => {
			const negativePrice = { ...validProduct, basePrice: -10 };
			expect(() => createProductSchema.parse(negativePrice)).toThrow();
		});

		it("should accept product with variations", () => {
			const productWithVariations = {
				...validProduct,
				variations: [
					{
						name: "Small",
						sku: "TEST-001-S",
						price: 99.99,
					},
				],
			};
			expect(() =>
				createProductSchema.parse(productWithVariations),
			).not.toThrow();
		});
	});

	describe("addToCartSchema", () => {
		it("should accept valid cart item", () => {
			const validItem = {
				productId: "11111111-1111-1111-1111-111111111111",
				quantity: 2,
			};
			expect(() => addToCartSchema.parse(validItem)).not.toThrow();
		});

		it("should default quantity to 1", () => {
			const item = addToCartSchema.parse({
				productId: "11111111-1111-1111-1111-111111111111",
			});
			expect(item.quantity).toBe(1);
		});

		it("should reject zero or negative quantity", () => {
			expect(() =>
				addToCartSchema.parse({
					productId: "11111111-1111-1111-1111-111111111111",
					quantity: 0,
				}),
			).toThrow();

			expect(() =>
				addToCartSchema.parse({
					productId: "11111111-1111-1111-1111-111111111111",
					quantity: -1,
				}),
			).toThrow();
		});

		it("should reject invalid product ID", () => {
			expect(() =>
				addToCartSchema.parse({
					productId: "not-a-uuid",
					quantity: 1,
				}),
			).toThrow();
		});
	});

	describe("createOrderSchema", () => {
		const validAddress = {
			street: "123 Main St",
			city: "New York",
			state: "NY",
			postalCode: "10001",
			country: "USA",
		};

		const validOrder = {
			items: [
				{ productId: "11111111-1111-1111-1111-111111111111", quantity: 2 },
			],
			shippingAddress: validAddress,
			paymentMethod: "card",
		};

		it("should accept valid order data", () => {
			expect(() => createOrderSchema.parse(validOrder)).not.toThrow();
		});

		it("should require at least one item", () => {
			const emptyItems = { ...validOrder, items: [] };
			expect(() => createOrderSchema.parse(emptyItems)).toThrow();
		});

		it("should require shipping address", () => {
			const { shippingAddress, ...noAddress } = validOrder;
			expect(() => createOrderSchema.parse(noAddress)).toThrow();
		});

		it("should accept optional billing address", () => {
			const withBilling = {
				...validOrder,
				billingAddress: validAddress,
			};
			expect(() => createOrderSchema.parse(withBilling)).not.toThrow();
		});

		it("should accept optional coupon code", () => {
			const withCoupon = {
				...validOrder,
				couponCode: "SAVE20",
			};
			expect(() => createOrderSchema.parse(withCoupon)).not.toThrow();
		});
	});
});

// ==============================================
// ENTITY TESTS
// ==============================================
describe("Domain Entities", () => {
	describe("Money Value Object", () => {
		it("should create a Money instance", () => {
			const money = new Money(100, "USD");
			expect(money.amount).toBe(100);
			expect(money.currency).toBe("USD");
		});

		it("should add two Money instances", () => {
			const m1 = new Money(50, "USD");
			const m2 = new Money(30, "USD");
			const result = m1.add(m2);
			expect(result.amount).toBe(80);
		});

		it("should throw when adding different currencies", () => {
			const m1 = new Money(50, "USD");
			const m2 = new Money(30, "EUR");
			expect(() => m1.add(m2)).toThrow();
		});

		it("should subtract Money instances", () => {
			const m1 = new Money(100, "USD");
			const m2 = new Money(30, "USD");
			const result = m1.subtract(m2);
			expect(result.amount).toBe(70);
		});

		it("should multiply by a scalar", () => {
			const money = new Money(10, "USD");
			const result = money.multiply(3);
			expect(result.amount).toBe(30);
		});

		it("should format correctly", () => {
			const money = new Money(99.99, "USD");
			expect(money.format()).toBe("$99.99");
		});
	});

	describe("Email Value Object", () => {
		it("should create a valid Email", () => {
			const email = new Email("test@example.com");
			expect(email.toString()).toBe("test@example.com");
		});

		it("should throw for invalid email", () => {
			expect(() => new Email("invalid")).toThrow();
		});

		it("should normalize email to lowercase", () => {
			const email = new Email("Test@Example.COM");
			expect(email.toString()).toBe("test@example.com");
		});
	});

	describe("Address Value Object", () => {
		it("should create a valid Address", () => {
			const address = new Address(
				"123 Main St",
				"New York",
				"NY",
				"10001",
				"USA",
			);
			expect(address.street).toBe("123 Main St");
			expect(address.city).toBe("New York");
		});

		it("should format address to string", () => {
			const address = new Address(
				"123 Main St",
				"New York",
				"NY",
				"10001",
				"USA",
			);
			expect(address.format()).toContain("123 Main St");
			expect(address.format()).toContain("New York");
		});
	});
});

// ==============================================
// UTILITY FUNCTION TESTS
// ==============================================
describe("Utility Functions", () => {
	describe("formatCurrency", () => {
		// The store trades in BDT and formats to whole taka — Intl renders
		// "BDT 1,000", so formatCurrency uses the ৳ symbol and rounds.
		it("should format taka with the ৳ symbol", () => {
			expect(formatCurrency(99.99)).toBe("৳100");
			expect(formatCurrency(48000)).toBe("৳48,000");
		});

		it("should handle zero", () => {
			expect(formatCurrency(0)).toBe("৳0");
		});

		it("should group large numbers", () => {
			expect(formatCurrency(1234567.89)).toContain("1,234,568");
		});
	});
});

// ==============================================
// API UTILITIES TESTS
// ==============================================
describe("API Utilities", () => {
	describe("successResponse", () => {
		it("should create a success response", async () => {
			const response = successResponse({ message: "Hello" });
			const json = await response.json();

			expect(response.status).toBe(200);
			expect(json.success).toBe(true);
			expect(json.data.message).toBe("Hello");
		});

		it("should support custom status code", async () => {
			const response = successResponse({ id: 1 }, 201);
			expect(response.status).toBe(201);
		});
	});

	describe("errorResponse", () => {
		// Signature is (code, message, status, details) — the previous tests
		// called it as (message, status, details) and so asserted a 200.
		it("should create an error response", async () => {
			const response = errorResponse("BAD_REQUEST", "Something went wrong", 400);
			const json = await response.json();

			expect(response.status).toBe(400);
			expect(json.success).toBe(false);
			expect(json.error.code).toBe("BAD_REQUEST");
			expect(json.error.message).toBe("Something went wrong");
		});

		it("should include error details when provided", async () => {
			const response = errorResponse("VALIDATION_ERROR", "Validation failed", 400, {
				email: ["Invalid format"],
			});
			const json = await response.json();

			expect(response.status).toBe(400);
			expect(json.error.details.email).toEqual(["Invalid format"]);
		});
	});

	describe("notFoundResponse", () => {
		it("should name the missing resource", async () => {
			const response = notFoundResponse("Inventory item");
			const json = await response.json();

			expect(response.status).toBe(404);
			expect(json.error.message).toContain("Inventory item");
		});
	});

	describe("validationErrorResponse", () => {
		it("should surface per-field messages from a Zod error", async () => {
			const schema = z.object({ name: z.string().min(1), age: z.number().positive() });
			const parsed = schema.safeParse({ name: "", age: -5 });
			expect(parsed.success).toBe(false);

			if (!parsed.success) {
				const response = validationErrorResponse(parsed.error);
				const json = await response.json();

				expect(response.status).toBe(400);
				expect(json.error.details.name).toBeDefined();
				expect(json.error.details.age).toBeDefined();
			}
		});
	});

	describe("getPaginationMeta", () => {
		it("should calculate pagination correctly", () => {
			const meta = getPaginationMeta(2, 10, 95);

			expect(meta.page).toBe(2);
			expect(meta.perPage).toBe(10);
			expect(meta.total).toBe(95);
			expect(meta.totalPages).toBe(10);
		});

		it("should round partial pages up", () => {
			expect(getPaginationMeta(1, 25, 1).totalPages).toBe(1);
			expect(getPaginationMeta(1, 25, 26).totalPages).toBe(2);
		});

		it("should handle an exact page boundary", () => {
			expect(getPaginationMeta(5, 10, 50).totalPages).toBe(5);
		});
	});

	describe("validateRequest", () => {
		// Takes a NextRequest, not a plain object, and returns
		// { data } | { error: NextResponse }.
		const schema = z.object({
			name: z.string().min(1),
			age: z.number().positive(),
		});

		const makeRequest = (body: unknown) =>
			new NextRequest("http://localhost/api/test", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});

		it("should return parsed data for valid input", async () => {
			const result = await validateRequest(makeRequest({ name: "John", age: 25 }), schema);

			expect(result.error).toBeUndefined();
			expect(result.data?.name).toBe("John");
			expect(result.data?.age).toBe(25);
		});

		it("should return an error response for invalid input", async () => {
			const result = await validateRequest(makeRequest({ name: "", age: -5 }), schema);

			expect(result.data).toBeUndefined();
			expect(result.error?.status).toBe(400);
		});
	});
});

// ==============================================
// CONFIGURATION TESTS
// ==============================================
describe("Configuration", () => {
	it("should have required app config", () => {
		expect(config.app.name).toBeDefined();
		expect(config.app.url).toBeDefined();
	});

	it("should have currency config", () => {
		expect(config.currency.default).toBe("BDT");
		expect(config.currency.supported).toContain("BDT");
		expect(config.currency.symbol).toBe("৳");
	});

	it("should have tax config", () => {
		expect(config.tax.rate).toBeGreaterThanOrEqual(0);
		expect(config.tax.rate).toBeLessThanOrEqual(1);
	});

	it("should have shipping config", () => {
		expect(config.shipping.freeShippingThreshold).toBeGreaterThanOrEqual(0);
		expect(config.shipping.defaultShippingRate).toBeGreaterThanOrEqual(0);
	});

	it("should have cart config", () => {
		expect(config.cart.maxItems).toBeGreaterThan(0);
		expect(config.cart.cartExpiryDays).toBeGreaterThan(0);
	});

	it("should have security config", () => {
		expect(config.security.minPasswordLength).toBeGreaterThanOrEqual(8);
		expect(config.security.maxLoginAttempts).toBeGreaterThan(0);
	});

	it("should have feature flags", () => {
		expect(typeof config.features.enableWishlist).toBe("boolean");
		expect(typeof config.features.enableReviews).toBe("boolean");
	});
});

// ==============================================
// JOB QUEUE TESTS
// ==============================================
describe("Job Queue", () => {
	beforeEach(() => {
		// Reset queue state if needed
	});

	it("should add jobs to the queue", async () => {
		const jobId = await jobQueue.add("send_email", {
			to: "test@example.com",
			template: "welcome",
			data: {},
		});

		expect(jobId).toBeDefined();
		expect(typeof jobId).toBe("string");
	});

	it("should return queue stats", () => {
		const stats = jobQueue.stats();

		expect(stats).toHaveProperty("pending");
		expect(stats).toHaveProperty("processing");
		expect(stats).toHaveProperty("failed");
	});
});

// ==============================================
// INTEGRATION TEST PLACEHOLDERS
// ==============================================
describe.skip("Integration Tests (require database)", () => {
	describe("Product API", () => {
		it("should fetch products", async () => {
			// Would test actual API endpoint
		});

		it("should create a product (admin)", async () => {
			// Would test product creation with auth
		});
	});

	describe("Order API", () => {
		it("should create an order", async () => {
			// Would test order creation flow
		});

		it("should update order status", async () => {
			// Would test admin order management
		});
	});

	describe("Cart API", () => {
		it("should add items to cart", async () => {
			// Would test cart operations
		});

		it("should apply coupon", async () => {
			// Would test coupon validation and application
		});
	});
});

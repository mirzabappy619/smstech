/**
 * Products API Integration Tests
 */
import { describe, it, expect } from "vitest";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

describe("Products API", () => {
	describe("GET /api/v1/products", () => {
		it("should return a list of products", async () => {
			const response = await fetch(`${BASE_URL}/api/v1/products`);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data).toHaveProperty("data");
			// paginatedResponse() puts page/perPage/total/totalPages under `meta`.
			expect(data).toHaveProperty("meta");
			expect(Array.isArray(data.data)).toBe(true);
		});

		it("should support pagination", async () => {
			const response = await fetch(
				`${BASE_URL}/api/v1/products?page=1&limit=5`,
			);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.meta.page).toBe(1);
			expect(data.meta.perPage).toBe(5);
			expect(data.data.length).toBeLessThanOrEqual(5);
		});

		it("should support search", async () => {
			const response = await fetch(`${BASE_URL}/api/v1/products?search=phone`);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(Array.isArray(data.data)).toBe(true);
		});

		it("should support category filter", async () => {
			const response = await fetch(
				`${BASE_URL}/api/v1/products?category=electronics`,
			);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(Array.isArray(data.data)).toBe(true);
		});

		it("should support sorting", async () => {
			const response = await fetch(
				`${BASE_URL}/api/v1/products?sort=price&order=asc`,
			);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(Array.isArray(data.data)).toBe(true);
		});
	});

	describe("GET /api/v1/products/:id", () => {
		it("should return 404 for non-existent product", async () => {
			const response = await fetch(
				`${BASE_URL}/api/v1/products/00000000-0000-0000-0000-000000000000`,
			);

			expect(response.status).toBe(404);
		});
	});

	describe("POST /api/v1/products", () => {
		it("should return 401 for unauthenticated requests", async () => {
			const response = await fetch(`${BASE_URL}/api/v1/products`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: "Test Product",
					slug: "test-product",
					base_price: 99.99,
				}),
			});

			expect(response.status).toBe(401);
		});
	});
});

describe("Categories API", () => {
	describe("GET /api/v1/categories", () => {
		it("should return a list of categories", async () => {
			const response = await fetch(`${BASE_URL}/api/v1/categories`);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data).toHaveProperty("data");
			expect(Array.isArray(data.data)).toBe(true);
		});
	});
});

describe("Health Check", () => {
	describe("GET /api/health", () => {
		it("should return health status", async () => {
			const response = await fetch(`${BASE_URL}/api/health`);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data).toHaveProperty("status");
			expect(data.status).toBe("healthy");
		});
	});
});

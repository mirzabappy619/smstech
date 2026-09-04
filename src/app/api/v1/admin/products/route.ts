import { NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import {
	errorResponse,
	HTTP_STATUS,
	requireAdmin,
	successResponse,
	validateRequest,
	parsePagination
} from "@/lib/api-utils";

const adminProductVariationSchema = z.object({
	name: z.string().trim().min(1).max(100),
	sku: z.string().trim().min(1).max(100),
	price: z.number().nonnegative(), // allow $0 variations
	attributes: z.record(z.string()).default({}),
	is_active: z.boolean().default(true),
	is_auto_generated: z.boolean().default(false),
	images: z.array(z.string().url()).default([]),
	// Initial inventory per warehouse (optional)
	warehouse_stocks: z
		.array(
			z.object({
				warehouse_id: z.string().uuid(),
				quantity_in_packages: z.number().int().nonnegative(),
			})
		)
		.optional()
		.default([]),
});

const unitSystemSchema = z
	.object({
		baseUnit: z.enum(['piece', 'pair', 'dozen', 'pack']),
		unitsPerPackage: z.number().int().positive(),
		packageName: z.string().min(1).max(100),
	})
	.default({ baseUnit: 'piece', unitsPerPackage: 1, packageName: 'Individual' });

const attributeDefinitionSchema = z.object({
	name: z.string().min(1).max(100),
	displayName: z.string().min(1).max(100),
	values: z.array(z.string().min(1).max(100)).min(1),
	displayOrder: z.number().int().nonnegative(),
});

const adminCreateProductSchema = z.object({
	name: z.string().trim().min(1).max(255),
	slug: z
		.string()
		.trim()
		.min(1)
		.max(255)
		.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug format"),
	description: z.string().trim().optional().default(""),
	short_description: z.string().trim().max(500).optional().default(""),
	category_id: z.string().uuid(),
	brand: z.string().trim().optional().default(""),
	base_price: z.number().nonnegative(),
	compare_at_price: z.number().nonnegative().nullable().optional(),
	cost_price: z.number().nonnegative().nullable().optional(),
	sku: z.string().trim().min(1).max(100),
	barcode: z.string().trim().max(100).optional().default(""),
	weight: z.number().positive().nullable().optional(),
	is_active: z.boolean().default(true),
	is_featured: z.boolean().default(false),
	is_digital: z.boolean().default(false),
	track_inventory: z.boolean().default(false),
	// Pre-order mode: sold through the pre-booking queue instead of the cart
	is_preorder: z.boolean().default(false),
	preorder_release_date: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
		.nullable()
		.optional(),
	preorder_deposit_pct: z.number().gt(0).max(100).default(10),
	seo_title: z.string().trim().max(70).optional().default(""),
	seo_description: z.string().trim().max(160).optional().default(""),
	seo_keywords: z.string().trim().optional().default(""),
	images: z.array(z.string().url()).default([]),
	variations: z.array(adminProductVariationSchema).default([]),
	trust_badges: z
		.array(z.object({ icon: z.string(), text: z.string() }))
		.default([]),
	// New fields
	unit_system: unitSystemSchema,
	attribute_definitions: z.array(attributeDefinitionSchema).default([]),
});

/**
 * GET /api/v1/admin/products
 * List all products (for admin use)
 */
export async function GET(request: NextRequest) {
	try {
		// Require admin authentication
		const authResult = await requireAdmin(request);
		if (authResult.error) {
			return authResult.error;
		}

		const { searchParams } = new URL(request.url);
		const search = searchParams.get("search") || "";
		const { page, limit, offset } = parsePagination(searchParams);

		const supabase = await createAdminClient();

		// Build query with correct column names
		let query = supabase
			.from("products")
			.select("id, name, description, base_price, images, sku", {
				count: "exact",
			});

		// Apply search filter if provided
		if (search) {
			query = query.or(
				`name.ilike.%${search}%,description.ilike.%${search}%,sku.ilike.%${search}%`,
			);
		}

		// Apply pagination
		query = query
			.order("created_at", { ascending: false })
			.range(offset, offset + limit - 1);

		const { data: products, error, count } = await query;
		if (error) {
			console.error("Failed to fetch products:", error.message);
			return errorResponse(
				"PRODUCTS_FETCH_FAILED",
				`Failed to fetch products: ${error.message}`,
				500,
			);
		}

		return successResponse({
			products: products || [],
			pagination: {
				page,
				limit,
				total: count || 0,
				totalPages: Math.ceil((count || 0) / limit),
			},
		});
	} catch (error) {
		console.error("Admin products API error:", error);
		return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
	}
}

/**
 * POST /api/v1/admin/products
 * Create a product from the admin form
 */
export async function POST(request: NextRequest) {
	let insertedProductId: string | null = null;
	try {
		const authResult = await requireAdmin(request);
		if (authResult.error) {
			return authResult.error;
		}

		const validation = await validateRequest(request, adminCreateProductSchema);
		if (validation.error) {
			return validation.error;
		}

		const supabase = await createAdminClient();
		const payload = validation.data;
		const {
			brand,
			seo_keywords,
			variations = [],
			trust_badges = [],
			...productFields
		} = payload;

		const keywordList = (seo_keywords ?? "")
			.split(",")
			.map((k) => k.trim())
			.filter(Boolean);

		const { data: product, error: productError } = await supabase
			.from("products")
			.insert({
				...productFields,
				barcode: productFields.barcode || null,
				preorder_release_date: productFields.preorder_release_date || null,
				short_description: productFields.short_description || null,
				description: productFields.description || null,
				seo_title: productFields.seo_title || null,
				seo_description: productFields.seo_description || null,
				seo_keywords: keywordList,
				requires_shipping: !productFields.is_digital,
				unit_system: payload.unit_system,
				attribute_definitions: payload.attribute_definitions,
				metadata: {
					brand: brand || null,
					trust_badges: trust_badges.length > 0 ? trust_badges : null,
				},
			})
			.select("*")
			.single();

		if (productError) {
			if (productError.code === "23505") {
				const conflictField = productError.message.includes("sku")
					? "sku"
					: productError.message.includes("slug")
						? "slug"
						: "field";

				return errorResponse(
					"PRODUCT_EXISTS",
					`A product with this ${conflictField} already exists`,
					HTTP_STATUS.CONFLICT,
				);
			}

			return errorResponse(
				"PRODUCT_CREATE_FAILED",
				productError.message || "Failed to create product",
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			);
		}

		insertedProductId = product.id;

		if (variations.length > 0) {
			// Get the default warehouse location for inventory seeding
			const { data: defaultLocation } = await supabase
				.from("warehouses")
				.select("id")
				.eq("is_default", true)
				.single();

			const { data: insertedVariations, error: variationError } = await supabase
				.from("product_variations")
				.insert(
					variations.map((variation) => ({
						product_id: product.id,
						name: variation.name,
						sku: variation.sku,
						price: variation.price,
						attributes: variation.attributes,
						is_active: variation.is_active,
						is_auto_generated: variation.is_auto_generated,
						images: variation.images ?? [],
					})),
				)
				.select("id, sku");

			if (variationError) {
				await supabase.from("products").delete().eq("id", product.id);
				insertedProductId = null;

				if (variationError.code === "23505") {
					return errorResponse(
						"PRODUCT_VARIATION_EXISTS",
						"A variation SKU already exists",
						HTTP_STATUS.CONFLICT,
					);
				}

				return errorResponse(
					"PRODUCT_VARIATION_CREATE_FAILED",
					variationError.message || "Failed to create product variations",
					HTTP_STATUS.INTERNAL_SERVER_ERROR,
				);
			}

			// Seed inventory records for each variation
			if (insertedVariations && insertedVariations.length > 0) {
				const inventoryInserts: Array<Record<string, unknown>> = [];

				insertedVariations.forEach((dbVar, idx) => {
					const inputVar = variations[idx];
					const warehouseStocks = inputVar?.warehouse_stocks || [];

					if (warehouseStocks.length > 0) {
						warehouseStocks.forEach((ws) => {
							inventoryInserts.push({
								product_id: product.id,
								variation_id: dbVar.id,
								warehouse_id: ws.warehouse_id,
								quantity: ws.quantity_in_packages,
								reserved_quantity: 0,
							});
						});
					} else if (defaultLocation) {
						inventoryInserts.push({
							product_id: product.id,
							variation_id: dbVar.id,
							warehouse_id: defaultLocation.id,
							quantity: 0,
							reserved_quantity: 0,
						});
					}
				});

				if (inventoryInserts.length > 0) {
					// Plain insert, not upsert: the product was created moments ago,
					// so no inventory row can exist yet. An upsert would also fail —
					// the uniqueness of (product, variation, warehouse) comes from a
					// partial index, which ON CONFLICT cannot infer.
					const { error: inventoryError } = await supabase
						.from("inventory")
						.insert(inventoryInserts as never);

					if (inventoryError) {
						// Roll back so the admin retries against a clean slate rather
						// than ending up with a product whose opening stock is missing.
						await supabase.from("products").delete().eq("id", product.id);
						insertedProductId = null;

						return errorResponse(
							"PRODUCT_INVENTORY_CREATE_FAILED",
							inventoryError.message || "Failed to seed product inventory",
							HTTP_STATUS.INTERNAL_SERVER_ERROR,
						);
					}
				}
			}
		}

		return successResponse(product, HTTP_STATUS.CREATED);
	} catch (error) {
		if (insertedProductId) {
			const supabase = await createAdminClient();
			await supabase.from("products").delete().eq("id", insertedProductId);
		}
		console.error("Admin product create error:", error);
		return errorResponse(
			"INTERNAL_ERROR",
			"Internal server error",
			HTTP_STATUS.INTERNAL_SERVER_ERROR,
		);
	}
}

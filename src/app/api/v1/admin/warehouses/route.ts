import { NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import {
	errorResponse,
	HTTP_STATUS,
	requireAdmin,
	successResponse,
} from "@/lib/api-utils";

const createWarehouseSchema = z.object({
	name: z.string().min(1).max(100),
	code: z.string().min(1).max(50).toUpperCase(),
	type: z.enum(["warehouse", "store", "fulfillment_center"]).default("warehouse"),
	address_street: z.string().optional(),
	address_city: z.string().optional(),
	address_state: z.string().optional(),
	address_postal_code: z.string().optional(),
	address_country: z.string().optional().default("Bangladesh"),
	phone: z.string().optional(),
	email: z.string().email().optional(),
	latitude: z.number().optional(),
	longitude: z.number().optional(),
	is_active: z.boolean().default(true),
	is_default: z.boolean().default(false),
});

/**
 * GET /api/v1/admin/warehouses
 * List all warehouse locations.
 */
export async function GET(request: NextRequest) {
	try {
		const authResult = await requireAdmin(request);
		if (authResult.error) return authResult.error;

		const supabase = await createAdminClient();

		const { data: warehouses, error } = await supabase
			.from("locations")
			.select("*")
			.order("is_default", { ascending: false })
			.order("name", { ascending: true });

		if (error) {
			return errorResponse(
				"WAREHOUSE_FETCH_FAILED",
				"Failed to fetch warehouses",
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			);
		}

		// Attach inventory summary per warehouse
		const { data: inventorySummary } = await supabase
			.from("inventory")
			.select("location_id, quantity, available_quantity");

		const summaryByLocation = (inventorySummary || []).reduce(
			(acc, row) => {
				const key = row.location_id as string;
				if (!acc[key]) acc[key] = { total_quantity: 0, total_available: 0, sku_count: 0 };
				acc[key].total_quantity += Number(row.quantity) || 0;
				acc[key].total_available += Number(row.available_quantity) || 0;
				acc[key].sku_count += 1;
				return acc;
			},
			{} as Record<string, { total_quantity: number; total_available: number; sku_count: number }>,
		);

		const result = (warehouses || []).map((w) => ({
			...w,
			inventory_summary: summaryByLocation[w.id] || {
				total_quantity: 0,
				total_available: 0,
				sku_count: 0,
			},
		}));

		return successResponse(result);
	} catch (error) {
		console.error("Warehouses GET error:", error);
		return errorResponse(
			"INTERNAL_ERROR",
			"Internal server error",
			HTTP_STATUS.INTERNAL_SERVER_ERROR,
		);
	}
}

/**
 * POST /api/v1/admin/warehouses
 * Create a new warehouse location.
 */
export async function POST(request: NextRequest) {
	try {
		const authResult = await requireAdmin(request);
		if (authResult.error) return authResult.error;

		const body = await request.json();
		const parsed = createWarehouseSchema.safeParse(body);
		if (!parsed.success) {
			return errorResponse(
				"VALIDATION_ERROR",
				"Invalid warehouse data",
				HTTP_STATUS.BAD_REQUEST,
			);
		}

		const supabase = await createAdminClient();

		// If this is being set as default, unset others
		if (parsed.data.is_default) {
			await supabase
				.from("locations")
				.update({ is_default: false })
				.eq("is_default", true);
		}

		const { data: warehouse, error } = await supabase
			.from("locations")
			.insert(parsed.data)
			.select("*")
			.single();

		if (error) {
			if (error.code === "23505") {
				return errorResponse(
					"WAREHOUSE_EXISTS",
					"A warehouse with this code already exists",
					HTTP_STATUS.CONFLICT,
				);
			}
			return errorResponse(
				"WAREHOUSE_CREATE_FAILED",
				error.message || "Failed to create warehouse",
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			);
		}

		return successResponse(warehouse, HTTP_STATUS.CREATED);
	} catch (error) {
		console.error("Warehouses POST error:", error);
		return errorResponse(
			"INTERNAL_ERROR",
			"Internal server error",
			HTTP_STATUS.INTERNAL_SERVER_ERROR,
		);
	}
}

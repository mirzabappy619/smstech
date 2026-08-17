import { NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import {
	errorResponse,
	HTTP_STATUS,
	requireAdmin,
	successResponse,
} from "@/lib/api-utils";

const updateWarehouseInventorySchema = z.object({
	variation_id: z.string().uuid(),
	warehouse_id: z.string().uuid(),
	quantity_in_packages: z.number().int().nonnegative(),
	notes: z.string().optional(),
});

/**
 * POST /api/v1/admin/inventory/warehouse
 * Set stock for a specific variation at a specific warehouse.
 * Logs the adjustment to inventory_logs.
 */
export async function POST(request: NextRequest) {
	try {
		const authResult = await requireAdmin(request);
		if (authResult.error) return authResult.error;

		const body = await request.json();
		const parsed = updateWarehouseInventorySchema.safeParse(body);
		if (!parsed.success) {
			return errorResponse(
				"VALIDATION_ERROR",
				"Invalid request data",
				HTTP_STATUS.BAD_REQUEST,
			);
		}
		const { variation_id, warehouse_id, quantity_in_packages, notes } =
			parsed.data;

		const supabase = await createAdminClient();

		// Fetch current inventory record (upsert if missing)
		let { data: currentStock, error: fetchError } = await supabase
			.from("inventory")
			.select("id, quantity, reserved_quantity, product_id")
			.eq("variation_id", variation_id)
			.eq("location_id", warehouse_id)
			.single();

		// If no record exists, create one (quantity 0)
		if (fetchError || !currentStock) {
			// Get product_id from the variation
			const { data: variation } = await supabase
				.from("product_variations")
				.select("product_id")
				.eq("id", variation_id)
				.single();

			if (!variation) {
				return errorResponse(
					"VARIATION_NOT_FOUND",
					"Variation not found",
					HTTP_STATUS.NOT_FOUND,
				);
			}

			const { data: newRecord, error: createError } = await supabase
				.from("inventory")
				.insert({
					product_id: variation.product_id,
					variation_id,
					location_id: warehouse_id,
					quantity: quantity_in_packages,
					reserved_quantity: 0,
				})
				.select("id, quantity, reserved_quantity, product_id")
				.single();

			if (createError || !newRecord) {
				return errorResponse(
					"INVENTORY_CREATE_FAILED",
					"Failed to create inventory record",
					HTTP_STATUS.INTERNAL_SERVER_ERROR,
				);
			}

			currentStock = newRecord;
			fetchError = null;
		}

		if (fetchError || !currentStock) {
			return errorResponse(
				"INVENTORY_NOT_FOUND",
				"Inventory record not found",
				HTTP_STATUS.NOT_FOUND,
			);
		}

		const oldQuantity = currentStock.quantity as number;
		const quantityChange = quantity_in_packages - oldQuantity;

		// Update the inventory quantity
		const { error: updateError } = await supabase
			.from("inventory")
			.update({
				quantity: quantity_in_packages,
				updated_at: new Date().toISOString(),
			})
			.eq("id", currentStock.id);

		if (updateError) {
			return errorResponse(
				"INVENTORY_UPDATE_FAILED",
				"Failed to update inventory",
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			);
		}

		// Log the adjustment
		await supabase.from("inventory_logs").insert({
			inventory_id: currentStock.id,
			adjustment_type: "adjustment",
			quantity_change: quantityChange,
			quantity_before: oldQuantity,
			quantity_after: quantity_in_packages,
			reason: notes || "Manual admin adjustment",
			user_id: authResult.user?.id,
		});

		return successResponse(
			{
				message: "Inventory updated successfully",
				variation_id,
				warehouse_id,
				quantity_in_packages,
				quantity_change: quantityChange,
				previous_quantity: oldQuantity,
			},
			HTTP_STATUS.OK,
		);
	} catch (error) {
		console.error("Inventory warehouse update error:", error);
		return errorResponse(
			"INTERNAL_ERROR",
			"Internal server error",
			HTTP_STATUS.INTERNAL_SERVER_ERROR,
		);
	}
}

/**
 * GET /api/v1/admin/inventory/warehouse?variation_id=uuid
 * Get inventory breakdown by warehouse for a specific variation.
 */
export async function GET(request: NextRequest) {
	try {
		const authResult = await requireAdmin(request);
		if (authResult.error) return authResult.error;

		const { searchParams } = new URL(request.url);
		const variationId = searchParams.get("variation_id");

		if (!variationId) {
			return errorResponse(
				"MISSING_PARAM",
				"variation_id query param is required",
				HTTP_STATUS.BAD_REQUEST,
			);
		}

		const supabase = await createAdminClient();

		const { data: inventory, error } = await supabase
			.from("inventory")
			.select(
				`
        id,
        quantity,
        reserved_quantity,
        available_quantity,
        location_id,
        locations ( id, name, code, address_city, is_default )
      `,
			)
			.eq("variation_id", variationId)
			.order("created_at", { ascending: true });

		if (error) {
			return errorResponse(
				"INVENTORY_FETCH_FAILED",
				"Failed to fetch inventory",
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			);
		}

		// Also get all warehouses that DON'T have a record yet (so admin can add stock)
		const { data: allWarehouses } = await supabase
			.from("locations")
			.select("id, name, code, address_city, is_default")
			.eq("is_active", true)
			.order("is_default", { ascending: false });

		const existingLocationIds = new Set(
			(inventory || []).map((i) => i.location_id),
		);
		const missingWarehouses = (allWarehouses || []).filter(
			(w) => !existingLocationIds.has(w.id),
		);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const warehouses = (inventory || []).map((item: any) => ({
			inventory_id: item.id,
			location_id: item.location_id,
			location_name: item.locations?.name || "Unknown",
			location_code: item.locations?.code || "",
			location_city: item.locations?.address_city || "",
			is_default: item.locations?.is_default || false,
			quantity: item.quantity,
			reserved_quantity: item.reserved_quantity,
			available_quantity: item.available_quantity,
		}));

		const totals = warehouses.reduce(
			(acc, w) => ({
				total_quantity: acc.total_quantity + w.quantity,
				total_reserved: acc.total_reserved + w.reserved_quantity,
				total_available:
					acc.total_available + w.available_quantity,
			}),
			{ total_quantity: 0, total_reserved: 0, total_available: 0 },
		);

		return successResponse({
			variation_id: variationId,
			warehouses,
			missing_warehouses: missingWarehouses,
			totals,
		});
	} catch (error) {
		console.error("Inventory warehouse fetch error:", error);
		return errorResponse(
			"INTERNAL_ERROR",
			"Internal server error",
			HTTP_STATUS.INTERNAL_SERVER_ERROR,
		);
	}
}

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

		const { data: currentStock } = await supabase
			.from("inventory")
			.select("id, quantity")
			.eq("variation_id", variation_id)
			.eq("warehouse_id", warehouse_id)
			.maybeSingle();

		const oldQuantity = (currentStock?.quantity as number) ?? 0;
		const quantityChange = quantity_in_packages - oldQuantity;

		// This screen sets an absolute count rather than applying a delta, so it
		// goes through the same atomic helper with the delta that gets there.
		// A count of zero is a legitimate result, so negatives are allowed here.
		const { error: rpcError } = await supabase.rpc("apply_stock_movement", {
			p_product_id: variation.product_id,
			p_variation_id: variation_id,
			p_warehouse_id: warehouse_id,
			p_delta: quantityChange,
			p_adjustment_type: "adjustment",
			p_reason: notes || "Manual admin stock count",
			p_order_id: null,
			p_user_id: authResult.user?.id ?? null,
			p_allow_negative: false,
		});

		if (rpcError) {
			const insufficient = rpcError.message?.includes("INSUFFICIENT_STOCK");
			return errorResponse(
				insufficient ? "INSUFFICIENT_STOCK" : "INVENTORY_UPDATE_FAILED",
				insufficient
					? "That count would leave fewer units on hand than are already reserved for orders."
					: "Failed to update inventory",
				insufficient
					? HTTP_STATUS.BAD_REQUEST
					: HTTP_STATUS.INTERNAL_SERVER_ERROR,
			);
		}

		// Keep the last physical count timestamp in step with the change.
		await supabase
			.from("inventory")
			.update({ last_counted_at: new Date().toISOString() })
			.eq("variation_id", variation_id)
			.eq("warehouse_id", warehouse_id);

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
        warehouse_id,
        warehouses ( id, name, code, address, is_default )
      `,
			)
			.eq("variation_id", variationId)
			.order("created_at", { ascending: true });

		if (error) {
			console.error("Inventory warehouse fetch failed:", error);
			return errorResponse(
				"INVENTORY_FETCH_FAILED",
				error.message,
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			);
		}

		// Also get all warehouses that DON'T have a record yet (so admin can add stock)
		const { data: allWarehouses } = await supabase
			.from("warehouses")
			.select("id, name, code, address, is_default")
			.eq("is_active", true)
			.order("is_default", { ascending: false });

		const existingWarehouseIds = new Set(
			(inventory || []).map((i) => i.warehouse_id),
		);
		const missingWarehouses = (allWarehouses || []).filter(
			(w) => !existingWarehouseIds.has(w.id),
		);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const warehouses = (inventory || []).map((item: any) => ({
			inventory_id: item.id,
			warehouse_id: item.warehouse_id,
			location_name: item.warehouses?.name || "Unknown",
			location_code: item.warehouses?.code || "",
			location_city: item.warehouses?.address || "",
			is_default: item.warehouses?.is_default || false,
			quantity: item.quantity ?? 0,
			reserved_quantity: item.reserved_quantity ?? 0,
			available_quantity: item.available_quantity ?? 0,
		}));

		const totals = warehouses.reduce(
			(acc, w) => ({
				total_quantity: acc.total_quantity + w.quantity,
				total_reserved: acc.total_reserved + w.reserved_quantity,
				total_available: acc.total_available + w.available_quantity,
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

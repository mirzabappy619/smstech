import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
	errorResponse,
	HTTP_STATUS,
	jsonResponse,
	requireAdmin,
} from "@/lib/api-utils";

interface MappedInventoryItem {
	id: string;
	product_id: string;
	variation_id: string | null;
	product_name: string;
	variation_name: string | null;
	sku: string;
	quantity: number;
	reserved_quantity: number;
	available_quantity: number;
	reorder_point: number;
	reorder_quantity: number;
	last_restocked: string | null;
	warehouse_id: string | null;
	location: string | null;
}

const isLowStock = (i: MappedInventoryItem) =>
	i.available_quantity > 0 && i.available_quantity <= i.reorder_point;

const isOutOfStock = (i: MappedInventoryItem) => i.available_quantity <= 0;

export async function GET(request: NextRequest) {
	try {
		const { error: authError } = await requireAdmin(request);
		if (authError) return authError;

		const { searchParams } = new URL(request.url);
		const search = searchParams.get("search");
		const warehouseId = searchParams.get("warehouse_id");
		const lowStock = searchParams.get("low_stock") === "true";
		const outOfStock = searchParams.get("out_of_stock") === "true";

		const supabase = await createAdminClient();

		let query = supabase
			.from("inventory")
			.select(
				`
				id, product_id, variation_id, warehouse_id,
				quantity, reserved_quantity, available_quantity,
				reorder_point, reorder_quantity, bin_location, last_counted_at, updated_at,
				products ( id, name, sku ),
				product_variations ( id, name, sku ),
				warehouses ( id, name, code )
			`,
			)
			.order("updated_at", { ascending: false });

		if (warehouseId && warehouseId !== "all") {
			query = query.eq("warehouse_id", warehouseId);
		}

		const { data: items, error } = await query;

		if (error) {
			console.error("Inventory fetch failed:", error);
			return errorResponse(
				"INVENTORY_FETCH_FAILED",
				error.message,
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			);
		}

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const all: MappedInventoryItem[] = (items || []).map((item: any) => ({
			id: item.id as string,
			product_id: item.product_id as string,
			variation_id: item.variation_id as string | null,
			product_name: (item.products?.name as string) || "Unknown Product",
			variation_name: (item.product_variations?.name as string) || null,
			sku:
				(item.product_variations?.sku as string) ||
				(item.products?.sku as string) ||
				"",
			quantity: (item.quantity as number) ?? 0,
			reserved_quantity: (item.reserved_quantity as number) ?? 0,
			available_quantity: (item.available_quantity as number) ?? 0,
			reorder_point: (item.reorder_point as number) ?? 0,
			reorder_quantity: (item.reorder_quantity as number) ?? 0,
			last_restocked: item.last_counted_at as string | null,
			warehouse_id: item.warehouse_id as string | null,
			location: (item.warehouses?.name as string) || null,
		}));

		// Summary is always computed over the whole (warehouse-scoped) set, never
		// over the search/stock filter — otherwise the KPI cards would just
		// restate whatever filter the user happens to have applied.
		const summary = {
			total_items: all.length,
			low_stock: all.filter(isLowStock).length,
			out_of_stock: all.filter(isOutOfStock).length,
			total_stock: all.reduce((sum, i) => sum + i.available_quantity, 0),
		};

		let mapped = all;

		if (search) {
			const q = search.toLowerCase();
			mapped = mapped.filter(
				(i) =>
					i.product_name.toLowerCase().includes(q) ||
					i.sku.toLowerCase().includes(q),
			);
		}

		if (outOfStock) {
			mapped = mapped.filter(isOutOfStock);
		} else if (lowStock) {
			mapped = mapped.filter(isLowStock);
		}

		return jsonResponse({ items: mapped, summary });
	} catch (error) {
		console.error("Inventory route error:", error);
		return errorResponse(
			"INTERNAL_ERROR",
			"Internal server error",
			HTTP_STATUS.INTERNAL_SERVER_ERROR,
		);
	}
}

import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
	errorResponse,
	HTTP_STATUS,
	jsonResponse,
	requireAdmin,
} from "@/lib/api-utils";

export async function GET(request: NextRequest) {
	try {
		const { error: authError } = await requireAdmin(request);
		if (authError) return authError;

		const { searchParams } = new URL(request.url);
		const search = searchParams.get("search");
		const lowStock = searchParams.get("low_stock") === "true";
		const outOfStock = searchParams.get("out_of_stock") === "true";

		const supabase = await createAdminClient();

		const { data: items, error } = await supabase
			.from("inventory")
			.select(
				`
				id, product_id, variation_id,
				quantity, reserved_quantity, available_quantity,
				reorder_point, reorder_quantity, bin_location, last_counted_at, updated_at,
				products ( id, name, sku ),
				product_variations ( id, name, sku ),
				locations ( id, name )
			`,
			)
			.order("updated_at", { ascending: false });

		if (error) {
			return errorResponse(
				"INVENTORY_FETCH_FAILED",
				"Failed to fetch inventory",
				HTTP_STATUS.INTERNAL_SERVER_ERROR,
			);
		}

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		let mapped = (items || []).map((item: any) => ({
			id: item.id as string,
			product_id: item.product_id as string,
			variation_id: item.variation_id as string | null,
			product_name: (item.products?.name as string) || "Unknown Product",
			variation_name: (item.product_variations?.name as string) || null,
			sku:
				(item.product_variations?.sku as string) ||
				(item.products?.sku as string) ||
				"",
			quantity: item.quantity as number,
			reserved_quantity: item.reserved_quantity as number,
			available_quantity: item.available_quantity as number,
			reorder_point: item.reorder_point as number,
			reorder_quantity: item.reorder_quantity as number,
			last_restocked: item.last_counted_at as string | null,
			location: (item.locations?.name as string) || null,
		}));

		if (search) {
			const q = search.toLowerCase();
			mapped = mapped.filter(
				(i) =>
					i.product_name.toLowerCase().includes(q) ||
					i.sku.toLowerCase().includes(q),
			);
		}

		if (outOfStock) {
			mapped = mapped.filter((i) => i.available_quantity <= 0);
		} else if (lowStock) {
			mapped = mapped.filter(
				(i) =>
					i.available_quantity > 0 &&
					i.available_quantity <= i.reorder_point,
			);
		}

		return jsonResponse(mapped);
	} catch {
		return errorResponse(
			"INTERNAL_ERROR",
			"Internal server error",
			HTTP_STATUS.INTERNAL_SERVER_ERROR,
		);
	}
}

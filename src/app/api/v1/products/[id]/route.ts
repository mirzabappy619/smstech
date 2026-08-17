import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { jsonResponse, errorResponse } from "@/lib/api-utils";
import { allProducts } from "@/data/products";

export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { id } = await params;

		try {
			const supabase = await createServerClient();

			const isUUID =
				/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
					id,
				);

			let query = supabase
				.from("products")
				.select(
					`*, category:categories(id, name, slug),
					variations:product_variations(
						*,
						inventory(quantity, reserved_quantity, available_quantity)
					)`,
				)
				.eq("is_active", true);

			if (isUUID) {
				query = query.eq("id", id);
			} else {
				query = query.eq("slug", id);
			}

			const { data: product, error } = await query.single();

			if (!error && product) {
				const enriched = {
					...product,
					variations: (product.variations ?? []).map(
						(v: {
							inventory?: { quantity: number; reserved_quantity: number; available_quantity: number }[];
							[key: string]: unknown;
						}) => {
							const inv = v.inventory ?? [];
							const total_quantity  = inv.reduce((s: number, r: { quantity: number }) => s + (r.quantity  ?? 0), 0);
							const total_reserved  = inv.reduce((s: number, r: { reserved_quantity: number }) => s + (r.reserved_quantity  ?? 0), 0);
							const total_available = inv.reduce((s: number, r: { available_quantity: number }) => s + (r.available_quantity ?? 0), 0);
							const { inventory: _inv, ...rest } = v;
							return { ...rest, total_quantity, total_reserved, total_available };
						},
					),
				};
				return jsonResponse(enriched);
			}
		} catch {
			// fallback
		}

		// Fallback to searching allProducts by id or slug
		const match = allProducts.find((p) => p.id === id || p.slug === id);
		if (match) {
			return jsonResponse(match);
		}

		return errorResponse("PRODUCT_NOT_FOUND", "Product not found", 404);
	} catch {
		return errorResponse("INTERNAL_ERROR", "Internal server error", 500);
	}
}

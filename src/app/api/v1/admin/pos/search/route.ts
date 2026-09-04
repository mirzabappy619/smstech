import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { buildIlikeOr } from "@/lib/supabase/filters";
import { requirePermission, hasBranchAccess } from "@/lib/rbac/rbac-service";

export async function GET(request: NextRequest) {
	try {
		const auth = await requirePermission(request, "pos:access");
		if (auth.error) return auth.error;

		const { searchParams } = new URL(request.url);
		const q = searchParams.get("q")?.trim() || "";
		const warehouseId = searchParams.get("warehouse_id");

		if (warehouseId && !hasBranchAccess(auth.userRBAC.branchContext, warehouseId)) {
			return NextResponse.json(
				{ success: false, error: "You do not have access to this branch." },
				{ status: 403 },
			);
		}

		const supabase = await getSupabaseServerClient();

		// ── 1. Serialized units ──────────────────────────────────────────────
		// Only in_stock units are sellable over the counter. 'reserved' units
		// are held against a pre-booking; they used to appear here and could be
		// sold to a walk-in customer.
		let unitQuery = supabase
			.from("device_units")
			.select(
				`
        id,
        serial_number,
        imei_1,
        imei_2,
        mac_address,
        battery_health_pct,
        battery_cycles,
        cosmetic_grade,
        regional_variant,
        cost_price,
        selling_price,
        status,
        warehouse_id,
        products (
          id,
          name,
          sku,
          brand,
          base_price,
          images,
          warranty
        )
      `,
			)
			.eq("status", "in_stock");

		if (warehouseId) {
			unitQuery = unitQuery.eq("warehouse_id", warehouseId);
		}

		const unitFilter = buildIlikeOr(
			["serial_number", "imei_1", "imei_2", "mac_address"],
			q,
		);
		if (unitFilter) unitQuery = unitQuery.or(unitFilter);

		const { data: deviceUnits, error: unitError } = await unitQuery.limit(20);
		if (unitError) throw unitError;

		// ── 2. Catalogue products, with the stock held at this branch ────────
		let productQuery = supabase
			.from("products")
			.select(
				"id, name, sku, brand, base_price, compare_at_price, images, warranty, stock_count, track_inventory",
			)
			.eq("is_active", true);

		const productFilter = buildIlikeOr(["name", "sku", "brand"], q);
		if (productFilter) productQuery = productQuery.or(productFilter);

		const { data: products, error: productError } = await productQuery.limit(20);
		if (productError) throw productError;

		// Attach the branch's on-hand figure so the till can refuse to sell
		// what is not there, rather than adding it to the cart blindly.
		//
		// The POS cart has no variation picker, so it rings products up against
		// the pooled row (variation_id IS NULL) — and that is the only row
		// checkout will check. Summing every row for the product, variations
		// included, reported stock the till could never actually sell: the item
		// went into the cart and then failed at settlement. Sellable stock and
		// variation-held stock are therefore counted separately.
		let productsWithStock = (products || []).map((p) => ({
			...p,
			available_quantity: 0,
			variation_quantity: 0,
		}));

		if (warehouseId && productsWithStock.length > 0) {
			const { data: stockRows } = await supabase
				.from("inventory")
				.select("product_id, variation_id, available_quantity")
				.eq("warehouse_id", warehouseId)
				.in(
					"product_id",
					productsWithStock.map((p) => p.id),
				);

			const pooledByProduct = new Map<string, number>();
			const variationByProduct = new Map<string, number>();
			for (const row of stockRows || []) {
				const target = row.variation_id ? variationByProduct : pooledByProduct;
				target.set(
					row.product_id,
					(target.get(row.product_id) || 0) + (row.available_quantity ?? 0),
				);
			}

			productsWithStock = productsWithStock.map((p) => ({
				...p,
				available_quantity: pooledByProduct.get(p.id) ?? 0,
				variation_quantity: variationByProduct.get(p.id) ?? 0,
			}));
		}

		return NextResponse.json({
			success: true,
			data: {
				deviceUnits: deviceUnits || [],
				products: productsWithStock,
			},
		});
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		console.error("POS search failed:", message);
		return NextResponse.json(
			{ success: false, error: "Failed to perform POS search" },
			{ status: 500 },
		);
	}
}

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { buildIlikeOr } from "@/lib/supabase/filters";
import { requirePermission, hasBranchAccess } from "@/lib/rbac/rbac-service";
import { POS_PRODUCT_COLUMNS, attachBranchStock } from "@/lib/pos/catalog";

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
			.select(POS_PRODUCT_COLUMNS)
			.eq("is_active", true);

		const productFilter = buildIlikeOr(["name", "sku", "brand"], q);
		if (productFilter) productQuery = productQuery.or(productFilter);

		const { data: products, error: productError } = await productQuery.limit(20);
		if (productError) throw productError;

		// Sellable stock, variation-held stock and the variations themselves are
		// all resolved together — the till rings the base product against the
		// pooled row and each variation against its own, exactly as checkout
		// draws them down.
		const productsWithStock = await attachBranchStock(
			supabase,
			products || [],
			warehouseId,
		);

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

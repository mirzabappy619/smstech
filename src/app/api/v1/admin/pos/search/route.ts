import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() || "";
    const warehouseId = searchParams.get("warehouse_id");

    const supabase = await getSupabaseServerClient();

    // 1. Search in serialized device_units first
    let unitQuery = supabase
      .from("device_units")
      .select(`
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
      `)
      .in("status", ["in_stock", "reserved"]);

    if (warehouseId) {
      unitQuery = unitQuery.eq("warehouse_id", warehouseId);
    }

    if (q) {
      unitQuery = unitQuery.or(`serial_number.ilike.%${q}%,imei_1.ilike.%${q}%,imei_2.ilike.%${q}%,mac_address.ilike.%${q}%`);
    }

    const { data: deviceUnits } = await unitQuery.limit(20);

    // 2. Search general catalog products
    let productQuery = supabase
      .from("products")
      .select("id, name, sku, brand, base_price, compare_at_price, images, warranty, stock_count, track_inventory")
      .eq("is_active", true);

    if (q) {
      productQuery = productQuery.or(`name.ilike.%${q}%,sku.ilike.%${q}%,brand.ilike.%${q}%`);
    }

    const { data: products } = await productQuery.limit(20);

    return NextResponse.json({
      success: true,
      data: {
        deviceUnits: deviceUnits || [],
        products: products || []
      }
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to perform POS search" },
      { status: 500 }
    );
  }
}

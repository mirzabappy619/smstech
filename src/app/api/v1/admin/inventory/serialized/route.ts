import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const warehouseId = searchParams.get("warehouse_id");
    const status = searchParams.get("status") || "all";
    const grade = searchParams.get("grade") || "all";
    const query = searchParams.get("q")?.trim();

    const supabase = await getSupabaseServerClient();
    let dbQuery = supabase
      .from("device_units")
      .select(`
        *,
        products (
          id,
          name,
          sku,
          brand,
          base_price,
          warranty
        ),
        warehouses (
          id,
          name,
          code
        )
      `)
      .order("created_at", { ascending: false });

    if (warehouseId && warehouseId !== "all") {
      dbQuery = dbQuery.eq("warehouse_id", warehouseId);
    }
    if (status !== "all") {
      dbQuery = dbQuery.eq("status", status);
    }
    if (grade !== "all") {
      dbQuery = dbQuery.eq("cosmetic_grade", grade);
    }
    if (query) {
      dbQuery = dbQuery.or(`serial_number.ilike.%${query}%,imei_1.ilike.%${query}%,imei_2.ilike.%${query}%`);
    }

    const { data: units, error } = await dbQuery.limit(100);
    if (error) throw error;

    return NextResponse.json({ success: true, data: units || [] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      product_id,
      variation_id,
      warehouse_id,
      serial_number,
      imei_1,
      imei_2,
      mac_address,
      battery_health_pct,
      battery_cycles,
      cosmetic_grade,
      regional_variant,
      specs_summary,
      cost_price,
      selling_price,
      notes
    } = body;

    if (!product_id || !warehouse_id || !serial_number || !selling_price) {
      return NextResponse.json(
        { success: false, error: "product_id, warehouse_id, serial_number, and selling_price are required." },
        { status: 400 }
      );
    }

    const supabase = await getSupabaseServerClient();
    const { data: newUnit, error } = await supabase
      .from("device_units")
      .insert({
        product_id,
        variation_id: variation_id || null,
        warehouse_id,
        serial_number,
        imei_1: imei_1 || null,
        imei_2: imei_2 || null,
        mac_address: mac_address || null,
        battery_health_pct: battery_health_pct ? Number(battery_health_pct) : null,
        battery_cycles: Number(battery_cycles) || 0,
        cosmetic_grade: cosmetic_grade || "Brand New",
        regional_variant: regional_variant || "Official",
        specs_summary: specs_summary || {},
        cost_price: Number(cost_price) || 0,
        selling_price: Number(selling_price),
        status: "in_stock",
        notes: notes || null
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data: newUnit });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { buildIlikeOr } from "@/lib/supabase/filters";

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
    const searchFilter = buildIlikeOr(
      ["serial_number", "imei_1", "imei_2"],
      query,
    );
    if (searchFilter) {
      dbQuery = dbQuery.or(searchFilter);
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
        { success: false, error: "Product, branch, serial number and selling price are all required." },
        { status: 400 }
      );
    }

    const price = Number(selling_price);
    if (!Number.isFinite(price) || price <= 0) {
      return NextResponse.json(
        { success: false, error: "Selling price must be greater than zero." },
        { status: 400 }
      );
    }

    const cost = cost_price === undefined || cost_price === null || cost_price === ""
      ? 0
      : Number(cost_price);
    if (!Number.isFinite(cost) || cost < 0) {
      return NextResponse.json(
        { success: false, error: "Cost price must be zero or more." },
        { status: 400 }
      );
    }

    let batteryHealth: number | null = null;
    if (battery_health_pct !== undefined && battery_health_pct !== null && battery_health_pct !== "") {
      batteryHealth = Number(battery_health_pct);
      if (!Number.isFinite(batteryHealth) || batteryHealth < 0 || batteryHealth > 100) {
        return NextResponse.json(
          { success: false, error: "Battery health must be between 0 and 100." },
          { status: 400 }
        );
      }
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
        battery_health_pct: batteryHealth,
        battery_cycles: Number(battery_cycles) || 0,
        cosmetic_grade: cosmetic_grade || "Brand New",
        regional_variant: regional_variant || "Official",
        specs_summary: specs_summary || {},
        cost_price: cost,
        selling_price: price,
        status: "in_stock",
        notes: notes || null
      })
      .select()
      .single();

    if (error) {
      // serial_number is UNIQUE — report the clash plainly instead of leaking
      // a raw constraint violation to the intake screen.
      if (error.code === "23505") {
        return NextResponse.json(
          { success: false, error: `Serial "${serial_number}" is already in stock.` },
          { status: 409 }
        );
      }
      throw error;
    }
    return NextResponse.json({ success: true, data: newUnit });
  } catch (error: any) {
    console.error("Serialized intake failed:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

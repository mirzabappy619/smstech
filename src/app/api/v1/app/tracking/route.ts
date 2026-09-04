import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query"); // Order number or Serial number

    if (!query) {
      return NextResponse.json({ success: false, error: "Tracking query required" }, { status: 400 });
    }

    const supabase = await getSupabaseServerClient();

    // Check orders
    const { data: order } = await supabase
      .from("orders")
      .select(`
        id, order_number, total, status, payment_status, courier_provider, courier_consignment_id, courier_status, created_at,
        order_items (product_name, serial_number, warranty_period)
      `)
      .or(`order_number.eq.${query},customer_phone.eq.${query}`)
      .maybeSingle();

    // Check device warranty
    const { data: unit } = await supabase
      .from("device_units")
      .select(`
        id, serial_number, imei_1, battery_health_pct, cosmetic_grade, warranty_months, warranty_starts_at, warranty_expires_at, sold_at,
        products (name, brand)
      `)
      .or(`serial_number.eq.${query},imei_1.eq.${query}`)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      data: {
        order: order || null,
        warranty: unit || null
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

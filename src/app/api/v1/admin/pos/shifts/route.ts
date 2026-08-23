import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

// GET current active shift for warehouse/cashier or shift history
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const warehouseId = searchParams.get("warehouse_id");
    const status = searchParams.get("status") || "open";

    const supabase = await getSupabaseServerClient();

    if (status === "open" && warehouseId) {
      const { data: openShift } = await supabase
        .from("pos_shifts")
        .select(`
          *,
          warehouses (id, name, code)
        `)
        .eq("warehouse_id", warehouseId)
        .eq("status", "open")
        .maybeSingle();

      return NextResponse.json({ success: true, data: openShift || null });
    }

    // Otherwise list shifts
    let query = supabase
      .from("pos_shifts")
      .select(`
        *,
        warehouses (id, name, code)
      `)
      .order("created_at", { ascending: false })
      .limit(30);

    if (warehouseId) query = query.eq("warehouse_id", warehouseId);

    const { data: shifts, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, data: shifts || [] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Open Shift, Close Shift, or Add Cash Movement
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, warehouse_id, opening_float, closing_cash_actual, shift_id, movement_type, movement_amount, reason, notes } = body;
    const supabase = await getSupabaseServerClient();

    if (action === "open_shift") {
      if (!warehouse_id) {
        return NextResponse.json({ success: false, error: "warehouse_id is required" }, { status: 400 });
      }

      // Check if open shift already exists
      const { data: existing } = await supabase
        .from("pos_shifts")
        .select("id")
        .eq("warehouse_id", warehouse_id)
        .eq("status", "open")
        .maybeSingle();

      if (existing) {
        return NextResponse.json({ success: false, error: "An active shift is already open for this branch" }, { status: 400 });
      }

      const shiftNumber = `SHIFT-${Date.now().toString().slice(-6)}`;
      const { data: newShift, error } = await supabase
        .from("pos_shifts")
        .insert({
          shift_number: shiftNumber,
          warehouse_id,
          opening_float: Number(opening_float) || 0,
          closing_cash_expected: Number(opening_float) || 0,
          status: "open",
          notes: notes || null
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, data: newShift });
    }

    if (action === "cash_movement") {
      if (!shift_id || !movement_amount) {
        return NextResponse.json({ success: false, error: "shift_id and movement_amount are required" }, { status: 400 });
      }

      const { data: movement, error } = await supabase
        .from("pos_cash_movements")
        .insert({
          shift_id,
          type: movement_type || "drop",
          amount: Number(movement_amount),
          reason: reason || "Mid-day drawer adjustment"
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, data: movement });
    }

    if (action === "close_shift") {
      if (!shift_id) {
        return NextResponse.json({ success: false, error: "shift_id is required" }, { status: 400 });
      }

      const { data: currentShift, error: fetchErr } = await supabase
        .from("pos_shifts")
        .select("*")
        .eq("id", shift_id)
        .single();

      if (fetchErr || !currentShift) {
        return NextResponse.json({ success: false, error: "Shift not found" }, { status: 404 });
      }

      const expected = Number(currentShift.opening_float) + Number(currentShift.cash_sales_total) + Number(currentShift.dues_collected_total);
      const actual = Number(closing_cash_actual) || 0;
      const difference = actual - expected;

      const { data: closedShift, error: closeErr } = await supabase
        .from("pos_shifts")
        .update({
          closing_cash_actual: actual,
          closing_cash_expected: expected,
          difference,
          status: "closed",
          closed_at: new Date().toISOString(),
          notes: notes || currentShift.notes
        })
        .eq("id", shift_id)
        .select()
        .single();

      if (closeErr) throw closeErr;
      return NextResponse.json({ success: true, data: closedShift });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

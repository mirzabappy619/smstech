import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, supplier_id, supplier_name, customer_id, customer_name, warehouse_id, items, total_amount, payment_status, notes } = body;
    const supabase = await getSupabaseServerClient();

    if (type === "batch_buy") {
      // 1. Intake bulk purchase from supplier
      if (!warehouse_id || !items?.length) {
        return NextResponse.json({ success: false, error: "warehouse_id and items are required" }, { status: 400 });
      }

      const createdUnits = [];
      for (const it of items) {
        if (it.serial_numbers && Array.isArray(it.serial_numbers)) {
          // Intake serialized batch
          for (const sn of it.serial_numbers) {
            const { data: unit } = await supabase
              .from("device_units")
              .insert({
                product_id: it.product_id,
                warehouse_id,
                serial_number: sn.serial || sn,
                imei_1: sn.imei1 || null,
                battery_health_pct: sn.battery_health ? Number(sn.battery_health) : 100,
                battery_cycles: Number(sn.cycles) || 0,
                cosmetic_grade: sn.grade || "Brand New",
                regional_variant: sn.variant || "Official",
                cost_price: Number(it.unit_cost) || 0,
                selling_price: Number(it.selling_price) || Number(it.unit_cost) * 1.15,
                status: "in_stock"
              })
              .select()
              .single();
            if (unit) createdUnits.push(unit);
          }
        } else {
          // Intake bulk quantitative item
          const { data: inv } = await supabase.from("inventory").select("id, quantity").eq("product_id", it.product_id).eq("warehouse_id", warehouse_id).maybeSingle();
          if (inv) {
            await supabase.from("inventory").update({ quantity: (inv.quantity || 0) + (Number(it.quantity) || 1) }).eq("id", inv.id);
          } else {
            await supabase.from("inventory").insert({ product_id: it.product_id, warehouse_id, quantity: Number(it.quantity) || 1 });
          }
        }
      }

      // Record Supplier Double-Entry Ledger
      if (supplier_id || supplier_name) {
        const billRef = `BILL-IN-${Date.now().toString().slice(-6)}`;
        await supabase.from("party_ledgers").insert({
          party_type: "supplier",
          party_id: supplier_id || "00000000-0000-0000-0000-000000000000",
          party_name: supplier_name || "Central Supplier",
          entry_type: "credit",
          amount: Number(total_amount) || 0,
          balance_after: Number(total_amount) || 0,
          reference_type: "purchase_bill",
          reference_id: billRef,
          notes: notes || "Batch Purchase Intake"
        });
      }

      return NextResponse.json({ success: true, message: `Batch intake completed (${createdUnits.length} serialized units added).` });
    }

    if (type === "batch_sell") {
      // 2. Dispatch bulk wholesale/corporate invoice
      if (!customer_name || !items?.length) {
        return NextResponse.json({ success: false, error: "customer_name and items required" }, { status: 400 });
      }

      const orderNumber = `B2B-${Date.now().toString().slice(-6)}`;
      const { data: order, error } = await supabase
        .from("orders")
        .insert({
          order_number: orderNumber,
          customer_id: customer_id || null,
          customer_name,
          customer_phone: body.customer_phone || "01700000000",
          address_line1: body.address || "Corporate Delivery",
          subtotal: Number(total_amount),
          total: Number(total_amount),
          payment_status: payment_status || "paid",
          status: "delivered",
          invoice_type: "b2b_wholesale",
          warehouse_id,
          notes: notes || "Corporate Wholesale Dispatch"
        })
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({ success: true, data: order, message: `B2B Wholesale order ${orderNumber} created.` });
    }

    return NextResponse.json({ success: false, error: "Invalid procurement type" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

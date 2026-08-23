import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: transfers, error } = await supabase
      .from("branch_transfers")
      .select(`
        *,
        source:warehouses!branch_transfers_source_warehouse_id_fkey(id, name, code),
        target:warehouses!branch_transfers_target_warehouse_id_fkey(id, name, code)
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ success: true, data: transfers || [] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, transfer_id, source_warehouse_id, target_warehouse_id, items, notes } = body;
    const supabase = await getSupabaseServerClient();

    if (action === "create_transfer") {
      if (!source_warehouse_id || !target_warehouse_id || !items?.length) {
        return NextResponse.json({ success: false, error: "Missing required transfer fields" }, { status: 400 });
      }

      const transferNumber = `TRF-${Date.now().toString().slice(-6)}`;
      const { data: transfer, error: trfErr } = await supabase
        .from("branch_transfers")
        .insert({
          transfer_number: transferNumber,
          source_warehouse_id,
          target_warehouse_id,
          status: "pending",
          total_items: items.length,
          notes: notes || null
        })
        .select()
        .single();

      if (trfErr) throw trfErr;

      // Insert items and flag device units as in_transit
      for (const item of items) {
        await supabase.from("branch_transfer_items").insert({
          transfer_id: transfer.id,
          product_id: item.product_id,
          device_unit_id: item.device_unit_id || null,
          quantity: item.quantity || 1
        });

        if (item.device_unit_id) {
          await supabase
            .from("device_units")
            .update({ status: "in_transit" })
            .eq("id", item.device_unit_id);
        }
      }

      return NextResponse.json({ success: true, data: transfer });
    }

    if (action === "update_status") {
      const { status } = body; // 'in_transit' | 'received' | 'rejected'
      if (!transfer_id || !status) {
        return NextResponse.json({ success: false, error: "transfer_id and status required" }, { status: 400 });
      }

      const { data: currentTransfer } = await supabase.from("branch_transfers").select("*").eq("id", transfer_id).single();
      if (!currentTransfer) return NextResponse.json({ success: false, error: "Transfer not found" }, { status: 404 });

      const updatePayload: any = { status };
      if (status === "in_transit") updatePayload.shipped_at = new Date().toISOString();
      if (status === "received") updatePayload.received_at = new Date().toISOString();

      await supabase.from("branch_transfers").update(updatePayload).eq("id", transfer_id);

      // If received, update device units to target branch
      if (status === "received") {
        const { data: transferItems } = await supabase.from("branch_transfer_items").select("*").eq("transfer_id", transfer_id);
        if (transferItems) {
          for (const it of transferItems) {
            if (it.device_unit_id) {
              await supabase
                .from("device_units")
                .update({
                  warehouse_id: currentTransfer.target_warehouse_id,
                  status: "in_stock"
                })
                .eq("id", it.device_unit_id);
            }
          }
        }
      } else if (status === "rejected") {
        // Return back to source warehouse in_stock
        const { data: transferItems } = await supabase.from("branch_transfer_items").select("*").eq("transfer_id", transfer_id);
        if (transferItems) {
          for (const it of transferItems) {
            if (it.device_unit_id) {
              await supabase
                .from("device_units")
                .update({ status: "in_stock" })
                .eq("id", it.device_unit_id);
            }
          }
        }
      }

      return NextResponse.json({ success: true, message: `Transfer updated to ${status}` });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

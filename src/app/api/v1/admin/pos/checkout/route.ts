import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      warehouse_id,
      shift_id,
      customer_id,
      customer_name,
      customer_phone,
      customer_email,
      items,
      payments,
      discount_amount,
      notes
    } = body;

    if (!items || !items.length) {
      return NextResponse.json({ success: false, error: "Cart is empty" }, { status: 400 });
    }

    const supabase = await getSupabaseServerClient();

    const subtotal = items.reduce((sum: number, it: any) => sum + (Number(it.unit_price) * Number(it.quantity)), 0);
    const discount = Number(discount_amount) || 0;
    const finalTotal = Math.max(0, subtotal - discount);

    const paymentBreakdown = payments || [{ method: "cash", amount: finalTotal, reference: "Direct Cash" }];
    const totalTendered = paymentBreakdown.reduce((sum: number, p: any) => sum + Number(p.amount), 0);

    const cashAmount = paymentBreakdown.filter((p: any) => p.method === "cash").reduce((s: number, p: any) => s + Number(p.amount), 0);
    const cardAmount = paymentBreakdown.filter((p: any) => p.method === "card").reduce((s: number, p: any) => s + Number(p.amount), 0);
    const mobileAmount = paymentBreakdown.filter((p: any) => ["bkash", "nagad"].includes(p.method)).reduce((s: number, p: any) => s + Number(p.amount), 0);
    const advanceAmount = paymentBreakdown.filter((p: any) => p.method === "advance").reduce((s: number, p: any) => s + Number(p.amount), 0);
    const dueAmount = paymentBreakdown.filter((p: any) => p.method === "due").reduce((s: number, p: any) => s + Number(p.amount), 0);

    const orderNumber = `POS-${Date.now().toString().slice(-8)}`;

    let resolvedCustomerId = customer_id;
    if (!resolvedCustomerId && customer_phone) {
      const { data: existingCust } = await supabase
        .from("customers")
        .select("id, advance_balance, outstanding_due")
        .eq("phone", customer_phone)
        .maybeSingle();

      if (existingCust) {
        resolvedCustomerId = existingCust.id;
      } else {
        const custCode = `CUST-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const { data: newCust } = await supabase
          .from("customers")
          .insert({
            name: customer_name || "Counter Customer",
            phone: customer_phone,
            email: customer_email || null,
            customer_code: custCode,
            total_orders: 1,
            total_spent: finalTotal
          })
          .select()
          .single();
        if (newCust) resolvedCustomerId = newCust.id;
      }
    }

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        order_number: orderNumber,
        customer_id: resolvedCustomerId || null,
        customer_name: customer_name || "Counter Customer",
        customer_phone: customer_phone || "01700000000",
        customer_email: customer_email || null,
        address_line1: "Counter In-Store Pickup",
        city: "Dhaka",
        shipping_method: "In-Store Counter Handover",
        shipping_amount: 0.00,
        discount_amount: discount,
        subtotal,
        total: finalTotal,
        payment_method: paymentBreakdown.length === 1 ? paymentBreakdown[0].method : "split_payment",
        payment_status: dueAmount > 0 ? (totalTendered - dueAmount > 0 ? "partial" : "pending") : "paid",
        status: "delivered",
        warehouse_id: warehouse_id || null,
        shift_id: shift_id || null,
        invoice_type: "pos",
        advance_deducted: advanceAmount,
        due_amount: dueAmount,
        payment_breakdown: paymentBreakdown,
        notes: notes || "POS In-Store Checkout"
      })
      .select()
      .single();

    if (orderErr) throw orderErr;

    for (const it of items) {
      await supabase.from("order_items").insert({
        order_id: order.id,
        product_id: it.product_id || null,
        product_name: it.product_name,
        unit_price: Number(it.unit_price),
        quantity: Number(it.quantity) || 1,
        total: Number(it.unit_price) * (Number(it.quantity) || 1),
        device_unit_id: it.device_unit_id || null,
        serial_number: it.serial_number || null,
        imei_1: it.imei_1 || null,
        warranty_period: it.warranty || "1 Year SMSTech Warranty"
      });

      if (it.device_unit_id) {
        await supabase
          .from("device_units")
          .update({
            status: "sold",
            sold_order_id: order.id,
            sold_at: new Date().toISOString(),
            warranty_expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
          })
          .eq("id", it.device_unit_id);
      }
    }

    for (const p of paymentBreakdown) {
      await supabase.from("payment_transactions").insert({
        order_id: order.id,
        shift_id: shift_id || null,
        gateway: p.method === "advance" ? "customer_advance" : (p.method === "due" ? "customer_due" : p.method),
        transaction_reference: p.reference || orderNumber,
        amount: Number(p.amount),
        status: "completed",
        raw_payload: { method: p.method, notes: p.notes || "" }
      });
    }

    if (resolvedCustomerId) {
      const { data: custData } = await supabase.from("customers").select("advance_balance, outstanding_due, name, total_orders, total_spent").eq("id", resolvedCustomerId).single();
      if (custData) {
        let newAdvance = Number(custData.advance_balance || 0);
        let newDue = Number(custData.outstanding_due || 0);

        if (advanceAmount > 0) {
          newAdvance = Math.max(0, newAdvance - advanceAmount);
          await supabase.from("party_ledgers").insert({
            party_type: "customer",
            party_id: resolvedCustomerId,
            party_name: custData.name || customer_name,
            entry_type: "debit",
            amount: advanceAmount,
            balance_after: newAdvance,
            reference_type: "sales_invoice",
            reference_id: order.order_number,
            notes: `Advance deduction for invoice ${order.order_number}`
          });
        }

        if (dueAmount > 0) {
          newDue = newDue + dueAmount;
          await supabase.from("party_ledgers").insert({
            party_type: "customer",
            party_id: resolvedCustomerId,
            party_name: custData.name || customer_name,
            entry_type: "debit",
            amount: dueAmount,
            balance_after: newDue,
            reference_type: "sales_invoice",
            reference_id: order.order_number,
            notes: `Partial Due generated on invoice ${order.order_number}`
          });
        }

        await supabase.from("customers").update({
          advance_balance: newAdvance,
          outstanding_due: newDue,
          total_orders: (Number(custData.total_orders) || 0) + 1,
          total_spent: (Number(custData.total_spent) || 0) + finalTotal
        }).eq("id", resolvedCustomerId);
      }
    }

    if (shift_id) {
      const { data: shift } = await supabase.from("pos_shifts").select("*").eq("id", shift_id).single();
      if (shift) {
        await supabase.from("pos_shifts").update({
          cash_sales_total: Number(shift.cash_sales_total || 0) + cashAmount,
          card_sales_total: Number(shift.card_sales_total || 0) + cardAmount,
          mobile_sales_total: Number(shift.mobile_sales_total || 0) + mobileAmount,
          wallet_sales_total: Number(shift.wallet_sales_total || 0) + advanceAmount,
          dues_created_total: Number(shift.dues_created_total || 0) + dueAmount
        }).eq("id", shift_id);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        order,
        orderNumber: order.order_number,
        total: finalTotal,
        dueAmount,
        advanceDeducted: advanceAmount
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

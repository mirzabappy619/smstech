import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { customer_id, amount, payment_method, reference, notes } = body;

    if (!customer_id || !amount || Number(amount) <= 0) {
      return NextResponse.json({ success: false, error: "customer_id and a valid amount are required" }, { status: 400 });
    }

    const payAmount = Number(amount);
    const supabase = await getSupabaseServerClient();

    const { data: customer, error: fetchErr } = await supabase
      .from("customers")
      .select("id, name, phone, outstanding_due, advance_balance")
      .eq("id", customer_id)
      .single();

    if (fetchErr || !customer) {
      return NextResponse.json({ success: false, error: "Customer not found" }, { status: 404 });
    }

    const currentDue = Number(customer.outstanding_due) || 0;
    const newDue = Math.max(0, currentDue - payAmount);
    const excess = Math.max(0, payAmount - currentDue);
    const newAdvance = (Number(customer.advance_balance) || 0) + excess;

    const receiptNumber = `DUE-RCP-${Date.now().toString().slice(-6)}`;

    // 1. Insert Ledger entry
    await supabase.from("party_ledgers").insert({
      party_type: "customer",
      party_id: customer.id,
      party_name: customer.name,
      entry_type: "credit",
      amount: payAmount,
      balance_after: newDue,
      reference_type: "due_clearance",
      reference_id: receiptNumber,
      notes: notes || `Due collection received via ${payment_method || 'cash'} (Ref: ${reference || 'N/A'})`
    });

    // 2. Update Customer Record
    await supabase
      .from("customers")
      .update({
        outstanding_due: newDue,
        advance_balance: newAdvance
      })
      .eq("id", customer.id);

    return NextResponse.json({
      success: true,
      data: {
        receiptNumber,
        customerName: customer.name,
        amountCollected: payAmount,
        previousDue: currentDue,
        remainingDue: newDue,
        advanceAdded: excess,
        date: new Date().toISOString()
      },
      message: `Due payment of ৳${payAmount} received from ${customer.name}. Remaining due: ৳${newDue}`
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

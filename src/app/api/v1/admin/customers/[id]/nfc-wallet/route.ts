import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action, nfc_card_uid, loyalty_tier, credit_limit, advance_deposit, reason } = body;

    const supabase = await getSupabaseServerClient();
    const { data: customer, error: custErr } = await supabase.from("customers").select("*").eq("id", id).single();
    if (custErr || !customer) {
      return NextResponse.json({ success: false, error: "Customer not found" }, { status: 404 });
    }

    if (action === "bind_nfc") {
      const { data: updated, error } = await supabase
        .from("customers")
        .update({ nfc_card_uid })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ success: true, data: updated, message: `NFC card ${nfc_card_uid} bound successfully.` });
    }

    if (action === "update_tier") {
      const { data: updated, error } = await supabase
        .from("customers")
        .update({
          loyalty_tier: loyalty_tier || customer.loyalty_tier,
          credit_limit: credit_limit !== undefined ? Number(credit_limit) : customer.credit_limit
        })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ success: true, data: updated });
    }

    if (action === "add_advance") {
      const deposit = Number(advance_deposit) || 0;
      if (deposit <= 0) return NextResponse.json({ success: false, error: "Valid deposit amount required" }, { status: 400 });

      const newBalance = (Number(customer.advance_balance) || 0) + deposit;
      await supabase.from("customers").update({ advance_balance: newBalance }).eq("id", id);

      const refId = `DEP-${Date.now().toString().slice(-6)}`;
      await supabase.from("party_ledgers").insert({
        party_type: "customer",
        party_id: customer.id,
        party_name: customer.name,
        entry_type: "credit",
        amount: deposit,
        balance_after: newBalance,
        reference_type: "advance_deposit",
        reference_id: refId,
        notes: reason || "Advance Deposit Wallet Top-Up"
      });

      return NextResponse.json({ success: true, newBalance, message: `Added ৳${deposit} advance deposit.` });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

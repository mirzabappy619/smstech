import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customer_id");

    const supabase = await getSupabaseServerClient();
    const { data: customer, error } = await supabase.from("customers").select("*").eq("id", customerId).maybeSingle();

    if (error || !customer) {
      return NextResponse.json({ success: false, error: "Customer not found" }, { status: 404 });
    }

    const nfcPayload = {
      tag: "SMSTECH_PRIVILEGE",
      customerId: customer.id,
      code: customer.customer_code,
      tier: customer.loyalty_tier,
      balance: customer.advance_balance,
      timestamp: Date.now()
    };

    return NextResponse.json({
      success: true,
      data: {
        customer,
        nfcPayload: JSON.stringify(nfcPayload)
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

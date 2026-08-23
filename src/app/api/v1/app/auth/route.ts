import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { phone } = await request.json();
    if (!phone) {
      return NextResponse.json({ success: false, error: "Phone number required" }, { status: 400 });
    }

    const supabase = await getSupabaseServerClient();
    let { data: customer } = await supabase.from("customers").select("*").eq("phone", phone).maybeSingle();

    if (!customer) {
      const custCode = `CUST-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const { data: newCust } = await supabase
        .from("customers")
        .insert({
          name: "Mobile App Customer",
          phone,
          customer_code: custCode,
          loyalty_tier: "Silver"
        })
        .select()
        .single();
      customer = newCust;
    }

    const mockJwt = `app_token_${customer?.id || 'demo'}_${Date.now()}`;

    return NextResponse.json({
      success: true,
      token: mockJwt,
      customer: {
        id: customer?.id,
        name: customer?.name,
        phone: customer?.phone,
        customer_code: customer?.customer_code,
        loyalty_tier: customer?.loyalty_tier,
        advance_balance: customer?.advance_balance || 0,
        outstanding_due: customer?.outstanding_due || 0
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const partyType = searchParams.get("party_type") || "all"; // 'customer' | 'supplier' | 'all'
    const partyId = searchParams.get("party_id");

    const supabase = await getSupabaseServerClient();
    let query = supabase.from("party_ledgers").select("*").order("created_at", { ascending: false });

    if (partyType !== "all") query = query.eq("party_type", partyType);
    if (partyId) query = query.eq("party_id", partyId);

    const { data: entries, error } = await query.limit(100);
    if (error) throw error;

    // Also calculate global summary metrics
    const { data: customers } = await supabase.from("customers").select("advance_balance, outstanding_due");
    const totalDuesReceivable = customers?.reduce((s, c) => s + (Number(c.outstanding_due) || 0), 0) || 0;
    const totalAdvanceLiabilities = customers?.reduce((s, c) => s + (Number(c.advance_balance) || 0), 0) || 0;

    return NextResponse.json({
      success: true,
      data: entries || [],
      summary: {
        totalDuesReceivable,
        totalAdvanceLiabilities
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

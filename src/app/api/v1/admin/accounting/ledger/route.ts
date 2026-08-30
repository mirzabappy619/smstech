import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const partyType = searchParams.get("party_type") || "all"; // 'customer' | 'supplier' | 'all'
    const partyId = searchParams.get("party_id");

    const supabase = await getSupabaseServerClient();
    let query = supabase
      .from("party_ledgers")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (partyType !== "all") query = query.eq("party_type", partyType);
    if (partyId) query = query.eq("party_id", partyId);

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "50", 10)),
    );
    const offset = (page - 1) * limit;

    const { data: entries, error, count } = await query.range(
      offset,
      offset + limit - 1,
    );
    if (error) throw error;

    // Summaries run as SQL aggregates. Reducing an unbounded `.select()` in
    // JavaScript silently stopped at PostgREST's 1000-row ceiling, so these
    // totals froze once the store passed 1000 customers.
    const [balances, supplierBalances] = await Promise.all([
      supabase.rpc("admin_customer_balances"),
      supabase.rpc("admin_supplier_balances"),
    ]);

    const row = balances.data?.[0];
    const round2 = (n: number) => Math.round(n * 100) / 100;

    return NextResponse.json({
      success: true,
      data: entries || [],
      meta: { page, limit, total: count ?? 0 },
      summary: {
        totalDuesReceivable: round2(Number(row?.dues_receivable) || 0),
        totalAdvanceLiabilities: round2(Number(row?.advance_liabilities) || 0),
        totalSupplierPayables: round2(
          Number(supplierBalances.data?.[0]?.payables) || 0,
        ),
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

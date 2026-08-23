import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const q = searchParams.get("q");

    const supabase = await getSupabaseServerClient();
    let query = supabase.from("products").select("id, name, slug, brand, base_price, compare_at_price, images, specs, warranty, stock_status").eq("is_active", true);

    if (category) query = query.eq("subcategory", category);
    if (q) query = query.ilike("name", `%${q}%`);

    const { data: products, error } = await query.limit(50);
    if (error) throw error;

    return NextResponse.json({ success: true, data: products || [] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { buildIlikeOr } from "@/lib/supabase/filters";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const nfcUid = searchParams.get("uid")?.trim();
    const query = searchParams.get("query")?.trim(); // Phone, Name, or CUST-XXXXX

    const supabase = await getSupabaseServerClient();
    let dbQuery = supabase.from("customers").select("*");

    if (nfcUid) {
      dbQuery = dbQuery.eq("nfc_card_uid", nfcUid);
    } else if (query) {
      const filter = buildIlikeOr(["phone", "name", "customer_code"], query);
      if (filter) dbQuery = dbQuery.or(filter);
    } else {
      const { data: recentCustomers } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      return NextResponse.json({ success: true, data: recentCustomers || [] });
    }

    // A name or partial phone can legitimately match several people.
    // maybeSingle() turned that into an error; return the candidates instead
    // so the cashier can pick.
    const { data: matches, error } = await dbQuery
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) throw error;

    if (!matches || matches.length === 0) {
      return NextResponse.json({ success: false, message: "Customer not found" }, { status: 404 });
    }

    if (matches.length > 1) {
      return NextResponse.json({
        success: true,
        data: { customer: null, matches, recentOrders: [], preBookings: [] }
      });
    }

    const customer = matches[0];

    // Also fetch last 5 purchase orders and active pre-bookings
    const { data: recentOrders } = await supabase
      .from("orders")
      .select("id, order_number, total, created_at, status, payment_status")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false })
      .limit(5);

    const { data: preBookings } = await supabase
      .from("pre_bookings")
      .select("id, booking_number, total_price, advance_paid, remaining_due, queue_priority, status")
      .eq("customer_id", customer.id)
      .in("status", ["queued", "allocated", "ready_for_pickup"]);

    return NextResponse.json({
      success: true,
      data: {
        customer,
        matches: [customer],
        recentOrders: recentOrders || [],
        preBookings: preBookings || []
      }
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

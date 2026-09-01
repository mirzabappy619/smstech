import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

// GET pre-bookings for a customer or product
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customer_id");
    const phone = searchParams.get("phone");

    const supabase = await getSupabaseServerClient();
    let query = supabase
      .from("pre_bookings")
      .select(`
        *,
        products (
          id,
          name,
          images,
          base_price,
          brand
        )
      `)
      .order("queue_priority", { ascending: true });

    if (customerId) query = query.eq("customer_id", customerId);
    if (phone) query = query.eq("customer_phone", phone);

    const { data: bookings, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, data: bookings || [] });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Create Pre-Booking & Calculate Queue Priority
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      customer_name,
      customer_phone,
      customer_email,
      product_id,
      variation_id,
      target_warehouse_id,
      total_price,
      advance_paid,
      payment_method
    } = body;

    if (!customer_name || !customer_phone || !product_id || !advance_paid) {
      return NextResponse.json(
        { success: false, error: "customer_name, customer_phone, product_id, and advance_paid are required." },
        { status: 400 }
      );
    }

    const supabase = await getSupabaseServerClient();

    // 1. Load the product so the deposit is checked against its own setting
    //    rather than whatever the client decided to send.
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, is_active, preorder_deposit_pct")
      .eq("id", product_id)
      .single();

    if (productError || !product || !product.is_active) {
      return NextResponse.json(
        { success: false, error: "Product not found or unavailable." },
        { status: 404 }
      );
    }

    const price = Number(total_price);
    const advance = Number(advance_paid);
    if (!(price > 0) || !(advance > 0)) {
      return NextResponse.json(
        { success: false, error: "total_price and advance_paid must be positive amounts." },
        { status: 400 }
      );
    }

    const depositPct = Number(product.preorder_deposit_pct) || 10;
    // Round down by one taka so client-side rounding of the deposit never
    // trips the check on an otherwise valid booking.
    const minimumAdvance = Math.floor((price * depositPct) / 100) - 1;
    if (advance < minimumAdvance) {
      return NextResponse.json(
        {
          success: false,
          error: `A deposit of at least ${depositPct}% (৳${Math.ceil((price * depositPct) / 100)}) is required for this product.`,
        },
        { status: 400 }
      );
    }

    // 2. Calculate next Queue Priority Rank for this product
    const { count } = await supabase
      .from("pre_bookings")
      .select("*", { count: "exact", head: true })
      .eq("product_id", product_id)
      .in("status", ["queued", "allocated"]);

    const nextPriority = (count || 0) + 1;
    const bookingNumber = `PRE-${Date.now().toString().slice(-6)}`;
    const remainingDue = Math.max(0, price - advance);

    // 3. Insert Pre-Booking
    const { data: booking, error } = await supabase
      .from("pre_bookings")
      .insert({
        booking_number: bookingNumber,
        customer_name,
        customer_phone,
        customer_email: customer_email || null,
        product_id,
        variation_id: variation_id || null,
        target_warehouse_id: target_warehouse_id || null,
        queue_priority: nextPriority,
        total_price: price,
        advance_paid: advance,
        remaining_due: remainingDue,
        payment_method: payment_method || "bkash",
        payment_status: "paid",
        status: "queued"
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: booking,
      message: `Pre-booking #${bookingNumber} confirmed! Queue Priority: #${nextPriority}`
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

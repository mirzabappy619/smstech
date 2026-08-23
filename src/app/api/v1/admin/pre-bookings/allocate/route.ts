import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { product_id, warehouse_id } = body;

    const supabase = await getSupabaseServerClient();

    // 1. Find waiting pre-orders for this product ordered by queue_priority
    let bookingQuery = supabase
      .from("pre_bookings")
      .select("*")
      .eq("status", "queued")
      .order("queue_priority", { ascending: true });

    if (product_id) bookingQuery = bookingQuery.eq("product_id", product_id);

    const { data: waitingBookings } = await bookingQuery;

    if (!waitingBookings || waitingBookings.length === 0) {
      return NextResponse.json({ success: true, message: "No queued pre-bookings waiting for allocation." });
    }

    // 2. Find available in_stock device units
    let unitQuery = supabase
      .from("device_units")
      .select("id, product_id, serial_number")
      .eq("status", "in_stock");

    if (product_id) unitQuery = unitQuery.eq("product_id", product_id);
    if (warehouse_id) unitQuery = unitQuery.eq("warehouse_id", warehouse_id);

    const { data: availableUnits } = await unitQuery;

    if (!availableUnits || availableUnits.length === 0) {
      return NextResponse.json({ success: false, error: "No available in-stock device units to allocate." });
    }

    const allocations = [];
    const availablePool = [...availableUnits];

    for (const booking of waitingBookings) {
      const matchIndex = availablePool.findIndex(u => u.product_id === booking.product_id);
      if (matchIndex !== -1) {
        const unit = availablePool.splice(matchIndex, 1)[0];

        // Update device unit to reserved
        await supabase.from("device_units").update({ status: "reserved" }).eq("id", unit.id);

        // Update pre-booking to allocated
        await supabase
          .from("pre_bookings")
          .update({
            allocated_unit_id: unit.id,
            allocated_at: new Date().toISOString(),
            status: "allocated"
          })
          .eq("id", booking.id);

        allocations.push({
          bookingNumber: booking.booking_number,
          customerName: booking.customer_name,
          customerPhone: booking.customer_phone,
          serialNumber: unit.serial_number
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: allocations,
      message: `Successfully auto-allocated ${allocations.length} device units to waiting pre-orders.`
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

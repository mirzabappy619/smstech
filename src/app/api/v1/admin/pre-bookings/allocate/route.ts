import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/rbac/rbac-service";

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, "inventory:serials");
    if (auth.error) return auth.error;

    const body = await request.json();
    const { product_id, warehouse_id } = body;

    if (
      warehouse_id &&
      !auth.userRBAC.branchContext.isAllBranches &&
      !auth.userRBAC.branchContext.branchIds.includes(warehouse_id)
    ) {
      return NextResponse.json(
        { success: false, error: "You do not have access to this branch." },
        { status: 403 },
      );
    }

    const supabase = await getSupabaseServerClient();

    // 1. Find waiting pre-orders for this product ordered by queue_priority
    let bookingQuery = supabase
      .from("pre_bookings")
      .select("*")
      .eq("status", "queued")
      .order("queue_priority", { ascending: true })
      // Bookings sharing a priority are served in the order they were taken,
      // rather than whatever order the database happened to return.
      .order("created_at", { ascending: true });

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

    // Oldest stock first, so units do not sit on the shelf indefinitely.
    unitQuery = unitQuery.order("created_at", { ascending: true });

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

        // Reserve the unit. The status guard makes this a no-op if another
        // allocation run claimed the same unit a moment earlier.
        const { data: claimed } = await supabase
          .from("device_units")
          .update({ status: "reserved" })
          .eq("id", unit.id)
          .eq("status", "in_stock")
          .select("id")
          .maybeSingle();

        if (!claimed) continue;

        const { data: allocated } = await supabase
          .from("pre_bookings")
          .update({
            allocated_unit_id: unit.id,
            allocated_at: new Date().toISOString(),
            status: "allocated"
          })
          .eq("id", booking.id)
          .eq("status", "queued")
          .select("id")
          .maybeSingle();

        if (!allocated) {
          // Booking was taken by another run — release the unit again.
          await supabase
            .from("device_units")
            .update({ status: "in_stock" })
            .eq("id", unit.id);
          continue;
        }

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

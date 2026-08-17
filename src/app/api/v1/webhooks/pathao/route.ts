import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Pathao sends merchant_order_id, consignment_id, order_status, etc.
    const consignment_id = body.consignment_id;
    const order_status = body.order_status;
    
    if (!consignment_id || !order_status) {
      return NextResponse.json({ success: false, message: 'Invalid payload' }, { status: 400 });
    }

    const supabase = await createAdminClient();
    
    // Find the order
    const { data: order } = await supabase
      .from('orders')
      .select('id, status, courier_data')
      .eq('courier_consignment_id', consignment_id)
      .single();

    if (!order) {
      // Order not found, but we return 200 to acknowledge receipt
      return NextResponse.json({ success: true, message: 'Order not found' });
    }

    let newOrderStatus = order.status;
    const lowerStatus = order_status.toLowerCase();
    
    if (lowerStatus.includes('delivered')) {
      newOrderStatus = 'delivered';
    } else if (lowerStatus.includes('cancelled') || lowerStatus.includes('returned')) {
      newOrderStatus = 'cancelled';
    }

    // Merge existing courier data with webhook payload
    const existingData = typeof order.courier_data === 'object' && order.courier_data !== null ? order.courier_data : {};
    const updatedCourierData = { ...existingData, ...body };

    // Update order
    await supabase
      .from('orders')
      .update({
        courier_status: order_status,
        status: newOrderStatus,
        courier_data: updatedCourierData,
      })
      .eq('id', order.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Pathao webhook error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

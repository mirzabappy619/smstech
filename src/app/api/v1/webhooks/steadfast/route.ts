import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Steadfast typically sends consignment_id, invoice, status, tracking_code
    const consignment_id = body.consignment_id || body.tracking_code;
    const invoice = body.invoice;
    const status = body.status;
    
    if ((!consignment_id && !invoice) || !status) {
      return NextResponse.json({ success: false, message: 'Invalid payload' }, { status: 400 });
    }

    const supabase = await createAdminClient();
    
    // Find the order by consignment_id OR invoice (order_number)
    let query = supabase.from('orders').select('id, status, courier_data');
    
    if (consignment_id) {
      query = query.eq('courier_consignment_id', consignment_id);
    } else if (invoice) {
      query = query.eq('order_number', invoice);
    }
    
    const { data: order } = await query.single();

    if (!order) {
      return NextResponse.json({ success: true, message: 'Order not found' });
    }

    let newOrderStatus = order.status;
    const lowerStatus = status.toLowerCase();
    
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
        courier_status: status,
        status: newOrderStatus,
        courier_data: updatedCourierData,
      })
      .eq('id', order.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Steadfast webhook error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

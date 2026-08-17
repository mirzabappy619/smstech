import { NextRequest } from 'next/server';
import { requireAdmin, successResponse, errorResponse, HTTP_STATUS } from '@/lib/api-utils';
import { createAdminClient } from '@/lib/supabase/server';
import { PathaoService } from '@/infrastructure/courier/pathao-service';
import { SteadfastService } from '@/infrastructure/courier/steadfast-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { error: authError } = await requireAdmin(request);
    if (authError) return authError;
    
    const { orderId } = await params;

    const supabase = await createAdminClient();
    
    // Fetch order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, courier_provider, courier_consignment_id, status, courier_status')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return errorResponse('ORDER_NOT_FOUND', 'Order not found', HTTP_STATUS.NOT_FOUND);
    }

    if (!order.courier_provider || !order.courier_consignment_id) {
      return errorResponse('NO_COURIER_DATA', 'Order has not been sent to a courier', HTTP_STATUS.BAD_REQUEST);
    }

    // Fetch settings
    const { data: settings, error: settingsError } = await supabase
      .from('courier_settings')
      .select('*')
      .single();

    if (settingsError || !settings) {
      return errorResponse('SETTINGS_NOT_FOUND', 'Courier settings not found', HTTP_STATUS.NOT_FOUND);
    }
    
    let courierStatus: string | null = null;
    let statusResult: Record<string, unknown> = {};

    if (order.courier_provider === 'pathao') {
      const pathaoService = new PathaoService(settings);
      const info = await pathaoService.getOrderInfo(order.courier_consignment_id);
      courierStatus = info?.order_status_slug || info?.order_status || null;
      statusResult = { status: courierStatus, ...info };
    } else if (order.courier_provider === 'steadfast') {
      const steadfastService = new SteadfastService(settings);
      const info = await steadfastService.getStatusByConsignmentId(order.courier_consignment_id);
      courierStatus = info?.delivery_status || null;
      statusResult = { status: courierStatus, ...info };
    }

    if (!courierStatus) {
      return errorResponse('COURIER_ERROR', 'Failed to fetch status from courier', HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
    
    const newCourierStatus = courierStatus || order.courier_status;
    let newOrderStatus = order.status;
    
    const lowerStatus = newCourierStatus.toLowerCase();
    if (lowerStatus.includes('delivered')) {
      newOrderStatus = 'delivered';
    } else if (lowerStatus.includes('cancelled') || lowerStatus.includes('returned')) {
      newOrderStatus = 'cancelled';
    }

    if (newCourierStatus !== order.courier_status || newOrderStatus !== order.status) {
      await supabase
        .from('orders')
        .update({
          courier_status: newCourierStatus,
          status: newOrderStatus
        })
        .eq('id', order.id);
    }

    return successResponse(statusResult);
  } catch (error: any) {
    console.error('Courier status GET error:', error);
    return errorResponse('COURIER_API_ERROR', error.message || 'Failed to check status', HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

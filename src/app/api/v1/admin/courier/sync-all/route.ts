import { NextRequest } from 'next/server';
import { requireAdmin, successResponse, errorResponse, HTTP_STATUS } from '@/lib/api-utils';
import { createAdminClient } from '@/lib/supabase/server';
import { CourierService } from '@/infrastructure/courier';

export async function POST(request: NextRequest) {
  try {
    const { error: authError } = await requireAdmin(request);
    if (authError) return authError;

    const supabase = await createAdminClient();

    // Fetch active courier orders that are not in final state
    const { data: activeOrders, error } = await supabase
      .from('orders')
      .select('id, courier_provider, courier_consignment_id, courier_status')
      .not('courier_consignment_id', 'is', null);

    if (error) {
      return errorResponse('DATABASE_ERROR', error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }

    const pendingOrders = (activeOrders || []).filter(o => {
      const st = (o.courier_status || '').toLowerCase();
      return !st.includes('delivered') && !st.includes('cancel') && !st.includes('return');
    });

    let updatedCount = 0;
    const results: Array<{ orderId: string; success: boolean; status?: string }> = [];

    for (const order of pendingOrders) {
      try {
        const res = await CourierService.getStatus(order.id);
        if (res) {
          updatedCount++;
          results.push({ orderId: order.id, success: true, status: res.status });
        } else {
          results.push({ orderId: order.id, success: false });
        }
      } catch (err) {
        results.push({ orderId: order.id, success: false });
      }
    }

    return successResponse({
      totalSynced: pendingOrders.length,
      updatedCount,
      details: results,
    });
  } catch (error: any) {
    console.error('Courier sync-all POST error:', error);
    return errorResponse('INTERNAL_ERROR', error.message || 'Internal server error', HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

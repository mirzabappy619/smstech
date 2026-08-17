import { NextRequest } from 'next/server';
import { requireAdmin, successResponse, errorResponse, HTTP_STATUS } from '@/lib/api-utils';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { error: authError } = await requireAdmin(request);
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim() || '';
    const provider = searchParams.get('provider')?.trim() || '';
    const status = searchParams.get('status')?.trim() || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    const supabase = await createAdminClient();

    // Query all orders with courier consignment ID
    let query = supabase
      .from('orders')
      .select('id, order_number, total, payment_status, status, shipping_address, courier_provider, courier_consignment_id, courier_tracking_code, courier_status, courier_delivery_fee, courier_data, courier_sent_at, created_at', { count: 'exact' })
      .not('courier_consignment_id', 'is', null);

    if (provider && provider !== 'all') {
      query = query.eq('courier_provider', provider);
    }

    if (status && status !== 'all') {
      query = query.ilike('courier_status', `%${status}%`);
    }

    if (search) {
      query = query.or(`order_number.ilike.%${search}%,courier_consignment_id.ilike.%${search}%,courier_tracking_code.ilike.%${search}%`);
    }

    query = query.order('courier_sent_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data: orders, count, error: fetchError } = await query;

    if (fetchError) {
      return errorResponse('DATABASE_ERROR', fetchError.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }

    // Fetch summary stats across all courier orders
    const { data: allCourierOrders } = await supabase
      .from('orders')
      .select('courier_provider, courier_status, courier_delivery_fee')
      .not('courier_consignment_id', 'is', null);

    const stats = {
      totalSent: allCourierOrders?.length || 0,
      pathaoCount: allCourierOrders?.filter(o => o.courier_provider === 'pathao').length || 0,
      steadfastCount: allCourierOrders?.filter(o => o.courier_provider === 'steadfast').length || 0,
      pendingCount: allCourierOrders?.filter(o => {
        const st = (o.courier_status || '').toLowerCase();
        return !st.includes('delivered') && !st.includes('cancel') && !st.includes('return');
      }).length || 0,
      deliveredCount: allCourierOrders?.filter(o => (o.courier_status || '').toLowerCase().includes('delivered')).length || 0,
      cancelledCount: allCourierOrders?.filter(o => {
        const st = (o.courier_status || '').toLowerCase();
        return st.includes('cancel') || st.includes('return');
      }).length || 0,
      totalDeliveryFees: allCourierOrders?.reduce((acc, o) => acc + (Number(o.courier_delivery_fee) || 0), 0) || 0,
    };

    return successResponse({
      deliveries: orders || [],
      stats,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: any) {
    console.error('Courier deliveries GET error:', error);
    return errorResponse('INTERNAL_ERROR', error.message || 'Internal server error', HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

import { NextRequest } from 'next/server';
import { requireAdmin, successResponse, errorResponse, HTTP_STATUS, validateRequest } from '@/lib/api-utils';
import { createAdminClient } from '@/lib/supabase/server';
import { PathaoService } from '@/infrastructure/courier/pathao-service';
import { SteadfastService } from '@/infrastructure/courier/steadfast-service';
import { isValidBDPhone, normalizeBDPhone, BD_PHONE_ERROR_MESSAGE } from '@/lib/bd-phone-validator';
import { z } from 'zod';

const sendOrderSchema = z.object({
  orderId: z.string().uuid(),
  provider: z.enum(['pathao', 'steadfast']),
  storeId: z.number().optional(),
  store_id: z.number().optional(),
  specialInstruction: z.string().optional(),
  itemWeight: z.number().optional(),
  deliveryType: z.number().optional(),
  itemType: z.number().optional()
});

export async function POST(request: NextRequest) {
  try {
    const { error: authError } = await requireAdmin(request);
    if (authError) return authError;

    const { data, error: validationError } = await validateRequest(request, sendOrderSchema);
    if (validationError) return validationError;

    const supabase = await createAdminClient();

    // Fetch order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        order_items ( id, quantity )
      `)
      .eq('id', data.orderId)
      .single();

    if (orderError || !order) {
      return errorResponse('ORDER_NOT_FOUND', 'Order not found', HTTP_STATUS.NOT_FOUND);
    }

    if (order.courier_consignment_id) {
      return errorResponse('ALREADY_SENT', 'Order has already been sent to a courier', HTTP_STATUS.BAD_REQUEST);
    }

    // Fetch settings
    const { data: settings, error: settingsError } = await supabase
      .from('courier_settings')
      .select('*')
      .single();

    if (settingsError || !settings) {
      return errorResponse('SETTINGS_NOT_FOUND', 'Courier settings not found', HTTP_STATUS.NOT_FOUND);
    }
    
    // Default address fallback parsing
    const shipping_address = order.shipping_address as any || {};
    const recipient_name = `${shipping_address.first_name || ''} ${shipping_address.last_name || ''}`.trim() || 'Unknown';
    const rawPhone = shipping_address.phone || '';
    if (!isValidBDPhone(rawPhone)) {
      return errorResponse('INVALID_PHONE', `Recipient phone number "${rawPhone}" is invalid: ${BD_PHONE_ERROR_MESSAGE}`, HTTP_STATUS.BAD_REQUEST);
    }
    const recipient_phone = normalizeBDPhone(rawPhone);
    const address_line2 = shipping_address.address_line2 ? `, ${shipping_address.address_line2}` : '';
    const recipient_address = `${shipping_address.address_line1 || ''}${address_line2}, ${shipping_address.city || ''}, ${shipping_address.state || ''} ${shipping_address.postal_code || ''}`.trim();
    
    const amount_to_collect = order.payment_method === 'cash_on_delivery' ? Math.round(Number(order.total)) : 0;
    
    let courierResult: any;

    if (data.provider === 'pathao') {
      const pathaoService = new PathaoService(settings);
      
      const item_quantity = (order.order_items || []).reduce((acc: number, item: any) => acc + (item.quantity || 1), 0);
      
      courierResult = await pathaoService.createOrder({
        store_id: data.storeId || data.store_id || settings.pathao_default_store_id || 388178,
        merchant_order_id: order.order_number,
        recipient_name,
        recipient_phone,
        recipient_address,
        recipient_city: shipping_address.city_id || 0,
        recipient_zone: shipping_address.zone_id || 0,
        recipient_area: shipping_address.area_id,
        delivery_type: data.deliveryType || 48,
        item_type: data.itemType || 2,
        special_instruction: data.specialInstruction,
        item_quantity,
        item_weight: data.itemWeight || 0.5,
        amount_to_collect
      });
      
    } else if (data.provider === 'steadfast') {
      const steadfastService = new SteadfastService(settings);
      
      courierResult = await steadfastService.createOrder({
        invoice: order.order_number,
        recipient_name,
        recipient_phone,
        recipient_address,
        cod_amount: amount_to_collect,
        note: data.specialInstruction
      });
    }

    if (!courierResult) {
      return errorResponse('COURIER_ERROR', 'Failed to create order with courier', HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }

    // Update order
    const tracking_code = courierResult.tracking_code || courierResult.consignment_id;
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({
        courier_provider: data.provider,
        courier_consignment_id: courierResult.consignment_id,
        courier_tracking_code: tracking_code,
        courier_status: courierResult.status || 'pending',
        courier_delivery_fee: courierResult.delivery_fee || 0,
        courier_data: courierResult,
        courier_sent_at: new Date().toISOString(),
        status: 'shipped',
        tracking_number: tracking_code
      })
      .eq('id', order.id)
      .select()
      .single();

    if (updateError) {
      return errorResponse('DATABASE_ERROR', 'Failed to update order with courier data', HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }

    return successResponse(updatedOrder);
  } catch (error: any) {
    console.error('Courier send POST error:', error);
    return errorResponse('COURIER_API_ERROR', error.message || 'Failed to send to courier', HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

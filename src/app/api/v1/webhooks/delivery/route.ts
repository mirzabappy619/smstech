import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { jsonResponse, errorResponse } from '@/lib/api-utils';
import { emailService } from '@/infrastructure/email';

// Supported delivery providers
type DeliveryProvider = 'fedex' | 'ups' | 'usps' | 'dhl' | 'custom';

interface DeliveryWebhookPayload {
  provider: DeliveryProvider;
  event_type: string;
  tracking_number: string;
  status: string;
  status_detail?: string;
  location?: {
    city?: string;
    state?: string;
    country?: string;
  };
  timestamp: string;
  estimated_delivery?: string;
  signature?: string;
}

// Map provider status to internal order status
const statusMapping: Record<string, string> = {
  // Common statuses across providers
  'picked_up': 'shipped',
  'in_transit': 'shipped',
  'out_for_delivery': 'out_for_delivery',
  'delivered': 'delivered',
  'delivery_attempted': 'shipped',
  'exception': 'shipped',
  'returned': 'cancelled',
  // FedEx specific
  'FD': 'delivered',
  'IT': 'shipped',
  'OD': 'out_for_delivery',
  // UPS specific
  'D': 'delivered',
  'I': 'shipped',
  'O': 'out_for_delivery',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const provider = request.headers.get('x-delivery-provider') as DeliveryProvider;

    // Parse payload
    let payload: DeliveryWebhookPayload;
    try {
      payload = JSON.parse(body);
      payload.provider = provider || payload.provider || 'custom';
    } catch {
      return errorResponse('INVALID_JSON', 'Invalid JSON payload', 400);
    }

    // Validate required fields
    if (!payload.tracking_number || !payload.status) {
      return errorResponse('MISSING_FIELDS', 'Missing required fields: tracking_number, status', 400);
    }

    const supabase = await createServerClient();

    // Find order by tracking number
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        status,
        user_id,
        users (
          email,
          first_name,
          last_name
        )
      `)
      .eq('tracking_number', payload.tracking_number)
      .single();

    if (orderError || !order) {
      console.log(`Order not found for tracking: ${payload.tracking_number}`);
      // Don't error - might be a test webhook or old tracking number
      return jsonResponse({ received: true, processed: false, reason: 'order_not_found' });
    }

    // Map provider status to internal status
    const mappedStatus = statusMapping[payload.status] || statusMapping[payload.event_type] || null;
    
    // Only update if we have a valid mapped status
    if (mappedStatus && mappedStatus !== order.status) {
      const updateData: Record<string, unknown> = {
        status: mappedStatus,
        updated_at: new Date().toISOString(),
      };

      // Set delivered_at timestamp
      if (mappedStatus === 'delivered') {
        updateData.delivered_at = payload.timestamp || new Date().toISOString();
      }

      // Update estimated delivery if provided
      if (payload.estimated_delivery) {
        updateData.estimated_delivery = payload.estimated_delivery;
      }

      // Update order
      const { error: updateError } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', order.id);

      if (updateError) {
        console.error('Failed to update order:', updateError);
        return errorResponse('UPDATE_FAILED', 'Failed to update order', 500);
      }

      // Log tracking event
      await supabase.from('order_tracking_events').insert({
        order_id: order.id,
        provider: payload.provider,
        status: payload.status,
        status_detail: payload.status_detail,
        location: payload.location,
        timestamp: payload.timestamp,
      });

      // Send notification email for significant events
      const user = (order.users as unknown) as { email: string; first_name: string; last_name: string } | null;
      if (user?.email) {
        if (mappedStatus === 'shipped' && order.status === 'processing') {
          // Order just shipped - send notification
          await emailService.sendOrderShipped(user.email, {
            customerName: user.first_name || 'Customer',
            orderNumber: order.order_number,
            trackingNumber: payload.tracking_number,
            trackingUrl: getTrackingUrl(payload.provider, payload.tracking_number),
            carrier: getCarrierName(payload.provider),
            estimatedDelivery: payload.estimated_delivery || 'Check tracking for updates',
          });
        } else if (mappedStatus === 'delivered') {
          // Order delivered - could send delivery confirmation
          console.log(`Order ${order.order_number} delivered`);
        }
      }
    }

    return jsonResponse({
      received: true,
      processed: true,
      order_number: order.order_number,
      new_status: mappedStatus,
    });
  } catch (error) {
    console.error('Delivery webhook error:', error);
    return errorResponse('WEBHOOK_ERROR', 'Webhook processing failed', 500);
  }
}

function getTrackingUrl(provider: DeliveryProvider, trackingNumber: string): string {
  const urls: Record<DeliveryProvider, string> = {
    fedex: `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`,
    ups: `https://www.ups.com/track?tracknum=${trackingNumber}`,
    usps: `https://tools.usps.com/go/TrackConfirmAction?tLabels=${trackingNumber}`,
    dhl: `https://www.dhl.com/en/express/tracking.html?AWB=${trackingNumber}`,
    custom: '#',
  };
  return urls[provider] || '#';
}

function getCarrierName(provider: DeliveryProvider): string {
  const names: Record<DeliveryProvider, string> = {
    fedex: 'FedEx',
    ups: 'UPS',
    usps: 'USPS',
    dhl: 'DHL Express',
    custom: 'Carrier',
  };
  return names[provider] || 'Carrier';
}

// Allow unauthenticated webhook requests
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

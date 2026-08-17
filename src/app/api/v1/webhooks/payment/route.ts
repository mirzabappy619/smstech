import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { jsonResponse, errorResponse } from '@/lib/api-utils';

// Stripe webhook handler
// In production, use: import Stripe from 'stripe';
// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
// const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return errorResponse('INVALID_SIGNATURE', 'Missing stripe-signature header', 400);
    }

    // TODO: Verify webhook signature in production
    // let event: Stripe.Event;
    // try {
    //   event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    // } catch (err) {
    //   return errorResponse('Webhook signature verification failed', 400);
    // }

    // Parse the event from body for now (placeholder)
    const event = JSON.parse(body);
    const supabase = await createServerClient();

    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        
        // Update order payment status
        const { error } = await supabase
          .from('orders')
          .update({
            payment_status: 'paid',
            payment_method: paymentIntent.payment_method_types?.[0] || 'card',
            paid_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('payment_intent_id', paymentIntent.id);

        if (error) {
          console.error('Failed to update order:', error);
        }

        // Log payment received
        console.log(`Payment received for order with payment intent: ${paymentIntent.id}`);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        
        await supabase
          .from('orders')
          .update({
            payment_status: 'failed',
            updated_at: new Date().toISOString(),
          })
          .eq('payment_intent_id', paymentIntent.id);

        console.log(`Payment failed for payment intent: ${paymentIntent.id}`);
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object;
        const paymentIntentId = charge.payment_intent;
        
        const refundAmount = charge.amount_refunded / 100;
        const totalAmount = charge.amount / 100;
        
        const status = refundAmount >= totalAmount ? 'refunded' : 'partially_refunded';
        
        await supabase
          .from('orders')
          .update({
            payment_status: status,
            refunded_amount: refundAmount,
            updated_at: new Date().toISOString(),
          })
          .eq('payment_intent_id', paymentIntentId);

        console.log(`Refund processed for payment intent: ${paymentIntentId}`);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        // Handle subscription events for future subscription features
        console.log(`Subscription event: ${event.type}`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return jsonResponse({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return errorResponse('WEBHOOK_ERROR', 'Webhook handler failed', 500);
  }
}

// Stripe webhooks should not be rate limited
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

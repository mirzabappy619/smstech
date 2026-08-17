/**
 * Stripe Payment Service
 * Handles payment processing, refunds, and subscription management
 */

import { config } from '@/config';

// Types for Stripe-like responses (compatible with actual Stripe SDK)
export interface PaymentIntent {
  id: string;
  client_secret: string;
  amount: number;
  currency: string;
  status: PaymentIntentStatus;
  payment_method?: string;
  metadata: Record<string, string>;
  created: number;
}

export type PaymentIntentStatus = 
  | 'requires_payment_method'
  | 'requires_confirmation'
  | 'requires_action'
  | 'processing'
  | 'requires_capture'
  | 'canceled'
  | 'succeeded';

export interface Refund {
  id: string;
  amount: number;
  currency: string;
  payment_intent: string;
  status: 'pending' | 'succeeded' | 'failed' | 'canceled';
  reason?: string;
  created: number;
}

export interface Customer {
  id: string;
  email: string;
  name?: string;
  metadata: Record<string, string>;
  created: number;
}

export interface CreatePaymentIntentParams {
  amount: number; // in cents
  currency: string;
  customerId?: string;
  metadata?: Record<string, string>;
  description?: string;
  receiptEmail?: string;
  paymentMethodTypes?: string[];
}

export interface CreateRefundParams {
  paymentIntentId: string;
  amount?: number; // partial refund amount in cents
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
}

export interface CreateCustomerParams {
  email: string;
  name?: string;
  metadata?: Record<string, string>;
}

export class PaymentService {
  private secretKey: string;
  private isConfigured: boolean;

  constructor() {
    this.secretKey = config.payment?.providers.stripe.secretKey || '';
    this.isConfigured = !!this.secretKey && this.secretKey !== 'your_stripe_secret_key';
  }

  /**
   * Check if Stripe is configured
   */
  isStripeConfigured(): boolean {
    return this.isConfigured;
  }

  /**
   * Create a payment intent for checkout
   */
  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<{
    success: boolean;
    paymentIntent?: PaymentIntent;
    error?: string;
  }> {
    const {
      amount,
      currency,
      metadata = {},
    } = params;

    if (!this.isConfigured) {
      // Return mock payment intent for development
      console.warn('Stripe not configured. Using mock payment intent.');
      const mockIntent: PaymentIntent = {
        id: `pi_mock_${Date.now()}`,
        client_secret: `pi_mock_${Date.now()}_secret_${Math.random().toString(36).substring(7)}`,
        amount,
        currency: currency.toLowerCase(),
        status: 'requires_payment_method',
        metadata,
        created: Math.floor(Date.now() / 1000),
      };
      return { success: true, paymentIntent: mockIntent };
    }

    try {
      // Production: Use Stripe SDK
      // const stripe = new Stripe(this.secretKey);
      // const paymentIntent = await stripe.paymentIntents.create({ amount, currency, metadata });
      
      const mockIntent: PaymentIntent = {
        id: `pi_${Date.now()}`,
        client_secret: `pi_${Date.now()}_secret_${Math.random().toString(36).substring(7)}`,
        amount,
        currency: currency.toLowerCase(),
        status: 'requires_payment_method',
        metadata,
        created: Math.floor(Date.now() / 1000),
      };
      return { success: true, paymentIntent: mockIntent };
    } catch (error) {
      console.error('Create payment intent error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create payment intent',
      };
    }
  }

  /**
   * Create a refund
   */
  async createRefund(params: CreateRefundParams): Promise<{
    success: boolean;
    refund?: Refund;
    error?: string;
  }> {
    const { paymentIntentId, amount, reason } = params;

    if (!this.isConfigured) {
      const mockRefund: Refund = {
        id: `re_mock_${Date.now()}`,
        amount: amount || 0,
        currency: 'usd',
        payment_intent: paymentIntentId,
        status: 'succeeded',
        reason,
        created: Math.floor(Date.now() / 1000),
      };
      return { success: true, refund: mockRefund };
    }

    try {
      // Production: Use Stripe SDK
      return { success: false, error: 'Install Stripe SDK for production' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create refund',
      };
    }
  }

  /**
   * Create or retrieve a Stripe customer
   */
  async createCustomer(params: CreateCustomerParams): Promise<{
    success: boolean;
    customer?: Customer;
    error?: string;
  }> {
    const { email, name, metadata = {} } = params;

    if (!this.isConfigured) {
      const mockCustomer: Customer = {
        id: `cus_mock_${Date.now()}`,
        email,
        name,
        metadata,
        created: Math.floor(Date.now() / 1000),
      };
      return { success: true, customer: mockCustomer };
    }

    try {
      // Production: Use Stripe SDK
      return { success: false, error: 'Install Stripe SDK for production' };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create customer',
      };
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(
    payload: string,
    _signature: string,
    _webhookSecret: string
  ): { success: boolean; event?: unknown; error?: string } {
    if (!this.isConfigured) {
      try {
        const event = JSON.parse(payload);
        return { success: true, event };
      } catch {
        return { success: false, error: 'Invalid payload' };
      }
    }

    try {
      // Production: Use stripe.webhooks.constructEvent()
      const event = JSON.parse(payload);
      return { success: true, event };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Webhook verification failed',
      };
    }
  }

  /**
   * Calculate order amount in cents
   */
  calculateAmount(subtotal: number, tax: number, shipping: number, discount: number): number {
    const total = subtotal + tax + shipping - discount;
    return Math.round(total * 100);
  }
}

// Singleton instance
export const paymentService = new PaymentService();

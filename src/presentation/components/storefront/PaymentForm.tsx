'use client';

import { useState, useEffect } from 'react';

interface PaymentFormProps {
  clientSecret: string;
  amount: number;
  currency: string;
  onSuccess: (paymentIntentId: string) => void;
  onError: (error: string) => void;
}

/**
 * Stripe Payment Form Component
 * 
 * Usage:
 * 1. Install Stripe: npm install @stripe/stripe-js @stripe/react-stripe-js
 * 2. Add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to .env.local
 * 3. Wrap your app with <Elements stripe={stripePromise}>
 * 
 * Example:
 * ```tsx
 * import { loadStripe } from '@stripe/stripe-js';
 * import { Elements } from '@stripe/react-stripe-js';
 * 
 * const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
 * 
 * <Elements stripe={stripePromise} options={{ clientSecret }}>
 *   <PaymentForm
 *     clientSecret={clientSecret}
 *     amount={10000}
 *     currency="usd"
 *     onSuccess={(id) => console.log('Paid:', id)}
 *     onError={(err) => console.error(err)}
 *   />
 * </Elements>
 * ```
 */
export function PaymentForm({ clientSecret, amount, currency, onSuccess, onError }: PaymentFormProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mock card input state (replace with Stripe Elements in production)
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setError(null);

    try {
      // In production with Stripe:
      /*
      const stripe = useStripe();
      const elements = useElements();
      
      if (!stripe || !elements) {
        throw new Error('Stripe not loaded');
      }

      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/checkout/success`,
        },
        redirect: 'if_required',
      });

      if (error) {
        throw new Error(error.message);
      }

      if (paymentIntent?.status === 'succeeded') {
        onSuccess(paymentIntent.id);
      }
      */

      // Mock payment for development
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simulate success
      const mockPaymentIntentId = clientSecret.split('_secret')[0];
      onSuccess(mockPaymentIntentId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Payment failed';
      setError(message);
      onError(message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Update card complete status
  useEffect(() => {
    setCardComplete(
      cardNumber.replace(/\s/g, '').length === 16 &&
      expiry.length === 5 &&
      cvc.length >= 3
    );
  }, [cardNumber, expiry, cvc]);

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    return parts.length ? parts.join(' ') : value;
  };

  const formatExpiry = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return `${v.substring(0, 2)}/${v.substring(2, 4)}`;
    }
    return v;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Amount Display */}
      <div className="text-center py-4 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-500">Amount to pay</p>
        <p className="text-2xl font-bold text-gray-900">{formatAmount(amount, currency)}</p>
      </div>

      {/* Card Number */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Card Number
        </label>
        <input
          type="text"
          value={cardNumber}
          onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
          maxLength={19}
          placeholder="1234 5678 9012 3456"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          disabled={isProcessing}
        />
      </div>

      {/* Expiry and CVC */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Expiry Date
          </label>
          <input
            type="text"
            value={expiry}
            onChange={(e) => setExpiry(formatExpiry(e.target.value))}
            maxLength={5}
            placeholder="MM/YY"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isProcessing}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            CVC
          </label>
          <input
            type="text"
            value={cvc}
            onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
            maxLength={4}
            placeholder="123"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isProcessing}
          />
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isProcessing || !cardComplete}
        className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isProcessing ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Processing...
          </span>
        ) : (
          `Pay ${formatAmount(amount, currency)}`
        )}
      </button>

      {/* Secure Payment Notice */}
      <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <span>Payments are secure and encrypted</span>
      </div>

      {/* Test Card Info (Development Only) */}
      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800">
        <p className="font-medium">Test Mode</p>
        <p>Use card: 4242 4242 4242 4242, any future date, any 3 digits for CVC</p>
      </div>
    </form>
  );
}

/**
 * Payment Status Component
 */
export function PaymentStatus({ status }: { status: string }) {
  const statusConfig: Record<string, { color: string; label: string; icon: string }> = {
    requires_payment_method: { color: 'yellow', label: 'Awaiting Payment', icon: '⏳' },
    requires_confirmation: { color: 'yellow', label: 'Confirming', icon: '🔄' },
    requires_action: { color: 'orange', label: 'Action Required', icon: '⚠️' },
    processing: { color: 'blue', label: 'Processing', icon: '⚡' },
    succeeded: { color: 'green', label: 'Paid', icon: '✅' },
    canceled: { color: 'gray', label: 'Canceled', icon: '❌' },
  };

  const config = statusConfig[status] || { color: 'gray', label: status, icon: '❓' };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm bg-${config.color}-100 text-${config.color}-800`}>
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}

export default PaymentForm;

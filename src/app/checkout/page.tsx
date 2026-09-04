'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Banknote,
  Check,
  CreditCard,
  Lock,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Store,
  Truck,
  Zap,
} from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { stores } from '../../data/stores'
import Container from '../../components/ui/container'
import { formatBDT } from '../../components/ui/price'
import { isValidBDPhone, BD_PHONE_ERROR_MESSAGE } from '@/lib/bd-phone-validator'
import {
  trackMetaInitiateCheckout,
  trackMetaPurchase,
  getMetaCookie,
} from '@/presentation/components/meta-pixel'

const STEPS = ['Your details', 'Delivery', 'Payment'] as const

const FREE_DELIVERY_THRESHOLD = 100000
const DELIVERY_FEE = 120

type PaymentMethod = 'cod' | 'advance_split' | 'bkash' | 'nagad' | 'card'

/**
 * Turn an API error envelope into something a customer can act on. Validation
 * failures carry a per-field `details` map; everything else has a message.
 */
function describeOrderError(json: any): string | null {
  const err = json?.error
  if (!err) return null

  const details = err.details
  if (details && typeof details === 'object') {
    const first = Object.values(details).flat()[0]
    if (typeof first === 'string') {
      const field = Object.keys(details)[0]?.replace(/_/g, ' ')
      return field ? `${field}: ${first}` : first
    }
  }

  return typeof err.message === 'string' ? err.message : null
}

export default function Checkout() {
  const { cart, cartTotal } = useApp()
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    city: 'Dhaka',
    area: '',
  })
  const [delivery, setDelivery] = useState<'home' | 'pickup'>('home')
  const [selectedStore, setSelectedStore] = useState(stores[0]?.id ?? '1')
  const [payment, setPayment] = useState<PaymentMethod>('cod')
  const [formError, setFormError] = useState<string | null>(null)
  const initiateCheckoutTracked = useRef(false)

  const deliveryFee =
    delivery === 'pickup' || cartTotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE
  const finalTotal = cartTotal + deliveryFee
  const splitAdvanceAmount = Math.round(finalTotal * 0.1)

  useEffect(() => {
    if (initiateCheckoutTracked.current || cart.length === 0) return
    initiateCheckoutTracked.current = true

    try {
      trackMetaInitiateCheckout({
        contentIds: cart.map((i) => i.product.id),
        contents: cart.map((i) => ({
          id: i.product.id,
          quantity: i.quantity,
          item_price: i.product.price,
        })),
        numItems: cart.reduce((sum, i) => sum + i.quantity, 0),
        value: finalTotal,
        currency: 'BDT',
      })
    } catch {}
  }, [cart, finalTotal])

  const handlePlaceOrder = async () => {
    setLoading(true)
    try {
      const chosenStore = stores.find((s) => s.id === selectedStore)
      const fbc = getMetaCookie('_fbc')
      const fbp = getMetaCookie('_fbp')

      const orderPayload = {
        customer_name: form.name || 'Customer',
        customer_email: form.email || 'customer@smstech.bd',
        customer_phone: form.phone || '01700000000',
        shipping_address: {
          name: form.name,
          phone: form.phone,
          email: form.email || undefined,
          address_line1:
            delivery === 'pickup'
              ? `In-store pickup at ${chosenStore?.name ?? 'SMSTech'}`
              : form.address,
          area: form.area,
          city: form.city,
          country: 'BD',
          delivery_type: delivery,
          pickup_store: delivery === 'pickup' ? (chosenStore?.name ?? null) : null,
        },
        shipping_method: delivery === 'pickup' ? 'store_pickup' : 'home_delivery',
        items: cart.map((i) => ({
          product_id: i.product.id,
          quantity: i.quantity,
        })),
        payment_method:
          payment === 'advance_split'
            ? 'partial_advance_cod'
            : payment === 'cod'
              ? 'cash_on_delivery'
              : payment,
        advance_deducted: payment === 'advance_split' ? splitAdvanceAmount : 0,
        // Subtotal, shipping and total are deliberately not sent — the server
        // recomputes them from live prices so the client cannot set its own.
        create_payment_intent: false,
        source: 'storefront',
        fbc: fbc || null,
        fbp: fbp || null,
      }

      const res = await fetch('/api/v1/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
      })

      const json = await res.json().catch(() => null)

      // The order used to be treated as placed no matter what came back, so a
      // rejected request still sent the customer to the confirmation page and
      // the order never reached the admin panel. Fail loudly instead.
      if (!res.ok || json?.success === false) {
        throw new Error(
          describeOrderError(json) || 'We could not place your order. Please try again.',
        )
      }

      const createdOrderId = json?.data?.order?.id || json?.order?.id
      if (!createdOrderId) {
        throw new Error('We could not place your order. Please try again.')
      }

      try {
        trackMetaPurchase({
          eventId: createdOrderId,
          value: finalTotal,
          currency: 'BDT',
          contentIds: cart.map((i) => i.product.id),
          contents: cart.map((i) => ({
            id: i.product.id,
            quantity: i.quantity,
            item_price: i.product.price,
          })),
          numItems: cart.reduce((sum, i) => sum + i.quantity, 0),
        })
      } catch {}

      // Carry the real order number to the confirmation page. It used to be
      // dropped here and the success page invented a random one, so customers
      // were shown a reference that matched nothing in the system.
      const createdOrderNumber =
        json?.data?.order?.order_number || json?.order?.order_number || ''
      router.push(
        createdOrderNumber
          ? `/order-success?order=${encodeURIComponent(createdOrderNumber)}`
          : '/order-success',
      )
    } catch (err: any) {
      setFormError(err?.message || 'We could not place your order. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const next = () => {
    setFormError(null)

    if (step === 0) {
      if (!form.name.trim()) {
        setFormError('Please enter your full name.')
        return
      }
      if (!form.phone.trim() || !isValidBDPhone(form.phone)) {
        setFormError(BD_PHONE_ERROR_MESSAGE)
        return
      }
    }

    if (step === 1 && delivery === 'home' && !form.address.trim()) {
      setFormError('Please enter your delivery address.')
      return
    }

    if (step === STEPS.length - 1) {
      handlePlaceOrder()
      return
    }

    setStep(step + 1)
  }

  const field =
    'h-11 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:bg-surface focus:outline-none focus:ring-3 focus:ring-accent/15'
  const labelCls = 'mb-1.5 block text-[13px] font-medium text-ink'

  if (cart.length === 0) {
    return (
      <Container className="py-24">
        <div className="mx-auto max-w-md text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl border border-line bg-surface-2 text-ink-3">
            <ShoppingBag className="h-6 w-6" strokeWidth={1.75} />
          </span>
          <h1 className="mt-5 font-display text-2xl font-semibold tracking-tight text-ink">
            There&rsquo;s nothing to check out
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
            Add a device to your cart and come back.
          </p>
          <Link
            href="/laptops"
            className="mt-6 inline-flex h-11 items-center rounded-lg bg-accent px-5 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover"
          >
            Browse devices
          </Link>
        </div>
      </Container>
    )
  }

  const paymentOptions: {
    value: PaymentMethod
    Icon: typeof Banknote
    title: string
    desc: string
  }[] = [
    {
      value: 'cod',
      Icon: Banknote,
      title: 'Cash on delivery',
      desc: 'Inspect the device at the door, then pay the courier in full.',
    },
    {
      value: 'advance_split',
      Icon: Zap,
      title: `Reserve with ${formatBDT(splitAdvanceAmount)} advance`,
      desc: `Pay 10% now to lock the unit, then ${formatBDT(finalTotal - splitAdvanceAmount)} on delivery.`,
    },
    {
      value: 'bkash',
      Icon: Smartphone,
      title: 'bKash',
      desc: 'Pay in full through the official bKash gateway.',
    },
    {
      value: 'nagad',
      Icon: Smartphone,
      title: 'Nagad',
      desc: 'Pay in full through Nagad mobile banking.',
    },
    {
      value: 'card',
      Icon: CreditCard,
      title: 'Card or bank EMI',
      desc: 'Visa and Mastercard, with 3–12 month EMI on qualifying banks.',
    },
  ]

  return (
    <Container className="py-8 md:py-10">
      <h1 className="mb-8 font-display text-[30px] font-semibold leading-tight tracking-[-0.025em] text-ink md:text-[38px]">
        Checkout
      </h1>

      {/* Progress */}
      <ol className="mb-10 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {STEPS.map((s, i) => (
          <li key={s} className="flex shrink-0 items-center gap-2">
            <span
              className={`flex items-center gap-2 ${i <= step ? 'text-ink' : 'text-ink-3'}`}
              aria-current={i === step ? 'step' : undefined}
            >
              <span
                className={`tnum flex h-7 w-7 items-center justify-center rounded-full border text-[13px] font-medium ${
                  i < step
                    ? 'border-verified bg-verified text-white'
                    : i === step
                      ? 'border-ink bg-inverse text-inverse-ink'
                      : 'border-line text-ink-3'
                }`}
              >
                {i < step ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <span className="text-[13px] font-medium">{s}</span>
            </span>
            {i < STEPS.length - 1 && <span className="h-px w-8 bg-line sm:w-14" />}
          </li>
        ))}
      </ol>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-7 xl:col-span-8">
          {formError && (
            <p className="mb-4 rounded-lg border border-danger-line bg-danger-soft px-4 py-3 text-[13.5px] text-danger">
              {formError}
            </p>
          )}

          {/* Step 0 — details */}
          {step === 0 && (
            <section className="overflow-hidden rounded-xl border border-line bg-surface">
              <div className="border-b border-line px-6 py-4">
                <h2 className="font-display text-base font-semibold tracking-tight text-ink">
                  Your details
                </h2>
                <p className="mt-0.5 text-[13px] text-ink-3">
                  We use your phone to confirm the order and arrange delivery.
                </p>
              </div>
              <div className="grid gap-4 p-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="co-name" className={labelCls}>
                    Full name <span className="text-danger">*</span>
                  </label>
                  <input
                    id="co-name"
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Shakib Ahmed"
                    className={field}
                  />
                </div>
                <div>
                  <label htmlFor="co-phone" className={labelCls}>
                    Phone number <span className="text-danger">*</span>
                  </label>
                  <input
                    id="co-phone"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="01712345678"
                    className={field}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="co-email" className={labelCls}>
                    Email address
                  </label>
                  <input
                    id="co-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="you@example.com"
                    className={field}
                  />
                  <p className="mt-1.5 text-xs text-ink-3">
                    Your warranty certificate and inspection checksheet are sent here.
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Step 1 — delivery */}
          {step === 1 && (
            <section className="overflow-hidden rounded-xl border border-line bg-surface">
              <div className="border-b border-line px-6 py-4">
                <h2 className="font-display text-base font-semibold tracking-tight text-ink">
                  How would you like it?
                </h2>
              </div>

              <div className="space-y-5 p-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      {
                        val: 'home' as const,
                        Icon: Truck,
                        title: 'Courier delivery',
                        desc: 'To your door in 24–48 hours within Dhaka, 2–4 days elsewhere.',
                      },
                      {
                        val: 'pickup' as const,
                        Icon: Store,
                        title: 'Store pickup',
                        desc: 'Collect from the showroom once it clears final inspection.',
                      },
                    ]
                  ).map(({ val, Icon, title, desc }) => (
                    <label
                      key={val}
                      className={`cursor-pointer rounded-xl border p-4 transition-colors ${
                        delivery === val
                          ? 'border-ink bg-surface-2'
                          : 'border-line hover:border-line-2'
                      }`}
                    >
                      <span className="flex items-start justify-between gap-3">
                        <Icon className="h-4 w-4 shrink-0 text-ink-2" strokeWidth={2} />
                        <input
                          type="radio"
                          name="delivery"
                          value={val}
                          checked={delivery === val}
                          onChange={() => setDelivery(val)}
                          className="mt-0.5 accent-[var(--accent)]"
                        />
                      </span>
                      <span className="mt-3 block text-[14px] font-medium text-ink">{title}</span>
                      <span className="mt-1 block text-[13px] leading-relaxed text-ink-2">
                        {desc}
                      </span>
                    </label>
                  ))}
                </div>

                {delivery === 'home' ? (
                  <div className="grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label htmlFor="co-address" className={labelCls}>
                        Street address <span className="text-danger">*</span>
                      </label>
                      <input
                        id="co-address"
                        type="text"
                        value={form.address}
                        onChange={(e) => setForm({ ...form, address: e.target.value })}
                        placeholder="House, road, and any landmark"
                        className={field}
                      />
                    </div>
                    <div>
                      <label htmlFor="co-city" className={labelCls}>
                        City
                      </label>
                      <input
                        id="co-city"
                        type="text"
                        value={form.city}
                        onChange={(e) => setForm({ ...form, city: e.target.value })}
                        className={field}
                      />
                    </div>
                    <div>
                      <label htmlFor="co-area" className={labelCls}>
                        Area
                      </label>
                      <input
                        id="co-area"
                        type="text"
                        value={form.area}
                        onChange={(e) => setForm({ ...form, area: e.target.value })}
                        placeholder="Dhanmondi, Uttara…"
                        className={field}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="border-t border-line pt-5">
                    <p className="eyebrow mb-3">Pickup location</p>
                    <div className="space-y-2">
                      {stores.map((s) => (
                        <label
                          key={s.id}
                          className={`flex cursor-pointer items-start justify-between gap-3 rounded-xl border p-4 transition-colors ${
                            selectedStore === s.id
                              ? 'border-ink bg-surface-2'
                              : 'border-line hover:border-line-2'
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="block text-[14px] font-medium text-ink">{s.name}</span>
                            <span className="mt-0.5 block text-[13px] leading-relaxed text-ink-2">
                              {s.address}
                            </span>
                            <span className="mt-1.5 block text-xs text-ink-3">{s.hours}</span>
                          </span>
                          <input
                            type="radio"
                            name="pickup-store"
                            value={s.id}
                            checked={selectedStore === s.id}
                            onChange={() => setSelectedStore(s.id)}
                            className="mt-1 shrink-0 accent-[var(--accent)]"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Step 2 — payment */}
          {step === 2 && (
            <section className="overflow-hidden rounded-xl border border-line bg-surface">
              <div className="border-b border-line px-6 py-4">
                <h2 className="font-display text-base font-semibold tracking-tight text-ink">
                  How would you like to pay?
                </h2>
              </div>
              <div className="space-y-2 p-6">
                {paymentOptions.map(({ value, Icon, title, desc }) => (
                  <label
                    key={value}
                    className={`flex cursor-pointer items-start gap-3.5 rounded-xl border p-4 transition-colors ${
                      payment === value ? 'border-ink bg-surface-2' : 'border-line hover:border-line-2'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value={value}
                      checked={payment === value}
                      onChange={() => setPayment(value)}
                      className="mt-1 shrink-0 accent-[var(--accent)]"
                    />
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ink-2" strokeWidth={2} />
                    <span className="min-w-0">
                      <span className="block text-[14px] font-medium text-ink">{title}</span>
                      <span className="mt-0.5 block text-[13px] leading-relaxed text-ink-2">
                        {desc}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </section>
          )}

          {/* Navigation */}
          <div className="mt-6 flex items-center justify-between gap-3">
            {step > 0 ? (
              <button
                onClick={() => setStep(step - 1)}
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-line px-4 text-sm font-medium text-ink transition-colors hover:border-line-2 hover:bg-surface-2"
              >
                <ArrowLeft className="h-4 w-4" strokeWidth={2} />
                Back
              </button>
            ) : (
              <Link
                href="/cart"
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-line px-4 text-sm font-medium text-ink transition-colors hover:border-line-2 hover:bg-surface-2"
              >
                <ArrowLeft className="h-4 w-4" strokeWidth={2} />
                Back to cart
              </Link>
            )}

            <button
              onClick={next}
              disabled={loading}
              className="inline-flex h-11 items-center rounded-lg bg-accent px-6 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              {loading
                ? 'Placing order…'
                : step === STEPS.length - 1
                  ? `Place order — ${formatBDT(finalTotal)}`
                  : 'Continue'}
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="lg:col-span-5 xl:col-span-4">
          <div className="sticky top-24 overflow-hidden rounded-xl border border-line bg-surface">
            <div className="border-b border-line px-5 py-4">
              <h2 className="font-display text-base font-semibold tracking-tight text-ink">
                Order summary
              </h2>
            </div>

            <ul className="max-h-72 divide-y divide-line overflow-y-auto">
              {cart.map((item) => (
                <li
                  key={`${item.product.id}-${item.variant ?? ''}`}
                  className="flex gap-3 px-5 py-3.5"
                >
                  <img
                    src={item.product.image}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-lg border border-line bg-surface-2 object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-[13px] font-medium leading-snug text-ink">
                      {item.product.name}
                    </p>
                    {item.variant && (
                      <p className="mt-0.5 truncate text-[11px] text-ink-3">{item.variant}</p>
                    )}
                    <p className="tnum mt-0.5 text-[11px] text-ink-3">Qty {item.quantity}</p>
                  </div>
                  <p className="tnum shrink-0 text-[13px] font-medium text-ink">
                    {formatBDT(item.product.price * item.quantity)}
                  </p>
                </li>
              ))}
            </ul>

            <dl className="space-y-2.5 border-t border-line px-5 py-4 text-[13.5px]">
              <div className="flex justify-between">
                <dt className="text-ink-2">Subtotal</dt>
                <dd className="tnum font-medium text-ink">{formatBDT(cartTotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-2">Delivery</dt>
                <dd className={`tnum font-medium ${deliveryFee === 0 ? 'text-verified' : 'text-ink'}`}>
                  {deliveryFee === 0 ? 'Free' : formatBDT(deliveryFee)}
                </dd>
              </div>
              {payment === 'advance_split' && (
                <>
                  <div className="flex justify-between border-t border-line pt-2.5">
                    <dt className="text-ink-2">Pay now (10%)</dt>
                    <dd className="tnum font-medium text-accent-ink">
                      {formatBDT(splitAdvanceAmount)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-ink-2">Pay on delivery</dt>
                    <dd className="tnum font-medium text-ink">
                      {formatBDT(finalTotal - splitAdvanceAmount)}
                    </dd>
                  </div>
                </>
              )}
              <div className="flex items-baseline justify-between border-t border-line pt-3">
                <dt className="font-display text-base font-semibold text-ink">Total</dt>
                <dd className="tnum font-display text-lg font-semibold tracking-tight text-ink">
                  {formatBDT(finalTotal)}
                </dd>
              </div>
            </dl>

            <ul className="space-y-2 border-t border-line bg-surface-2 px-5 py-4 text-xs text-ink-3">
              <li className="flex items-center gap-2">
                <Lock className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                Encrypted checkout
              </li>
              <li className="flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                Warranty registered in your name
              </li>
              <li className="flex items-center gap-2">
                <RotateCcw className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                7-day returns, no restocking fee
              </li>
            </ul>
          </div>
        </div>
      </div>
    </Container>
  )
}

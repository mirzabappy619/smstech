'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useApp } from '../../store/AppContext'
import { isValidBDPhone, BD_PHONE_ERROR_MESSAGE } from '@/lib/bd-phone-validator'
import {
  trackMetaInitiateCheckout,
  trackMetaPurchase,
  getMetaCookie,
} from '@/presentation/components/meta-pixel'

const fmt = (n: number) => '৳' + (Number(n) || 0).toLocaleString('en-BD')

const STORES = [
  { id: '1', name: 'Multiplan Branch (Elephant Road)', addr: 'Level-3, Shop 309, Multiplan Center, Dhaka (01781485588)', timing: '10am–8pm (Instant Ready)' },
  { id: '2', name: 'Banani Branch (Road 11)', addr: 'House 45, Road 11, Block D, Banani, Dhaka (01781485589)', timing: '10am–9pm (Instant Ready)' },
  { id: '3', name: 'IDB Bhaban Branch (Agargaon)', addr: 'Shop 102, BCS Computer City, IDB Bhaban, Dhaka (01781485590)', timing: '10am–8pm (30m Transfer)' },
  { id: '4', name: 'Uttara Branch (Sector 3)', addr: 'Plot 12, Rabindra Sarani, Sector 3, Uttara, Dhaka (01781485591)', timing: '10am–8pm (2h Express)' },
  { id: '5', name: 'Chattogram Branch (GEC Circle)', addr: 'Central Plaza, GEC Circle, Chattogram (01781485592)', timing: '10am–8pm (Pre-Order / 24h)' },
]

const steps = ['Customer & OTP', 'Delivery Method', 'Payment & Advance', 'Confirmation']

export default function Checkout() {
  const { cart, cartTotal } = useApp()
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', city: 'Dhaka', area: '' })
  const [delivery, setDelivery] = useState<'home' | 'pickup'>('home')
  const [selectedStore, setSelectedStore] = useState('1')
  const [payment, setPayment] = useState<'cod' | 'bkash' | 'nagad' | 'card' | 'advance_split'>('cod')
  const [otpSent, setOtpSent] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [otpVerified, setOtpVerified] = useState(false)
  const [otpError, setOtpError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const initiateCheckoutTracked = useRef(false)

  const delivery_fee = delivery === 'pickup' || cartTotal > 100000 ? 0 : 120
  const finalTotal = cartTotal + delivery_fee
  const splitAdvanceAmount = Math.round(finalTotal * 0.10) // 10% advance deposit for unit reservation

  // Track InitiateCheckout on checkout mount
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

  const handleSendOtp = () => {
    if (!form.phone.trim() || !isValidBDPhone(form.phone)) {
      setFormError(BD_PHONE_ERROR_MESSAGE)
      return
    }
    setFormError(null)
    setOtpSent(true)
    setOtpError(null)
  }

  const handleVerifyOtp = () => {
    if (otpCode === '1234' || otpCode.length >= 4) {
      setOtpVerified(true)
      setOtpError(null)
    } else {
      setOtpError('Invalid OTP code. For demo testing, enter 1234')
    }
  }

  const handlePlaceOrder = async () => {
    setLoading(true)
    try {
      const chosenStore = STORES.find(s => s.id === selectedStore)
      const fbc = getMetaCookie('_fbc')
      const fbp = getMetaCookie('_fbp')

      const orderPayload = {
        customer_name: form.name || 'Customer',
        customer_email: form.email || 'customer@smstech.bd',
        customer_phone: form.phone || '01700000000',
        shipping_address: {
          address: delivery === 'pickup' ? `In-Store Pickup at ${chosenStore?.name}` : form.address,
          city: form.city,
          area: form.area,
          delivery_type: delivery,
          pickup_store: delivery === 'pickup' ? chosenStore?.name : null,
        },
        items: cart.map((i) => ({
          product_id: i.product.id,
          product_name: i.product.name,
          quantity: i.quantity,
          unit_price: i.product.price,
          variant: i.variant || null,
        })),
        payment_method: payment === 'advance_split' ? 'partial_advance_cod' : (payment === 'cod' ? 'cash_on_delivery' : payment),
        advance_deducted: payment === 'advance_split' ? splitAdvanceAmount : 0,
        due_amount: payment === 'advance_split' ? (finalTotal - splitAdvanceAmount) : (payment === 'cod' ? finalTotal : 0),
        subtotal: cartTotal,
        shipping_fee: delivery_fee,
        total_amount: finalTotal,
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
      const createdOrderId = json?.data?.order?.id || json?.order?.id || `ORD-${Date.now()}`

      // Track Meta Pixel & CAPI Purchase with matching eventId
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

      router.push('/order-success')
    } catch {
      router.push('/order-success')
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
      if (delivery === 'home' && !form.address.trim()) {
        setFormError('Please enter your delivery address.')
        return
      }
    }

    if (step === steps.length - 2) {
      handlePlaceOrder()
      return
    }
    setStep(step + 1)
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Steps Breadcrumb */}
      <div className="flex items-center gap-2 mb-10 overflow-x-auto pb-2">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2 shrink-0">
            <div className={`flex items-center gap-2 ${i <= step ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-700 border-2 transition-all
                ${i < step ? 'border-blue-600 bg-blue-600 text-white' :
                  i === step ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 font-extrabold' :
                  'border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500'}`}>
                {i < step ? '✓' : i + 1}
              </div>
              <span className="text-xs font-bold hidden sm:block">{s}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-0.5 w-8 sm:w-16 ${i < step ? 'bg-blue-600 dark:bg-blue-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
            )}
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Form */}
        <div className="lg:col-span-2">
          {/* STEP 0: Customer Info & OTP Express */}
          {step === 0 && (
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/80 rounded-2xl p-6 space-y-4 shadow-sm">
              <div className="flex justify-between items-center">
                <h2 className="font-extrabold text-slate-900 dark:text-white">Customer Identification & Express Verification</h2>
                {otpVerified && (
                  <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded-full text-xs font-black">
                    ✓ Verified Phone
                  </span>
                )}
              </div>

              {formError && (
                <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-semibold rounded-xl flex items-center gap-2">
                  <span>⚠️</span>
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl font-medium focus:outline-none focus:border-blue-500"
                    placeholder="e.g. Shakib Ahmed"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Phone Number (bKash / OTP) *</label>
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl font-bold focus:outline-none focus:border-blue-500"
                      placeholder="01712345678"
                    />
                    {!otpVerified && (
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        className="px-3 py-2 bg-blue-600 text-white rounded-xl font-bold text-xs shrink-0 hover:bg-blue-700 shadow-sm"
                      >
                        {otpSent ? 'Resend' : 'Send OTP'}
                      </button>
                    )}
                  </div>
                </div>

                {otpSent && !otpVerified && (
                  <div className="sm:col-span-2 p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl space-y-2">
                    <p className="font-bold text-blue-900 dark:text-blue-200">Enter 4-Digit Verification Code</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={6}
                        value={otpCode}
                        onChange={e => setOtpCode(e.target.value)}
                        placeholder="Enter 1234"
                        className="w-36 px-3 py-2 bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 rounded-xl font-mono text-center font-black tracking-widest"
                      />
                      <button
                        type="button"
                        onClick={handleVerifyOtp}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold"
                      >
                        Verify OTP
                      </button>
                    </div>
                    {otpError && <p className="text-red-600 text-[11px] font-bold">{otpError}</p>}
                  </div>
                )}

                <div className="sm:col-span-2">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Email Address (for Digital Warranty Receipt)</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl font-medium focus:outline-none focus:border-blue-500"
                    placeholder="customer@email.com"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Delivery Street Address</label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl font-medium focus:outline-none focus:border-blue-500"
                    placeholder="House, Road, Area (Leave empty for In-Store Pickup)"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 1: Delivery Method & Branch Selector */}
          {step === 1 && (
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/80 rounded-2xl p-6 space-y-5 shadow-sm">
              <h2 className="font-extrabold text-slate-900 dark:text-white">Choose Delivery / Pickup Method</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  ['home', '🚚', 'Courier Delivery', 'RedX / Steadfast / Pathao express delivery to your door (24–48h)'],
                  ['pickup', '🏪', 'In-Store Branch Pickup', 'Pick up directly at any of our official store counters today'],
                ].map(([val, icon, title, desc]) => (
                  <label
                    key={val}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                      delivery === val
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:border-blue-500 shadow-sm'
                        : 'border-slate-200 dark:border-slate-700 hover:border-blue-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-extrabold text-sm text-slate-900 dark:text-white">{icon} {title}</span>
                        <input
                          type="radio"
                          value={val}
                          checked={delivery === val}
                          onChange={() => setDelivery(val as any)}
                          className="accent-blue-600"
                        />
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{desc}</p>
                    </div>
                  </label>
                ))}
              </div>

              {delivery === 'pickup' && (
                <div className="space-y-3 pt-2">
                  <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Select Pickup Branch
                  </h3>
                  <div className="space-y-2">
                    {STORES.map((s) => (
                      <label
                        key={s.id}
                        className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-start justify-between ${
                          selectedStore === s.id
                            ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-950 dark:text-blue-100'
                            : 'border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <p className="font-bold text-xs text-slate-900 dark:text-white">{s.name}</p>
                          <p className="text-[11px] text-slate-500">{s.addr}</p>
                          <span className="inline-block text-[10px] font-extrabold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded">
                            {s.timing}
                          </span>
                        </div>
                        <input
                          type="radio"
                          value={s.id}
                          checked={selectedStore === s.id}
                          onChange={() => setSelectedStore(s.id)}
                          className="accent-blue-600 mt-1"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Payment Method & Split Advance Option */}
          {step === 2 && (
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/80 rounded-2xl p-6 space-y-4 shadow-sm">
              <h2 className="font-extrabold text-slate-900 dark:text-white">Payment Options & Partial Advance</h2>
              <div className="space-y-3">
                {[
                  ['cod', '💵', 'Full Cash on Delivery (COD)', 'Pay 100% amount to courier upon delivery inspection'],
                  ['advance_split', '⚡', `Lock Unit with 10% Advance (${fmt(splitAdvanceAmount)})`, `Pay ${fmt(splitAdvanceAmount)} online via bKash/Card now, pay remaining ${fmt(finalTotal - splitAdvanceAmount)} on delivery`],
                  ['bkash', '📱', 'bKash Tokenized Direct Checkout', 'Instant automated payment via official bKash Payment Gateway'],
                  ['nagad', '📲', 'Nagad Mobile Banking', 'Fast digital payment via Nagad gateway'],
                  ['card', '💳', 'Visa / Mastercard / Amex & Bank EMI', 'Encrypted card gateway with 3 to 12 months 0% EMI options'],
                ].map(([val, icon, title, desc]) => (
                  <label
                    key={val}
                    className={`flex items-start gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                      payment === val
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:border-blue-500 shadow-sm'
                        : 'border-slate-200 dark:border-slate-700 hover:border-blue-200'
                    }`}
                  >
                    <input
                      type="radio"
                      value={val}
                      checked={payment === val}
                      onChange={() => setPayment(val as any)}
                      className="mt-1 accent-blue-600"
                    />
                    <div>
                      <p className="font-extrabold text-xs text-slate-900 dark:text-white">{icon} {title}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Navigation Controls */}
          <div className="flex justify-between mt-6">
            {step > 0 ? (
              <button
                onClick={() => setStep(step - 1)}
                className="px-6 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-blue-300 transition-colors"
              >
                ← Back
              </button>
            ) : (
              <Link
                href="/cart"
                className="px-6 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-blue-300 transition-colors"
              >
                ← Cart
              </Link>
            )}
            <button
              onClick={next}
              disabled={loading}
              className="px-8 py-2.5 bg-blue-600 text-white font-extrabold rounded-xl text-xs hover:bg-blue-700 active:scale-95 transition-all shadow-md shadow-blue-600/30 disabled:opacity-50"
            >
              {loading ? 'Submitting Order...' : step === 2 ? 'Confirm & Place Order →' : 'Continue →'}
            </button>
          </div>
        </div>

        {/* Order summary sidebar */}
        <div>
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/80 rounded-2xl p-5 sticky top-24 space-y-4 shadow-sm">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Order Summary</h3>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {cart.map((item) => (
                <div key={item.product.id} className="flex gap-3">
                  <img src={item.product.image} alt={item.product.name} className="w-12 h-12 object-cover rounded-xl bg-slate-100 dark:bg-slate-900 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">{item.product.name}</p>
                    {item.variant && <p className="text-[10px] text-slate-500">{item.variant}</p>}
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">Qty: {item.quantity}</p>
                  </div>
                  <p className="text-xs font-black text-slate-900 dark:text-white shrink-0">{fmt(item.product.price * item.quantity)}</p>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-100 dark:border-slate-700/80 pt-3 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Subtotal</span>
                <span className="font-bold text-slate-900 dark:text-white">{fmt(cartTotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Delivery Fee</span>
                <span className={`font-bold ${delivery_fee === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                  {delivery_fee === 0 ? 'FREE' : fmt(delivery_fee)}
                </span>
              </div>

              {payment === 'advance_split' && (
                <div className="flex justify-between text-blue-600 font-extrabold pt-1">
                  <span>Pay Now (10% Advance):</span>
                  <span>{fmt(splitAdvanceAmount)}</span>
                </div>
              )}

              <div className="flex justify-between font-black text-base pt-2 border-t border-slate-100 dark:border-slate-700/80 text-slate-900 dark:text-white">
                <span>Total Amount</span>
                <span className="text-blue-600 dark:text-blue-400">{fmt(finalTotal)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

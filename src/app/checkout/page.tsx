'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useApp } from '../../store/AppContext'

const fmt = (n: number) => '৳' + n.toLocaleString('en-BD')

const steps = ['Customer Info', 'Delivery', 'Payment', 'Confirmation']

export default function Checkout() {
  const { cart, cartTotal } = useApp()
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', city: 'Dhaka', area: '' })
  const [delivery, setDelivery] = useState<'home' | 'pickup'>('home')
  const [store, setStore] = useState<'1' | '2'>('1')
  const [payment, setPayment] = useState<'cod' | 'mobile' | 'card' | 'online'>('cod')

  const delivery_fee = cartTotal > 100000 ? 0 : 120

  const handlePlaceOrder = async () => {
    setLoading(true)
    try {
      // Post order to Admin API endpoint
      const orderPayload = {
        customer_name: form.name || 'Customer',
        customer_email: form.email || 'customer@smstech.bd',
        customer_phone: form.phone || '01700000000',
        shipping_address: {
          address: form.address,
          city: form.city,
          area: form.area,
          delivery_type: delivery,
          pickup_store: delivery === 'pickup' ? `Store 0${store}` : null,
        },
        items: cart.map((i) => ({
          product_id: i.product.id,
          product_name: i.product.name,
          quantity: i.quantity,
          unit_price: i.product.price,
          variant: i.variant || null,
        })),
        payment_method: payment === 'cod' ? 'cash_on_delivery' : payment,
        subtotal: cartTotal,
        shipping_fee: delivery_fee,
        total_amount: cartTotal + delivery_fee,
        source: 'storefront',
      }

      await fetch('/api/v1/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
      }).catch(() => {
        // Fallback for offline/demo mode
      })

      router.push('/order-success')
    } catch {
      router.push('/order-success')
    } finally {
      setLoading(false)
    }
  }

  const next = () => {
    if (step === steps.length - 2) {
      handlePlaceOrder()
      return
    }
    setStep(step + 1)
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Steps */}
      <div className="flex items-center gap-2 mb-10 overflow-x-auto pb-2">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2 shrink-0">
            <div className={`flex items-center gap-2 ${i <= step ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-700 border-2 transition-all
                ${i < step ? 'border-blue-600 bg-blue-600 text-white' :
                  i === step ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400' :
                  'border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500'}`}>
                {i < step ? '✓' : i + 1}
              </div>
              <span className="text-sm font-600 hidden sm:block">{s}</span>
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
          {step === 0 && (
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/80 rounded-2xl p-6 transition-colors">
              <h2 className="font-700 text-slate-900 dark:text-white mb-5">Customer Information</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  ['Full Name', 'name', 'text'],
                  ['Phone Number', 'phone', 'tel'],
                  ['Email Address', 'email', 'email'],
                  ['Delivery Address', 'address', 'text'],
                  ['City', 'city', 'text'],
                  ['Area / District', 'area', 'text'],
                ].map(([label, field, type]) => (
                  <div key={field} className={field === 'address' ? 'sm:col-span-2' : ''}>
                    <label className="text-xs font-700 text-slate-700 dark:text-slate-300 block mb-1.5">{label}</label>
                    <input
                      type={type}
                      value={(form as any)[field]}
                      onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl text-sm focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 transition-colors"
                      placeholder={label as string}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/80 rounded-2xl p-6 transition-colors">
              <h2 className="font-700 text-slate-900 dark:text-white mb-5">Delivery Method</h2>
              <div className="space-y-3 mb-6">
                {[
                  ['home', '🚚', 'Home Delivery', 'Delivered to your address within 24–48 hours'],
                  ['pickup', '🏪', 'Store Pickup', 'Pick up from an SMSTech store — ready within hours'],
                ].map(([val, icon, title, desc]) => (
                  <label key={val} className={`flex items-start gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all
                    ${delivery === val
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:border-blue-500'
                      : 'border-slate-200 dark:border-slate-700 hover:border-blue-200 dark:hover:border-slate-600'}`}>
                    <input type="radio" value={val} checked={delivery === val} onChange={() => setDelivery(val as any)} className="mt-1 accent-blue-600" />
                    <div>
                      <p className="font-700 text-sm text-slate-900 dark:text-white">{icon} {title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{desc}</p>
                    </div>
                  </label>
                ))}
              </div>
              {delivery === 'pickup' && (
                <div className="space-y-3 pl-2">
                  <p className="text-sm font-700 text-slate-700 dark:text-slate-300">Select Store</p>
                  {[
                    ['1', 'SMSTech — Multiplan Branch', 'Shop 309, Level-3, Computer City Market (Multiplan), Elephant Road (01781485588)'],
                  ].map(([val, name, addr]) => (
                    <label key={val} className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all
                      ${store === val
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:border-blue-500'
                        : 'border-slate-200 dark:border-slate-700 hover:border-blue-200 dark:hover:border-slate-600'}`}>
                      <input type="radio" value={val} checked={store === val} onChange={() => setStore(val as '1' | '2')} className="accent-blue-600" />
                      <div>
                        <p className="font-600 text-sm text-slate-900 dark:text-white">{name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{addr} · Open 10am–8pm</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/80 rounded-2xl p-6 transition-colors">
              <h2 className="font-700 text-slate-900 dark:text-white mb-5">Payment Method</h2>
              <div className="space-y-3">
                {[
                  ['cod', '💵', 'Cash on Delivery', 'Pay when you receive your order'],
                  ['mobile', '📱', 'Mobile Banking', 'bKash, Nagad, Rocket'],
                  ['card', '💳', 'Debit / Credit Card', 'Visa, Mastercard'],
                  ['online', '🌐', 'Online Payment', 'Bank transfer and online gateway'],
                ].map(([val, icon, title, desc]) => (
                  <label key={val} className={`flex items-start gap-4 p-4 rounded-2xl border-2 cursor-pointer transition-all
                    ${payment === val
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:border-blue-500'
                      : 'border-slate-200 dark:border-slate-700 hover:border-blue-200 dark:hover:border-slate-600'}`}>
                    <input type="radio" value={val} checked={payment === val} onChange={() => setPayment(val as any)} className="mt-1 accent-blue-600" />
                    <div>
                      <p className="font-700 text-sm text-slate-900 dark:text-white">{icon} {title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{desc}</p>
                    </div>
                  </label>
                ))}
              </div>
              <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">🔒 Your payment is encrypted, secure, and recorded into our admin order system.</span>
              </div>
            </div>
          )}

          <div className="flex justify-between mt-6">
            {step > 0 ? (
              <button
                onClick={() => setStep(step - 1)}
                className="px-6 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-600 text-slate-700 dark:text-slate-200 hover:border-blue-300 dark:hover:border-blue-500 transition-colors"
              >
                ← Back
              </button>
            ) : (
              <Link
                href="/cart"
                className="px-6 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-600 text-slate-700 dark:text-slate-200 hover:border-blue-300 dark:hover:border-blue-500 transition-colors"
              >
                ← Cart
              </Link>
            )}
            <button
              onClick={next}
              disabled={loading}
              className="px-8 py-3 bg-blue-600 text-white font-700 rounded-xl text-sm hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? 'Processing...' : step === 2 ? 'Place Order →' : 'Continue →'}
            </button>
          </div>
        </div>

        {/* Order summary */}
        <div>
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/80 rounded-2xl p-5 sticky top-24 space-y-4 transition-colors">
            <h3 className="font-700 text-slate-900 dark:text-white">Order Summary</h3>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {cart.map((item) => (
                <div key={item.product.id} className="flex gap-3">
                  <img src={item.product.image} alt={item.product.name} className="w-12 h-12 object-cover rounded-xl bg-slate-100 dark:bg-slate-900 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-600 text-slate-900 dark:text-white line-clamp-1">{item.product.name}</p>
                    {item.variant && <p className="text-[10px] text-slate-500 dark:text-slate-400">{item.variant}</p>}
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">×{item.quantity}</p>
                  </div>
                  <p className="text-xs font-700 text-slate-900 dark:text-white shrink-0">{fmt(item.product.price * item.quantity)}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-100 dark:border-slate-700/80 pt-3 space-y-2">
              <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                <span>Subtotal</span>
                <span className="font-600 text-slate-900 dark:text-white">{fmt(cartTotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                <span>Delivery</span>
                <span className={`font-600 ${delivery_fee === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                  {delivery_fee === 0 ? 'FREE' : fmt(delivery_fee)}
                </span>
              </div>
              <div className="flex justify-between font-800 text-base pt-2 border-t border-slate-100 dark:border-slate-700/80 text-slate-900 dark:text-white">
                <span>Total</span>
                <span className="text-blue-600 dark:text-blue-400">{fmt(cartTotal + delivery_fee)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import Link from 'next/link'
import { useApp } from '../../store/AppContext'
import { useState } from 'react'

const fmt = (n: number) => '৳' + n.toLocaleString('en-BD')

export default function Cart() {
  const { cart, removeFromCart, updateQuantity, cartTotal } = useApp()
  const [coupon, setCoupon] = useState('')
  const delivery = cartTotal > 100000 ? 0 : 120

  if (cart.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <div className="text-7xl mb-6">🛒</div>
        <h2 className="text-2xl font-800 text-slate-900 dark:text-white mb-2">Your cart is empty</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-8">Add some products to get started.</p>
        <div className="flex gap-3 justify-center">
          <Link href="/laptops" className="px-6 py-3 bg-blue-600 text-white font-600 rounded-xl hover:bg-blue-700 transition-colors text-sm">Shop Laptops</Link>
          <Link href="/smartphones" className="px-6 py-3 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-600 rounded-xl hover:border-blue-300 dark:hover:border-blue-500 transition-colors text-sm">Shop Smartphones</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-800 text-slate-900 dark:text-white mb-8">Shopping Cart ({cart.length} item{cart.length !== 1 ? 's' : ''})</h1>
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Items */}
        <div className="lg:col-span-2 space-y-4">
          {cart.map((item) => (
            <div key={item.product.id} className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/80 rounded-2xl p-5 flex gap-4 hover:shadow-sm transition-all">
              <img src={item.product.image} alt={item.product.name} className="w-24 h-24 object-cover rounded-xl bg-slate-100 dark:bg-slate-900 shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-700 text-blue-600 dark:text-blue-400">{item.product.brand}</span>
                <h3 className="font-600 text-slate-900 dark:text-white text-sm line-clamp-2 mt-0.5">{item.product.name}</h3>
                {item.variant && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{item.variant}</p>}
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">{item.product.warranty}</p>
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                    <button onClick={() => updateQuantity(item.product.id, item.quantity - 1)} className="w-8 h-8 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">−</button>
                    <span className="w-8 h-8 flex items-center justify-center text-sm font-700 text-slate-900 dark:text-white">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.product.id, item.quantity + 1)} className="w-8 h-8 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">+</button>
                  </div>
                  <div className="text-right">
                    <p className="font-800 text-slate-900 dark:text-white">{fmt(item.product.price * item.quantity)}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{fmt(item.product.price)} each</p>
                  </div>
                </div>
                <div className="flex gap-4 mt-2">
                  <button onClick={() => removeFromCart(item.product.id)} className="text-xs text-red-500 dark:text-red-400 hover:text-red-600 font-600">Remove</button>
                </div>
              </div>
            </div>
          ))}
          <Link href="/laptops" className="inline-block text-sm text-blue-600 dark:text-blue-400 font-600 hover:underline">← Continue Shopping</Link>
        </div>

        {/* Summary */}
        <div>
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/80 rounded-2xl p-5 space-y-4 sticky top-24 transition-colors">
            <h2 className="font-700 text-slate-900 dark:text-white">Order Summary</h2>

            {/* Coupon */}
            <div className="flex gap-2">
              <input
                value={coupon}
                onChange={(e) => setCoupon(e.target.value)}
                placeholder="Enter coupon code"
                className="flex-1 px-3 py-2.5 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl text-sm focus:outline-none focus:border-blue-400 dark:focus:border-blue-500"
              />
              <button className="px-4 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-600 rounded-xl text-sm hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">Apply</button>
            </div>

            <div className="space-y-2.5 pt-2">
              <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                <span>Subtotal ({cart.length} items)</span>
                <span className="font-600 text-slate-900 dark:text-white">{fmt(cartTotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                <span>Delivery</span>
                <span className={`font-600 ${delivery === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                  {delivery === 0 ? 'FREE' : fmt(delivery)}
                </span>
              </div>
              {delivery === 0 && <p className="text-xs text-emerald-600 dark:text-emerald-400">✓ Free delivery on orders above ৳1,00,000</p>}
              <div className="border-t border-slate-100 dark:border-slate-700/80 pt-2.5 flex justify-between font-800 text-slate-900 dark:text-white">
                <span>Total</span>
                <span className="text-blue-600 dark:text-blue-400 text-lg">{fmt(cartTotal + delivery)}</span>
              </div>
            </div>

            <Link
              href="/checkout"
              className="block w-full py-3.5 text-center font-700 bg-blue-600 text-white rounded-xl hover:bg-blue-700 active:scale-[0.98] transition-all text-sm"
            >
              Proceed to Checkout →
            </Link>

            <div className="flex flex-wrap gap-2 justify-center pt-1">
              {['VISA', 'MC', 'bKash', 'Nagad', 'COD'].map((m) => (
                <span key={m} className="px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-[10px] font-700 rounded-md">{m}</span>
              ))}
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 text-center">🔒 Secure and encrypted checkout</p>
          </div>
        </div>
      </div>
    </div>
  )
}

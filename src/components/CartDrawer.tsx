'use client'

import Link from 'next/link'
import { useApp } from '../store/AppContext'

const fmt = (n: number) => '৳' + n.toLocaleString('en-BD')

export default function CartDrawer() {
  const { cart, cartOpen, setCartOpen, removeFromCart, updateQuantity, cartTotal } = useApp()

  if (!cartOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={() => setCartOpen(false)} />
      <div className="w-full max-w-md bg-white dark:bg-slate-900 flex flex-col shadow-2xl transition-colors">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="font-700 text-slate-900 dark:text-white">Your Cart</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{cart.length} item{cart.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={() => setCartOpen(false)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
          {cart.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">🛒</div>
              <h3 className="font-600 text-slate-900 dark:text-white mb-2">Your cart is empty</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Add some products to get started.</p>
              <Link
                href="/laptops"
                onClick={() => setCartOpen(false)}
                className="inline-block px-5 py-2.5 bg-blue-600 text-white font-600 rounded-xl text-sm hover:bg-blue-700 transition-colors"
              >
                Shop Now
              </Link>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.product.id} className="flex gap-3 pb-4 border-b border-slate-100 dark:border-slate-800 last:border-0">
                <img
                  src={item.product.image}
                  alt={item.product.name}
                  className="w-20 h-20 object-cover rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-600 text-blue-600 dark:text-blue-400">{item.product.brand}</p>
                  <p className="text-sm font-600 text-slate-900 dark:text-white line-clamp-2 leading-snug">{item.product.name}</p>
                  {item.variant && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{item.variant}</p>}
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                        className="w-7 h-7 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-lg"
                      >−</button>
                      <span className="w-7 h-7 flex items-center justify-center text-sm font-600 text-slate-900 dark:text-white">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                        className="w-7 h-7 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-lg"
                      >+</button>
                    </div>
                    <div className="text-right">
                      <p className="font-700 text-slate-900 dark:text-white text-sm">{fmt(item.product.price * item.quantity)}</p>
                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="text-xs text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {cart.length > 0 && (
          <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">Subtotal</span>
              <span className="font-600 text-slate-900 dark:text-white">{fmt(cartTotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">Delivery</span>
              <span className="font-600 text-emerald-600 dark:text-emerald-400">Calculated at checkout</span>
            </div>
            <div className="flex justify-between font-700 text-base border-t border-slate-100 dark:border-slate-800 pt-3">
              <span className="text-slate-900 dark:text-white">Total</span>
              <span className="text-blue-600 dark:text-blue-400">{fmt(cartTotal)}</span>
            </div>
            <div className="flex gap-2 pt-1">
              <Link
                href="/cart"
                onClick={() => setCartOpen(false)}
                className="flex-1 py-2.5 text-center text-sm font-600 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 hover:border-blue-300 dark:hover:border-blue-500 transition-colors"
              >
                View Cart
              </Link>
              <Link
                href="/checkout"
                onClick={() => setCartOpen(false)}
                className="flex-1 py-2.5 text-center text-sm font-700 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
              >
                Checkout
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

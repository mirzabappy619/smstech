'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Minus, Plus, ShieldCheck, ShoppingBag, Trash2, X } from 'lucide-react'
import { useApp } from '../store/AppContext'
import { formatBDT } from './ui/price'
import { ConditionBadge } from './ui/condition'

export default function CartDrawer() {
  const { cart, cartOpen, setCartOpen, removeFromCart, updateQuantity, cartTotal } = useApp()

  useEffect(() => {
    document.body.style.overflow = cartOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [cartOpen])

  useEffect(() => {
    if (!cartOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setCartOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cartOpen, setCartOpen])

  if (!cartOpen) return null

  const itemCount = cart.reduce((n, i) => n + i.quantity, 0)
  const savings = cart.reduce(
    (n, i) => n + Math.max(0, i.product.originalPrice - i.product.price) * i.quantity,
    0,
  )

  return (
    <div className="fixed inset-0 z-70 flex" role="dialog" aria-modal="true" aria-label="Shopping cart">
      <div
        className="flex-1 animate-fade-in bg-inverse/45 backdrop-blur-sm"
        onClick={() => setCartOpen(false)}
      />

      <aside className="flex w-full max-w-md animate-slide-in-right flex-col border-l border-line bg-surface shadow-lg">
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="font-display text-base font-semibold tracking-tight text-ink">Your cart</h2>
            <p className="tnum text-[13px] text-ink-3">
              {itemCount} item{itemCount === 1 ? '' : 's'}
            </p>
          </div>
          <button
            onClick={() => setCartOpen(false)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
            aria-label="Close cart"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {cart.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-8 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-xl border border-line bg-surface-2 text-ink-3">
                <ShoppingBag className="h-6 w-6" strokeWidth={1.75} />
              </span>
              <h3 className="mt-4 font-display text-base font-semibold text-ink">
                Your cart is empty
              </h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">
                Browse new and certified pre-owned laptops and phones, all warranty-backed.
              </p>
              <div className="mt-6 flex gap-2">
                <Link
                  href="/laptops"
                  onClick={() => setCartOpen(false)}
                  className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover"
                >
                  Shop laptops
                </Link>
                <Link
                  href="/smartphones"
                  onClick={() => setCartOpen(false)}
                  className="inline-flex h-10 items-center rounded-lg border border-line px-4 text-sm font-medium text-ink transition-colors hover:bg-surface-2"
                >
                  Shop phones
                </Link>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {cart.map((item) => (
                <li key={`${item.product.id}-${item.variant ?? ''}`} className="flex gap-3.5 p-5">
                  <Link
                    href={`/product/${item.product.slug}`}
                    onClick={() => setCartOpen(false)}
                    className="shrink-0"
                  >
                    <img
                      src={item.product.image}
                      alt=""
                      className="h-20 w-20 rounded-lg border border-line bg-surface-2 object-cover"
                    />
                  </Link>

                  <div className="min-w-0 flex-1">
                    <p className="eyebrow">{item.product.brand}</p>
                    <Link
                      href={`/product/${item.product.slug}`}
                      onClick={() => setCartOpen(false)}
                      className="mt-0.5 line-clamp-2 block text-[13.5px] font-medium leading-snug text-ink hover:text-accent"
                    >
                      {item.product.name}
                    </Link>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <ConditionBadge product={item.product} withIcon={false} />
                      {item.variant && (
                        <span className="text-xs text-ink-3">{item.variant}</span>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <div className="flex items-center rounded-lg border border-line">
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                          className="flex h-8 w-8 items-center justify-center rounded-l-lg text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
                        </button>
                        <span className="tnum flex h-8 w-8 items-center justify-center text-[13px] font-medium text-ink">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                          className="flex h-8 w-8 items-center justify-center rounded-r-lg text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
                          aria-label="Increase quantity"
                        >
                          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="tnum text-sm font-semibold text-ink">
                          {formatBDT(item.product.price * item.quantity)}
                        </span>
                        <button
                          onClick={() => removeFromCart(item.product.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-3 transition-colors hover:bg-danger-soft hover:text-danger"
                          aria-label={`Remove ${item.product.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {cart.length > 0 && (
          <footer className="border-t border-line bg-surface-2 px-5 py-4">
            <dl className="space-y-2 text-[13.5px]">
              <div className="flex justify-between">
                <dt className="text-ink-2">Subtotal</dt>
                <dd className="tnum font-medium text-ink">{formatBDT(cartTotal)}</dd>
              </div>
              {savings > 0 && (
                <div className="flex justify-between">
                  <dt className="text-ink-2">You save</dt>
                  <dd className="tnum font-medium text-verified">−{formatBDT(savings)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-ink-2">Delivery</dt>
                <dd className="text-ink-3">Calculated at checkout</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-2.5">
                <dt className="font-display text-[15px] font-semibold text-ink">Total</dt>
                <dd className="tnum font-display text-[15px] font-semibold text-ink">
                  {formatBDT(cartTotal)}
                </dd>
              </div>
            </dl>

            <div className="mt-4 flex gap-2">
              <Link
                href="/cart"
                onClick={() => setCartOpen(false)}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-lg border border-line bg-surface text-sm font-medium text-ink transition-colors hover:border-line-2"
              >
                View cart
              </Link>
              <Link
                href="/checkout"
                onClick={() => setCartOpen(false)}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-lg bg-accent text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover"
              >
                Checkout
              </Link>
            </div>

            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-ink-3">
              <ShieldCheck className="h-3.5 w-3.5 text-verified" strokeWidth={2} />
              Warranty-backed · 7-day returns
            </p>
          </footer>
        )}
      </aside>
    </div>
  )
}

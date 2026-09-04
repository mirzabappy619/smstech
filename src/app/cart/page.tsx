'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Lock,
  Minus,
  Plus,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Truck,
} from 'lucide-react'
import { useApp } from '../../store/AppContext'
import Container from '../../components/ui/container'
import { Breadcrumbs } from '../../components/CollectionView'
import { formatBDT } from '../../components/ui/price'
import { ConditionBadge } from '../../components/ui/condition'

const FREE_DELIVERY_THRESHOLD = 100000
const DELIVERY_FEE = 120

export default function Cart() {
  const { cart, removeFromCart, updateQuantity, cartTotal } = useApp()
  const [coupon, setCoupon] = useState('')

  const itemCount = cart.reduce((n, i) => n + i.quantity, 0)
  const delivery = cartTotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE
  const savings = cart.reduce(
    (n, i) => n + Math.max(0, i.product.originalPrice - i.product.price) * i.quantity,
    0,
  )
  const remainingForFree = Math.max(0, FREE_DELIVERY_THRESHOLD - cartTotal)

  if (cart.length === 0) {
    return (
      <Container className="py-24">
        <div className="mx-auto max-w-md text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl border border-line bg-surface-2 text-ink-3">
            <ShoppingBag className="h-6 w-6" strokeWidth={1.75} />
          </span>
          <h1 className="mt-5 font-display text-2xl font-semibold tracking-tight text-ink">
            Your cart is empty
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
            Nothing added yet. Browse new and certified pre-owned devices — every listing shows its
            grade and warranty before you commit.
          </p>
          <div className="mt-7 flex justify-center gap-2">
            <Link
              href="/laptops"
              className="inline-flex h-11 items-center rounded-lg bg-accent px-5 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover"
            >
              Shop laptops
            </Link>
            <Link
              href="/smartphones"
              className="inline-flex h-11 items-center rounded-lg border border-line px-5 text-sm font-medium text-ink transition-colors hover:border-line-2 hover:bg-surface-2"
            >
              Shop smartphones
            </Link>
          </div>
        </div>
      </Container>
    )
  }

  return (
    <Container className="py-8 md:py-10">
      <Breadcrumbs items={[{ label: 'Cart' }]} />

      <h1 className="mb-8 font-display text-[30px] font-semibold leading-tight tracking-[-0.025em] text-ink md:text-[38px]">
        Your cart
        <span className="tnum ml-3 align-middle text-base font-normal text-ink-3">
          {itemCount} item{itemCount === 1 ? '' : 's'}
        </span>
      </h1>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Items */}
        <div className="lg:col-span-8">
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {cart.map((item) => (
              <li key={`${item.product.id}-${item.variant ?? ''}`} className="flex gap-4 p-5">
                <Link href={`/product/${item.product.slug}`} className="shrink-0">
                  <img
                    src={item.product.image}
                    alt=""
                    className="h-24 w-24 rounded-lg border border-line bg-surface-2 object-contain p-2"
                  />
                </Link>

                <div className="min-w-0 flex-1">
                  <p className="eyebrow">{item.product.brand}</p>
                  <Link
                    href={`/product/${item.product.slug}`}
                    className="mt-1 line-clamp-2 block text-[14.5px] font-medium leading-snug text-ink hover:text-accent"
                  >
                    {item.product.name}
                  </Link>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <ConditionBadge product={item.product} withIcon={false} />
                    {item.variant && <span className="text-xs text-ink-3">{item.variant}</span>}
                  </div>

                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-verified">
                    <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
                    {item.product.warranty}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center rounded-lg border border-line">
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                        className="flex h-9 w-9 items-center justify-center rounded-l-lg text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
                      </button>
                      <span className="tnum flex h-9 w-9 items-center justify-center text-sm font-medium text-ink">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                        className="flex h-9 w-9 items-center justify-center rounded-r-lg text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="tnum font-display text-[15px] font-semibold text-ink">
                          {formatBDT(item.product.price * item.quantity)}
                        </p>
                        {item.quantity > 1 && (
                          <p className="tnum text-xs text-ink-3">
                            {formatBDT(item.product.price)} each
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-3 transition-colors hover:bg-danger-soft hover:text-danger"
                        aria-label={`Remove ${item.product.name}`}
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <Link
            href="/laptops"
            className="group mt-5 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-ink-2 transition-colors hover:text-accent"
          >
            <ArrowLeft
              className="h-4 w-4 transition-transform group-hover:-translate-x-0.5"
              strokeWidth={2}
            />
            Continue shopping
          </Link>
        </div>

        {/* Summary */}
        <div className="lg:col-span-4">
          <div className="sticky top-24 overflow-hidden rounded-xl border border-line bg-surface">
            <div className="border-b border-line px-5 py-4">
              <h2 className="font-display text-base font-semibold tracking-tight text-ink">
                Order summary
              </h2>
            </div>

            <div className="space-y-4 p-5">
              <form
                onSubmit={(e) => e.preventDefault()}
                className="flex gap-2"
                aria-label="Apply a coupon"
              >
                <label htmlFor="coupon" className="sr-only">
                  Coupon code
                </label>
                <input
                  id="coupon"
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value)}
                  placeholder="Coupon code"
                  className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-3 text-[13px] text-ink placeholder:text-ink-3 focus:border-accent focus:bg-surface focus:outline-none"
                />
                <button
                  type="submit"
                  className="h-10 shrink-0 rounded-lg border border-line px-4 text-[13px] font-medium text-ink transition-colors hover:border-line-2 hover:bg-surface-2"
                >
                  Apply
                </button>
              </form>

              <dl className="space-y-2.5 border-t border-line pt-4 text-[13.5px]">
                <div className="flex justify-between">
                  <dt className="text-ink-2">Subtotal</dt>
                  <dd className="tnum font-medium text-ink">{formatBDT(cartTotal)}</dd>
                </div>
                {savings > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-ink-2">Discounts applied</dt>
                    <dd className="tnum font-medium text-verified">−{formatBDT(savings)}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-ink-2">Delivery</dt>
                  <dd
                    className={`tnum font-medium ${delivery === 0 ? 'text-verified' : 'text-ink'}`}
                  >
                    {delivery === 0 ? 'Free' : formatBDT(delivery)}
                  </dd>
                </div>
              </dl>

              {remainingForFree > 0 ? (
                <p className="tnum rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-xs leading-relaxed text-ink-2">
                  Add {formatBDT(remainingForFree)} more for free delivery.
                </p>
              ) : (
                <p className="flex items-center gap-1.5 rounded-lg border border-verified-line bg-verified-soft px-3 py-2.5 text-xs font-medium text-verified">
                  <Truck className="h-3.5 w-3.5" strokeWidth={2} />
                  Free delivery applied
                </p>
              )}

              <div className="flex items-baseline justify-between border-t border-line pt-4">
                <span className="font-display text-base font-semibold text-ink">Total</span>
                <span className="tnum font-display text-xl font-semibold tracking-tight text-ink">
                  {formatBDT(cartTotal + delivery)}
                </span>
              </div>

              <Link
                href="/checkout"
                className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-accent text-[15px] font-medium text-on-accent transition-colors hover:bg-accent-hover"
              >
                Proceed to checkout
              </Link>

              <ul className="space-y-2 border-t border-line pt-4 text-xs text-ink-3">
                <li className="flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                  Encrypted checkout
                </li>
                <li className="flex items-center gap-2">
                  <RotateCcw className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                  7-day returns, no restocking fee
                </li>
                <li className="flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                  Warranty on every device
                </li>
              </ul>

              <div className="flex flex-wrap justify-center gap-1.5 border-t border-line pt-4">
                {['Visa', 'Mastercard', 'bKash', 'Nagad', 'COD'].map((m) => (
                  <span
                    key={m}
                    className="rounded border border-line px-1.5 py-0.5 text-[10px] font-medium text-ink-3"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Container>
  )
}

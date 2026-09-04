'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  BatteryCharging,
  Check,
  Loader2,
  PackageSearch,
  Search,
  ShieldCheck,
  Truck,
} from 'lucide-react'
import Container from '../../components/ui/container'
import { Breadcrumbs } from '../../components/CollectionView'
import { formatBDT } from '../../components/ui/price'

type OrderItem = {
  product_name?: string
  serial_number?: string | null
  warranty_period?: string | null
}

type TrackedOrder = {
  id: string
  order_number: string
  total: number
  status: string
  payment_status?: string
  courier_provider?: string | null
  courier_consignment_id?: string | null
  courier_status?: string | null
  created_at: string
  order_items?: OrderItem[]
}

type TrackedWarranty = {
  id: string
  serial_number?: string | null
  imei_1?: string | null
  battery_health_pct?: number | null
  cosmetic_grade?: string | null
  warranty_months?: number | null
  warranty_starts_at?: string | null
  warranty_expires_at?: string | null
  sold_at?: string | null
  products?: { name?: string; brand?: string } | null
}

/** Order lifecycle, in the order the customer experiences it. */
const TIMELINE = [
  { key: 'pending', label: 'Order received', note: 'We have your order and are confirming stock.' },
  { key: 'confirmed', label: 'Confirmed', note: 'Stock allocated and reserved for you.' },
  { key: 'processing', label: 'Inspected & packed', note: 'Final checks done, device packed.' },
  { key: 'shipped', label: 'Handed to courier', note: 'On its way to your address.' },
  { key: 'delivered', label: 'Delivered', note: 'Signed for at the delivery address.' },
]

/** Map whatever the backend reports onto a timeline index. */
function statusIndex(status: string): number {
  const s = (status || '').toLowerCase()
  const direct = TIMELINE.findIndex((t) => t.key === s)
  if (direct >= 0) return direct
  if (['paid', 'accepted', 'approved'].includes(s)) return 1
  if (['packed', 'ready', 'ready_for_pickup', 'picked'].includes(s)) return 2
  if (['in_transit', 'dispatched', 'out_for_delivery'].includes(s)) return 3
  if (['completed', 'collected'].includes(s)) return 4
  return 0
}

const formatDate = (v?: string | null) =>
  v
    ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—'

export default function TrackOrder() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [order, setOrder] = useState<TrackedOrder | null>(null)
  const [warranty, setWarranty] = useState<TrackedWarranty | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (!q) return

    setLoading(true)
    setError(null)
    setOrder(null)
    setWarranty(null)

    try {
      const res = await fetch(`/api/v1/app/tracking?query=${encodeURIComponent(q)}`)
      const json = await res.json()
      if (json.success) {
        setOrder(json.data?.order ?? null)
        setWarranty(json.data?.warranty ?? null)
      } else {
        setError(json.error || 'We could not look that up. Please try again.')
      }
    } catch {
      setError('Network problem — please check your connection and try again.')
    } finally {
      setLoading(false)
      setSearched(true)
    }
  }

  const activeStep = order ? statusIndex(order.status) : -1
  const isCancelled = ['cancelled', 'canceled', 'refunded'].includes(
    (order?.status || '').toLowerCase(),
  )

  return (
    <Container className="py-8 md:py-12">
      <Breadcrumbs items={[{ label: 'Track order' }]} />

      <div className="mx-auto max-w-2xl">
        <header className="mb-8">
          <h1 className="font-display text-[30px] font-semibold leading-tight tracking-[-0.025em] text-ink md:text-[38px]">
            Track an order
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
            Enter your order number or the phone number you ordered with. You can also enter a
            device serial number or IMEI to check its warranty status.
          </p>
        </header>

        <form
          onSubmit={handleSearch}
          className="rounded-xl border border-line bg-surface p-5"
        >
          <label htmlFor="track-query" className="mb-1.5 block text-[13px] font-medium text-ink">
            Order number, phone, serial or IMEI
          </label>
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"
                strokeWidth={2}
              />
              <input
                id="track-query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="SMST-2026-000123"
                className="h-12 w-full rounded-lg border border-line bg-surface-2 pl-10 pr-3 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:bg-surface focus:outline-none focus:ring-3 focus:ring-accent/15"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="inline-flex h-12 shrink-0 items-center gap-2 rounded-lg bg-accent px-5 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-45"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />}
              {loading ? 'Looking up' : 'Track'}
            </button>
          </div>
        </form>

        {error && (
          <p className="mt-5 rounded-lg border border-danger-line bg-danger-soft px-4 py-3 text-[13.5px] text-danger">
            {error}
          </p>
        )}

        {searched && !loading && !error && !order && !warranty && (
          <div className="mt-6 rounded-xl border border-line bg-surface px-6 py-14 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-surface-2 text-ink-3">
              <PackageSearch className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <h2 className="mt-4 font-display text-base font-semibold text-ink">
              Nothing found for that reference
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed text-ink-2">
              Double-check the order number on your confirmation, or try the phone number you
              ordered with. Still stuck?{' '}
              <Link href="/contact" className="font-medium text-accent">
                Contact us
              </Link>
              .
            </p>
          </div>
        )}

        {/* Order result */}
        {order && (
          <section className="mt-6 overflow-hidden rounded-xl border border-line bg-surface">
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
              <div>
                <h2 className="font-display text-base font-semibold tracking-tight text-ink">
                  Order {order.order_number}
                </h2>
                <p className="mt-0.5 text-[13px] text-ink-3">
                  Placed {formatDate(order.created_at)}
                </p>
              </div>
              <div className="text-right">
                <p className="tnum font-display text-base font-semibold text-ink">
                  {formatBDT(Number(order.total) || 0)}
                </p>
                {order.payment_status && (
                  <p className="text-xs capitalize text-ink-3">{order.payment_status}</p>
                )}
              </div>
            </header>

            {isCancelled ? (
              <div className="px-5 py-6">
                <p className="rounded-lg border border-danger-line bg-danger-soft px-4 py-3 text-[13.5px] capitalize text-danger">
                  This order is marked {order.status}.
                </p>
              </div>
            ) : (
              <ol className="relative px-5 py-6">
                <span
                  aria-hidden
                  className="absolute bottom-8 left-[2.1rem] top-9 w-px bg-line"
                />
                {TIMELINE.map((step, i) => {
                  const done = i < activeStep
                  const current = i === activeStep
                  return (
                    <li key={step.key} className="relative flex gap-4 pb-6 last:pb-0">
                      <span
                        className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                          done
                            ? 'border-verified bg-verified text-white'
                            : current
                              ? 'border-accent bg-accent text-on-accent'
                              : 'border-line bg-surface'
                        }`}
                      >
                        {done ? (
                          <Check className="h-3.5 w-3.5" strokeWidth={3} />
                        ) : (
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${current ? 'bg-current' : 'bg-line-2'}`}
                          />
                        )}
                      </span>
                      <div className="pt-0.5">
                        <p
                          className={`text-[14px] font-medium ${
                            done || current ? 'text-ink' : 'text-ink-3'
                          }`}
                        >
                          {step.label}
                        </p>
                        <p className="mt-0.5 text-[13px] leading-relaxed text-ink-3">
                          {current ? step.note : done ? 'Completed' : step.note}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}

            {order.courier_consignment_id && (
              <div className="border-t border-line bg-surface-2 px-5 py-4">
                <p className="flex items-center gap-2 text-[13px] font-medium text-ink">
                  <Truck className="h-4 w-4 text-ink-3" strokeWidth={2} />
                  {order.courier_provider || 'Courier'} — consignment{' '}
                  <span className="tnum">{order.courier_consignment_id}</span>
                </p>
                {order.courier_status && (
                  <p className="mt-1 pl-6 text-[13px] capitalize text-ink-2">
                    {order.courier_status}
                  </p>
                )}
              </div>
            )}

            {order.order_items && order.order_items.length > 0 && (
              <div className="border-t border-line px-5 py-4">
                <p className="eyebrow mb-3">Items</p>
                <ul className="space-y-2.5">
                  {order.order_items.map((item, i) => (
                    <li key={i} className="text-[13.5px] text-ink">
                      {item.product_name}
                      {item.serial_number && (
                        <span className="tnum ml-2 text-xs text-ink-3">
                          Serial {item.serial_number}
                        </span>
                      )}
                      {item.warranty_period && (
                        <span className="ml-2 text-xs text-verified">{item.warranty_period}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* Warranty / device result */}
        {warranty && (
          <section className="mt-6 overflow-hidden rounded-xl border border-line bg-surface">
            <header className="border-b border-line px-5 py-4">
              <h2 className="flex items-center gap-2 font-display text-base font-semibold tracking-tight text-ink">
                <ShieldCheck className="h-4 w-4 text-verified" strokeWidth={2} />
                Device record
              </h2>
              <p className="mt-0.5 text-[13px] text-ink-3">
                {warranty.products?.brand} {warranty.products?.name}
              </p>
            </header>

            <dl className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3">
              {[
                { t: 'Serial', v: warranty.serial_number || '—', mono: true },
                { t: 'IMEI', v: warranty.imei_1 || '—', mono: true },
                { t: 'Cosmetic grade', v: warranty.cosmetic_grade || '—' },
                {
                  t: 'Battery health',
                  v: warranty.battery_health_pct != null ? `${warranty.battery_health_pct}%` : '—',
                  mono: true,
                },
                {
                  t: 'Warranty',
                  v: warranty.warranty_months ? `${warranty.warranty_months} months` : '—',
                },
                { t: 'Starts', v: formatDate(warranty.warranty_starts_at) },
                { t: 'Expires', v: formatDate(warranty.warranty_expires_at) },
              ].map((row) => (
                <div key={row.t} className="bg-surface px-5 py-4">
                  <dt className="text-xs text-ink-3">{row.t}</dt>
                  <dd className={`mt-1 text-[14px] font-medium text-ink ${row.mono ? 'tnum' : ''}`}>
                    {row.v}
                  </dd>
                </div>
              ))}
            </dl>

            {warranty.battery_health_pct != null && (
              <p className="flex items-start gap-2 border-t border-line px-5 py-4 text-xs leading-relaxed text-ink-3">
                <BatteryCharging className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                Battery capacity measured at the point of sale. Batteries are consumables and are
                not covered by the hardware warranty.
              </p>
            )}
          </section>
        )}
      </div>
    </Container>
  )
}

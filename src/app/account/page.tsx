'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  CalendarClock,
  FileText,
  Heart,
  LayoutDashboard,
  Loader2,
  LogOut,
  MapPin,
  Package,
  ShieldCheck,
  User,
} from 'lucide-react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { useApp } from '@/store/AppContext'
import ProductCard from '@/components/ProductCard'
import Container from '@/components/ui/container'
import { Breadcrumbs } from '@/components/CollectionView'
import { formatBDT } from '@/components/ui/price'

const SECTIONS = [
  { key: 'overview', label: 'Overview', Icon: LayoutDashboard },
  { key: 'orders', label: 'Orders', Icon: Package },
  { key: 'warranty', label: 'Warranty & invoices', Icon: ShieldCheck },
  { key: 'prebookings', label: 'Reservations', Icon: CalendarClock },
  { key: 'saved', label: 'Saved items', Icon: Heart },
  { key: 'details', label: 'Your details', Icon: User },
] as const

type SectionKey = (typeof SECTIONS)[number]['key']

interface UserProfile {
  id: string
  email: string
  first_name?: string
  last_name?: string
  role?: string
  phone?: string
  address?: string
  city?: string
}

const formatDate = (v?: string) =>
  v ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

function Panel({
  title,
  lede,
  children,
}: {
  title: string
  lede?: string
  children: React.ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="border-b border-line px-6 py-4">
        <h2 className="font-display text-base font-semibold tracking-tight text-ink">{title}</h2>
        {lede && <p className="mt-0.5 text-[13px] text-ink-3">{lede}</p>}
      </div>
      {children}
    </section>
  )
}

function EmptyState({ text, cta }: { text: string; cta?: React.ReactNode }) {
  return (
    <div className="px-6 py-14 text-center">
      <p className="text-[13.5px] text-ink-2">{text}</p>
      {cta && <div className="mt-4">{cta}</div>}
    </div>
  )
}

export default function Account() {
  const router = useRouter()
  const { wishlist } = useApp()
  const [activeSection, setActiveSection] = useState<SectionKey>('overview')
  const [preBookings, setPreBookings] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [user, setUser] = useState<UserProfile | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    const supabase = createBrowserSupabaseClient()

    async function checkAuth() {
      try {
        const {
          data: { user: authUser },
          error,
        } = await supabase.auth.getUser()

        if (error || !authUser) {
          router.push('/login?redirectTo=/account')
          return
        }

        const res = await fetch('/api/v1/auth/me')
        const json = await res.json()

        if (json.success && json.data) {
          setUser(json.data)
        } else {
          setUser({
            id: authUser.id,
            email: authUser.email || '',
            first_name: authUser.user_metadata?.first_name,
            last_name: authUser.user_metadata?.last_name,
            role: 'customer',
          })
        }
      } catch (err) {
        console.error('Auth check failed:', err)
        router.push('/login?redirectTo=/account')
      } finally {
        setAuthLoading(false)
      }
    }

    checkAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') router.push('/login')
    })

    return () => subscription.unsubscribe()
  }, [router])

  useEffect(() => {
    if (!user) return

    async function loadUserData() {
      try {
        setOrdersLoading(true)
        const [ordersRes, pbRes] = await Promise.all([
          fetch('/api/v1/users/me/orders?limit=20').catch(() => null),
          fetch('/api/v1/pre-bookings').catch(() => null),
        ])

        if (ordersRes && ordersRes.ok) {
          const ordJson = await ordersRes.json()
          if (ordJson.success && Array.isArray(ordJson.data)) setOrders(ordJson.data)
        }

        if (pbRes && pbRes.ok) {
          const pbJson = await pbRes.json()
          if (pbJson.success && Array.isArray(pbJson.data)) setPreBookings(pbJson.data)
        }
      } catch (err) {
        console.error('Failed to load user account data:', err)
      } finally {
        setOrdersLoading(false)
      }
    }
    loadUserData()
  }, [user])

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      const supabase = createBrowserSupabaseClient()
      await supabase.auth.signOut()
      router.push('/login')
    } catch (err) {
      console.error('Logout error:', err)
      setLoggingOut(false)
    }
  }

  if (authLoading) {
    return (
      <Container className="flex justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-ink-3" strokeWidth={2} />
      </Container>
    )
  }

  if (!user) return null

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ')
  const displayName = fullName || user.email
  const userInitials = fullName
    ? fullName
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : (user.email?.[0] || 'C').toUpperCase()
  const isStaff = user.role === 'admin' || user.role === 'owner'

  const shopCta = (
    <Link
      href="/laptops"
      className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover"
    >
      Browse devices
    </Link>
  )

  const OrderRow = ({ ord }: { ord: any }) => (
    <li className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="tnum text-[14px] font-medium text-ink">
            #{ord.order_number || ord.id.slice(0, 8)}
          </p>
          <span className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium capitalize text-ink-2">
            {ord.status || 'Processing'}
          </span>
        </div>
        <p className="tnum mt-1 text-[13px] text-ink-3">
          {formatDate(ord.created_at)} · {formatBDT(ord.total || 0)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href={`/api/v1/admin/orders/${ord.id}/invoice`}
          target="_blank"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-[13px] font-medium text-ink-2 transition-colors hover:border-line-2 hover:text-ink"
        >
          <FileText className="h-3.5 w-3.5" strokeWidth={2} />
          Invoice
        </Link>
        <Link
          href="/track-order"
          className="inline-flex h-9 items-center rounded-lg bg-accent px-3 text-[13px] font-medium text-on-accent transition-colors hover:bg-accent-hover"
        >
          Track
        </Link>
      </div>
    </li>
  )

  return (
    <Container className="py-8 md:py-10">
      <Breadcrumbs items={[{ label: 'My account' }]} />

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Sidebar */}
        <aside className="lg:col-span-3">
          <div className="sticky top-24 overflow-hidden rounded-xl border border-line bg-surface">
            <div className="border-b border-line bg-surface-2 px-5 py-5">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent font-display text-sm font-semibold text-on-accent">
                {userInitials}
              </span>
              <p className="mt-3 truncate text-[15px] font-medium text-ink">{displayName}</p>
              <p className="truncate text-[13px] text-ink-3">{user.email}</p>
            </div>

            <nav className="p-2">
              {SECTIONS.map(({ key, label, Icon }) => {
                const active = activeSection === key
                return (
                  <button
                    key={key}
                    onClick={() => setActiveSection(key)}
                    aria-current={active ? 'page' : undefined}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] transition-colors ${
                      active
                        ? 'bg-surface-2 font-medium text-ink'
                        : 'text-ink-2 hover:bg-surface-2 hover:text-ink'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                    {label}
                    {key === 'saved' && wishlist.length > 0 && (
                      <span className="tnum ml-auto text-xs text-ink-3">{wishlist.length}</span>
                    )}
                  </button>
                )
              })}
            </nav>

            <div className="space-y-1 border-t border-line p-2">
              {isStaff && (
                <Link
                  href="/admin"
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
                >
                  <LayoutDashboard className="h-4 w-4 shrink-0" strokeWidth={2} />
                  Admin portal
                </Link>
              )}
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] text-ink-2 transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-50"
              >
                <LogOut className="h-4 w-4 shrink-0" strokeWidth={2} />
                {loggingOut ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          </div>
        </aside>

        {/* Content */}
        <div className="space-y-6 lg:col-span-9">
          {activeSection === 'overview' && (
            <>
              <dl className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
                {[
                  { t: 'Orders placed', v: orders.length },
                  { t: 'Active reservations', v: preBookings.length },
                  { t: 'Saved items', v: wishlist.length },
                ].map(({ t, v }) => (
                  <div key={t} className="bg-surface px-5 py-5">
                    <dt className="text-[13px] text-ink-3">{t}</dt>
                    <dd className="tnum mt-1 font-display text-2xl font-semibold tracking-tight text-ink">
                      {v}
                    </dd>
                  </div>
                ))}
              </dl>

              <Panel title="Recent orders">
                {ordersLoading ? (
                  <EmptyState text="Loading your orders…" />
                ) : orders.length === 0 ? (
                  <EmptyState text="You haven't placed an order yet." cta={shopCta} />
                ) : (
                  <>
                    <ul className="divide-y divide-line">
                      {orders.slice(0, 3).map((ord) => (
                        <OrderRow key={ord.id} ord={ord} />
                      ))}
                    </ul>
                    {orders.length > 3 && (
                      <div className="border-t border-line bg-surface-2 px-6 py-3">
                        <button
                          onClick={() => setActiveSection('orders')}
                          className="group inline-flex items-center gap-1.5 text-[13px] font-medium text-accent"
                        >
                          All {orders.length} orders
                          <ArrowRight
                            className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                            strokeWidth={2}
                          />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </Panel>

              <div className="flex items-start gap-3 rounded-xl border border-line bg-surface-2 p-5">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-verified" strokeWidth={2} />
                <p className="text-[13px] leading-relaxed text-ink-2">
                  <strong className="font-medium text-ink">Warranty is tied to your order.</strong>{' '}
                  Every device you buy is recorded against its serial or IMEI. You can pull the
                  certificate and invoice any time from Warranty &amp; invoices.
                </p>
              </div>
            </>
          )}

          {activeSection === 'orders' && (
            <Panel title="Order history" lede="Every order placed on this account.">
              {ordersLoading ? (
                <EmptyState text="Loading your orders…" />
              ) : orders.length === 0 ? (
                <EmptyState text="You haven't placed an order yet." cta={shopCta} />
              ) : (
                <ul className="divide-y divide-line">
                  {orders.map((ord) => (
                    <OrderRow key={ord.id} ord={ord} />
                  ))}
                </ul>
              )}
            </Panel>
          )}

          {activeSection === 'warranty' && (
            <Panel
              title="Warranty & invoices"
              lede="Download the invoice and warranty certificate for any order."
            >
              {orders.length === 0 ? (
                <EmptyState text="Devices you buy will appear here with their warranty details." />
              ) : (
                <ul className="divide-y divide-line">
                  {orders.map((ord) => (
                    <li key={ord.id} className="px-6 py-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="tnum text-[14px] font-medium text-ink">
                            Order #{ord.order_number || ord.id.slice(0, 8)}
                          </p>
                          <p className="tnum mt-0.5 text-[13px] text-ink-3">
                            {formatDate(ord.created_at)} · {formatBDT(ord.total || 0)}
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1.5 rounded-md border border-verified-line bg-verified-soft px-2 py-0.5 text-[11px] font-medium capitalize text-verified">
                          <ShieldCheck className="h-3 w-3" strokeWidth={2.25} />
                          {ord.status || 'Active'}
                        </span>
                      </div>

                      <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-line pt-4 text-[13px] sm:grid-cols-3">
                        <div>
                          <dt className="text-ink-3">Items</dt>
                          <dd className="tnum mt-0.5 font-medium text-ink">
                            {ord.items_count || 1}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-ink-3">Payment</dt>
                          <dd className="mt-0.5 font-medium capitalize text-ink">
                            {ord.payment_status || '—'}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-ink-3">Coverage</dt>
                          <dd className="mt-0.5 font-medium text-ink">SMSTech warranty</dd>
                        </div>
                      </dl>

                      <Link
                        href={`/api/v1/admin/orders/${ord.id}/invoice`}
                        target="_blank"
                        className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg border border-line px-4 text-[13px] font-medium text-ink transition-colors hover:border-line-2 hover:bg-surface-2"
                      >
                        <FileText className="h-3.5 w-3.5" strokeWidth={2} />
                        Download invoice &amp; warranty (PDF)
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}

          {activeSection === 'prebookings' && (
            <Panel
              title="Reservations"
              lede="Devices you have reserved, and where you sit in the queue."
            >
              {preBookings.length === 0 ? (
                <EmptyState
                  text="No active reservations. You can reserve any device that isn't in stock yet from its product page."
                  cta={shopCta}
                />
              ) : (
                <ul className="divide-y divide-line">
                  {preBookings.map((pb) => (
                    <li key={pb.id} className="px-6 py-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="tnum text-[14px] font-medium text-ink">
                          Booking #{pb.booking_number}
                        </p>
                        <span className="tnum rounded-md border border-accent-line bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent-ink">
                          Queue position #{pb.queue_priority}
                        </span>
                      </div>

                      <dl className="mt-4 grid grid-cols-3 gap-4 border-t border-line pt-4 text-[13px]">
                        <div>
                          <dt className="text-ink-3">Total</dt>
                          <dd className="tnum mt-0.5 font-medium text-ink">
                            {formatBDT(pb.total_price)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-ink-3">Deposit paid</dt>
                          <dd className="tnum mt-0.5 font-medium text-verified">
                            {formatBDT(pb.advance_paid)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-ink-3">Balance</dt>
                          <dd className="tnum mt-0.5 font-medium text-ink">
                            {formatBDT(pb.remaining_due)}
                          </dd>
                        </div>
                      </dl>

                      {pb.remaining_due > 0 && (
                        <p className="mt-4 rounded-lg border border-line bg-surface-2 px-4 py-3 text-[13px] leading-relaxed text-ink-2">
                          The balance of{' '}
                          <span className="tnum font-medium text-ink">
                            {formatBDT(pb.remaining_due)}
                          </span>{' '}
                          is due when your unit is allocated. Settle it on delivery, in store, or{' '}
                          <Link href="/contact" className="font-medium text-accent">
                            contact us
                          </Link>{' '}
                          to pay in advance.
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}

          {activeSection === 'saved' && (
            <Panel title={`Saved items (${wishlist.length})`}>
              {wishlist.length === 0 ? (
                <EmptyState
                  text="Nothing saved yet. Tap the heart on any listing to keep it here."
                  cta={shopCta}
                />
              ) : (
                <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 xl:grid-cols-3">
                  {wishlist.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              )}
            </Panel>
          )}

          {activeSection === 'details' && (
            <Panel title="Your details" lede="Used for order confirmation and delivery.">
              <dl className="divide-y divide-line">
                {[
                  { t: 'Name', v: displayName, Icon: User },
                  { t: 'Email', v: user.email, Icon: null },
                  { t: 'Phone', v: user.phone || 'Not set', Icon: null },
                  {
                    t: 'Delivery address',
                    v: [user.address, user.city].filter(Boolean).join(', ') || 'Not set',
                    Icon: MapPin,
                  },
                ].map(({ t, v }) => (
                  <div
                    key={t}
                    className="flex flex-col gap-1 px-6 py-4 sm:flex-row sm:items-center sm:gap-6"
                  >
                    <dt className="w-40 shrink-0 text-[13px] text-ink-3">{t}</dt>
                    <dd className="text-[14px] text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="border-t border-line bg-surface-2 px-6 py-4">
                <p className="text-[13px] text-ink-2">
                  Need something changed?{' '}
                  <Link href="/contact" className="font-medium text-accent">
                    Contact us
                  </Link>{' '}
                  and we&rsquo;ll update it.
                </p>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </Container>
  )
}

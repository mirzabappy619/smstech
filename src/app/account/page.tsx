'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { useApp } from '@/store/AppContext'
import ProductCard from '@/components/ProductCard'

const fmt = (n: number) => '৳' + (Number(n) || 0).toLocaleString('en-BD')

const sections = [
  'Overview',
  'Digital NFC Card',
  'Digital Warranty Vault',
  'Pre-Booking Tracker',
  'My Orders',
  'Wishlist',
  'Saved Addresses'
]

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

export default function Account() {
  const router = useRouter()
  const { wishlist } = useApp()
  const [activeSection, setActiveSection] = useState('Overview')
  const [preBookings, setPreBookings] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [user, setUser] = useState<UserProfile | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)

  // Check Supabase auth and load user profile
  useEffect(() => {
    const supabase = createBrowserSupabaseClient()

    async function checkAuth() {
      try {
        const { data: { user: authUser }, error } = await supabase.auth.getUser()

        if (error || !authUser) {
          router.push('/login?redirectTo=/account')
          return
        }

        // Fetch user profile from API
        const res = await fetch('/api/v1/auth/me')
        const json = await res.json()

        if (json.success && json.data) {
          setUser(json.data)
        } else {
          // Fallback to auth user data
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

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        router.push('/login')
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

  // Load orders and pre-bookings after auth is confirmed
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
          if (ordJson.success && Array.isArray(ordJson.data)) {
            setOrders(ordJson.data)
          }
        }

        if (pbRes && pbRes.ok) {
          const pbJson = await pbRes.json()
          if (pbJson.success && Array.isArray(pbJson.data)) {
            setPreBookings(pbJson.data)
          }
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

  // Loading state
  if (authLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </div>
    )
  }

  // Not authenticated (shouldn't render, but safety fallback)
  if (!user) return null

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ')
  const displayName = fullName || user.email
  const userInitials = fullName
    ? fullName.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : (user.email?.[0] || 'C').toUpperCase()
  const isStaff = user.role === 'admin' || user.role === 'owner'

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <div className="grid lg:grid-cols-4 gap-8">
        {/* Sidebar */}
        <aside className="lg:col-span-1">
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/80 rounded-2xl overflow-hidden sticky top-24 transition-colors shadow-sm">
            <div className="p-5 border-b border-slate-100 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-black text-lg mb-2">
                {userInitials}
              </div>
              <p className="font-extrabold text-slate-900 dark:text-white">{displayName}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-black px-2 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 rounded-full">
                  ⭐ Gold Tier Member
                </span>
              </div>
            </div>

            <nav className="py-2">
              {sections.map((s) => (
                <button
                  key={s}
                  onClick={() => setActiveSection(s)}
                  className={`w-full text-left px-5 py-2.5 text-xs font-bold transition-colors ${
                    activeSection === s
                      ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 font-extrabold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                  }`}
                >
                  {s}
                </button>
              ))}

              {isStaff && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-700/80 mt-2 px-3">
                  <Link
                    href="/admin"
                    className="block p-2 text-center text-xs font-bold bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-200 dark:border-blue-900"
                  >
                    🔐 Staff POS & Admin Portal
                  </Link>
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 dark:border-slate-700/80 mt-2 px-3 pb-2">
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="w-full p-2 text-center text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-xl transition-colors disabled:opacity-50"
                >
                  {loggingOut ? 'Logging out...' : '🚪 Logout'}
                </button>
              </div>
            </nav>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="lg:col-span-3 space-y-6">
          {/* SECTION 1: Overview */}
          {activeSection === 'Overview' && (
            <>
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  ['💳', 'Gold Tier', 'Loyalty Membership'],
                  ['🛡️', `${orders.length} Orders`, 'Order History'],
                  ['⏳', `${preBookings.length} Active`, 'Pre-Bookings'],
                ].map(([icon, val, label]) => (
                  <div key={label as string} className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/80 rounded-2xl p-5 text-center transition-colors">
                    <p className="text-2xl mb-1">{icon}</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white">{val}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{label as string}</p>
                  </div>
                ))}
              </div>

              {/* Quick NFC Card Banner */}
              <div className="p-6 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
                <div>
                  <p className="text-xs uppercase font-bold tracking-wider text-blue-200">SMSTech Instant Counter Tap</p>
                  <h3 className="text-lg font-black mt-1">Digital NFC Membership Card</h3>
                  <p className="text-xs text-blue-100 mt-1">Tap your phone at any SMSTech store counter for instant warranty lookup & loyalty tier discounts.</p>
                </div>
                <button
                  onClick={() => setActiveSection('Digital NFC Card')}
                  className="px-5 py-2.5 bg-white text-blue-700 font-extrabold rounded-xl text-xs hover:bg-blue-50 transition-all shadow-md shrink-0"
                >
                  View Digital Card →
                </button>
              </div>

              {/* Recent Orders Overview */}
              <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/80 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Recent Orders</h3>
                  <button onClick={() => setActiveSection('My Orders')} className="text-xs font-bold text-blue-600 hover:underline">
                    View All →
                  </button>
                </div>
                {ordersLoading ? (
                  <div className="py-8 text-center text-xs text-slate-400">Loading recent orders...</div>
                ) : orders.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    No orders placed yet. <Link href="/laptops" className="text-blue-600 font-bold hover:underline">Start shopping</Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {orders.slice(0, 3).map((ord) => (
                      <div key={ord.id} className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="font-bold text-xs text-slate-900 dark:text-white">#{ord.order_number || ord.id.slice(0, 8)}</p>
                          <p className="text-[10px] text-slate-400 capitalize">
                            Status: {ord.status || 'Pending'} · {fmt(ord.total || 0)}
                          </p>
                        </div>
                        <Link href="/track-order" className="text-xs font-bold text-blue-600 hover:underline">Track →</Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* SECTION 2: Digital NFC Membership Card */}
          {activeSection === 'Digital NFC Card' && (
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/80 rounded-2xl p-6 space-y-6">
              <div>
                <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">Digital NFC Membership Card</h3>
                <p className="text-xs text-slate-500">Present this QR code at checkout or tap your smartphone on the store terminal.</p>
              </div>

              {/* Card Graphical Mockup */}
              <div className="max-w-sm mx-auto p-6 bg-gradient-to-br from-zinc-900 via-slate-800 to-blue-900 text-white rounded-3xl shadow-2xl border border-white/20 space-y-6 relative overflow-hidden">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-black text-sm tracking-wider uppercase">SMSTech Privilege</h4>
                    <p className="text-[10px] text-blue-300 font-mono">{user.id?.slice(0, 12)?.toUpperCase() || 'CUST-000000'}</p>
                  </div>
                  <span className="text-xl">⚡</span>
                </div>

                {/* QR Code Graphic Box */}
                <div className="w-36 h-36 mx-auto bg-white p-2.5 rounded-2xl shadow-inner flex items-center justify-center">
                  <svg className="w-full h-full text-zinc-900" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2 2h8v8H2V2zm2 2v4h4V4H4zm10-2h8v8h-8V2zm2 2v4h4V4h-4zM2 14h8v8H2v-8zm2 2v4h4v-4H4zm14 0h4v4h-4v-4zm-4 4h4v4h-4v-4zm4-4h4v-4h-4v4zm-4-4h4v4h-4v-4z" />
                  </svg>
                </div>

                <div className="flex justify-between items-end text-xs">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase">Card Holder</p>
                    <p className="font-bold text-sm">{displayName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-amber-400 font-bold uppercase">Gold Member</p>
                    <p className="text-[10px] text-slate-400">Tap to Scan</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 3: Digital Warranty Vault */}
          {activeSection === 'Digital Warranty Vault' && (
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/80 rounded-2xl p-6 space-y-4">
              <div>
                <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">Digital Warranty Vault</h3>
                <p className="text-xs text-slate-500">Live active warranty certificates and downloadable legal A4 invoices.</p>
              </div>

              {orders.length === 0 ? (
                <div className="text-center py-12 text-zinc-400 text-xs">
                  No registered warranty devices found. Orders with warranty coverage will appear here.
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((ord) => (
                    <div key={ord.id} className="p-5 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-3 bg-slate-50/50 dark:bg-slate-900/50">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">Order #{ord.order_number || ord.id.slice(0, 8)}</h4>
                          <div className="flex items-center gap-3 text-xs text-slate-500 font-mono mt-1">
                            <span className="text-blue-600 font-bold">Total: {fmt(ord.total || 0)}</span>
                            <span>Items: {ord.items_count || 1}</span>
                          </div>
                        </div>
                        <span className="px-3 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded-full text-xs font-black self-start sm:self-auto capitalize">
                          ✓ {ord.status || 'Active'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs pt-2 border-t border-slate-200 dark:border-slate-700">
                        <div>
                          <span className="text-slate-400 block text-[10px]">Order Date</span>
                          <span className="font-bold text-slate-700 dark:text-slate-300">{new Date(ord.created_at).toLocaleDateString()}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Payment Status</span>
                          <span className="font-bold text-slate-700 dark:text-slate-300 capitalize">{ord.payment_status || 'Paid'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Coverage Type</span>
                          <span className="font-bold text-blue-600">SMSTech Official Warranty</span>
                        </div>
                      </div>

                      <div className="pt-2">
                        <Link
                          href={`/api/v1/admin/orders/${ord.id}/invoice`}
                          target="_blank"
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                        >
                          <span>📄</span> Download Official Invoice / Warranty (A4 PDF)
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SECTION 4: Pre-Booking Tracker */}
          {activeSection === 'Pre-Booking Tracker' && (
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/80 rounded-2xl p-6 space-y-4">
              <div>
                <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">Pre-Booking Tracker & Queue Priority</h3>
                <p className="text-xs text-slate-500">Track your reserved device lot position and pay remaining balances.</p>
              </div>

              {preBookings.length === 0 ? (
                <div className="text-center py-12 text-zinc-400 text-xs">
                  No active pre-bookings found. You can pre-book out-of-stock devices on product pages.
                </div>
              ) : (
                <div className="space-y-4">
                  {preBookings.map((pb) => (
                    <div key={pb.id} className="p-5 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-3 bg-slate-50/50 dark:bg-slate-900/50">
                      <div className="flex justify-between items-center">
                        <span className="font-mono text-xs font-bold text-blue-600">Booking #{pb.booking_number}</span>
                        <span className="px-2.5 py-1 bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 rounded-full text-xs font-black">
                          Queue Rank #{pb.queue_priority}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-slate-200 dark:border-slate-700">
                        <div>
                          <span className="text-slate-400 block text-[10px]">Total Price</span>
                          <span className="font-bold">{fmt(pb.total_price)}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Advance Paid</span>
                          <span className="font-bold text-emerald-600">{fmt(pb.advance_paid)}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Remaining Due</span>
                          <span className="font-bold text-rose-600">{fmt(pb.remaining_due)}</span>
                        </div>
                      </div>

                      {pb.remaining_due > 0 && (
                        <div className="pt-2">
                          <button
                            onClick={() => alert(`Redirecting to bKash Gateway to clear remaining due of ৳${pb.remaining_due}...`)}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm"
                          >
                            Pay Remaining Due Online ({fmt(pb.remaining_due)}) →
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SECTION 5: My Orders */}
          {activeSection === 'My Orders' && (
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/80 rounded-2xl p-6 space-y-4">
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">Order History</h3>
              {ordersLoading ? (
                <div className="text-center py-12 text-zinc-400 text-xs">Loading orders...</div>
              ) : orders.length === 0 ? (
                <div className="text-center py-12 text-zinc-400 text-xs">
                  No orders placed yet. <Link href="/laptops" className="text-blue-600 font-bold hover:underline">Start shopping</Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((ord) => (
                    <div key={ord.id} className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-800">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm text-slate-900 dark:text-white">#{ord.order_number || ord.id.slice(0, 8)}</p>
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 text-[10px] font-bold rounded-full capitalize">
                            {ord.status || 'Processing'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Placed on {new Date(ord.created_at).toLocaleDateString()} · Total: <span className="font-bold text-slate-900 dark:text-white">{fmt(ord.total || 0)}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/api/v1/admin/orders/${ord.id}/invoice`}
                          target="_blank"
                          className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600"
                        >
                          Invoice ↗
                        </Link>
                        <Link
                          href="/track-order"
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors"
                        >
                          Track Order
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SECTION 6: Wishlist */}
          {activeSection === 'Wishlist' && (
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/80 rounded-2xl p-6 space-y-4">
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">Saved Wishlist ({wishlist.length})</h3>
              {wishlist.length === 0 ? (
                <div className="text-center py-12 text-zinc-400 text-xs">
                  Your wishlist is empty. Tap the heart icon on any product to save it here.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {wishlist.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SECTION 7: Saved Addresses */}
          {activeSection === 'Saved Addresses' && (
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/80 rounded-2xl p-6 space-y-4">
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">Saved Delivery Addresses</h3>
              <div className="p-5 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-2 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-blue-600">Default Delivery Address</span>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded text-[10px] font-bold">Primary</span>
                </div>
                <p className="font-bold text-sm text-slate-900 dark:text-white">{displayName}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{user.phone || 'Phone not set'}</p>
                <p className="text-xs text-slate-600 dark:text-slate-300">{user.address || 'Dhaka, Bangladesh'}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

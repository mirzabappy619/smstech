'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useApp } from '../../store/AppContext'

const fmt = (n: number) => '৳' + n.toLocaleString('en-BD')

const sampleOrders = [
  { id: '#SMST-2026-000098', date: 'Aug 12, 2026', product: 'ASUS ROG Strix G16', total: 189999, status: 'Delivered', img: 'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=80&h=80&fit=crop&auto=format' },
  { id: '#SMST-2026-000075', date: 'Aug 5, 2026', product: 'iPhone 17 Pro', total: 179999, status: 'Delivered', img: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=80&h=80&fit=crop&auto=format' },
  { id: '#SMST-2026-000061', date: 'Jul 28, 2026', product: 'Samsung Galaxy S26 Ultra', total: 174999, status: 'Delivered', img: 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=80&h=80&fit=crop&auto=format' },
]

const sections = ['Overview', 'My Orders', 'Wishlist', 'Saved Addresses', 'Reviews', 'Store Reservations', 'Settings']

export default function Account() {
  const [activeSection, setActiveSection] = useState('Overview')
  const { wishlist, toggleWishlist } = useApp()

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <div className="grid lg:grid-cols-4 gap-8">
        {/* Sidebar */}
        <aside className="lg:col-span-1">
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/80 rounded-2xl overflow-hidden sticky top-24 transition-colors">
            <div className="p-5 border-b border-slate-100 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-800 text-lg mb-2">C</div>
              <p className="font-700 text-slate-900 dark:text-white">Welcome back</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Customer Account</p>
            </div>
            <nav className="py-2">
              {sections.map((s) => (
                <button
                  key={s}
                  onClick={() => setActiveSection(s)}
                  className={`w-full text-left px-5 py-2.5 text-sm font-600 transition-colors
                    ${activeSection === s
                      ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 font-700'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                >
                  {s}
                </button>
              ))}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-700/80 mt-2 px-3">
                <Link
                  href="/admin"
                  className="block p-2 text-center text-xs font-700 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-200 dark:border-blue-900"
                >
                  🔐 Open Admin Portal
                </Link>
              </div>
            </nav>
          </div>
        </aside>

        {/* Main */}
        <div className="lg:col-span-3 space-y-6">
          {activeSection === 'Overview' && (
            <>
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  ['📦', sampleOrders.length, 'Total Orders'],
                  ['❤️', wishlist.length, 'Wishlisted'],
                  ['⭐', '3', 'Reviews'],
                ].map(([icon, val, label]) => (
                  <div key={label as string} className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/80 rounded-2xl p-5 text-center transition-colors">
                    <p className="text-2xl mb-1">{icon}</p>
                    <p className="text-2xl font-800 text-slate-900 dark:text-white">{val}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{label as string}</p>
                  </div>
                ))}
              </div>
              <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/80 rounded-2xl p-5 transition-colors">
                <h3 className="font-700 text-slate-900 dark:text-white mb-4">Recent Orders</h3>
                <div className="space-y-3">
                  {sampleOrders.map((order) => (
                    <div key={order.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      <img src={order.img} alt={order.product} className="w-12 h-12 object-cover rounded-xl bg-slate-100 dark:bg-slate-900" />
                      <div className="flex-1">
                        <p className="font-600 text-slate-900 dark:text-white text-sm">{order.product}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{order.id} · {order.date}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-700 text-sm text-slate-900 dark:text-white">{fmt(order.total)}</p>
                        <span className="text-xs px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-600 rounded-full">{order.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeSection === 'My Orders' && (
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/80 rounded-2xl p-5 transition-colors">
              <h3 className="font-700 text-slate-900 dark:text-white mb-4">My Orders</h3>
              <div className="space-y-4">
                {sampleOrders.map((order) => (
                  <div key={order.id} className="border border-slate-100 dark:border-slate-700 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-700 text-sm text-slate-900 dark:text-white">{order.id}</span>
                      <span className="text-xs px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-600 rounded-full">{order.status}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <img src={order.img} alt={order.product} className="w-14 h-14 object-cover rounded-xl bg-slate-100 dark:bg-slate-900" />
                      <div className="flex-1">
                        <p className="font-600 text-slate-900 dark:text-white text-sm">{order.product}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{order.date}</p>
                        <p className="font-700 text-sm text-slate-900 dark:text-white mt-1">{fmt(order.total)}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Link href="/track-order" className="text-xs text-blue-600 dark:text-blue-400 font-600 hover:underline">Track Order →</Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === 'Wishlist' && (
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/80 rounded-2xl p-5 transition-colors">
              <h3 className="font-700 text-slate-900 dark:text-white mb-4">My Wishlist ({wishlist.length})</h3>
              {wishlist.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-4xl mb-3">❤️</p>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">Your wishlist is empty.</p>
                  <Link href="/laptops" className="text-blue-600 dark:text-blue-400 font-600 text-sm hover:underline">Start Shopping →</Link>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  {wishlist.map((p) => (
                    <div key={p.id} className="border border-slate-100 dark:border-slate-700 rounded-xl p-3 flex gap-3">
                      <img src={p.image} alt={p.name} className="w-14 h-14 object-cover rounded-xl bg-slate-100 dark:bg-slate-900" />
                      <div className="flex-1">
                        <p className="text-xs font-700 text-blue-600 dark:text-blue-400">{p.brand}</p>
                        <p className="text-sm font-600 text-slate-900 dark:text-white line-clamp-1">{p.name}</p>
                        <p className="font-700 text-sm text-slate-900 dark:text-white mt-1">৳{p.price.toLocaleString()}</p>
                        <button onClick={() => toggleWishlist(p)} className="text-xs text-red-500 dark:text-red-400 hover:text-red-600 font-600 mt-1">Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {(activeSection !== 'Overview' && activeSection !== 'My Orders' && activeSection !== 'Wishlist') && (
            <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/80 rounded-2xl p-10 text-center transition-colors">
              <p className="text-3xl mb-3">🔧</p>
              <p className="font-700 text-slate-900 dark:text-white mb-1">{activeSection}</p>
              <p className="text-slate-500 dark:text-slate-400 text-sm">This section is coming soon.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

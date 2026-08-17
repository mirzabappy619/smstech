'use client'

import { useState } from 'react'
import Link from 'next/link'

const stores = [
  {
    id: '1',
    name: 'SMSTech — Multiplan Branch',
    address: 'Shop - 309, Level -03, Computer City Market (Multiplan), New Elephant Road (69-71), Dhaka - 1205',
    phone: '01781485588 / 01723249598',
    email: 'info@smstech.bd',
    hours: '10:00 AM – 8:00 PM (Everyday)',
    products: ['Laptops', 'Smartphones', 'Accessories', 'MacBooks', 'Pre-Owned Laptops'],
    lat: 23.7388, lng: 90.3872,
    distance: 'Elephant Road, Dhaka',
  },
]

const filters = ['All Stores', 'Laptops', 'Smartphones', 'Pre-Owned', 'Open Now']

export default function Stores() {
  const [activeFilter, setActiveFilter] = useState('All Stores')
  const [activeStore, setActiveStore] = useState(stores[0])

  return (
    <div>
      {/* Header */}
      <div className="bg-slate-900 dark:bg-slate-950 py-16 text-center transition-colors">
        <h1 className="text-3xl md:text-4xl font-800 text-white mb-3">Visit SMSTech Store</h1>
        <p className="text-slate-400 max-w-md mx-auto text-sm">
          Prefer to shop in person? Visit our store at Multiplan Computer City Market for expert guidance before you buy.
        </p>
      </div>

      {/* Filter pills */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700/80 transition-colors">
        <div className="max-w-7xl mx-auto px-4 py-3 flex gap-2 overflow-x-auto">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-600 transition-all
                ${activeFilter === f ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Store list */}
          <div className="space-y-5">
            {stores.map((store) => (
              <div
                key={store.id}
                onClick={() => setActiveStore(store)}
                className={`rounded-2xl border-2 p-6 cursor-pointer transition-all hover:shadow-md ${activeStore.id === store.id ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 dark:border-blue-500' : 'border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800'}`}
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-800 text-lg text-slate-900 dark:text-white">{store.name}</h2>
                      <span className="text-xs px-2.5 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-700 rounded-full">Open Now</span>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{store.distance}</p>
                  </div>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-2.5 text-slate-700 dark:text-slate-200">
                    <span className="text-base shrink-0 mt-0.5">📍</span>
                    <span className="font-600 leading-relaxed">{store.address}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-200">
                    <span className="text-base shrink-0">📞</span>
                    <span className="font-700 text-blue-600 dark:text-blue-400">{store.phone}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-200">
                    <span className="text-base shrink-0">🕐</span>
                    <span className="font-600">{store.hours}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                  {store.products.map((p) => (
                    <span key={p} className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs font-600 rounded-lg">{p}</span>
                  ))}
                </div>
                <div className="flex gap-3 mt-5">
                  <a
                    href={`https://www.google.com/maps?q=${encodeURIComponent(store.name + ' ' + store.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2.5 text-center text-sm font-700 border-2 border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors"
                  >
                    Get Directions
                  </a>
                  <Link href="/contact" className="flex-1 py-2.5 text-center text-sm font-700 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors">
                    Contact Store
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Map & Store Info Card */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-lg h-80 lg:h-[420px] relative bg-slate-100 dark:bg-slate-900">
              <iframe
                title="SMSTech Multiplan Store Location"
                src="https://maps.google.com/maps?q=Computer+City+Center+Multiplan+Dhaka&t=&z=16&ie=UTF8&iwloc=&output=embed"
                className="w-full h-full border-0"
                loading="lazy"
              />
            </div>

            {/* Store hours */}
            <div className="mt-5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/80 p-5 transition-colors">
              <h3 className="font-700 text-slate-900 dark:text-white mb-3 text-sm">Store Hours &amp; Information</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Opening Hours</span>
                  <span className="font-600 text-slate-900 dark:text-white">10:00 AM – 8:00 PM</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Hotline / Contact</span>
                  <span className="font-700 text-blue-600 dark:text-blue-400">01781485588, 01723249598</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Location</span>
                  <span className="font-600 text-slate-900 dark:text-white">Multiplan Center, Level-3, Shop 309</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

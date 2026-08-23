'use client'

import Link from 'next/link'
import { useApp } from '../../store/AppContext'
import { allProducts } from '../../data/products'
import { useState } from 'react'

const fmt = (n: number) => '৳' + (Number(n) || 0).toLocaleString('en-BD')

const BRANCHES = [
  'Multiplan Branch (Instant)',
  'Banani Branch (Instant)',
  'IDB Bhaban Branch (30m)',
  'Uttara Branch (2h)',
  'Chattogram Branch (24h)'
]

export default function Compare() {
  const { compareList, removeFromCompare, addToCompare } = useApp()
  const [search, setSearch] = useState('')

  const suggestions = allProducts
    .filter((p) => !compareList.find((c) => c.id === p.id) && p.name.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 5)

  // Standard Spec Categories
  const standardSpecs = [
    { label: 'Processor / Chipset', key: 'Processor' },
    { label: 'RAM / Memory', key: 'RAM' },
    { label: 'Storage Capacity', key: 'Storage' },
    { label: 'Graphics / GPU', key: 'GPU' },
    { label: 'Display & Screen', key: 'Display' },
    { label: 'Operating System', key: 'OS' },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Side-by-Side Hardware Comparison</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Compare up to 4 laptops, phones, or pre-owned devices across Processor, GPU, Battery, and Price.</p>
      </div>

      {compareList.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="text-6xl mb-4">⚖️</div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mb-2">No products in compare tray</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-8">Add devices from any product page or catalog to compare side-by-side.</p>
          <div className="flex gap-3 justify-center">
            <Link href="/laptops" className="px-5 py-2.5 bg-blue-600 text-white font-bold rounded-xl text-sm hover:bg-blue-700 shadow-md">
              Browse Laptops
            </Link>
            <Link href="/smartphones" className="px-5 py-2.5 border border-slate-200 dark:border-slate-700 font-bold rounded-xl text-sm hover:border-blue-300 dark:hover:border-blue-500 text-slate-700 dark:text-slate-200">
              Browse Phones
            </Link>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <td className="w-48 pr-4 align-top">
                  {compareList.length < 4 && (
                    <div className="p-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl text-center min-h-48 flex flex-col items-center justify-center gap-2 bg-slate-50 dark:bg-slate-800/50">
                      <span className="text-2xl text-blue-600 font-black">+</span>
                      <p className="text-xs text-slate-700 dark:text-slate-300 font-bold">Add Another Device</p>
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search MacBook, ROG..."
                        className="w-full mt-2 px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg text-xs font-semibold focus:outline-none focus:border-blue-500"
                      />
                      {search && (
                        <div className="w-full border border-slate-100 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-800 shadow-lg">
                          {suggestions.map((s) => (
                            <button
                              key={s.id}
                              onClick={() => { addToCompare(s); setSearch('') }}
                              className="w-full text-left px-2 py-2 text-xs hover:bg-blue-50 dark:hover:bg-slate-700 border-b border-slate-50 dark:border-slate-700 last:border-0 text-slate-900 dark:text-white font-bold"
                            >
                              {s.brand} {s.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </td>
                {compareList.map((p) => (
                  <td key={p.id} className="px-3 align-top min-w-[220px]">
                    <div className="border border-slate-100 dark:border-slate-700/80 rounded-2xl overflow-hidden bg-white dark:bg-slate-800 shadow-sm">
                      <div className="relative">
                        <button
                          onClick={() => removeFromCompare(p.id)}
                          className="absolute top-2 right-2 w-6 h-6 bg-white dark:bg-slate-700 rounded-full flex items-center justify-center text-slate-400 dark:text-slate-300 hover:text-red-500 text-xs font-bold shadow-sm z-10"
                        >×</button>
                        <img src={p.image} alt={p.name} className="w-full h-36 object-cover bg-slate-100 dark:bg-slate-900" />
                      </div>
                      <div className="p-3.5 space-y-1.5">
                        <p className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider">{p.brand}</p>
                        <p className="text-xs font-extrabold text-slate-900 dark:text-white line-clamp-2">{p.name}</p>
                        <p className="text-base font-black text-slate-900 dark:text-white pt-1">{fmt(p.price)}</p>
                        <Link
                          href={`/product/${p.slug}`}
                          className="block mt-2 text-center py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
                        >
                          View Details
                        </Link>
                      </div>
                    </div>
                  </td>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {/* Price & Rating */}
              <tr className="bg-slate-50 dark:bg-slate-800/60 font-bold">
                <td className="py-3 pr-4 pl-3 text-slate-700 dark:text-slate-300 font-extrabold">Rating & Reviews</td>
                {compareList.map((p) => (
                  <td key={p.id} className="px-3 py-3 font-bold text-amber-600">
                    ⭐ {p.rating} <span className="text-slate-400 font-normal">({p.reviews} reviews)</span>
                  </td>
                ))}
              </tr>

              {/* Standard Specifications */}
              {standardSpecs.map(({ label, key }) => (
                <tr key={key} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                  <td className="py-3 pr-4 pl-3 font-extrabold text-slate-900 dark:text-white">{label}</td>
                  {compareList.map((p) => (
                    <td key={p.id} className="px-3 py-3 text-slate-700 dark:text-slate-300 font-medium">
                      {p.specs[key] || '—'}
                    </td>
                  ))}
                </tr>
              ))}

              {/* Warranty */}
              <tr className="bg-slate-50 dark:bg-slate-800/60">
                <td className="py-3 pr-4 pl-3 font-extrabold text-slate-900 dark:text-white">Official Warranty</td>
                {compareList.map((p) => (
                  <td key={p.id} className="px-3 py-3 font-bold text-blue-600 dark:text-blue-400">
                    🛡️ {p.warranty}
                  </td>
                ))}
              </tr>

              {/* Multi-Branch Stock Table */}
              {BRANCHES.map((branch, i) => (
                <tr key={i}>
                  <td className="py-3 pr-4 pl-3 text-slate-500 font-semibold">{branch}</td>
                  {compareList.map((p) => (
                    <td key={p.id} className="px-3 py-3 font-bold text-emerald-600 dark:text-emerald-400">
                      ✓ Available In-Store
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

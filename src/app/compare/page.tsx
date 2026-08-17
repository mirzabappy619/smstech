'use client'

import Link from 'next/link'
import { useApp } from '../../store/AppContext'
import { allProducts } from '../../data/products'
import { useState } from 'react'

const fmt = (n: number) => '৳' + n.toLocaleString('en-BD')

export default function Compare() {
  const { compareList, removeFromCompare, addToCompare } = useApp()
  const [search, setSearch] = useState('')

  const suggestions = allProducts
    .filter((p) => !compareList.find((c) => c.id === p.id) && p.name.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 5)

  const specKeys = compareList.length > 0 ? Object.keys(compareList[0].specs) : []

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-800 text-slate-900 dark:text-white">Compare Products</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Compare up to 4 products side by side</p>
      </div>

      {compareList.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
          <div className="text-6xl mb-4">⚖️</div>
          <h2 className="text-xl font-700 text-slate-900 dark:text-white mb-2">No products to compare</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-8">Add products from any listing or product page to compare.</p>
          <div className="flex gap-3 justify-center">
            <Link href="/laptops" className="px-5 py-2.5 bg-blue-600 text-white font-600 rounded-xl text-sm hover:bg-blue-700">Browse Laptops</Link>
            <Link href="/smartphones" className="px-5 py-2.5 border border-slate-200 dark:border-slate-700 font-600 rounded-xl text-sm hover:border-blue-300 dark:hover:border-blue-500 text-slate-700 dark:text-slate-200">Browse Phones</Link>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <td className="w-40 pr-4 align-top">
                  {compareList.length < 4 && (
                    <div className="p-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl text-center min-h-48 flex flex-col items-center justify-center gap-2 bg-white dark:bg-slate-800">
                      <span className="text-2xl text-slate-600 dark:text-slate-300">+</span>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-600">Add Product</p>
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search..."
                        className="w-full mt-2 px-2 py-1.5 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg text-xs focus:outline-none focus:border-blue-400"
                      />
                      {search && (
                        <div className="w-full border border-slate-100 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-800">
                          {suggestions.map((s) => (
                            <button key={s.id} onClick={() => { addToCompare(s); setSearch('') }} className="w-full text-left px-2 py-2 text-xs hover:bg-blue-50 dark:hover:bg-slate-700 border-b border-slate-50 dark:border-slate-700 last:border-0 text-slate-900 dark:text-white">
                              {s.brand} {s.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </td>
                {compareList.map((p) => (
                  <td key={p.id} className="px-4 align-top">
                    <div className="border border-slate-100 dark:border-slate-700/80 rounded-2xl overflow-hidden bg-white dark:bg-slate-800">
                      <div className="relative">
                        <button
                          onClick={() => removeFromCompare(p.id)}
                          className="absolute top-2 right-2 w-6 h-6 bg-white dark:bg-slate-700 rounded-full flex items-center justify-center text-slate-400 dark:text-slate-300 hover:text-red-500 text-sm shadow-sm z-10"
                        >×</button>
                        <img src={p.image} alt={p.name} className="w-full h-36 object-cover bg-slate-100 dark:bg-slate-900" />
                      </div>
                      <div className="p-3">
                        <p className="text-xs font-700 text-blue-600 dark:text-blue-400">{p.brand}</p>
                        <p className="text-sm font-700 text-slate-900 dark:text-white mt-0.5 line-clamp-2">{p.name}</p>
                        <p className="text-lg font-800 text-slate-900 dark:text-white mt-2">{fmt(p.price)}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 line-through">{fmt(p.originalPrice)}</p>
                        <Link href={`/product/${p.slug}`} className="block mt-3 text-center py-2 bg-blue-600 text-white text-xs font-700 rounded-xl hover:bg-blue-700 transition-colors">
                          View Details
                        </Link>
                      </div>
                    </div>
                  </td>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Spec rows */}
              {specKeys.map((key, i) => (
                <tr key={key} className={i % 2 === 0 ? 'bg-slate-50 dark:bg-slate-800/60' : 'bg-white dark:bg-slate-800'}>
                  <td className="py-3 pr-4 text-sm font-700 text-slate-600 dark:text-slate-300 rounded-l-xl pl-3">{key}</td>
                  {compareList.map((p) => (
                    <td key={p.id} className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{p.specs[key] || '—'}</td>
                  ))}
                </tr>
              ))}
              {/* Rating */}
              <tr className="bg-slate-50 dark:bg-slate-800/60">
                <td className="py-3 pr-4 text-sm font-700 text-slate-600 dark:text-slate-300 pl-3">Rating</td>
                {compareList.map((p) => (
                  <td key={p.id} className="px-4 py-3 text-sm">
                    <span className="font-700 text-amber-600 dark:text-amber-400">{p.rating} ★</span>
                    <span className="text-slate-400 dark:text-slate-500 text-xs ml-1">({p.reviews})</span>
                  </td>
                ))}
              </tr>
              {/* Warranty */}
              <tr className="bg-white dark:bg-slate-800">
                <td className="py-3 pr-4 text-sm font-700 text-slate-600 dark:text-slate-300 pl-3">Warranty</td>
                {compareList.map((p) => (
                  <td key={p.id} className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{p.warranty}</td>
                ))}
              </tr>
              {/* Store availability */}
              <tr className="bg-slate-50 dark:bg-slate-800/60">
                <td className="py-3 pr-4 text-sm font-700 text-slate-600 dark:text-slate-300 pl-3">Store 01</td>
                {compareList.map((p) => (
                  <td key={p.id} className={`px-4 py-3 text-sm font-600 ${p.storeAvailability.store1 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                    {p.storeAvailability.store1 ? '✓ Available' : '✗ Not available'}
                  </td>
                ))}
              </tr>
              <tr className="bg-white dark:bg-slate-800">
                <td className="py-3 pr-4 text-sm font-700 text-slate-600 dark:text-slate-300 pl-3">Store 02</td>
                {compareList.map((p) => (
                  <td key={p.id} className={`px-4 py-3 text-sm font-600 ${p.storeAvailability.store2 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                    {p.storeAvailability.store2 ? '✓ Available' : '✗ Not available'}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

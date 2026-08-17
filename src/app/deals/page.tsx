'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import ProductCard from '../../components/ProductCard'
import { ProductSidebarFilter, ProductTopBar, applySortAndFilter } from '../../components/ProductSortFilter'
import { normalizeProduct, Product } from '../../data/products'

function DealsContent() {
  const [countdown, setCountdown] = useState({ h: 5, m: 23, s: 47 })
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const searchParams = useSearchParams()

  useEffect(() => {
    const t = setInterval(() => {
      setCountdown((prev) => {
        let { h, m, s } = prev
        s--; if (s < 0) { s = 59; m-- } if (m < 0) { m = 59; h-- } if (h < 0) h = 23
        return { h, m, s }
      })
    }, 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    async function loadDealsFromDb() {
      try {
        setLoading(true)
        const res = await fetch('/api/v1/products?show_all=true&limit=100')
        const json = await res.json()
        if (json.success && Array.isArray(json.data)) {
          const mapped = json.data
            .map(normalizeProduct)
            .filter((p: Product) => p.originalPrice > p.price || p.badges.includes('Hot Deal'))
          setProducts(mapped)
        }
      } catch (e) {
        console.error('Failed to fetch deals from database:', e)
      } finally {
        setLoading(false)
      }
    }
    loadDealsFromDb()
  }, [])

  const pad = (n: number) => String(n).padStart(2, '0')
  const sortedAndFiltered = applySortAndFilter(products, searchParams)
  const availableBrands = Array.from(new Set(products.map((p) => p.brand).filter(Boolean)))

  return (
    <div>
      {/* Hero */}
      <div className="bg-gradient-to-r from-red-600 to-red-700 dark:from-red-900 dark:to-red-950 py-16 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 0%, transparent 40%)' }} />
        <div className="relative max-w-7xl mx-auto px-4">
          <div className="text-white text-sm font-700 uppercase tracking-widest mb-3">⚡ Limited Time Offers</div>
          <h1 className="text-4xl md:text-5xl font-800 text-white mb-3">Big Deals. Better Technology.</h1>
          <p className="text-red-100 text-sm mb-6">Exclusive savings on premium laptops and smartphones with official warranty</p>
          <div className="flex items-center justify-center gap-3">
            <span className="text-white text-sm font-600">Ends in:</span>
            {[pad(countdown.h), pad(countdown.m), pad(countdown.s)].map((v, i) => (
              <div key={i} className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center border border-white/30">
                <span className="font-800 text-white text-xl">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-12 space-y-12">
        <div>
          <h2 className="text-2xl font-800 text-slate-900 dark:text-white mb-4">🔥 Hot Deals &amp; Discounts</h2>

          <ProductTopBar
            totalCount={sortedAndFiltered.length}
            availableBrands={availableBrands.length > 0 ? availableBrands : ['Apple', 'ASUS', 'Lenovo', 'Samsung']}
            onOpenMobileFilter={() => setMobileFilterOpen(true)}
          />

          <div className="flex flex-col lg:flex-row gap-6 items-start">
            <aside className="w-64 shrink-0 hidden lg:block sticky top-24">
              <ProductSidebarFilter />
            </aside>

            <div className="flex-1 w-full">
              {loading ? (
                <div className="text-center py-20 text-slate-500 dark:text-slate-400">
                  <div className="animate-spin w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full mx-auto mb-3" />
                  Loading deals from database...
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {sortedAndFiltered.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {mobileFilterOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileFilterOpen(false)} />
          <div className="relative ml-auto w-80 max-w-full bg-white dark:bg-slate-900 h-full overflow-y-auto p-4 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 dark:border-slate-800">
              <h2 className="font-700 text-slate-900 dark:text-white">Filters</h2>
              <button onClick={() => setMobileFilterOpen(false)} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">✕</button>
            </div>
            <ProductSidebarFilter onCloseMobile={() => setMobileFilterOpen(false)} />
          </div>
        </div>
      )}
    </div>
  )
}

export default function Deals() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500 dark:text-slate-400">Loading deals...</div>}>
      <DealsContent />
    </Suspense>
  )
}

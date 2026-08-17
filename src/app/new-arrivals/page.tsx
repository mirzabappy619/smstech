'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import ProductCard from '../../components/ProductCard'
import { ProductSidebarFilter, ProductTopBar, applySortAndFilter } from '../../components/ProductSortFilter'
import { normalizeProduct, Product } from '../../data/products'

function NewArrivalsContent() {
  const searchParams = useSearchParams()
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadNewArrivalsFromDb() {
      try {
        setLoading(true)
        const res = await fetch('/api/v1/products?show_all=true&limit=100')
        const json = await res.json()
        if (json.success && Array.isArray(json.data)) {
          const mapped = json.data
            .map(normalizeProduct)
            .filter((p: Product) => p.isNew || p.badges.includes('New'))
          setProducts(mapped.length > 0 ? mapped : json.data.map(normalizeProduct))
        }
      } catch (e) {
        console.error('Failed to fetch new arrivals from database:', e)
      } finally {
        setLoading(false)
      }
    }
    loadNewArrivalsFromDb()
  }, [])

  const sortedAndFiltered = applySortAndFilter(products, searchParams)
  const availableBrands = Array.from(new Set(products.map((p) => p.brand).filter(Boolean)))

  return (
    <div>
      <div className="bg-slate-900 dark:bg-slate-950 py-16 text-center transition-colors">
        <span className="inline-block px-3 py-1.5 bg-blue-600/20 border border-blue-500/30 text-blue-300 text-xs font-700 rounded-full uppercase tracking-wide mb-4">Just Landed</span>
        <h1 className="text-3xl md:text-4xl font-800 text-white mb-3">New Arrivals</h1>
        <p className="text-slate-400 text-sm max-w-md mx-auto">The latest and greatest from leading technology brands — fresh in stock at SMSTech.</p>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-12">
        <ProductTopBar
          totalCount={sortedAndFiltered.length}
          availableBrands={availableBrands.length > 0 ? availableBrands : ['Apple', 'ASUS', 'Samsung', 'Lenovo']}
          onOpenMobileFilter={() => setMobileFilterOpen(true)}
        />

        <div className="flex flex-col lg:flex-row gap-6 items-start">
          <aside className="w-64 shrink-0 hidden lg:block sticky top-24">
            <ProductSidebarFilter />
          </aside>

          <div className="flex-1 w-full">
            {loading ? (
              <div className="text-center py-20 text-slate-500 dark:text-slate-400">
                <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" />
                Loading new arrivals from database...
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

export default function NewArrivals() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500 dark:text-slate-400">Loading new arrivals...</div>}>
      <NewArrivalsContent />
    </Suspense>
  )
}

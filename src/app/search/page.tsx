'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import ProductCard from '../../components/ProductCard'
import { ProductSidebarFilter, ProductTopBar, applySortAndFilter } from '../../components/ProductSortFilter'
import { normalizeProduct, Product } from '../../data/products'

function SearchContent() {
  const searchParams = useSearchParams()
  const query = searchParams.get('q') || ''
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function searchDbProducts() {
      try {
        setLoading(true)
        const endpoint = query ? `/api/v1/products?search=${encodeURIComponent(query)}&limit=100` : '/api/v1/products?show_all=true&limit=100'
        const res = await fetch(endpoint)
        const json = await res.json()
        if (json.success && Array.isArray(json.data)) {
          setProducts(json.data.map(normalizeProduct))
        }
      } catch (e) {
        console.error('Failed to search database products:', e)
      } finally {
        setLoading(false)
      }
    }
    searchDbProducts()
  }, [query])

  const sortedAndFiltered = applySortAndFilter(products, searchParams)
  const availableBrands = Array.from(new Set(products.map((p) => p.brand).filter(Boolean)))

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-800 text-slate-900 dark:text-white">
          {query ? <>Search results for &ldquo;<span className="text-blue-600 dark:text-blue-400">{query}</span>&rdquo;</> : 'Search All Products'}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          {sortedAndFiltered.length} item{sortedAndFiltered.length !== 1 ? 's' : ''} found in database
        </p>
      </div>

      <ProductTopBar
        totalCount={sortedAndFiltered.length}
        availableBrands={availableBrands}
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
              Searching database...
            </div>
          ) : sortedAndFiltered.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
              <p className="text-lg font-600 text-slate-700 dark:text-slate-200">No products found matching &ldquo;{query}&rdquo;</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Check spelling or try broader search keywords.</p>
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

export default function Search() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500 dark:text-slate-400">Loading search...</div>}>
      <SearchContent />
    </Suspense>
  )
}

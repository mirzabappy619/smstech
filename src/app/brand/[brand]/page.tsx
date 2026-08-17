'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import ProductCard from '../../../components/ProductCard'
import { ProductSidebarFilter, ProductTopBar, applySortAndFilter } from '../../../components/ProductSortFilter'
import { normalizeProduct, Product, brands } from '../../../data/products'

function BrandDetailContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)
  const [baseProducts, setBaseProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  const brand = (params?.brand as string) || ''
  const brandName = brand ? brand.charAt(0).toUpperCase() + brand.slice(1) : ''

  useEffect(() => {
    async function loadBrandProductsFromDb() {
      if (!brand) return
      try {
        setLoading(true)
        const res = await fetch(`/api/v1/products?show_all=true&limit=100`)
        const json = await res.json()
        if (json.success && Array.isArray(json.data)) {
          const mapped = json.data
            .map(normalizeProduct)
            .filter((p: Product) => p.brand.toLowerCase() === brand.toLowerCase())
          setBaseProducts(mapped)
        }
      } catch (e) {
        console.error('Failed to fetch brand products from database:', e)
      } finally {
        setLoading(false)
      }
    }
    loadBrandProductsFromDb()
  }, [brand])

  const sortedAndFiltered = applySortAndFilter(baseProducts, searchParams)
  const brandInfo = brands.find((b) => b.name.toLowerCase() === brand.toLowerCase())
  const availableSubcategories = Array.from(new Set(baseProducts.map((p) => p.subcategory).filter(Boolean)))

  return (
    <div>
      <div className="bg-slate-900 dark:bg-slate-950 py-16 transition-colors">
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex items-center gap-2 text-xs text-slate-400 mb-6">
            <Link href="/" className="hover:text-blue-400">Home</Link>
            <span>›</span>
            <Link href="/brands" className="hover:text-blue-400">Brands</Link>
            <span>›</span>
            <span className="text-slate-200">{brandName}</span>
          </nav>
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center text-3xl font-800 text-white border border-white/10">
              {brandInfo?.logo || brandName[0]}
            </div>
            <div>
              <h1 className="text-3xl font-800 text-white">{brandName}</h1>
              <p className="text-slate-400 text-sm mt-1">{brandInfo?.count || baseProducts.length} products available in database</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-10">
        {loading ? (
          <div className="text-center py-20 text-slate-500 dark:text-slate-400">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" />
            Loading {brandName} products from database...
          </div>
        ) : (
          <>
            <ProductTopBar
              totalCount={sortedAndFiltered.length}
              availableBrands={[brandName]}
              onOpenMobileFilter={() => setMobileFilterOpen(true)}
            />

            <div className="flex flex-col lg:flex-row gap-6 items-start">
              <aside className="w-64 shrink-0 hidden lg:block sticky top-24">
                <ProductSidebarFilter availableSubcategories={availableSubcategories} />
              </aside>

              <div className="flex-1 w-full">
                {sortedAndFiltered.length === 0 ? (
                  <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <p className="text-slate-500 dark:text-slate-400 text-sm">No products found matching active filters for this brand.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                    {sortedAndFiltered.map((p) => <ProductCard key={p.id} product={p} />)}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {mobileFilterOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileFilterOpen(false)} />
          <div className="relative ml-auto w-80 max-w-full bg-white dark:bg-slate-900 h-full overflow-y-auto p-4 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 dark:border-slate-800">
              <h2 className="font-700 text-slate-900 dark:text-white">Filters</h2>
              <button onClick={() => setMobileFilterOpen(false)} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">✕</button>
            </div>
            <ProductSidebarFilter availableSubcategories={availableSubcategories} onCloseMobile={() => setMobileFilterOpen(false)} />
          </div>
        </div>
      )}
    </div>
  )
}

export default function BrandDetail() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500 dark:text-slate-400">Loading brand products...</div>}>
      <BrandDetailContent />
    </Suspense>
  )
}

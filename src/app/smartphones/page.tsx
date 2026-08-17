'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import ProductCard from '../../components/ProductCard'
import { ProductSidebarFilter, ProductTopBar, applySortAndFilter } from '../../components/ProductSortFilter'
import { normalizeProduct, Product } from '../../data/products'

function SmartphonesContent() {
  const searchParams = useSearchParams()
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadDbProducts() {
      try {
        setLoading(true)
        const res = await fetch('/api/v1/products?show_all=true&limit=100')
        const json = await res.json()
        if (json.success && Array.isArray(json.data)) {
          const mapped = json.data
            .map(normalizeProduct)
            .filter((p: Product) => p.category === 'smartphone' || p.subcategory === 'flagship' || p.subcategory === 'mid-range')
          setProducts(mapped)
        }
      } catch (e) {
        console.error('Failed to fetch smartphones from database:', e)
      } finally {
        setLoading(false)
      }
    }
    loadDbProducts()
  }, [])

  const sortedAndFiltered = applySortAndFilter(products, searchParams)
  const catParam = searchParams.get('cat')

  const availableSubcategories = ['flagship', 'gaming', 'mid-range', 'budget', '5g']
  const availableBrands = Array.from(new Set(products.map((p) => p.brand).filter(Boolean)))

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-6">
        <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400">Home</Link>
        <span>›</span>
        <span className="text-slate-900 dark:text-white font-600">Smartphones</span>
        {catParam && <><span>›</span><span className="text-slate-900 dark:text-white font-600 capitalize">{catParam}</span></>}
      </nav>

      <div className="mb-6">
        <h1 className="text-3xl font-800 text-slate-900 dark:text-white">Smartphone &amp; Mobile Phone Price in Bangladesh</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1.5 leading-relaxed">
          Smartphone Price starts from BDT 12,500 to BDT 210,000 in Bangladesh, depending on Brand, RAM, Storage, and Camera features. Buy original official smartphones from SMSTech. Browse below and order yours now!
        </p>
      </div>

      {/* Top Bar with embedded Brand Selector Pills inside the control box */}
      <ProductTopBar
        totalCount={sortedAndFiltered.length}
        availableBrands={availableBrands.length > 0 ? availableBrands : ['Apple', 'Samsung', 'Xiaomi', 'OnePlus', 'Google']}
        onOpenMobileFilter={() => setMobileFilterOpen(true)}
      />

      {/* Main Layout: Left Sidebar + Product Grid */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left Sidebar (Desktop) */}
        <aside className="w-64 shrink-0 hidden lg:block sticky top-24">
          <ProductSidebarFilter
            availableSubcategories={availableSubcategories}
          />
        </aside>

        {/* Product Grid */}
        <div className="flex-1 w-full">
          {loading ? (
            <div className="text-center py-20 text-slate-500 dark:text-slate-400">
              <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" />
              Loading smartphones from database...
            </div>
          ) : sortedAndFiltered.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
              <p className="text-lg font-600 text-slate-700 dark:text-slate-200">No smartphones match your selected filters</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Try clearing some filters or changing your search criteria.</p>
              <Link href="/smartphones" className="inline-block mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-600">Reset Filters</Link>
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

      {/* Mobile Filter Drawer */}
      {mobileFilterOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileFilterOpen(false)} />
          <div className="relative ml-auto w-80 max-w-full bg-white dark:bg-slate-900 h-full overflow-y-auto p-4 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 dark:border-slate-800">
              <h2 className="font-700 text-slate-900 dark:text-white">Filters</h2>
              <button onClick={() => setMobileFilterOpen(false)} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">✕</button>
            </div>
            <ProductSidebarFilter
              availableSubcategories={availableSubcategories}
              onCloseMobile={() => setMobileFilterOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default function Smartphones() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500 dark:text-slate-400">Loading smartphones...</div>}>
      <SmartphonesContent />
    </Suspense>
  )
}

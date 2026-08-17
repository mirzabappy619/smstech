'use client'

import { useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'

export type SortOption = {
  label: string
  sortKey: string
  order: 'ASC' | 'DESC'
}

export const SORT_OPTIONS: SortOption[] = [
  { label: 'Default / Featured', sortKey: 'default', order: 'ASC' },
  { label: 'Price: Low to High', sortKey: 'price', order: 'ASC' },
  { label: 'Price: High to Low', sortKey: 'price', order: 'DESC' },
  { label: 'Highest Rated', sortKey: 'rating', order: 'DESC' },
  { label: 'Newest Arrivals', sortKey: 'newest', order: 'DESC' },
  { label: 'Biggest Discount', sortKey: 'discount', order: 'DESC' },
  { label: 'Name: A to Z', sortKey: 'name', order: 'ASC' },
  { label: 'Name: Z to A', sortKey: 'name', order: 'DESC' },
]

type SidebarProps = {
  availableBrands?: string[]
  availableSubcategories?: string[]
  onCloseMobile?: () => void
}

export function ProductSidebarFilter({
  availableSubcategories = [],
  onCloseMobile,
}: SidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const currentBrand = searchParams.get('brand') || ''
  const currentCat = searchParams.get('cat') || ''
  const currentStock = searchParams.get('stock') || ''
  const currentPriceRange = searchParams.get('price_range') || ''

  const updateQuery = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '') {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    })
    const queryString = params.toString()
    const url = queryString ? `${pathname}?${queryString}` : pathname
    router.replace(url, { scroll: false })
  }

  const clearAllFilters = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('brand')
    params.delete('cat')
    params.delete('stock')
    params.delete('price_range')
    const queryString = params.toString()
    const url = queryString ? `${pathname}?${queryString}` : pathname
    router.replace(url, { scroll: false })
  }

  const hasActiveFilters = currentBrand || currentCat || currentStock || currentPriceRange

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-5 space-y-6 transition-colors shadow-sm">
      {/* Header & Clear */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700/80">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" strokeWidth={2}>
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          <h2 className="font-700 text-sm text-slate-900 dark:text-white">Filter Products</h2>
        </div>
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="text-xs font-600 text-red-500 hover:text-red-600 dark:text-red-400 hover:underline"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Categories Filter */}
      {availableSubcategories.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-700 uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Categories
          </h3>
          <div className="space-y-1.5">
            <button
              onClick={() => updateQuery({ cat: null })}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-600 transition-colors flex items-center justify-between
                ${!currentCat
                  ? 'bg-blue-600 text-white font-700'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60'}`}
            >
              <span>All Categories</span>
              {!currentCat && <span className="text-[10px]">✓</span>}
            </button>
            {availableSubcategories.map((cat) => (
              <button
                key={cat}
                onClick={() => updateQuery({ cat: currentCat === cat.toLowerCase() ? null : cat.toLowerCase() })}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-600 capitalize transition-colors flex items-center justify-between
                  ${currentCat === cat.toLowerCase()
                    ? 'bg-blue-600 text-white font-700'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60'}`}
              >
                <span>{cat}</span>
                {currentCat === cat.toLowerCase() && <span className="text-[10px]">✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Price Range Filter */}
      <div className="space-y-3">
        <h3 className="text-xs font-700 uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Price Range
        </h3>
        <div className="space-y-1.5">
          {[
            { label: 'All Prices', value: '' },
            { label: 'Under ৳50,000', value: '0-50000' },
            { label: '৳50,000 – ৳100,000', value: '50000-100000' },
            { label: '৳100,000 – ৳180,000', value: '100000-180000' },
            { label: 'Above ৳180,000', value: '180000-999999' },
          ].map((pr) => (
            <button
              key={pr.value}
              onClick={() => updateQuery({ price_range: currentPriceRange === pr.value ? null : pr.value })}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-600 transition-colors flex items-center justify-between
                ${currentPriceRange === pr.value
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-700 border border-blue-200 dark:border-blue-800'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60'}`}
            >
              <span>{pr.label}</span>
              {currentPriceRange === pr.value && <span className="text-[10px]">✓</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Availability Switch */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-700/80">
        <button
          onClick={() => updateQuery({ stock: currentStock === 'in_stock' ? null : 'in_stock' })}
          className={`w-full p-3 rounded-xl text-xs font-700 transition-colors flex items-center justify-between border
            ${currentStock === 'in_stock'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900'
              : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}
        >
          <span>In Stock Items Only</span>
          <span className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px]
            ${currentStock === 'in_stock' ? 'bg-emerald-600 text-white border-emerald-600' : 'border-slate-300 dark:border-slate-600'}`}>
            {currentStock === 'in_stock' && '✓'}
          </span>
        </button>
      </div>

      {onCloseMobile && (
        <button
          onClick={onCloseMobile}
          className="w-full py-2.5 bg-blue-600 text-white font-700 rounded-xl text-xs lg:hidden"
        >
          Apply Filters
        </button>
      )}
    </div>
  )
}

type TopBarProps = {
  totalCount: number
  availableBrands?: string[]
  onOpenMobileFilter?: () => void
}

export function ProductTopBar({ totalCount, availableBrands = [], onOpenMobileFilter }: TopBarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const currentBrand = searchParams.get('brand') || ''
  const currentSortKey = searchParams.get('sort') || 'default'
  const currentOrder = (searchParams.get('order') as 'ASC' | 'DESC') || 'ASC'
  const [copied, setCopied] = useState(false)

  const updateQuery = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '') {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    })
    const queryString = params.toString()
    const url = queryString ? `${pathname}?${queryString}` : pathname
    router.replace(url, { scroll: false })
  }

  const toggleBrand = (bName: string) => {
    const normalized = bName.toLowerCase()
    if (currentBrand.toLowerCase() === normalized) {
      updateQuery({ brand: null })
    } else {
      updateQuery({ brand: normalized })
    }
  }

  const handleSortChange = (value: string) => {
    const selected = SORT_OPTIONS.find((s) => `${s.sortKey}_${s.order}` === value)
    if (selected) {
      if (selected.sortKey === 'default') {
        updateQuery({ sort: null, order: null })
      } else {
        updateQuery({ sort: selected.sortKey, order: selected.order })
      }
    }
  }

  const handleCopyShareLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    }
  }

  const activeSortValue = `${currentSortKey}_${currentOrder}`

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/80 p-3.5 sm:p-4 mb-6 transition-colors shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
      {/* Left: Total Count & Multiline Brand Pills */}
      <div className="flex flex-wrap items-center gap-3">
        {onOpenMobileFilter && (
          <button
            onClick={onOpenMobileFilter}
            className="lg:hidden flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 rounded-xl text-xs font-700 text-slate-700 dark:text-slate-200 shrink-0"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            <span>Filters</span>
          </button>
        )}

        <span className="text-xs font-700 uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
          {totalCount} Product{totalCount !== 1 ? 's' : ''} Found
        </span>

        {/* Brand Selector Pills with multiline wrapping */}
        {availableBrands.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pl-3 border-l border-slate-200 dark:border-slate-700">
            <button
              onClick={() => updateQuery({ brand: null })}
              className={`px-3 py-1 rounded-full text-xs font-600 border transition-all whitespace-nowrap
                ${!currentBrand
                  ? 'bg-blue-600 text-white border-blue-600 font-700 shadow-sm'
                  : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400'}`}
            >
              All Brands
            </button>
            {availableBrands.map((b) => {
              const isSelected = currentBrand.toLowerCase() === b.toLowerCase()
              return (
                <button
                  key={b}
                  onClick={() => toggleBrand(b)}
                  className={`px-3 py-1 rounded-full text-xs font-600 border transition-all whitespace-nowrap
                    ${isSelected
                      ? 'bg-blue-600 text-white border-blue-600 font-700 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400'}`}
                >
                  {b}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end shrink-0">
        <div className="flex items-center gap-2">
          <label htmlFor="sort-select" className="text-xs font-600 text-slate-500 dark:text-slate-400 whitespace-nowrap">
            Sort By:
          </label>
          <select
            id="sort-select"
            value={activeSortValue}
            onChange={(e) => handleSortChange(e.target.value)}
            className="h-9 px-3 text-xs font-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={`${opt.sortKey}_${opt.order}`} value={`${opt.sortKey}_${opt.order}`}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleCopyShareLink}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-600 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-200 dark:border-blue-900 hover:bg-blue-100 dark:hover:bg-blue-900 transition-all shrink-0"
          title="Share this set of filters & sorting"
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          <span>{copied ? 'Copied! ✓' : 'Share View'}</span>
        </button>
      </div>
    </div>
  )
}

// Default export combining top bar for backwards compatibility if needed
export default function ProductSortFilter(props: {
  totalCount: number
  availableBrands?: string[]
  availableSubcategories?: string[]
}) {
  return <ProductTopBar totalCount={props.totalCount} />
}

// Utility function to sort and filter products based on search params
export function applySortAndFilter<T extends {
  price: number
  originalPrice: number
  rating: number
  brand: string
  subcategory: string
  stock: string
  isNew?: boolean
  name: string
}>(products: T[], searchParams: { get: (name: string) => string | null }): T[] {
  let result = [...products]

  // Filter by brand
  const brand = searchParams.get('brand')
  if (brand) {
    result = result.filter((p) => p.brand.toLowerCase() === brand.toLowerCase())
  }

  // Filter by subcategory / cat
  const cat = searchParams.get('cat')
  if (cat) {
    result = result.filter((p) => {
      if (cat === 'macbook') return p.brand.toLowerCase() === 'apple'
      return p.subcategory.toLowerCase() === cat.toLowerCase()
    })
  }

  // Filter by price range
  const priceRange = searchParams.get('price_range')
  if (priceRange) {
    const [min, max] = priceRange.split('-').map(Number)
    if (!isNaN(min) && !isNaN(max)) {
      result = result.filter((p) => p.price >= min && p.price <= max)
    }
  }

  // Filter by stock
  const stock = searchParams.get('stock')
  if (stock === 'in_stock') {
    result = result.filter((p) => p.stock !== 'out_of_stock')
  }

  // Sorting
  const sort = searchParams.get('sort')
  const order = (searchParams.get('order') as 'ASC' | 'DESC') || 'ASC'

  if (sort === 'price') {
    result.sort((a, b) => (order === 'ASC' ? a.price - b.price : b.price - a.price))
  } else if (sort === 'rating') {
    result.sort((a, b) => b.rating - a.rating)
  } else if (sort === 'newest') {
    result.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0))
  } else if (sort === 'discount') {
    result.sort((a, b) => {
      const discA = (a.originalPrice - a.price) / a.originalPrice
      const discB = (b.originalPrice - b.price) / b.originalPrice
      return discB - discA
    })
  } else if (sort === 'name') {
    result.sort((a, b) => (order === 'ASC' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)))
  }

  return result
}

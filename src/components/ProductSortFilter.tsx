'use client'

import { useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Check, Link2, ListFilter, SlidersHorizontal, X } from 'lucide-react'
import type { Product } from '../data/products'
import { CONDITION_META, isPreOwned, resolveCondition, type ConditionGrade } from './ui/condition'

export type SortOption = {
  label: string
  sortKey: string
  order: 'ASC' | 'DESC'
}

export const SORT_OPTIONS: SortOption[] = [
  { label: 'Featured', sortKey: 'default', order: 'ASC' },
  { label: 'Price: low to high', sortKey: 'price', order: 'ASC' },
  { label: 'Price: high to low', sortKey: 'price', order: 'DESC' },
  { label: 'Highest rated', sortKey: 'rating', order: 'DESC' },
  { label: 'Newest first', sortKey: 'newest', order: 'DESC' },
  { label: 'Biggest saving', sortKey: 'discount', order: 'DESC' },
  { label: 'Name: A to Z', sortKey: 'name', order: 'ASC' },
  { label: 'Name: Z to A', sortKey: 'name', order: 'DESC' },
]

const PRICE_RANGES = [
  { label: 'Under ৳50,000', value: '0-50000' },
  { label: '৳50,000 – ৳100,000', value: '50000-100000' },
  { label: '৳100,000 – ৳180,000', value: '100000-180000' },
  { label: 'Above ৳180,000', value: '180000-9999999' },
]

const CONDITION_FILTERS: { label: string; value: string; note: string }[] = [
  { label: 'Brand new', value: 'new', note: 'Sealed, full warranty' },
  { label: 'Open box', value: 'like-new', note: 'Unused, Grade A+' },
  { label: 'Excellent', value: 'excellent', note: 'Grade A' },
  { label: 'Good', value: 'good', note: 'Grade B' },
  { label: 'Fair', value: 'fair', note: 'Grade C' },
]

/* ------------------------------------------------------------------ */
/* Shared query helpers                                                */
/* ------------------------------------------------------------------ */

function useQueryUpdater() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const update = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '') params.delete(key)
      else params.set(key, value)
    })
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  return { update, searchParams }
}

/* ------------------------------------------------------------------ */
/* Sidebar                                                             */
/* ------------------------------------------------------------------ */

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line px-4 py-4 first:border-t-0">
      <h3 className="eyebrow mb-3">{title}</h3>
      {children}
    </section>
  )
}

function CheckRow({
  label,
  note,
  selected,
  onClick,
}: {
  label: string
  note?: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className="group flex w-full items-start gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface-2"
    >
      <span
        className={`mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
          selected ? 'border-accent bg-accent text-on-accent' : 'border-line-2 bg-surface'
        }`}
      >
        {selected && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      <span className="min-w-0">
        <span
          className={`block text-[13px] capitalize ${selected ? 'font-medium text-ink' : 'text-ink-2'}`}
        >
          {label}
        </span>
        {note && <span className="block text-[11px] text-ink-3">{note}</span>}
      </span>
    </button>
  )
}

type SidebarProps = {
  availableBrands?: string[]
  availableSubcategories?: string[]
  onCloseMobile?: () => void
}

export function ProductSidebarFilter({
  availableBrands = [],
  availableSubcategories = [],
  onCloseMobile,
}: SidebarProps) {
  const { update, searchParams } = useQueryUpdater()

  const currentBrand = searchParams.get('brand') || ''
  const currentCat = searchParams.get('cat') || ''
  const currentStock = searchParams.get('stock') || ''
  const currentPrice = searchParams.get('price_range') || ''
  const currentCondition = searchParams.get('condition') || ''

  const hasFilters = Boolean(
    currentBrand || currentCat || currentStock || currentPrice || currentCondition,
  )

  const clearAll = () =>
    update({ brand: null, cat: null, stock: null, price_range: null, condition: null })

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line bg-surface-2 px-4 py-3">
        <span className="flex items-center gap-2 text-[13px] font-medium text-ink">
          <ListFilter className="h-4 w-4 text-ink-3" strokeWidth={2} />
          Filters
        </span>
        {hasFilters && (
          <button
            onClick={clearAll}
            className="text-xs font-medium text-ink-3 transition-colors hover:text-danger"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Condition first — it is the decision most buyers make first */}
      <FilterGroup title="Condition">
        <div className="space-y-0.5">
          {CONDITION_FILTERS.map((c) => (
            <CheckRow
              key={c.value}
              label={c.label}
              note={c.note}
              selected={currentCondition === c.value}
              onClick={() => update({ condition: currentCondition === c.value ? null : c.value })}
            />
          ))}
        </div>
      </FilterGroup>

      {availableSubcategories.length > 0 && (
        <FilterGroup title="Category">
          <div className="space-y-0.5">
            {availableSubcategories.map((cat) => (
              <CheckRow
                key={cat}
                label={cat.replace(/-/g, ' ')}
                selected={currentCat === cat.toLowerCase()}
                onClick={() =>
                  update({ cat: currentCat === cat.toLowerCase() ? null : cat.toLowerCase() })
                }
              />
            ))}
          </div>
        </FilterGroup>
      )}

      {availableBrands.length > 0 && (
        <FilterGroup title="Brand">
          <div className="space-y-0.5">
            {availableBrands.map((b) => (
              <CheckRow
                key={b}
                label={b}
                selected={currentBrand.toLowerCase() === b.toLowerCase()}
                onClick={() =>
                  update({
                    brand: currentBrand.toLowerCase() === b.toLowerCase() ? null : b.toLowerCase(),
                  })
                }
              />
            ))}
          </div>
        </FilterGroup>
      )}

      <FilterGroup title="Price">
        <div className="space-y-0.5">
          {PRICE_RANGES.map((pr) => (
            <CheckRow
              key={pr.value}
              label={pr.label}
              selected={currentPrice === pr.value}
              onClick={() => update({ price_range: currentPrice === pr.value ? null : pr.value })}
            />
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Availability">
        <CheckRow
          label="In stock only"
          selected={currentStock === 'in_stock'}
          onClick={() => update({ stock: currentStock === 'in_stock' ? null : 'in_stock' })}
        />
      </FilterGroup>

      {onCloseMobile && (
        <div className="border-t border-line p-3 lg:hidden">
          <button
            onClick={onCloseMobile}
            className="h-11 w-full rounded-lg bg-accent text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover"
          >
            Show results
          </button>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Top bar                                                             */
/* ------------------------------------------------------------------ */

type TopBarProps = {
  totalCount: number
  availableBrands?: string[]
  onOpenMobileFilter?: () => void
}

export function ProductTopBar({
  totalCount,
  availableBrands = [],
  onOpenMobileFilter,
}: TopBarProps) {
  const { update, searchParams } = useQueryUpdater()
  const [copied, setCopied] = useState(false)

  const currentBrand = searchParams.get('brand') || ''
  const currentSortKey = searchParams.get('sort') || 'default'
  const currentOrder = (searchParams.get('order') as 'ASC' | 'DESC') || 'ASC'

  const activeChips = (
    [
      ['condition', searchParams.get('condition')],
      ['brand', searchParams.get('brand')],
      ['cat', searchParams.get('cat')],
      ['price_range', searchParams.get('price_range')],
      ['stock', searchParams.get('stock')],
    ] as const
  ).filter(([, v]) => Boolean(v)) as [string, string][]

  const chipLabel = (key: string, value: string) => {
    if (key === 'condition')
      return CONDITION_META[value as ConditionGrade]?.short ?? value
    if (key === 'price_range')
      return PRICE_RANGES.find((p) => p.value === value)?.label ?? value
    if (key === 'stock') return 'In stock'
    return value.replace(/-/g, ' ')
  }

  const handleSortChange = (value: string) => {
    const selected = SORT_OPTIONS.find((s) => `${s.sortKey}_${s.order}` === value)
    if (!selected) return
    if (selected.sortKey === 'default') update({ sort: null, order: null })
    else update({ sort: selected.sortKey, order: selected.order })
  }

  const handleCopyShareLink = () => {
    if (typeof window === 'undefined') return
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="mb-6 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5 py-3">
        <div className="flex flex-wrap items-center gap-3">
          {onOpenMobileFilter && (
            <button
              onClick={onOpenMobileFilter}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-[13px] font-medium text-ink transition-colors hover:bg-surface-2 lg:hidden"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={2} />
              Filters
            </button>
          )}

          <span className="tnum text-[13px] text-ink-2">
            <strong className="font-semibold text-ink">{totalCount}</strong>{' '}
            {totalCount === 1 ? 'device' : 'devices'}
          </span>

          {availableBrands.length > 0 && (
            <div className="hidden flex-wrap items-center gap-1.5 border-l border-line pl-3 xl:flex">
              <button
                onClick={() => update({ brand: null })}
                className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                  !currentBrand
                    ? 'border-ink bg-inverse text-inverse-ink'
                    : 'border-line text-ink-2 hover:border-line-2 hover:text-ink'
                }`}
              >
                All
              </button>
              {availableBrands.slice(0, 8).map((b) => {
                const selected = currentBrand.toLowerCase() === b.toLowerCase()
                return (
                  <button
                    key={b}
                    onClick={() => update({ brand: selected ? null : b.toLowerCase() })}
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                      selected
                        ? 'border-ink bg-inverse text-inverse-ink'
                        : 'border-line text-ink-2 hover:border-line-2 hover:text-ink'
                    }`}
                  >
                    {b}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="sort-select" className="sr-only">
            Sort products
          </label>
          <select
            id="sort-select"
            value={`${currentSortKey}_${currentOrder}`}
            onChange={(e) => handleSortChange(e.target.value)}
            className="h-9 cursor-pointer rounded-lg border border-line bg-surface px-3 text-[13px] font-medium text-ink transition-colors hover:border-line-2 focus:border-accent focus:outline-none"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={`${opt.sortKey}_${opt.order}`} value={`${opt.sortKey}_${opt.order}`}>
                {opt.label}
              </option>
            ))}
          </select>

          <button
            onClick={handleCopyShareLink}
            title="Copy a link to this filtered view"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-[13px] font-medium text-ink-2 transition-colors hover:border-line-2 hover:text-ink"
          >
            <Link2 className="h-3.5 w-3.5" strokeWidth={2} />
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Share'}</span>
          </button>
        </div>
      </div>

      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-ink-3">Active:</span>
          {activeChips.map(([key, value]) => (
            <button
              key={key}
              onClick={() => update({ [key]: null })}
              className="inline-flex items-center gap-1.5 rounded-md border border-accent-line bg-accent-soft px-2 py-1 text-xs font-medium capitalize text-accent-ink transition-colors hover:border-accent"
            >
              {chipLabel(key, value)}
              <X className="h-3 w-3" strokeWidth={2.5} />
            </button>
          ))}
          <button
            onClick={() =>
              update({ brand: null, cat: null, stock: null, price_range: null, condition: null })
            }
            className="text-xs font-medium text-ink-3 underline-offset-2 transition-colors hover:text-danger hover:underline"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  )
}

export default function ProductSortFilter(props: { totalCount: number }) {
  return <ProductTopBar totalCount={props.totalCount} />
}

/* ------------------------------------------------------------------ */
/* Filtering + sorting                                                 */
/* ------------------------------------------------------------------ */

export function applySortAndFilter(
  products: Product[],
  searchParams: { get: (name: string) => string | null },
): Product[] {
  let result = [...products]

  const brand = searchParams.get('brand')
  if (brand) {
    result = result.filter((p) => p.brand.toLowerCase() === brand.toLowerCase())
  }

  const cat = searchParams.get('cat')
  if (cat) {
    result = result.filter((p) => {
      if (cat === 'macbook') return p.brand.toLowerCase() === 'apple'
      if (cat === 'pre-owned') return isPreOwned(p)
      return p.subcategory.toLowerCase() === cat.toLowerCase()
    })
  }

  // Condition grade — accepts a specific grade, or the umbrella "pre-owned"
  const condition = searchParams.get('condition')
  if (condition) {
    result = result.filter((p) =>
      condition === 'pre-owned' ? isPreOwned(p) : resolveCondition(p) === condition,
    )
  }

  const priceRange = searchParams.get('price_range')
  if (priceRange) {
    const [min, max] = priceRange.split('-').map(Number)
    if (!isNaN(min) && !isNaN(max)) {
      result = result.filter((p) => p.price >= min && p.price <= max)
    }
  }

  if (searchParams.get('stock') === 'in_stock') {
    result = result.filter((p) => p.stock !== 'out_of_stock')
  }

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
      const discA = a.originalPrice > 0 ? (a.originalPrice - a.price) / a.originalPrice : 0
      const discB = b.originalPrice > 0 ? (b.originalPrice - b.price) / b.originalPrice : 0
      return discB - discA
    })
  } else if (sort === 'name') {
    result.sort((a, b) =>
      order === 'ASC' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name),
    )
  }

  return result
}

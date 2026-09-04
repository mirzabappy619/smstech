'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ChevronRight, SearchX, X } from 'lucide-react'
import type { Product } from '../data/products'
import ProductCard from './ProductCard'
import { ProductSidebarFilter, ProductTopBar } from './ProductSortFilter'
import Container from './ui/container'
import { ProductCardSkeleton } from './ui/skeleton'

export type Crumb = { label: string; href?: string }

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
        <li>
          <Link href="/" className="transition-colors hover:text-accent">
            Home
          </Link>
        </li>
        {items.map((c, i) => (
          <li key={c.label} className="flex items-center gap-1.5">
            <ChevronRight className="h-3 w-3" strokeWidth={2} />
            {c.href && i < items.length - 1 ? (
              <Link href={c.href} className="transition-colors hover:text-accent">
                {c.label}
              </Link>
            ) : (
              <span className="font-medium capitalize text-ink">{c.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

type Props = {
  crumbs: Crumb[]
  title: string
  lede?: string
  /** Products already filtered and sorted by the caller. */
  products: Product[]
  loading?: boolean
  availableBrands?: string[]
  availableSubcategories?: string[]
  /** Where "clear filters" sends the visitor. */
  resetHref: string
  emptyTitle?: string
  emptyBody?: string
  /** Rendered between the heading and the toolbar — e.g. a condition explainer. */
  banner?: ReactNode
}

/**
 * The shared shell behind every product listing: breadcrumbs, page heading,
 * toolbar, sticky filter rail and the responsive grid.
 */
export default function CollectionView({
  crumbs,
  title,
  lede,
  products,
  loading = false,
  availableBrands = [],
  availableSubcategories = [],
  resetHref,
  emptyTitle = 'Nothing matches those filters',
  emptyBody = 'Try widening your price range or clearing a filter.',
  banner,
}: Props) {
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)

  useEffect(() => {
    document.body.style.overflow = mobileFilterOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileFilterOpen])

  return (
    <Container className="py-8 md:py-10">
      <Breadcrumbs items={crumbs} />

      <header className="mb-8 max-w-3xl">
        <h1 className="font-display text-[30px] font-semibold leading-tight tracking-[-0.025em] text-ink md:text-[38px]">
          {title}
        </h1>
        {lede && <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{lede}</p>}
      </header>

      {banner}

      <ProductTopBar
        totalCount={products.length}
        availableBrands={availableBrands}
        onOpenMobileFilter={() => setMobileFilterOpen(true)}
      />

      <div className="flex flex-col items-start gap-6 lg:flex-row">
        <aside className="sticky top-24 hidden w-64 shrink-0 lg:block">
          <ProductSidebarFilter
            availableBrands={availableBrands}
            availableSubcategories={availableSubcategories}
          />
        </aside>

        <div className="w-full flex-1">
          {loading ? (
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-xl border border-line bg-surface px-6 py-16 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-surface-2 text-ink-3">
                <SearchX className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <h2 className="mt-4 font-display text-base font-semibold text-ink">{emptyTitle}</h2>
              <p className="mx-auto mt-1.5 max-w-sm text-[13.5px] leading-relaxed text-ink-2">
                {emptyBody}
              </p>
              <Link
                href={resetHref}
                className="mt-6 inline-flex h-10 items-center rounded-lg border border-line px-4 text-sm font-medium text-ink transition-colors hover:border-line-2 hover:bg-surface-2"
              >
                Clear filters
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile filter sheet */}
      {mobileFilterOpen && (
        <div className="fixed inset-0 z-70 flex lg:hidden">
          <div
            className="flex-1 animate-fade-in bg-inverse/45 backdrop-blur-sm"
            onClick={() => setMobileFilterOpen(false)}
          />
          <div className="flex w-[88%] max-w-sm animate-slide-in-right flex-col border-l border-line bg-bg">
            <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-3.5">
              <h2 className="font-display text-base font-semibold text-ink">Filters</h2>
              <button
                onClick={() => setMobileFilterOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
                aria-label="Close filters"
              >
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <ProductSidebarFilter
                availableBrands={availableBrands}
                availableSubcategories={availableSubcategories}
                onCloseMobile={() => setMobileFilterOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </Container>
  )
}

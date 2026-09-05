'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Clock } from 'lucide-react'
import CollectionView from '../../components/CollectionView'
import { applySortAndFilter } from '../../components/ProductSortFilter'
import Container from '../../components/ui/container'
import { formatBDT } from '../../components/ui/price'
import { normalizeProduct, Product } from '../../data/products'

function DealsContent() {
  const [countdown, setCountdown] = useState({ h: 5, m: 23, s: 47 })
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const searchParams = useSearchParams()

  useEffect(() => {
    const t = setInterval(() => {
      setCountdown((prev) => {
        let { h, m, s } = prev
        s--
        if (s < 0) {
          s = 59
          m--
        }
        if (m < 0) {
          m = 59
          h--
        }
        if (h < 0) h = 23
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
  const results = applySortAndFilter(products, searchParams)
  const brands = Array.from(new Set(products.map((p) => p.brand).filter(Boolean))).sort()

  const biggestSaving = products.reduce(
    (max, p) => Math.max(max, p.originalPrice - p.price),
    0,
  )

  return (
    <CollectionView
      crumbs={[{ label: 'Deals' }]}
      title="Deals"
      lede="Reduced units, open-box returns and end-of-line stock. Same inspection, same warranty, same 7-day return window — only the price changes."
      products={results}
      loading={loading}
      availableBrands={brands.length > 0 ? brands : ['Apple', 'ASUS', 'Lenovo', 'Samsung']}
      resetHref="/deals"
      emptyTitle="No deals match those filters"
      emptyBody="Clear a filter to see everything currently reduced."
      banner={
        <div className="mb-6 flex flex-col gap-4 rounded-xl border border-line bg-promo px-5 py-4 text-promo-ink sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[13px] font-medium">Current promotion ends soon</p>
            {biggestSaving > 0 && (
              <p className="tnum mt-0.5 text-xs opacity-60">
                Biggest single saving right now: {formatBDT(biggestSaving)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            <Clock className="h-3.5 w-3.5 opacity-50" strokeWidth={2} />
            <div className="flex gap-1.5">
              {(
                [
                  [pad(countdown.h), 'hr'],
                  [pad(countdown.m), 'min'],
                  [pad(countdown.s), 'sec'],
                ] as const
              ).map(([v, l]) => (
                <div
                  key={l}
                  className="flex h-12 w-12 flex-col items-center justify-center rounded-lg border border-white/15 bg-white/5"
                >
                  <span className="tnum font-display text-sm font-semibold leading-none">{v}</span>
                  <span className="mt-0.5 text-[9px] uppercase tracking-wider opacity-50">{l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      }
    />
  )
}

export default function Deals() {
  return (
    <Suspense
      fallback={
        <Container className="py-20 text-center text-sm text-ink-3">Loading deals…</Container>
      }
    >
      <DealsContent />
    </Suspense>
  )
}

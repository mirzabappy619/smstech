'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { BatteryCharging } from 'lucide-react'
import CollectionView from '../../components/CollectionView'
import { applySortAndFilter } from '../../components/ProductSortFilter'
import Container from '../../components/ui/container'
import { normalizeProduct, Product } from '../../data/products'

const SUBCATEGORIES = ['flagship', 'gaming', 'mid-range', 'budget', '5g', 'pre-owned']

function SmartphonesContent() {
  const searchParams = useSearchParams()
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
            .filter(
              (p: Product) =>
                p.category === 'smartphone' ||
                p.subcategory === 'flagship' ||
                p.subcategory === 'mid-range',
            )
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

  const results = applySortAndFilter(products, searchParams)
  const catParam = searchParams.get('cat')
  const brands = Array.from(new Set(products.map((p) => p.brand).filter(Boolean))).sort()

  const crumbs = [
    { label: 'Smartphones', href: '/smartphones' },
    ...(catParam ? [{ label: catParam.replace(/-/g, ' ') }] : []),
  ]

  return (
    <CollectionView
      crumbs={crumbs}
      title="Smartphones"
      lede="Flagship and mid-range handsets from ৳12,500 to ৳210,000 — official warranty on new units, published battery health on every pre-owned one."
      products={results}
      loading={loading}
      availableBrands={brands.length > 0 ? brands : ['Apple', 'Samsung', 'Xiaomi', 'OnePlus', 'Google']}
      availableSubcategories={SUBCATEGORIES}
      resetHref="/smartphones"
      emptyTitle="No phones match those filters"
      emptyBody="Try a different brand or widen the price range."
      banner={
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-verified-line bg-verified-soft p-4">
          <BatteryCharging className="mt-0.5 h-4 w-4 shrink-0 text-verified" strokeWidth={2} />
          <p className="text-[13px] leading-relaxed text-ink-2">
            <strong className="font-medium text-ink">Battery health is published, not estimated.</strong>{' '}
            Every pre-owned handset lists its measured capacity, and each unit is logged against its
            IMEI before it goes on sale.
          </p>
        </div>
      }
    />
  )
}

export default function Smartphones() {
  return (
    <Suspense
      fallback={
        <Container className="py-20 text-center text-sm text-ink-3">Loading smartphones…</Container>
      }
    >
      <SmartphonesContent />
    </Suspense>
  )
}

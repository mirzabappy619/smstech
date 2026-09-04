'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import CollectionView from '../../components/CollectionView'
import { applySortAndFilter } from '../../components/ProductSortFilter'
import Container from '../../components/ui/container'
import { normalizeProduct, Product } from '../../data/products'

const SUBCATEGORIES = [
  'gaming',
  'business',
  'student',
  'creator',
  'ultrabook',
  'macbook',
  'pre-owned',
]

function LaptopsContent() {
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
                p.category === 'laptop' ||
                p.subcategory === 'macbook' ||
                p.subcategory === 'gaming' ||
                p.subcategory === 'pre-owned' ||
                p.badges.includes('Pre-Owned'),
            )
          setProducts(mapped)
        }
      } catch (e) {
        console.error('Failed to fetch laptop products from database:', e)
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
    { label: 'Laptops', href: '/laptops' },
    ...(catParam ? [{ label: catParam.replace(/-/g, ' ') }] : []),
  ]

  return (
    <CollectionView
      crumbs={crumbs}
      title="Laptops"
      lede="From ৳27,900 ultraportables to ৳649,900 workstations — every listing states its condition grade, warranty term and stock location before you add it to the cart."
      products={results}
      loading={loading}
      availableBrands={brands.length > 0 ? brands : ['Apple', 'ASUS', 'Lenovo', 'HP', 'Dell']}
      availableSubcategories={SUBCATEGORIES}
      resetHref="/laptops"
      emptyTitle="No laptops match those filters"
      emptyBody="Try a wider price band, or clear the condition filter to see both new and pre-owned stock."
      banner={
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-verified-line bg-verified-soft p-4">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-verified" strokeWidth={2} />
          <p className="text-[13px] leading-relaxed text-ink-2">
            <strong className="font-medium text-ink">Every machine is inspected before listing.</strong>{' '}
            New units ship sealed with full manufacturer warranty; certified pre-owned units are
            graded A to C and covered by six months of SMSTech warranty.
          </p>
        </div>
      }
    />
  )
}

export default function Laptops() {
  return (
    <Suspense
      fallback={
        <Container className="py-20 text-center text-sm text-ink-3">Loading laptops…</Container>
      }
    >
      <LaptopsContent />
    </Suspense>
  )
}

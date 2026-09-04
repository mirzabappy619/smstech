'use client'

import { useState, useEffect, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import CollectionView from '../../../components/CollectionView'
import { applySortAndFilter } from '../../../components/ProductSortFilter'
import Container from '../../../components/ui/container'
import { normalizeProduct, Product, brands } from '../../../data/products'

function BrandDetailContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  const [baseProducts, setBaseProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  const brand = (params?.brand as string) || ''
  const brandInfo = brands.find((b) => b.slug === brand.toLowerCase())
  const brandName = brandInfo?.name ?? (brand ? brand.charAt(0).toUpperCase() + brand.slice(1) : '')

  useEffect(() => {
    async function loadBrandProductsFromDb() {
      if (!brand) return
      try {
        setLoading(true)
        const res = await fetch('/api/v1/products?show_all=true&limit=100')
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

  const results = applySortAndFilter(baseProducts, searchParams)
  const subcategories = Array.from(
    new Set(baseProducts.map((p) => p.subcategory).filter(Boolean)),
  ).sort()

  return (
    <CollectionView
      crumbs={[{ label: 'Brands', href: '/brands' }, { label: brandName }]}
      title={brandName}
      lede={`Every ${brandName} device we currently hold — new and certified pre-owned — with its condition grade and warranty term stated on the listing.`}
      products={results}
      loading={loading}
      availableSubcategories={subcategories}
      resetHref={`/brand/${brand}`}
      emptyTitle={`No ${brandName} devices match those filters`}
      emptyBody="Clear a filter to see the full range from this brand."
    />
  )
}

export default function BrandDetail() {
  return (
    <Suspense
      fallback={
        <Container className="py-20 text-center text-sm text-ink-3">Loading brand…</Container>
      }
    >
      <BrandDetailContent />
    </Suspense>
  )
}

'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import CollectionView from '../../components/CollectionView'
import { applySortAndFilter } from '../../components/ProductSortFilter'
import Container from '../../components/ui/container'
import { normalizeProduct, Product } from '../../data/products'

function NewArrivalsContent() {
  const searchParams = useSearchParams()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadNewArrivalsFromDb() {
      try {
        setLoading(true)
        const res = await fetch('/api/v1/products?show_all=true&limit=100')
        const json = await res.json()
        if (json.success && Array.isArray(json.data)) {
          const all = json.data.map(normalizeProduct)
          const fresh = all.filter((p: Product) => p.isNew || p.badges.includes('New'))
          setProducts(fresh.length > 0 ? fresh : all)
        }
      } catch (e) {
        console.error('Failed to fetch new arrivals from database:', e)
      } finally {
        setLoading(false)
      }
    }
    loadNewArrivalsFromDb()
  }, [])

  const results = applySortAndFilter(products, searchParams)
  const brands = Array.from(new Set(products.map((p) => p.brand).filter(Boolean))).sort()

  return (
    <CollectionView
      crumbs={[{ label: 'New arrivals' }]}
      title="New arrivals"
      lede="The most recent stock to clear inspection — sealed launches and freshly graded pre-owned units, listed as they land."
      products={results}
      loading={loading}
      availableBrands={brands.length > 0 ? brands : ['Apple', 'ASUS', 'Samsung', 'Lenovo']}
      resetHref="/new-arrivals"
      emptyTitle="Nothing new matches those filters"
      emptyBody="Clear a filter to see everything that has landed recently."
    />
  )
}

export default function NewArrivals() {
  return (
    <Suspense
      fallback={
        <Container className="py-20 text-center text-sm text-ink-3">
          Loading new arrivals…
        </Container>
      }
    >
      <NewArrivalsContent />
    </Suspense>
  )
}

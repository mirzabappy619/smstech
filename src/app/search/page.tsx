'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import CollectionView from '../../components/CollectionView'
import { applySortAndFilter } from '../../components/ProductSortFilter'
import Container from '../../components/ui/container'
import { normalizeProduct, Product } from '../../data/products'

function SearchContent() {
  const searchParams = useSearchParams()
  const query = searchParams.get('q') || ''
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function searchDbProducts() {
      try {
        setLoading(true)
        const endpoint = query
          ? `/api/v1/products?search=${encodeURIComponent(query)}&limit=100`
          : '/api/v1/products?show_all=true&limit=100'
        const res = await fetch(endpoint)
        const json = await res.json()
        if (json.success && Array.isArray(json.data)) {
          setProducts(json.data.map(normalizeProduct))
        }
      } catch (e) {
        console.error('Failed to search database products:', e)
      } finally {
        setLoading(false)
      }
    }
    searchDbProducts()
  }, [query])

  const results = applySortAndFilter(products, searchParams)
  const brands = Array.from(new Set(products.map((p) => p.brand).filter(Boolean))).sort()

  return (
    <CollectionView
      crumbs={[{ label: query ? `Search: ${query}` : 'Search' }]}
      title={query ? `Results for “${query}”` : 'Search the catalogue'}
      lede={
        query
          ? 'Matching devices across new and certified pre-owned stock.'
          : 'Everything currently listed — narrow it down with the filters.'
      }
      products={results}
      loading={loading}
      availableBrands={brands}
      resetHref={query ? `/search?q=${encodeURIComponent(query)}` : '/search'}
      emptyTitle={query ? `Nothing found for “${query}”` : 'No devices match those filters'}
      emptyBody="Check the spelling, try a broader term such as the brand or model family, or clear your filters."
    />
  )
}

export default function Search() {
  return (
    <Suspense
      fallback={
        <Container className="py-20 text-center text-sm text-ink-3">Searching…</Container>
      }
    >
      <SearchContent />
    </Suspense>
  )
}

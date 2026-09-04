'use client'

import Link from 'next/link'
import { Heart } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import ProductCard from '../../components/ProductCard'
import Container from '../../components/ui/container'
import { Breadcrumbs } from '../../components/CollectionView'

export default function Wishlist() {
  const { wishlist } = useApp()

  return (
    <Container className="py-8 md:py-10">
      <Breadcrumbs items={[{ label: 'Saved items' }]} />

      <header className="mb-8 max-w-2xl">
        <h1 className="font-display text-[30px] font-semibold leading-tight tracking-[-0.025em] text-ink md:text-[38px]">
          Saved items
        </h1>
        <p className="tnum mt-3 text-[15px] text-ink-2">
          {wishlist.length} device{wishlist.length === 1 ? '' : 's'} saved.
          {wishlist.length > 0 &&
            ' High-end pre-owned stock moves quickly — prices and availability can change.'}
        </p>
      </header>

      {wishlist.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface px-6 py-20 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-surface-2 text-ink-3">
            <Heart className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <h2 className="mt-4 font-display text-lg font-semibold text-ink">Nothing saved yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed text-ink-2">
            Tap the heart on any listing to keep it here while you compare options.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Link
              href="/laptops"
              className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover"
            >
              Browse laptops
            </Link>
            <Link
              href="/smartphones"
              className="inline-flex h-10 items-center rounded-lg border border-line px-4 text-sm font-medium text-ink transition-colors hover:border-line-2 hover:bg-surface-2"
            >
              Browse phones
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {wishlist.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </Container>
  )
}

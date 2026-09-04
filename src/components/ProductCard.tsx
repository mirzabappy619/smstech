'use client'

import Link from 'next/link'
import {
  BellRing,
  CalendarClock,
  Check,
  GitCompareArrows,
  Heart,
  ShieldCheck,
  ShoppingBag,
} from 'lucide-react'
import { useApp } from '../store/AppContext'
import type { Product } from '../data/products'
import Price, { discountPct } from './ui/price'
import Rating from './ui/rating'
import { ConditionBadge, isPreOwned } from './ui/condition'

type Props = {
  product: Product
  compact?: boolean
}

export default function ProductCard({ product, compact }: Props) {
  const { addToCart, toggleWishlist, isWishlisted, addToCompare, isCompared } = useApp()
  const wishlisted = isWishlisted(product.id)
  const compared = isCompared(product.id)
  const pct = discountPct(product.price, product.originalPrice)
  const preOwned = isPreOwned(product)

  const warrantyLabel = product.warranty?.split(/\s+/).slice(0, 2).join(' ') || '1 Year'

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border border-line bg-surface transition-[border-color,box-shadow] duration-200 hover:border-line-2 hover:shadow-md">
      {/* Media */}
      <div className="relative">
        <Link
          href={`/product/${product.slug}`}
          className="block overflow-hidden bg-surface-2"
          tabIndex={-1}
          aria-hidden="true"
        >
          <img
            src={product.image}
            alt=""
            loading="lazy"
            className={`w-full object-contain p-5 transition-transform duration-500 ease-out group-hover:scale-[1.04] ${
              compact ? 'h-36' : 'aspect-[4/3] h-auto'
            }`}
          />
        </Link>

        {/* Grade / status, top-left */}
        <div className="pointer-events-none absolute left-3 top-3 flex flex-col items-start gap-1.5">
          <ConditionBadge product={product} />
          {product.isPreorder && (
            <span className="inline-flex items-center gap-1 rounded-md border border-accent-line bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium leading-4 text-accent-ink">
              <CalendarClock className="h-3 w-3" strokeWidth={2.25} />
              Pre-order
            </span>
          )}
          {pct >= 10 && !product.isPreorder && (
            <span className="tnum rounded-md bg-inverse px-1.5 py-0.5 text-[11px] font-semibold leading-4 text-inverse-ink">
              Save {pct}%
            </span>
          )}
        </div>

        {/* Quick actions, top-right */}
        <div className="absolute right-2.5 top-2.5 flex flex-col gap-1.5 opacity-0 transition-opacity duration-200 focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100">
          <button
            onClick={() => toggleWishlist(product)}
            aria-label={wishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
            aria-pressed={wishlisted}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface/90 text-ink-2 backdrop-blur transition-colors hover:border-line-2 hover:text-danger"
          >
            <Heart
              className={`h-4 w-4 ${wishlisted ? 'fill-danger text-danger' : ''}`}
              strokeWidth={2}
            />
          </button>
          <button
            onClick={() => addToCompare(product)}
            aria-label={compared ? 'Already in comparison' : 'Add to comparison'}
            aria-pressed={compared}
            className={`flex h-8 w-8 items-center justify-center rounded-lg border bg-surface/90 backdrop-blur transition-colors ${
              compared
                ? 'border-accent-line text-accent'
                : 'border-line text-ink-2 hover:border-line-2 hover:text-accent'
            }`}
          >
            {compared ? (
              <Check className="h-4 w-4" strokeWidth={2.5} />
            ) : (
              <GitCompareArrows className="h-4 w-4" strokeWidth={2} />
            )}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 border-t border-line p-4">
        <div className="min-w-0">
          <p className="eyebrow">{product.brand}</p>
          <h3 className="mt-1.5">
            <Link
              href={`/product/${product.slug}`}
              className="line-clamp-2 text-[15px] font-semibold leading-snug tracking-tight text-ink transition-colors hover:text-accent"
            >
              {product.name}
            </Link>
          </h3>
          {product.shortSpec && (
            <p className="mt-1 line-clamp-1 text-[13px] text-ink-3">{product.shortSpec}</p>
          )}
        </div>

        {product.reviews > 0 && <Rating value={product.rating} count={product.reviews} />}

        <Price price={product.price} original={product.originalPrice} size="md" />

        {/* Assurance row — the line that carries the trust story */}
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-ink-3">
          <span className="inline-flex items-center gap-1 text-verified">
            <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
            {warrantyLabel} warranty
          </span>
          <span aria-hidden className="text-line-2">·</span>
          {product.isPreorder ? (
            <span className="text-accent-ink">
              {product.preorderReleaseDate
                ? `Ships ${new Date(product.preorderReleaseDate).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                  })}`
                : 'Reserve now'}
            </span>
          ) : product.stock === 'out_of_stock' ? (
            <span className="text-danger">Out of stock</span>
          ) : product.stock === 'low_stock' ? (
            <span className="tnum text-certified">Only {product.stockCount} left</span>
          ) : (
            <span>In stock</span>
          )}
          {preOwned && product.batteryHealth != null && (
            <>
              <span aria-hidden className="text-line-2">·</span>
              <span className="tnum">Battery {product.batteryHealth}%</span>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="mt-auto flex gap-2 pt-1">
          {product.isPreorder ? (
            <Link
              href={`/product/${product.slug}`}
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-accent text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover"
            >
              <CalendarClock className="h-4 w-4" strokeWidth={2} />
              Reserve
            </Link>
          ) : product.stock === 'out_of_stock' ? (
            <Link
              href={`/product/${product.slug}`}
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-line bg-surface text-sm font-medium text-ink transition-colors hover:border-line-2 hover:bg-surface-2"
            >
              <BellRing className="h-4 w-4" strokeWidth={2} />
              Notify me
            </Link>
          ) : (
            <>
              <button
                onClick={() => addToCart(product)}
                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-accent text-sm font-medium text-on-accent transition-[background-color,transform] duration-150 hover:bg-accent-hover active:scale-[0.985]"
              >
                <ShoppingBag className="h-4 w-4" strokeWidth={2} />
                Add to cart
              </button>
              <Link
                href={`/product/${product.slug}`}
                className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink-2 transition-colors hover:border-line-2 hover:text-ink"
              >
                Details
              </Link>
            </>
          )}
        </div>
      </div>
    </article>
  )
}

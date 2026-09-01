'use client'

import Link from 'next/link'
import { useApp } from '../store/AppContext'
import type { Product } from '../data/products'

const fmt = (n: number) => '৳' + n.toLocaleString('en-BD')

type Props = {
  product: Product
  compact?: boolean
}

export default function ProductCard({ product, compact }: Props) {
  const { addToCart, toggleWishlist, isWishlisted } = useApp()
  const wishlisted = isWishlisted(product.id)
  const discount = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)

  return (
    <div className="group relative bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-100 dark:border-slate-700/60 overflow-hidden hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-lg hover:shadow-blue-50 dark:hover:shadow-none transition-all duration-300 flex flex-col">
      {/* Badges */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-1">
        {product.isPreorder && (
          <span className="text-[10px] font-700 uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-500 text-white">
            Pre-Order
          </span>
        )}
        {product.badges.slice(0, 2).map((b) => (
          <span
            key={b}
            className={`text-[10px] font-700 uppercase tracking-wide px-2 py-0.5 rounded-full
              ${b === 'Hot Deal' ? 'bg-red-500 text-white' :
                b === 'New' ? 'bg-blue-600 text-white' :
                b === 'Best Seller' ? 'bg-amber-500 text-white' :
                'bg-slate-700 dark:bg-slate-600 text-white'}`}
          >
            {b}
          </span>
        ))}
      </div>

      {/* Wishlist */}
      <button
        onClick={() => toggleWishlist(product)}
        className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white dark:bg-slate-700 shadow-sm flex items-center justify-center hover:scale-110 transition-transform"
        aria-label="Add to wishlist"
      >
        <svg viewBox="0 0 24 24" className={`w-4 h-4 ${wishlisted ? 'fill-red-500 stroke-red-500' : 'fill-none stroke-slate-400 dark:stroke-slate-300'}`} strokeWidth={2}>
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      </button>

      {/* Image */}
      <Link href={`/product/${product.slug}`} className="block overflow-hidden bg-slate-50 dark:bg-slate-900">
        <img
          src={product.image}
          alt={product.name}
          className={`w-full object-cover group-hover:scale-105 transition-transform duration-500 ${compact ? 'h-40' : 'h-52'}`}
        />
      </Link>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1 gap-2">
        <div>
          <span className="text-xs font-600 text-blue-600 dark:text-blue-400 uppercase tracking-wide">{product.brand}</span>
          <Link href={`/product/${product.slug}`}>
            <h3 className="font-600 text-slate-900 dark:text-white mt-0.5 line-clamp-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-sm leading-snug">
              {product.name}
            </h3>
          </Link>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">{product.shortSpec}</p>
        </div>

        {/* Rating */}
        <div className="flex items-center gap-1.5">
          <div className="flex">
            {[1,2,3,4,5].map((s) => (
              <svg key={s} viewBox="0 0 12 12" className={`w-3 h-3 ${s <= Math.round(product.rating) ? 'fill-amber-400' : 'fill-slate-200 dark:fill-slate-700'}`}>
                <path d="M6 1l1.4 2.8L10.6 4.3 8.3 6.5l.5 3.2L6 8.1 3.2 9.7l.5-3.2L1.4 4.3l3.2-.5z" />
              </svg>
            ))}
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400">{product.rating} ({product.reviews})</span>
        </div>

        {/* Availability */}
        <div className="flex items-center gap-2 text-xs">
          {product.isPreorder ? (
            <span className="text-amber-600 dark:text-amber-400 font-600">
              Pre-Order{product.preorderReleaseDate ? ` · ${new Date(product.preorderReleaseDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}
            </span>
          ) : product.stock === 'out_of_stock' ? (
            <span className="text-red-500 dark:text-red-400 font-500">Out of Stock</span>
          ) : product.stock === 'low_stock' ? (
            <span className="text-amber-600 dark:text-amber-400 font-600">Only {product.stockCount} left</span>
          ) : (
            <span className="text-emerald-600 dark:text-emerald-400 font-500">In Stock</span>
          )}
          <span className="text-slate-300 dark:text-slate-600">·</span>
          <span className="text-slate-400 dark:text-slate-400">{product.warranty.split(' ').slice(0, 2).join(' ')} warranty</span>
        </div>

        {/* Price */}
        <div className="mt-auto pt-2 border-t border-slate-50 dark:border-slate-700/60">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-700 text-slate-900 dark:text-white">{fmt(product.price)}</span>
            <span className="text-xs text-slate-400 dark:text-slate-500 line-through">{fmt(product.originalPrice)}</span>
            <span className="text-xs font-600 text-emerald-600 dark:text-emerald-400">-{discount}%</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Save {fmt(product.originalPrice - product.price)}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-2">
          {product.isPreorder ? (
            <Link
              href={`/product/${product.slug}`}
              className="flex-1 py-2 text-sm font-600 bg-amber-500 text-white rounded-xl text-center hover:bg-amber-600 active:scale-95 transition-all"
            >
              Pre-Order
            </Link>
          ) : product.stock === 'out_of_stock' ? (
            <button className="flex-1 py-2 text-sm font-600 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-600 dark:text-slate-300 hover:border-blue-400 transition-colors">
              Notify Me
            </button>
          ) : (
            <>
              <button
                onClick={() => addToCart(product)}
                className="flex-1 py-2 text-sm font-600 bg-blue-600 dark:bg-blue-600 text-white rounded-xl hover:bg-blue-700 active:scale-95 transition-all"
              >
                Add to Cart
              </button>
              <Link
                href={`/product/${product.slug}`}
                className="px-3 py-2 text-sm font-600 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 hover:border-blue-300 dark:hover:border-blue-500 transition-colors"
              >
                Details
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

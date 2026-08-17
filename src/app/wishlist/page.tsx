'use client'

import Link from 'next/link'
import { useApp } from '../../store/AppContext'
import ProductCard from '../../components/ProductCard'

export default function Wishlist() {
  const { wishlist } = useApp()

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-800 text-slate-900 dark:text-white mb-2">My Wishlist</h1>
      <p className="text-slate-500 dark:text-slate-400 text-sm mb-8">{wishlist.length} saved product{wishlist.length !== 1 ? 's' : ''}</p>

      {wishlist.length === 0 ? (
        <div className="text-center py-24 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
          <div className="text-7xl mb-6">❤️</div>
          <h2 className="text-2xl font-800 text-slate-900 dark:text-white mb-2">Your wishlist is waiting.</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-8">Save products you love and come back later.</p>
          <div className="flex gap-3 justify-center">
            <Link href="/laptops" className="px-6 py-3 bg-blue-600 text-white font-600 rounded-xl hover:bg-blue-700 transition-colors text-sm">
              Explore Products
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {wishlist.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  )
}

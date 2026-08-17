import Link from 'next/link'
import { brands } from '../../data/products'

export default function Brands() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-800 text-slate-900 dark:text-white mb-2">Shop by Brand</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm">Authorized reseller of leading technology brands</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
        {brands.map((brand) => (
          <Link
            key={brand.name}
            href={`/brand/${brand.name.toLowerCase()}`}
            className="group flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border border-slate-100 dark:border-slate-700/80 hover:border-blue-200 dark:hover:border-blue-500 hover:shadow-lg transition-all bg-white dark:bg-slate-800"
          >
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-900 group-hover:bg-blue-50 dark:group-hover:bg-blue-950 flex items-center justify-center text-3xl font-800 text-slate-600 dark:text-slate-300 transition-colors">
              {brand.logo}
            </div>
            <div className="text-center">
              <p className="font-700 text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{brand.name}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{brand.count} products</p>
            </div>
            <span className="text-xs text-blue-600 dark:text-blue-400 font-600 opacity-0 group-hover:opacity-100 transition-opacity">Explore →</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

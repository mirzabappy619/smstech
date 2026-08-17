'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'

type Props = {
  brands: string[]
}

export default function BrandPillBar({ brands }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const currentBrand = searchParams.get('brand') || ''

  const toggleBrand = (brandName: string) => {
    const params = new URLSearchParams(searchParams.toString())
    const normalized = brandName.toLowerCase()

    if (currentBrand.toLowerCase() === normalized) {
      params.delete('brand')
    } else {
      params.set('brand', normalized)
    }

    const queryString = params.toString()
    const url = queryString ? `${pathname}?${queryString}` : pathname
    router.replace(url, { scroll: false })
  }

  return (
    <div className="mb-6 overflow-x-auto pb-2 scrollbar-none">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => {
            const params = new URLSearchParams(searchParams.toString())
            params.delete('brand')
            const queryString = params.toString()
            const url = queryString ? `${pathname}?${queryString}` : pathname
            router.replace(url, { scroll: false })
          }}
          className={`px-4 py-1.5 rounded-full text-xs font-600 border transition-all duration-200 shadow-sm whitespace-nowrap
            ${!currentBrand
              ? 'bg-blue-600 text-white border-blue-600 font-700 shadow-blue-200 dark:shadow-none'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400'}`}
        >
          All Brands
        </button>

        {brands.map((b) => {
          const isSelected = currentBrand.toLowerCase() === b.toLowerCase()
          return (
            <button
              key={b}
              onClick={() => toggleBrand(b)}
              className={`px-4 py-1.5 rounded-full text-xs font-600 border transition-all duration-200 shadow-sm whitespace-nowrap
                ${isSelected
                  ? 'bg-blue-600 text-white border-blue-600 font-700 shadow-blue-200 dark:shadow-none'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400'}`}
            >
              {b}
            </button>
          )
        })}
      </div>
    </div>
  )
}

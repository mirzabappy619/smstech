'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useApp } from '../store/AppContext'

export default function MobileNav() {
  const { cartCount, wishlist } = useApp()
  const pathname = usePathname()

  const items = [
    { label: 'Home', href: '/', icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    )},
    { label: 'Categories', href: '/laptops', icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
      </svg>
    )},
    { label: 'Search', href: '#', search: true, icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
        <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
      </svg>
    )},
    { label: 'Wishlist', href: '/wishlist', badge: wishlist.length, icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    )},
    { label: 'Cart', href: '/cart', badge: cartCount, icon: (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
    )},
  ]

  const { setSearchOpen: openSearch } = useApp()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 transition-colors">
      <div className="flex">
        {items.map((item) => {
          const active = !item.search && pathname === item.href
          return item.search ? (
            <button
              key={item.label}
              onClick={() => openSearch(true)}
              className="flex-1 flex flex-col items-center gap-1 py-2.5 text-slate-500 dark:text-slate-400"
            >
              {item.icon}
              <span className="text-[10px] font-600">{item.label}</span>
            </button>
          ) : (
            <Link
              key={item.label}
              href={item.href}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 relative
                ${active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}
            >
              {item.icon}
              <span className="text-[10px] font-600">{item.label}</span>
              {item.badge != null && item.badge > 0 && (
                <span className="absolute top-1 right-4 w-4 h-4 bg-blue-600 text-white text-[9px] font-700 rounded-full flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

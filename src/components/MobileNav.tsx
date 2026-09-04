'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Heart, Home, LayoutGrid, Search, ShoppingBag } from 'lucide-react'
import { useApp } from '../store/AppContext'

export default function MobileNav() {
  const { cartCount, wishlist, setSearchOpen, setCartOpen } = useApp()
  const pathname = usePathname()

  const items = [
    { label: 'Home', href: '/', Icon: Home },
    { label: 'Shop', href: '/laptops', Icon: LayoutGrid },
    { label: 'Search', action: 'search' as const, Icon: Search },
    { label: 'Saved', href: '/wishlist', badge: wishlist.length, Icon: Heart },
    { label: 'Cart', action: 'cart' as const, badge: cartCount, Icon: ShoppingBag },
  ]

  const cell =
    'relative flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors'

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      aria-label="Primary"
    >
      <div className="flex">
        {items.map(({ label, href, action, badge, Icon }) => {
          const active = href ? pathname === href : false
          const tone = active ? 'text-accent' : 'text-ink-3'

          const content = (
            <>
              <span className="relative">
                <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
                {badge != null && badge > 0 && (
                  <span className="tnum absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-semibold text-on-accent">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </span>
              {label}
            </>
          )

          if (action) {
            return (
              <button
                key={label}
                onClick={() => (action === 'search' ? setSearchOpen(true) : setCartOpen(true))}
                className={`${cell} ${tone}`}
              >
                {content}
              </button>
            )
          }

          return (
            <Link key={label} href={href!} className={`${cell} ${tone}`}>
              {content}
              {active && (
                <span className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-accent" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

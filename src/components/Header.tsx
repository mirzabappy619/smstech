'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useApp } from '../store/AppContext'
import { normalizeProduct, Product } from '../data/products'
import { useTheme } from '@/presentation/contexts/theme-context'

const navItems = [
  {
    label: 'Laptops',
    href: '/laptops',
    mega: [
      { label: 'Gaming Laptops', href: '/laptops?cat=gaming' },
      { label: 'Business Laptops', href: '/laptops?cat=business' },
      { label: 'Student Laptops', href: '/laptops?cat=student' },
      { label: 'Ultrabooks', href: '/laptops?cat=ultrabook' },
      { label: 'MacBooks', href: '/laptops?brand=apple' },
      { label: 'Creator Laptops', href: '/laptops?cat=creator' },
      { label: 'Pre-Owned Laptops', href: '/laptops?cat=pre-owned' },
      { label: 'Accessories', href: '/laptops?cat=accessories' },
    ],
  },
  {
    label: 'Smartphones',
    href: '/smartphones',
    mega: [
      { label: 'iPhones', href: '/smartphones?brand=apple' },
      { label: 'Samsung', href: '/smartphones?brand=samsung' },
      { label: 'Xiaomi', href: '/smartphones?brand=xiaomi' },
      { label: 'OnePlus', href: '/smartphones?brand=oneplus' },
      { label: 'Gaming Phones', href: '/smartphones?cat=gaming' },
      { label: 'Budget Phones', href: '/smartphones?cat=budget' },
      { label: 'Accessories', href: '/smartphones?cat=accessories' },
    ],
  },
  {
    label: 'Brands',
    href: '/brands',
    mega: [
      { label: 'Apple', href: '/brand/apple' },
      { label: 'Samsung', href: '/brand/samsung' },
      { label: 'ASUS', href: '/brand/asus' },
      { label: 'Lenovo', href: '/brand/lenovo' },
      { label: 'HP', href: '/brand/hp' },
      { label: 'Dell', href: '/brand/dell' },
      { label: 'MSI', href: '/brand/msi' },
      { label: 'Xiaomi', href: '/brand/xiaomi' },
    ],
  },
  { label: 'Pre-Owned', href: '/laptops?cat=pre-owned' },
  { label: 'Deals', href: '/deals', highlight: true },
  { label: 'New Arrivals', href: '/new-arrivals' },
  { label: 'Compare', href: '/compare' },
  { label: 'Stores', href: '/stores' },
]

const popularSearches = [
  'MacBook Air',
  'Dell Latitude',
  'HP ProBook',
  'Surface Laptop',
  'iPhone 17 Pro',
  'Pre-Owned',
  'Ryzen 5',
  'Intel i5',
]

export default function Header() {
  const { cartCount, wishlist, setCartOpen, searchOpen, setSearchOpen, announcementDismissed, dismissAnnouncement } = useApp()
  const { theme, toggleTheme } = useTheme()
  const [activeMega, setActiveMega] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [dbProducts, setDbProducts] = useState<Product[]>([])
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  
  const searchRef = useRef<HTMLInputElement>(null)
  const mobileSearchRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    async function loadProducts() {
      try {
        const res = await fetch('/api/v1/products?show_all=true&limit=100')
        const json = await res.json()
        if (json.success && Array.isArray(json.data)) {
          setDbProducts(json.data.map(normalizeProduct))
        }
      } catch (e) {
        console.error('Failed to load products for search dropdown:', e)
      }
    }
    loadProducts()
  }, [])

  const filtered = query.trim().length > 0
    ? dbProducts.filter((p) => {
        const q = query.toLowerCase()
        return (
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.subcategory?.toLowerCase().includes(q)
        )
      }).slice(0, 6)
    : []

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus()
  }, [searchOpen])

  useEffect(() => {
    if (mobileSearchOpen) mobileSearchRef.current?.focus()
  }, [mobileSearchOpen])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`)
      setSearchOpen(false)
      setMobileSearchOpen(false)
    }
  }

  const handleSelectSuggestion = (href: string) => {
    router.push(href)
    setSearchOpen(false)
    setMobileSearchOpen(false)
    setQuery('')
  }

  return (
    <>
      {/* Announcement bar */}
      {!announcementDismissed && (
        <div className="bg-blue-600 dark:bg-blue-700 text-white text-xs py-2 px-4 flex items-center justify-center gap-4 relative">
          <span className="font-500">
            🚚 Free Delivery on Selected Products &nbsp;·&nbsp; ✅ Authentic Products &nbsp;·&nbsp; 🛡️ Official Warranty
          </span>
          <button
            onClick={dismissAnnouncement}
            className="absolute right-4 top-1/2 -translate-y-1/2 opacity-70 hover:opacity-100"
            aria-label="Dismiss announcement"
          >
            <svg viewBox="0 0 16 16" className="w-4 h-4 fill-white">
              <path d="M12 4L4 12M4 4l8 8" stroke="white" strokeWidth={1.5} fill="none" />
            </svg>
          </button>
        </div>
      )}

      {/* Main header */}
      <header className="sticky top-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 shadow-sm transition-colors">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-4">
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
            aria-label="Toggle menu"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 stroke-current" fill="none" strokeWidth={2}>
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>

          {/* Logo */}
          <Link href="/" className="shrink-0 flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 dark:bg-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-800 text-sm">S</span>
            </div>
            <span className="font-800 text-slate-900 dark:text-white text-xl hidden sm:block">
              SMS<span className="text-blue-600 dark:text-blue-400">Tech</span>
            </span>
          </Link>

          {/* Desktop Search Bar with Live Suggestions */}
          <form onSubmit={handleSearchSubmit} className="flex-1 relative hidden md:block">
            <div className="relative">
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setSearchOpen(true)
                }}
                onFocus={() => setSearchOpen(true)}
                type="text"
                placeholder="Search laptops, smartphones, pre-owned devices..."
                className="w-full h-10 pl-4 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:focus:bg-slate-900 transition-all"
              />
              <button
                type="submit"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                aria-label="Submit search"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
                  <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                </svg>
              </button>
            </div>

            {/* Suggestions Overlay Dropdown */}
            {searchOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setSearchOpen(false)}
                />
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-2xl z-50 overflow-hidden max-h-[460px] overflow-y-auto">
                  {query.trim().length > 0 ? (
                    filtered.length > 0 ? (
                      <div>
                        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/80 text-[11px] font-800 text-slate-400 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                          <span>Matching Products ({filtered.length})</span>
                          <span className="text-[10px] text-blue-600 dark:text-blue-400">Press Enter for full results</span>
                        </div>

                        {filtered.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => handleSelectSuggestion(`/product/${p.slug}`)}
                            className="flex items-center gap-3.5 px-4 py-3 hover:bg-blue-50/70 dark:hover:bg-slate-700/60 transition-colors cursor-pointer border-b border-slate-100 dark:border-slate-700/60 last:border-0"
                          >
                            <img
                              src={p.image}
                              alt={p.name}
                              className="w-12 h-12 object-cover rounded-xl bg-slate-100 dark:bg-slate-700 shrink-0 border border-slate-200/60 dark:border-slate-600/60"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-700 text-slate-900 dark:text-white truncate">
                                {p.name}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs font-600 text-blue-600 dark:text-blue-400">
                                  ৳{p.price.toLocaleString()}
                                </span>
                                <span className="text-slate-300 dark:text-slate-600">•</span>
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                  {p.brand}
                                </span>
                                {p.subcategory === 'pre-owned' && (
                                  <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-700 rounded-md">
                                    Pre-Owned
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className="text-slate-400 dark:text-slate-500 text-xs">→</span>
                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={() => handleSelectSuggestion(`/search?q=${encodeURIComponent(query.trim())}`)}
                          className="w-full py-3 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-950 text-blue-600 dark:text-blue-400 text-xs font-800 text-center transition-colors border-t border-slate-100 dark:border-slate-700"
                        >
                          View all matching results for "{query.trim()}" →
                        </button>
                      </div>
                    ) : (
                      <div className="p-6 text-center">
                        <p className="text-sm text-slate-600 dark:text-slate-300 font-600">
                          No products found for "{query}"
                        </p>
                        <p className="text-xs text-slate-400 mt-1">Try searching for Dell, HP, MacBook, or iPhone</p>
                      </div>
                    )
                  ) : (
                    <div className="p-5">
                      <div className="text-xs font-800 text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
                        🔥 Popular Searches
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {popularSearches.map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => {
                              setQuery(s)
                              router.push(`/search?q=${encodeURIComponent(s)}`)
                              setSearchOpen(false)
                            }}
                            className="px-3.5 py-1.5 text-xs font-600 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 dark:hover:text-white rounded-xl transition-all"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </form>

          {/* Right actions */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Search icon mobile */}
            <button
              onClick={() => setMobileSearchOpen(true)}
              className="md:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
              aria-label="Open search modal"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
            </button>

            {/* Dark Mode Switcher */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-amber-400 stroke-amber-400" strokeWidth={1.5}>
                  <circle cx="12" cy="12" r="5" />
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth={2} />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-slate-700 stroke-slate-700" strokeWidth={1.5}>
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>

            {/* Admin Link */}
            <Link
              href="/admin"
              className="hidden lg:flex items-center gap-1.5 px-3 py-2 text-xs font-700 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 rounded-lg border border-blue-200 dark:border-blue-900 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
              <span>Admin Portal</span>
            </Link>

            <Link href="/stores" className="hidden xl:flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
              </svg>
              <span className="font-500">Stores</span>
            </Link>

            <Link href="/account" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" title="Account">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
              </svg>
            </Link>

            <Link href="/wishlist" className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" title="Wishlist">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              {wishlist.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-700 rounded-full flex items-center justify-center">
                  {wishlist.length}
                </span>
              )}
            </Link>

            <button
              onClick={() => setCartOpen(true)}
              className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              title="Cart"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-blue-600 text-white text-[10px] font-700 rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="hidden md:block border-t border-slate-50 dark:border-slate-800/60">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center">
              {navItems.map((item) => (
                <div
                  key={item.label}
                  className="relative"
                  onMouseEnter={() => item.mega && setActiveMega(item.label)}
                  onMouseLeave={() => setActiveMega(null)}
                >
                  <Link
                    href={item.href}
                    className={`flex items-center gap-1 px-4 py-3 text-sm font-600 transition-colors
                      ${item.highlight ? 'text-red-500 dark:text-red-400 hover:text-red-600' : 'text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400'}`}
                  >
                    {item.label}
                    {item.mega && (
                      <svg viewBox="0 0 16 16" className="w-3 h-3 opacity-50" fill="currentColor">
                        <path d="M4 6l4 4 4-4" stroke="currentColor" fill="none" strokeWidth={1.5} />
                      </svg>
                    )}
                  </Link>

                  {/* Mega menu */}
                  {item.mega && activeMega === item.label && (
                    <div className="absolute top-full left-0 mt-0 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-2xl shadow-slate-200/60 dark:shadow-none z-50 min-w-56 py-2 overflow-hidden">
                      {item.mega.map((sub) => (
                        <Link
                          key={sub.label}
                          href={sub.href}
                          className="block px-5 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700/60 transition-colors"
                        >
                          {sub.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </nav>
      </header>

      {/* Mobile Search Overlay Modal */}
      {mobileSearchOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm p-4 flex flex-col">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[85vh] overflow-hidden">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-700">
              <form onSubmit={handleSearchSubmit} className="flex-1 relative">
                <input
                  ref={mobileSearchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  type="text"
                  placeholder="Search products..."
                  className="w-full h-11 pl-4 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </form>
              <button
                onClick={() => setMobileSearchOpen(false)}
                className="text-slate-500 text-sm font-700 px-2 py-1 hover:text-slate-900 dark:hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="overflow-y-auto flex-1 py-3">
              {query.trim().length > 0 ? (
                filtered.length > 0 ? (
                  <div className="space-y-2">
                    {filtered.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => handleSelectSuggestion(`/product/${p.slug}`)}
                        className="flex items-center gap-3 p-2.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded-xl cursor-pointer"
                      >
                        <img src={p.image} alt={p.name} className="w-11 h-11 object-cover rounded-lg shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-700 text-slate-900 dark:text-white truncate">{p.name}</p>
                          <p className="text-xs text-blue-600 font-600">৳{p.price.toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center py-6 text-sm text-slate-500">No results found</p>
                )
              ) : (
                <div>
                  <p className="text-xs font-800 text-slate-400 uppercase tracking-wider mb-2">Popular Searches</p>
                  <div className="flex flex-wrap gap-2">
                    {popularSearches.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          setQuery(s)
                          router.push(`/search?q=${encodeURIComponent(s)}`)
                          setMobileSearchOpen(false)
                        }}
                        className="px-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute top-0 left-0 bottom-0 w-72 bg-white dark:bg-slate-900 flex flex-col shadow-xl">
            <div className="p-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
              <span className="font-800 text-xl text-slate-900 dark:text-white">SMS<span className="text-blue-600 dark:text-blue-400">Tech</span></span>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 py-2">
              <Link
                href="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className="block mx-4 my-2 p-3 text-center text-sm font-700 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-200 dark:border-blue-900"
              >
                🔐 Admin Portal
              </Link>
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-5 py-3 text-sm font-600 ${item.highlight ? 'text-red-500 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'} hover:bg-slate-50 dark:hover:bg-slate-800`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

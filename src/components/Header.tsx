'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import {
  ArrowRight,
  ChevronDown,
  Heart,
  LayoutDashboard,
  MapPin,
  Menu,
  Moon,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sun,
  Truck,
  User,
  X,
} from 'lucide-react'
import { useApp } from '../store/AppContext'
import { normalizeProduct, Product } from '../data/products'
import { useTheme } from '@/presentation/contexts/theme-context'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import Container from './ui/container'
import { formatBDT } from './ui/price'
import { ConditionBadge } from './ui/condition'

type MegaColumn = {
  heading: string
  links: { label: string; href: string; note?: string }[]
}

type NavItem = {
  label: string
  href: string
  accent?: boolean
  mega?: MegaColumn[]
  feature?: { eyebrow: string; title: string; body: string; href: string; cta: string }
}

const navItems: NavItem[] = [
  {
    label: 'Laptops',
    href: '/laptops',
    mega: [
      {
        heading: 'By use',
        links: [
          { label: 'Gaming', href: '/laptops?cat=gaming', note: 'RTX & Radeon' },
          { label: 'Business', href: '/laptops?cat=business', note: 'Thin, durable, secure' },
          { label: 'Creator', href: '/laptops?cat=creator', note: 'Colour-accurate panels' },
          { label: 'Student', href: '/laptops?cat=student', note: 'Everyday value' },
          { label: 'Ultrabooks', href: '/laptops?cat=ultrabook', note: 'Under 1.4 kg' },
        ],
      },
      {
        heading: 'By brand',
        links: [
          { label: 'MacBook', href: '/laptops?brand=apple' },
          { label: 'ASUS', href: '/brand/asus' },
          { label: 'Lenovo', href: '/brand/lenovo' },
          { label: 'Dell', href: '/brand/dell' },
          { label: 'HP', href: '/brand/hp' },
        ],
      },
      {
        heading: 'By condition',
        links: [
          { label: 'Brand new', href: '/laptops', note: 'Sealed, full warranty' },
          { label: 'Certified pre-owned', href: '/laptops?cat=pre-owned', note: '32-point inspected' },
          { label: 'Open box', href: '/deals', note: 'Unused, reduced' },
        ],
      },
    ],
    feature: {
      eyebrow: 'Certified pre-owned',
      title: 'High-end laptops, honestly graded',
      body: 'Every unit inspected across 32 points, graded A to C, and covered for 6 months.',
      href: '/laptops?cat=pre-owned',
      cta: 'Shop pre-owned',
    },
  },
  {
    label: 'Smartphones',
    href: '/smartphones',
    mega: [
      {
        heading: 'By brand',
        links: [
          { label: 'iPhone', href: '/smartphones?brand=apple' },
          { label: 'Samsung Galaxy', href: '/smartphones?brand=samsung' },
          { label: 'Xiaomi', href: '/smartphones?brand=xiaomi' },
          { label: 'OnePlus', href: '/smartphones?brand=oneplus' },
          { label: 'Google Pixel', href: '/smartphones?brand=google' },
        ],
      },
      {
        heading: 'By tier',
        links: [
          { label: 'Flagship', href: '/smartphones?cat=flagship', note: 'Latest silicon' },
          { label: 'Mid-range', href: '/smartphones?cat=mid-range' },
          { label: 'Gaming', href: '/smartphones?cat=gaming' },
          { label: 'Budget', href: '/smartphones?cat=budget' },
        ],
      },
      {
        heading: 'By condition',
        links: [
          { label: 'Brand new', href: '/smartphones', note: 'Official warranty' },
          { label: 'Certified pre-owned', href: '/smartphones?cat=pre-owned', note: 'Battery health listed' },
          { label: 'Accessories', href: '/smartphones?cat=accessories' },
        ],
      },
    ],
    feature: {
      eyebrow: 'Battery transparency',
      title: 'We publish battery health',
      body: 'Every pre-owned phone lists its measured battery capacity before you buy.',
      href: '/smartphones?cat=pre-owned',
      cta: 'Browse pre-owned phones',
    },
  },
  { label: 'Pre-Owned', href: '/laptops?cat=pre-owned' },
  { label: 'Deals', href: '/deals', accent: true },
  { label: 'New Arrivals', href: '/new-arrivals' },
  { label: 'Brands', href: '/brands' },
  { label: 'Compare', href: '/compare' },
]

const popularSearches = [
  'MacBook Air M3',
  'iPhone 17 Pro',
  'ThinkPad X1',
  'Galaxy S26 Ultra',
  'RTX 4060',
  'Pre-owned',
  'Dell Latitude',
]

const assurances = [
  { icon: ShieldCheck, text: 'Authenticity guaranteed on every device' },
  { icon: Truck, text: 'Dhaka delivery in 24–48 hours' },
  { icon: MapPin, text: 'A Dhaka showroom you can walk into' },
]

const iconBtn =
  'relative flex h-9 w-9 items-center justify-center rounded-lg text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink'

function CountBubble({ n, tone = 'accent' }: { n: number; tone?: 'accent' | 'ink' }) {
  if (n <= 0) return null
  return (
    <span
      className={`tnum absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold ${
        tone === 'accent' ? 'bg-accent text-on-accent' : 'bg-inverse text-inverse-ink'
      }`}
    >
      {n > 99 ? '99+' : n}
    </span>
  )
}

function Wordmark({ compact }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-inverse font-display text-[13px] font-bold tracking-tight text-inverse-ink">
        SM
      </span>
      <span
        className={`font-display text-[19px] font-semibold tracking-tight text-ink ${
          compact ? '' : 'hidden sm:inline'
        }`}
      >
        SMSTech
        <span className="ml-1 align-super text-[10px] font-medium tracking-[0.14em] text-ink-3">
          BD
        </span>
      </span>
    </span>
  )
}

export default function Header() {
  const {
    cartCount,
    wishlist,
    compareList,
    setCartOpen,
    searchOpen,
    setSearchOpen,
    announcementDismissed,
    dismissAnnouncement,
  } = useApp()
  const { theme, toggleTheme } = useTheme()
  const [activeMega, setActiveMega] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [dbProducts, setDbProducts] = useState<Product[]>([])
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const [authUser, setAuthUser] = useState<{ email: string; initials: string; role?: string } | null>(
    null,
  )
  const [assuranceIndex, setAssuranceIndex] = useState(0)

  const searchRef = useRef<HTMLInputElement>(null)
  const mobileSearchRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const pathname = usePathname()

  // Check Supabase auth state
  useEffect(() => {
    const supabase = createBrowserSupabaseClient()

    async function checkAuth() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user) {
          const firstName = user.user_metadata?.first_name || ''
          const lastName = user.user_metadata?.last_name || ''
          const fullName = [firstName, lastName].filter(Boolean).join(' ')
          const initials = fullName
            ? fullName
                .split(' ')
                .filter(Boolean)
                .map((n: string) => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()
            : (user.email?.[0] || 'U').toUpperCase()

          let role = 'customer'
          try {
            const res = await fetch('/api/v1/auth/me')
            const json = await res.json()
            if (json.success && json.data?.role) {
              role = json.data.role
            }
          } catch {}

          setAuthUser({ email: user.email || '', initials, role })
        } else {
          setAuthUser(null)
        }
      } catch {
        setAuthUser(null)
      }
    }

    checkAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        checkAuth()
      } else if (event === 'SIGNED_OUT') {
        setAuthUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

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

  // Rotate the assurance line rather than cramming all three onto one row
  useEffect(() => {
    if (announcementDismissed) return
    const t = setInterval(() => setAssuranceIndex((i) => (i + 1) % assurances.length), 4500)
    return () => clearInterval(t)
  }, [announcementDismissed])

  // Close overlays on navigation
  useEffect(() => {
    setMobileMenuOpen(false)
    setMobileSearchOpen(false)
    setActiveMega(null)
  }, [pathname])

  // Lock scroll behind the mobile drawer / search sheet
  useEffect(() => {
    const locked = mobileMenuOpen || mobileSearchOpen
    document.body.style.overflow = locked ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileMenuOpen, mobileSearchOpen])

  // Escape closes whatever is open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setMobileMenuOpen(false)
      setMobileSearchOpen(false)
      setSearchOpen(false)
      setActiveMega(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setSearchOpen])

  const filtered =
    query.trim().length > 0
      ? dbProducts
          .filter((p) => {
            const q = query.toLowerCase()
            return (
              p.name.toLowerCase().includes(q) ||
              p.brand.toLowerCase().includes(q) ||
              p.category.toLowerCase().includes(q) ||
              p.subcategory?.toLowerCase().includes(q)
            )
          })
          .slice(0, 6)
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
      {/* Assurance bar */}
      {!announcementDismissed && (
        <div className="relative bg-inverse text-inverse-ink">
          <Container className="flex h-9 items-center justify-center">
            <div className="flex items-center gap-2 text-xs">
              {assurances.map((a, i) => {
                const Icon = a.icon
                return (
                  <span
                    key={a.text}
                    className={`items-center gap-2 ${i === assuranceIndex ? 'flex' : 'hidden'}`}
                  >
                    <Icon className="h-3.5 w-3.5 opacity-70" strokeWidth={2} />
                    <span className="opacity-90">{a.text}</span>
                  </span>
                )
              })}
            </div>
          </Container>
          <button
            onClick={dismissAnnouncement}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 opacity-50 transition-opacity hover:opacity-100"
            aria-label="Dismiss announcement"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
      )}

      <header className="sticky top-0 z-50 border-b border-line bg-surface/85 backdrop-blur-xl">
        <Container className="flex h-16 items-center gap-3 lg:gap-6">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className={`${iconBtn} lg:hidden`}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" strokeWidth={2} />
          </button>

          <Link href="/" className="shrink-0" aria-label="SMSTech BD — home">
            <Wordmark />
          </Link>

          {/* Search */}
          <form onSubmit={handleSearchSubmit} className="relative hidden flex-1 md:block">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"
                strokeWidth={2}
              />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setSearchOpen(true)
                }}
                onFocus={() => setSearchOpen(true)}
                type="text"
                placeholder="Search by model, spec or condition — “MacBook Air M3”, “Grade A iPhone”"
                className="h-10 w-full rounded-lg border border-line bg-surface-2 pl-10 pr-4 text-sm text-ink transition-[border-color,box-shadow,background-color] placeholder:text-ink-3 focus:border-accent focus:bg-surface focus:outline-none focus:ring-3 focus:ring-accent/15"
              />
            </div>

            {searchOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setSearchOpen(false)} />
                <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[480px] overflow-y-auto overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
                  {query.trim().length > 0 ? (
                    filtered.length > 0 ? (
                      <div>
                        <div className="flex items-center justify-between border-b border-line bg-surface-2 px-4 py-2">
                          <span className="eyebrow">
                            {filtered.length} match{filtered.length === 1 ? '' : 'es'}
                          </span>
                          <span className="text-[11px] text-ink-3">Enter for all results</span>
                        </div>

                        {filtered.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleSelectSuggestion(`/product/${p.slug}`)}
                            className="flex w-full items-center gap-3.5 border-b border-line px-4 py-3 text-left transition-colors last:border-0 hover:bg-surface-2"
                          >
                            <img
                              src={p.image}
                              alt=""
                              className="h-12 w-12 shrink-0 rounded-lg border border-line bg-surface-2 object-contain p-1"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium text-ink">{p.name}</div>
                              <div className="mt-1 flex items-center gap-2">
                                <span className="tnum text-[13px] font-medium text-ink">
                                  {formatBDT(p.price)}
                                </span>
                                <span className="text-xs text-ink-3">{p.brand}</span>
                                <ConditionBadge product={p} withIcon={false} />
                              </div>
                            </div>
                            <ArrowRight className="h-4 w-4 shrink-0 text-ink-3" strokeWidth={2} />
                          </button>
                        ))}

                        <button
                          type="submit"
                          className="w-full border-t border-line bg-surface-2 py-3 text-center text-[13px] font-medium text-accent-ink transition-colors hover:bg-accent-soft"
                        >
                          See all results for “{query.trim()}”
                        </button>
                      </div>
                    ) : (
                      <div className="px-5 py-8 text-center">
                        <p className="text-sm font-medium text-ink">No matches for “{query}”</p>
                        <p className="mt-1 text-[13px] text-ink-3">
                          Try a model name, a brand, or a spec like “16GB”.
                        </p>
                      </div>
                    )
                  ) : (
                    <div className="p-5">
                      <p className="eyebrow mb-3">Popular right now</p>
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
                            className="rounded-md border border-line bg-surface-2 px-3 py-1.5 text-[13px] text-ink-2 transition-colors hover:border-accent-line hover:bg-accent-soft hover:text-accent-ink"
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

          {/* Actions */}
          <div className="ml-auto flex shrink-0 items-center gap-0.5">
            <button
              onClick={() => setMobileSearchOpen(true)}
              className={`${iconBtn} md:hidden`}
              aria-label="Search"
            >
              <Search className="h-5 w-5" strokeWidth={2} />
            </button>

            <Link href="/track-order" className="hidden xl:block">
              <span className="flex h-9 items-center gap-2 rounded-lg px-3 text-[13px] font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink">
                <Truck className="h-4 w-4" strokeWidth={2} />
                Track order
              </span>
            </Link>

            <button
              onClick={toggleTheme}
              className={iconBtn}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {theme === 'dark' ? (
                <Sun className="h-5 w-5" strokeWidth={2} />
              ) : (
                <Moon className="h-5 w-5" strokeWidth={2} />
              )}
            </button>

            {authUser && (authUser.role === 'admin' || authUser.role === 'owner') && (
              <Link href="/admin" className="hidden lg:block">
                <span className="flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-[13px] font-medium text-ink-2 transition-colors hover:border-line-2 hover:text-ink">
                  <LayoutDashboard className="h-4 w-4" strokeWidth={2} />
                  Admin
                </span>
              </Link>
            )}

            <Link
              href="/compare"
              className={`${iconBtn} hidden sm:flex`}
              aria-label="Comparison list"
            >
              <ShieldCheck className="h-5 w-5" strokeWidth={2} />
              <CountBubble n={compareList.length} tone="ink" />
            </Link>

            <Link href="/wishlist" className={iconBtn} aria-label="Saved items">
              <Heart className="h-5 w-5" strokeWidth={2} />
              <CountBubble n={wishlist.length} tone="ink" />
            </Link>

            <button onClick={() => setCartOpen(true)} className={iconBtn} aria-label="Open cart">
              <ShoppingBag className="h-5 w-5" strokeWidth={2} />
              <CountBubble n={cartCount} />
            </button>

            <Link
              href={authUser ? '/account' : '/login'}
              className={`${iconBtn} ml-1`}
              aria-label={authUser ? 'My account' : 'Sign in'}
              title={authUser ? 'My account' : 'Sign in'}
            >
              {authUser ? (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-on-accent">
                  {authUser.initials}
                </span>
              ) : (
                <User className="h-5 w-5" strokeWidth={2} />
              )}
            </Link>
          </div>
        </Container>

        {/* Category nav */}
        <nav className="hidden border-t border-line lg:block" onMouseLeave={() => setActiveMega(null)}>
          <Container>
            <ul className="flex items-center">
              {navItems.map((item) => {
                const open = activeMega === item.label
                return (
                  <li
                    key={item.label}
                    className="static"
                    onMouseEnter={() => setActiveMega(item.mega ? item.label : null)}
                  >
                    <Link
                      href={item.href}
                      className={`relative flex items-center gap-1 px-3.5 py-3 text-[13.5px] font-medium transition-colors ${
                        item.accent
                          ? 'text-danger hover:text-danger'
                          : open
                            ? 'text-accent'
                            : 'text-ink-2 hover:text-ink'
                      }`}
                    >
                      {item.label}
                      {item.mega && (
                        <ChevronDown
                          className={`h-3.5 w-3.5 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`}
                          strokeWidth={2.5}
                        />
                      )}
                      {open && (
                        <span className="absolute inset-x-2.5 -bottom-px h-0.5 rounded-full bg-accent" />
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </Container>

          {/* Full-width mega panel */}
          {navItems.map((item) =>
            item.mega && activeMega === item.label ? (
              <div
                key={item.label}
                className="absolute inset-x-0 top-full animate-fade-in border-b border-line bg-surface shadow-lg"
              >
                <Container className="grid grid-cols-12 gap-8 py-8">
                  <div className="col-span-8 grid grid-cols-3 gap-8">
                    {item.mega.map((col) => (
                      <div key={col.heading}>
                        <p className="eyebrow mb-3">{col.heading}</p>
                        <ul className="space-y-0.5">
                          {col.links.map((sub) => (
                            <li key={sub.label}>
                              <Link
                                href={sub.href}
                                className="group -mx-2 block rounded-md px-2 py-1.5 transition-colors hover:bg-surface-2"
                              >
                                <span className="block text-sm font-medium text-ink group-hover:text-accent">
                                  {sub.label}
                                </span>
                                {sub.note && (
                                  <span className="block text-xs text-ink-3">{sub.note}</span>
                                )}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>

                  {item.feature && (
                    <div className="col-span-4">
                      <div className="flex h-full flex-col justify-between rounded-xl border border-line bg-surface-2 p-6">
                        <div>
                          <p className="eyebrow text-certified">{item.feature.eyebrow}</p>
                          <p className="mt-2 font-display text-lg font-semibold tracking-tight text-ink">
                            {item.feature.title}
                          </p>
                          <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
                            {item.feature.body}
                          </p>
                        </div>
                        <Link
                          href={item.feature.href}
                          className="group mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-accent"
                        >
                          {item.feature.cta}
                          <ArrowRight
                            className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                            strokeWidth={2}
                          />
                        </Link>
                      </div>
                    </div>
                  )}
                </Container>
              </div>
            ) : null,
          )}
        </nav>
      </header>

      {/* Mobile search sheet */}
      {mobileSearchOpen && (
        <div className="fixed inset-0 z-60 flex flex-col bg-bg md:hidden">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <form onSubmit={handleSearchSubmit} className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"
                strokeWidth={2}
              />
              <input
                ref={mobileSearchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                type="text"
                placeholder="Search devices…"
                className="h-11 w-full rounded-lg border border-line bg-surface-2 pl-10 pr-3 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:bg-surface focus:outline-none"
              />
            </form>
            <button
              onClick={() => setMobileSearchOpen(false)}
              className="px-2 py-1 text-sm font-medium text-ink-2"
            >
              Cancel
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {query.trim().length > 0 ? (
              filtered.length > 0 ? (
                <ul className="space-y-1">
                  {filtered.map((p) => (
                    <li key={p.id}>
                      <button
                        onClick={() => handleSelectSuggestion(`/product/${p.slug}`)}
                        className="flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition-colors hover:bg-surface-2"
                      >
                        <img
                          src={p.image}
                          alt=""
                          className="h-12 w-12 shrink-0 rounded-lg border border-line bg-surface-2 object-contain p-1"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink">{p.name}</p>
                          <p className="tnum text-[13px] text-ink-2">{formatBDT(p.price)}</p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-10 text-center text-sm text-ink-3">No matches found</p>
              )
            ) : (
              <>
                <p className="eyebrow mb-3">Popular right now</p>
                <div className="flex flex-wrap gap-2">
                  {popularSearches.map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setQuery(s)
                        router.push(`/search?q=${encodeURIComponent(s)}`)
                        setMobileSearchOpen(false)
                      }}
                      className="rounded-md border border-line bg-surface px-3 py-1.5 text-[13px] text-ink-2"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-60 lg:hidden">
          <div
            className="absolute inset-0 animate-fade-in bg-inverse/45 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-[86%] max-w-sm animate-slide-in-left flex-col bg-surface shadow-lg">
            <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
              <Wordmark compact />
              <button
                onClick={() => setMobileMenuOpen(false)}
                className={iconBtn}
                aria-label="Close menu"
              >
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <nav className="p-3">
                {navItems.map((item) => (
                  <div key={item.label} className="mb-1">
                    <Link
                      href={item.href}
                      className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-[15px] font-medium transition-colors hover:bg-surface-2 ${
                        item.accent ? 'text-danger' : 'text-ink'
                      }`}
                    >
                      {item.label}
                      <ArrowRight className="h-4 w-4 text-ink-3" strokeWidth={2} />
                    </Link>
                    {item.mega && (
                      <div className="mb-2 ml-3 mt-1 border-l border-line pl-3">
                        {item.mega
                          .flatMap((c) => c.links)
                          .slice(0, 5)
                          .map((sub) => (
                            <Link
                              key={sub.href + sub.label}
                              href={sub.href}
                              className="block rounded-md px-2 py-1.5 text-[13.5px] text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
                            >
                              {sub.label}
                            </Link>
                          ))}
                      </div>
                    )}
                  </div>
                ))}
              </nav>

              <div className="border-t border-line p-3">
                <p className="eyebrow px-3 pb-2">Your account</p>
                {[
                  { label: authUser ? 'My account' : 'Sign in', href: authUser ? '/account' : '/login' },
                  { label: 'Track an order', href: '/track-order' },
                  { label: 'Saved items', href: '/wishlist' },
                  { label: 'Our stores', href: '/stores' },
                  { label: 'Help & FAQ', href: '/faq' },
                ].map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="block rounded-lg px-3 py-2 text-sm text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
                  >
                    {l.label}
                  </Link>
                ))}
                {authUser && (authUser.role === 'admin' || authUser.role === 'owner') && (
                  <Link
                    href="/admin"
                    className="mt-2 flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink"
                  >
                    <LayoutDashboard className="h-4 w-4" strokeWidth={2} />
                    Admin portal
                  </Link>
                )}
              </div>
            </div>

            <div className="border-t border-line p-4">
              <div className="flex items-start gap-2.5 text-xs text-ink-3">
                <ShieldCheck className="mt-px h-4 w-4 shrink-0 text-verified" strokeWidth={2} />
                <span>
                  Every device — new or pre-owned — is inspected, graded and warranty-backed.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

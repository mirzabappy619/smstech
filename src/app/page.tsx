'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  BadgeCheck,
  BatteryCharging,
  ChevronDown,
  ClipboardCheck,
  Clock,
  Cpu,
  MapPin,
  Package,
  Phone,
  RotateCcw,
  ShieldCheck,
  Store,
  Truck,
} from 'lucide-react'
import ProductCard from '../components/ProductCard'
import HeroSlider from '../components/HeroSlider'
import Container from '../components/ui/container'
import SectionHeading from '../components/ui/section'
import { ProductGridSkeleton } from '../components/ui/skeleton'
import { isPreOwned } from '../components/ui/condition'
import { brands, normalizeProduct, Product } from '../data/products'
import { stores } from '../data/stores'

const fallbackCategories = [
  {
    name: 'Laptops',
    desc: 'Work, study and gaming machines',
    count: 48,
    href: '/laptops',
    img: 'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=600&h=450&fit=crop&auto=format',
  },
  {
    name: 'Smartphones',
    desc: 'Flagship and mid-range handsets',
    count: 64,
    href: '/smartphones',
    img: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=600&h=450&fit=crop&auto=format',
  },
  {
    name: 'Gaming laptops',
    desc: 'RTX and Radeon, built to sustain',
    count: 18,
    href: '/laptops?cat=gaming',
    img: 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=600&h=450&fit=crop&auto=format',
  },
  {
    name: 'MacBook',
    desc: 'Apple silicon, new and pre-owned',
    count: 12,
    href: '/laptops?brand=apple',
    img: 'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=600&h=450&fit=crop&auto=format',
  },
  {
    name: 'iPhone',
    desc: 'Sealed units and graded pre-owned',
    count: 14,
    href: '/smartphones?brand=apple',
    img: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&h=450&fit=crop&auto=format',
  },
  {
    name: 'Android',
    desc: 'Samsung, Xiaomi, OnePlus, Pixel',
    count: 50,
    href: '/smartphones?cat=android',
    img: 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=600&h=450&fit=crop&auto=format',
  },
]

const laptopTabs = ['Gaming', 'Business', 'Student', 'Creator', 'Premium', 'MacBook']
const phoneTabs = ['iPhone', 'Samsung', 'Xiaomi', 'OnePlus', 'Google']

const inspectionSteps = [
  {
    icon: ClipboardCheck,
    step: '01',
    title: 'Sourced and logged',
    body: 'Each device is bought through authorised channels or verified trade-ins, then logged against its serial or IMEI.',
  },
  {
    icon: Cpu,
    step: '02',
    title: '32-point inspection',
    body: 'Display, chassis, ports, keyboard, thermals, storage health and every radio are tested by hand, not sampled.',
  },
  {
    icon: BatteryCharging,
    step: '03',
    title: 'Graded and published',
    body: 'We assign a grade from A to C, publish the measured battery capacity, and photograph any cosmetic marks.',
  },
  {
    icon: ShieldCheck,
    step: '04',
    title: 'Warranty attached',
    body: 'New devices carry full manufacturer warranty; pre-owned units ship with six months of SMSTech cover.',
  },
]

const reviews = [
  {
    name: 'Rahim Hossain',
    product: 'ASUS ROG Strix G16',
    rating: 5,
    text: 'The spec sheet on the site matched the machine exactly. No surprises, no missing accessories, and the team talked me out of a model I did not need.',
    city: 'Dhaka',
  },
  {
    name: 'Priya Das',
    product: 'iPhone 17 Pro',
    rating: 5,
    text: 'Sealed unit with full Apple warranty registered to my name. Ordering was straightforward and it arrived the next morning.',
    city: 'Chittagong',
  },
  {
    name: 'Karim Ahmed',
    product: 'MacBook Air M3',
    rating: 5,
    text: 'I went into the Multiplan store to compare two configurations side by side. Being able to hold the machine before buying made the decision easy.',
    city: 'Dhaka',
  },
  {
    name: 'Tasnim Akter',
    product: 'Samsung Galaxy S26',
    rating: 4,
    text: 'Bought a Grade A pre-owned handset. The listed battery health was accurate and the cosmetic photos were honest about a small mark.',
    city: 'Rajshahi',
  },
]

const faqs = [
  {
    q: 'How do you grade pre-owned devices?',
    a: 'Every pre-owned device passes a 32-point inspection covering the display, chassis, ports, keyboard, thermals, storage health and all radios. We then assign a grade — A+ (open box, unused), A (excellent, no marks visible at arm’s length), B (minor cosmetic marks) or C (visible wear, fully functional) — and publish the measured battery capacity alongside it.',
  },
  {
    q: 'What warranty comes with my purchase?',
    a: 'Brand new devices carry the full manufacturer warranty, typically 1–2 years for laptops and 1 year for smartphones. Certified pre-owned devices ship with six months of SMSTech cover on hardware faults. The exact term is stated on every product page.',
  },
  {
    q: 'Are the products genuine?',
    a: 'Yes. New stock is sourced through authorised brand distributors, and every pre-owned unit is logged against its serial number or IMEI before listing. If a device ever fails an authenticity check, we refund in full.',
  },
  {
    q: 'Can I order online and collect from a store?',
    a: 'Yes. Choose Store Pickup at checkout and select your preferred SMSTech branch. We will notify you as soon as the device is inspected and ready — usually the same day.',
  },
  {
    q: 'How long does delivery take?',
    a: 'Dhaka metro orders are typically delivered within 24–48 hours. Outside Dhaka takes 2–4 business days depending on the location.',
  },
  {
    q: 'What if I change my mind?',
    a: 'You have seven days from delivery to return a device in its original condition for a refund. Warranty claims are handled separately and run for the full term stated on the product page.',
  },
]

export default function Home() {
  const [laptopTab, setLaptopTab] = useState('Gaming')
  const [phoneTab, setPhoneTab] = useState('iPhone')
  const [countdown, setCountdown] = useState({ h: 11, m: 43, s: 22 })
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const [allDbProducts, setAllDbProducts] = useState<Product[]>([])
  const [dbCategories, setDbCategories] = useState(fallbackCategories)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadDb() {
      try {
        const [prodRes, catRes] = await Promise.all([
          fetch('/api/v1/products?show_all=true&limit=100').catch(() => null),
          fetch('/api/v1/categories').catch(() => null),
        ])

        if (prodRes && prodRes.ok) {
          const json = await prodRes.json()
          if (json.success && Array.isArray(json.data)) {
            setAllDbProducts(json.data.map(normalizeProduct))
          }
        }

        if (catRes && catRes.ok) {
          const catJson = await catRes.json()
          if (catJson.success && Array.isArray(catJson.data) && catJson.data.length > 0) {
            const mapped = catJson.data.map((c: any, index: number) => {
              const fallback = fallbackCategories[index % fallbackCategories.length]
              return {
                name: c.name,
                desc: c.description || fallback.desc,
                count: c.product_count || fallback.count,
                href:
                  c.slug === 'laptops'
                    ? '/laptops'
                    : c.slug === 'smartphones'
                      ? '/smartphones'
                      : `/search?category=${encodeURIComponent(c.slug)}`,
                img: c.image_url || fallback.img,
              }
            })
            if (mapped.length > 0) setDbCategories(mapped)
          }
        }
      } catch (e) {
        console.error('Failed to load homepage data from db:', e)
      } finally {
        setLoading(false)
      }
    }
    loadDb()
  }, [])

  useEffect(() => {
    const t = setInterval(() => {
      setCountdown((prev) => {
        let { h, m, s } = prev
        s--
        if (s < 0) {
          s = 59
          m--
        }
        if (m < 0) {
          m = 59
          h--
        }
        if (h < 0) {
          h = 23
        }
        return { h, m, s }
      })
    }, 1000)
    return () => clearInterval(t)
  }, [])

  const laptops = allDbProducts.filter(
    (p) => p.category === 'laptop' || p.subcategory === 'macbook' || p.subcategory === 'gaming',
  )
  const smartphones = allDbProducts.filter(
    (p) =>
      p.category === 'smartphone' ||
      p.subcategory === 'flagship' ||
      p.subcategory === 'mid-range',
  )
  const preOwned = allDbProducts.filter(isPreOwned)

  const filteredLaptops = laptops
    .filter((l) => {
      if (laptopTab === 'MacBook') return l.brand === 'Apple'
      if (laptopTab === 'Premium') return l.price >= 200000
      return l.subcategory === laptopTab.toLowerCase()
    })
    .slice(0, 4)

  const filteredPhones = smartphones
    .filter((p) => {
      const tab = phoneTab.toLowerCase()
      if (tab === 'iphone') return p.brand === 'Apple'
      if (tab === 'samsung') return p.brand === 'Samsung'
      if (tab === 'xiaomi') return p.brand === 'Xiaomi'
      if (tab === 'oneplus') return p.brand === 'OnePlus'
      if (tab === 'google') return p.brand === 'Google'
      return true
    })
    .slice(0, 4)

  const deals = allDbProducts
    .filter((p) => p.badges.includes('Hot Deal') || p.originalPrice > p.price)
    .slice(0, 4)

  const newArrivals = [...laptops, ...smartphones].filter((p) => p.isNew).slice(0, 4)

  const pad = (n: number) => String(n).padStart(2, '0')

  const tabClass = (active: boolean) =>
    `shrink-0 rounded-lg border px-3.5 py-2 text-[13px] font-medium transition-colors ${
      active
        ? 'border-ink bg-inverse text-inverse-ink'
        : 'border-line bg-surface text-ink-2 hover:border-line-2 hover:text-ink'
    }`

  return (
    <>
      <HeroSlider />

      {/* Assurance strip */}
      <section className="border-b border-line bg-surface-2">
        <Container>
          <ul className="grid grid-cols-2 divide-line md:grid-cols-4 md:divide-x">
            {[
              { Icon: BadgeCheck, t: 'Authenticity guaranteed', s: 'Serial & IMEI logged' },
              { Icon: ShieldCheck, t: 'Warranty on everything', s: 'Including pre-owned' },
              { Icon: Truck, t: 'Nationwide delivery', s: '24–48 hrs in Dhaka' },
              { Icon: RotateCcw, t: '7-day returns', s: 'No restocking fee' },
            ].map(({ Icon, t, s }) => (
              <li key={t} className="flex items-center gap-3 px-1 py-5 md:justify-center md:px-4">
                <Icon className="h-5 w-5 shrink-0 text-ink-3" strokeWidth={1.75} />
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-ink">{t}</p>
                  <p className="truncate text-xs text-ink-3">{s}</p>
                </div>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* Categories */}
      <Container as="section" className="py-16 md:py-20">
        <SectionHeading
          eyebrow="Browse"
          title="Shop by category"
          lede="Every listing states its condition, warranty term and stock location up front."
        />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {dbCategories.slice(0, 6).map((cat) => (
            <Link
              key={cat.name}
              href={cat.href}
              className="group overflow-hidden rounded-xl border border-line bg-surface transition-[border-color,box-shadow] hover:border-line-2 hover:shadow-md"
            >
              <div className="aspect-[4/3] overflow-hidden bg-surface-2">
                <img
                  src={cat.img}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="p-3.5">
                <h3 className="text-sm font-semibold tracking-tight text-ink group-hover:text-accent">
                  {cat.name}
                </h3>
                <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-ink-3">{cat.desc}</p>
                <p className="tnum mt-2 text-xs text-ink-3">{cat.count} listings</p>
              </div>
            </Link>
          ))}
        </div>
      </Container>

      {/* Deals */}
      <section className="border-y border-line bg-inverse text-inverse-ink">
        <Container className="py-16 md:py-20">
          <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow" style={{ color: 'inherit', opacity: 0.55 }}>
                Limited time
              </p>
              <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight md:text-[32px]">
                Today&rsquo;s best prices
              </h2>
              <p className="mt-2 max-w-xl text-[15px] opacity-70">
                Reduced units, open-box returns and end-of-line stock — all covered by the same
                warranty and return terms.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-[13px] opacity-60">
                <Clock className="h-3.5 w-3.5" strokeWidth={2} />
                Ends in
              </span>
              <div className="flex gap-1.5">
                {(
                  [
                    [pad(countdown.h), 'hr'],
                    [pad(countdown.m), 'min'],
                    [pad(countdown.s), 'sec'],
                  ] as const
                ).map(([v, l]) => (
                  <div
                    key={l}
                    className="flex h-14 w-14 flex-col items-center justify-center rounded-lg border border-white/15 bg-white/5"
                  >
                    <span className="tnum font-display text-lg font-semibold leading-none">
                      {v}
                    </span>
                    <span className="mt-1 text-[10px] uppercase tracking-wider opacity-50">
                      {l}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {loading ? (
            <ProductGridSkeleton />
          ) : deals.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {deals.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-white/10 bg-white/5 px-5 py-10 text-center text-sm opacity-60">
              No active deals right now — check back soon.
            </p>
          )}

          <div className="mt-8 text-center">
            <Link
              href="/deals"
              className="group inline-flex h-11 items-center gap-2 rounded-lg border border-white/20 px-6 text-sm font-medium transition-colors hover:bg-white/10"
            >
              View all deals
              <ArrowRight
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                strokeWidth={2}
              />
            </Link>
          </div>
        </Container>
      </section>

      {/* Laptops */}
      <Container as="section" className="py-16 md:py-20">
        <SectionHeading
          eyebrow="Laptops"
          title="Find the right machine"
          lede="Filtered by what you actually do with it, not by marketing tier."
          href="/laptops"
          linkLabel="All laptops"
        />
        <div className="mb-6 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {laptopTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setLaptopTab(tab)}
              className={tabClass(laptopTab === tab)}
            >
              {tab}
            </button>
          ))}
        </div>
        {loading ? (
          <ProductGridSkeleton />
        ) : (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {(filteredLaptops.length > 0 ? filteredLaptops : laptops.slice(0, 4)).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </Container>

      {/* How we verify — the trust centrepiece */}
      <section id="verification" className="border-y border-line bg-surface">
        <Container className="py-16 md:py-24">
          <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-5">
              <p className="eyebrow">Our process</p>
              <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink md:text-[34px] md:leading-[1.12]">
                Buying used shouldn&rsquo;t mean buying blind
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
                Most of the risk in second-hand electronics comes from missing information. So we
                publish it — the grade, the battery capacity, the cosmetic marks and the warranty
                term — on every single listing, before you commit.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/laptops?cat=pre-owned"
                  className="group inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-5 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover"
                >
                  Browse certified pre-owned
                  <ArrowRight
                    className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                    strokeWidth={2}
                  />
                </Link>
                <Link
                  href="/about#grading"
                  className="inline-flex h-11 items-center rounded-lg border border-line px-5 text-sm font-medium text-ink transition-colors hover:border-line-2 hover:bg-surface-2"
                >
                  How grading works
                </Link>
              </div>
            </div>

            <ol className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:col-span-7">
              {inspectionSteps.map(({ icon: Icon, step, title, body }) => (
                <li key={step} className="bg-surface p-6">
                  <div className="flex items-center justify-between">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface-2 text-ink">
                      <Icon className="h-4 w-4" strokeWidth={2} />
                    </span>
                    <span className="tnum font-display text-xs font-semibold tracking-widest text-ink-3">
                      {step}
                    </span>
                  </div>
                  <h3 className="mt-4 text-[15px] font-semibold tracking-tight text-ink">
                    {title}
                  </h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </Container>
      </section>

      {/* Certified pre-owned */}
      {(loading || preOwned.length > 0) && (
        <Container as="section" className="py-16 md:py-20">
          <SectionHeading
            eyebrow="Certified pre-owned"
            title="High-end devices, honestly graded"
            lede="Inspected across 32 points, graded A to C, and covered for six months."
            href="/laptops?cat=pre-owned"
            linkLabel="All pre-owned"
          />
          {loading ? (
            <ProductGridSkeleton />
          ) : (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {preOwned.slice(0, 4).map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </Container>
      )}

      {/* Smartphones */}
      <section className="border-y border-line bg-surface-2">
        <Container className="py-16 md:py-20">
          <SectionHeading
            eyebrow="Smartphones"
            title="Flagship to mid-range"
            lede="Every pre-owned handset lists its measured battery capacity."
            href="/smartphones"
            linkLabel="All smartphones"
          />
          <div className="mb-6 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {phoneTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setPhoneTab(tab)}
                className={tabClass(phoneTab === tab)}
              >
                {tab}
              </button>
            ))}
          </div>
          {loading ? (
            <ProductGridSkeleton />
          ) : (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {(filteredPhones.length > 0 ? filteredPhones : smartphones.slice(0, 4)).map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </Container>
      </section>

      {/* New arrivals */}
      {(loading || newArrivals.length > 0) && (
        <Container as="section" className="py-16 md:py-20">
          <SectionHeading
            eyebrow="Just landed"
            title="New arrivals"
            href="/new-arrivals"
            linkLabel="All new arrivals"
          />
          {loading ? (
            <ProductGridSkeleton />
          ) : (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {newArrivals.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </Container>
      )}

      {/* Brands */}
      <section className="border-y border-line bg-surface">
        <Container className="py-16 md:py-20">
          <SectionHeading
            align="center"
            eyebrow="Authorised & verified"
            title="Shop by brand"
            lede="We stock the brands people actually keep for five years."
          />
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4 lg:grid-cols-6">
            {brands.map((brand) => (
              <Link
                key={brand.name}
                href={`/brand/${brand.slug}`}
                className="group flex flex-col items-center justify-center gap-2.5 bg-surface px-3 py-7 transition-colors hover:bg-surface-2"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-surface-2 font-display text-[13px] font-bold tracking-tight text-ink-2 transition-colors group-hover:border-accent-line group-hover:bg-accent-soft group-hover:text-accent-ink">
                  {brand.mark}
                </span>
                <span className="text-[13px] font-medium text-ink">{brand.name}</span>
                <span className="tnum text-[11px] text-ink-3">{brand.count} listings</span>
              </Link>
            ))}
          </div>
        </Container>
      </section>

      {/* Stores */}
      <Container as="section" className="py-16 md:py-20">
        <SectionHeading
          eyebrow="In person"
          title="Come and hold it first"
          lede="Inspect any device — including graded pre-owned stock — before you pay a taka."
          href="/stores"
          linkLabel="Store locator"
        />
        <div className="grid gap-4 md:grid-cols-2">
          {stores.map((store) => (
            <article
              key={store.id}
              className="overflow-hidden rounded-xl border border-line bg-surface"
            >
              <div className="relative aspect-[16/7] overflow-hidden bg-surface-2">
                <img
                  src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=900&h=500&fit=crop&auto=format"
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="p-5">
                <h3 className="font-display text-base font-semibold tracking-tight text-ink">
                  {store.name}
                </h3>
                <ul className="mt-3 space-y-2 text-[13px] text-ink-2">
                  <li className="flex gap-2.5">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-3" strokeWidth={2} />
                    <span className="leading-relaxed">{store.address}</span>
                  </li>
                  <li className="flex gap-2.5">
                    <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-3" strokeWidth={2} />
                    <span className="tnum">{store.phone}</span>
                  </li>
                  <li className="flex gap-2.5">
                    <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-3" strokeWidth={2} />
                    <span>{store.hours}</span>
                  </li>
                </ul>
                <div className="mt-5 flex gap-2">
                  <a
                    href={`https://www.google.com/maps?q=${encodeURIComponent(store.mapQuery)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-line text-[13px] font-medium text-ink transition-colors hover:border-line-2 hover:bg-surface-2"
                  >
                    <MapPin className="h-3.5 w-3.5" strokeWidth={2} />
                    Directions
                  </a>
                  <Link
                    href="/stores"
                    className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-accent text-[13px] font-medium text-on-accent transition-colors hover:bg-accent-hover"
                  >
                    <Store className="h-3.5 w-3.5" strokeWidth={2} />
                    Store details
                  </Link>
                </div>
              </div>
            </article>
          ))}

          {/* Pickup rather than a second address we cannot actually send anyone to */}
          <article className="flex flex-col justify-between rounded-xl border border-line bg-surface-2 p-6">
            <div>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-ink">
                <Store className="h-4 w-4" strokeWidth={2} />
              </span>
              <h3 className="mt-4 font-display text-base font-semibold tracking-tight text-ink">
                Reserve for in-store pickup
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
                Order online, choose Store Pickup, and we hold the exact unit for you — inspected,
                graded and boxed. High-end pre-owned stock is one-of-one, so reserving is the only
                way to be sure it is still there when you arrive.
              </p>
            </div>
            <Link
              href="/laptops"
              className="group mt-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-accent"
            >
              Browse what is in stock
              <ArrowRight
                className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                strokeWidth={2}
              />
            </Link>
          </article>
        </div>
      </Container>

      {/* Reviews */}
      <section className="border-y border-line bg-surface-2">
        <Container className="py-16 md:py-20">
          <SectionHeading
            eyebrow="Verified buyers"
            title="What customers say"
            lede="Reviews from confirmed orders only."
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {reviews.map((r) => (
              <figure
                key={r.name}
                className="flex flex-col rounded-xl border border-line bg-surface p-5"
              >
                <div className="flex items-center gap-1.5">
                  <span className="tnum font-display text-sm font-semibold text-ink">
                    {r.rating}.0
                  </span>
                  <span className="text-xs text-ink-3">/ 5</span>
                </div>
                <blockquote className="mt-3 flex-1 text-[13.5px] leading-relaxed text-ink-2">
                  {r.text}
                </blockquote>
                <figcaption className="mt-5 border-t border-line pt-4">
                  <p className="text-[13px] font-medium text-ink">{r.name}</p>
                  <p className="text-xs text-ink-3">{r.city}</p>
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-verified">
                    <BadgeCheck className="h-3.5 w-3.5" strokeWidth={2} />
                    Verified purchase · {r.product}
                  </p>
                </figcaption>
              </figure>
            ))}
          </div>
        </Container>
      </section>

      {/* FAQ */}
      <Container as="section" className="py-16 md:py-20">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-4">
            <p className="eyebrow">Answers</p>
            <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink md:text-[32px]">
              Questions worth asking
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
              Still unsure about something? Our team answers within a few hours, seven days a week.
            </p>
            <Link
              href="/contact"
              className="group mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-accent"
            >
              Talk to us
              <ArrowRight
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                strokeWidth={2}
              />
            </Link>
          </div>

          <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface lg:col-span-8">
            {faqs.map((f, i) => {
              const open = openFaq === i
              return (
                <div key={f.q}>
                  <h3>
                    <button
                      onClick={() => setOpenFaq(open ? null : i)}
                      aria-expanded={open}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-surface-2"
                    >
                      <span className="text-[14.5px] font-medium tracking-tight text-ink">
                        {f.q}
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-ink-3 transition-transform ${open ? 'rotate-180' : ''}`}
                        strokeWidth={2}
                      />
                    </button>
                  </h3>
                  {open && (
                    <div className="animate-fade-in px-5 pb-5">
                      <p className="max-w-2xl text-[13.5px] leading-relaxed text-ink-2">{f.a}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </Container>

      {/* Newsletter */}
      <Container as="section" className="pb-20">
        <div className="bg-grid overflow-hidden rounded-2xl border border-line bg-surface px-6 py-12 text-center md:px-12 md:py-16">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-surface-2 text-ink-2">
            <Package className="h-4.5 w-4.5" strokeWidth={1.75} />
          </span>
          <h2 className="mx-auto mt-5 max-w-xl font-display text-2xl font-semibold tracking-tight text-ink md:text-[30px]">
            Get first refusal on graded stock
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-[15px] leading-relaxed text-ink-2">
            High-end pre-owned units sell within days. We email a short list when new inventory
            passes inspection — nothing else.
          </p>
          <form
            className="mx-auto mt-7 flex max-w-md flex-col gap-2 sm:flex-row"
            onSubmit={(e) => e.preventDefault()}
          >
            <label htmlFor="newsletter-email" className="sr-only">
              Email address
            </label>
            <input
              id="newsletter-email"
              type="email"
              required
              placeholder="you@example.com"
              className="h-12 flex-1 rounded-lg border border-line bg-surface px-4 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
            />
            <button
              type="submit"
              className="inline-flex h-12 items-center justify-center rounded-lg bg-accent px-6 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover"
            >
              Notify me
            </button>
          </form>
          <p className="mt-3 text-xs text-ink-3">
            Roughly one email a week. Unsubscribe in one click.
          </p>
        </div>
      </Container>
    </>
  )
}

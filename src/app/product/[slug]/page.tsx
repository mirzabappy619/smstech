'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowRight,
  BatteryCharging,
  CalendarClock,
  Check,
  CheckCircle2,
  GitCompareArrows,
  Heart,
  MapPin,
  Package,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck,
  X,
} from 'lucide-react'
import { useApp } from '../../../store/AppContext'
import { normalizeProduct, Product } from '../../../data/products'
import { stores } from '../../../data/stores'
import ProductCard from '../../../components/ProductCard'
import Container from '../../../components/ui/container'
import { Breadcrumbs } from '../../../components/CollectionView'
import Price, { formatBDT } from '../../../components/ui/price'
import Rating from '../../../components/ui/rating'
import { Skeleton } from '../../../components/ui/skeleton'
import {
  CONDITION_META,
  ConditionPanel,
  isPreOwned,
  resolveCondition,
} from '../../../components/ui/condition'
import { trackMetaViewContent } from '@/presentation/components/meta-pixel'

const TABS = [
  'Overview',
  'Specifications',
  'Condition report',
  'Availability',
  'Warranty & returns',
] as const
type Tab = (typeof TABS)[number]

const INSPECTION_CHECKS = [
  'Display — dead pixels, backlight bleed, brightness uniformity',
  'Chassis and hinges — structural integrity, cosmetic marks logged',
  'Keyboard and trackpad — every key actuated, gestures verified',
  'All ports — USB, Thunderbolt, HDMI, audio, card reader',
  'Wireless — Wi-Fi, Bluetooth, and cellular radios where fitted',
  'Storage health — SMART data read, remaining endurance recorded',
  'Thermals — sustained load test, fan noise and throttling checked',
  'Battery — measured capacity against original design capacity',
]

export default function ProductDetail() {
  const params = useParams()
  const router = useRouter()
  const slug = (params?.slug as string) || ''
  const [product, setProduct] = useState<Product | null>(null)
  const [related, setRelated] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  const { addToCart, toggleWishlist, isWishlisted, addToCompare, isCompared } = useApp()
  const [activeImage, setActiveImage] = useState(0)
  const [activeTab, setActiveTab] = useState<Tab>('Overview')
  const [selectedVariant, setSelectedVariant] = useState(0)
  const [selectedColor, setSelectedColor] = useState(0)

  // Pre-booking modal
  const [showPreBookingModal, setShowPreBookingModal] = useState(false)
  const [pbName, setPbName] = useState('')
  const [pbPhone, setPbPhone] = useState('')
  const [pbEmail, setPbEmail] = useState('')
  const [pbSubmitting, setPbSubmitting] = useState(false)
  const [pbError, setPbError] = useState<string | null>(null)
  const [pbSuccess, setPbSuccess] = useState<any | null>(null)

  useEffect(() => {
    async function loadSingleProductFromDb() {
      if (!slug) return
      try {
        setLoading(true)
        const res = await fetch(`/api/v1/products/${encodeURIComponent(slug)}`)
        const json = await res.json()
        if (json.success && json.data) {
          const norm = normalizeProduct(json.data)
          setProduct(norm)
          setActiveImage(0)

          try {
            trackMetaViewContent({
              productId: norm.id,
              productName: norm.name,
              price: norm.price,
              currency: 'BDT',
            })
          } catch {}

          const relRes = await fetch('/api/v1/products?show_all=true&limit=10')
          const relJson = await relRes.json()
          if (relJson.success && Array.isArray(relJson.data)) {
            setRelated(
              relJson.data
                .map(normalizeProduct)
                .filter((p: Product) => p.slug !== norm.slug)
                .slice(0, 4),
            )
          }
        }
      } catch (e) {
        console.error('Failed to load product from database:', e)
      } finally {
        setLoading(false)
      }
    }
    loadSingleProductFromDb()
  }, [slug])

  if (loading) {
    return (
      <Container className="py-10">
        <div className="grid gap-10 lg:grid-cols-2">
          <Skeleton className="aspect-square w-full rounded-xl" />
          <div className="space-y-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-9 w-4/5" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
        </div>
      </Container>
    )
  }

  if (!product) {
    return (
      <Container className="py-24 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-surface-2 text-ink-3">
          <Package className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight text-ink">
          We couldn&rsquo;t find that device
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-[14px] leading-relaxed text-ink-2">
          It may have sold, or the link may be out of date. Our current stock is listed below.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Link
            href="/laptops"
            className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover"
          >
            Browse laptops
          </Link>
          <Link
            href="/smartphones"
            className="inline-flex h-10 items-center rounded-lg border border-line px-4 text-sm font-medium text-ink transition-colors hover:border-line-2 hover:bg-surface-2"
          >
            Browse phones
          </Link>
        </div>
      </Container>
    )
  }

  const wishlisted = isWishlisted(product.id)
  const compared = isCompared(product.id)
  const grade = resolveCondition(product)
  const gradeMeta = CONDITION_META[grade]
  const preOwned = isPreOwned(product)

  const currentPrice = product.variants?.[selectedVariant]?.price ?? product.price
  const originalPrice = Math.max(product.originalPrice, currentPrice)

  const isPreorder = Boolean(product.isPreorder)
  const depositPct = Number(product.preorderDepositPct) || 10
  const requiredAdvance = Math.round(currentPrice * (depositPct / 100))
  const releaseDate = product.preorderReleaseDate
    ? new Date(product.preorderReleaseDate).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null

  // Only surface locations we can actually send someone to.
  const stockLocations = [
    { label: 'Online — ships nationwide', available: product.storeAvailability?.online, Icon: Truck },
    ...stores.map((store) => ({
      label: `${store.name} — ${store.area}`,
      available: product.storeAvailability?.[store.key],
      Icon: Store,
    })),
  ]

  const variantLabel = product.variants?.[selectedVariant]?.label
  const cartVariant = [variantLabel, product.colors?.[selectedColor], gradeMeta.short]
    .filter(Boolean)
    .join(' · ')

  const handlePreBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPbError(null)
    if (!pbName.trim() || !pbPhone.trim()) {
      setPbError('Please provide your name and phone number.')
      return
    }
    setPbSubmitting(true)
    try {
      const res = await fetch('/api/v1/pre-bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: pbName,
          customer_phone: pbPhone,
          customer_email: pbEmail,
          product_id: product.id,
          total_price: currentPrice,
          advance_paid: requiredAdvance,
          payment_method: 'bkash',
        }),
      })
      const json = await res.json()
      if (json.success) setPbSuccess(json.data)
      else setPbError(json.error || 'Failed to submit pre-booking. Please try again.')
    } catch (err: any) {
      setPbError(err?.message || 'Something went wrong. Please try again.')
    } finally {
      setPbSubmitting(false)
    }
  }

  const specEntries = Object.entries(product.specs)

  return (
    <Container className="py-8 md:py-10">
      <Breadcrumbs
        items={[
          { label: `${product.category}s`, href: `/${product.category}s` },
          { label: product.name },
        ]}
      />

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
        {/* Gallery */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="relative overflow-hidden rounded-xl border border-line bg-surface-2">
            <img
              src={product.images[activeImage] || product.image}
              alt={product.name}
              className="aspect-square w-full object-contain p-8"
            />
            <span
              className={`absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium ${
                gradeMeta.tone === 'verified'
                  ? 'border-verified-line bg-verified-soft text-verified'
                  : 'border-certified-line bg-certified-soft text-certified'
              }`}
            >
              <ShieldCheck className="h-3 w-3" strokeWidth={2.25} />
              {gradeMeta.label}
            </span>
          </div>

          {product.images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {product.images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImage(i)}
                  aria-label={`View image ${i + 1}`}
                  aria-current={activeImage === i}
                  className={`h-18 w-18 shrink-0 overflow-hidden rounded-lg border bg-surface-2 p-1 transition-colors ${
                    activeImage === i ? 'border-accent' : 'border-line hover:border-line-2'
                  }`}
                >
                  <img src={img} alt="" className="h-full w-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Buy box */}
        <div>
          <p className="eyebrow">{product.brand}</p>
          <h1 className="mt-2 font-display text-[26px] font-semibold leading-tight tracking-[-0.025em] text-ink md:text-[34px]">
            {product.name}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            {product.reviews > 0 && <Rating value={product.rating} count={product.reviews} />}
            <span className="tnum text-xs text-ink-3">
              SKU SMST-{product.id.slice(0, 8).toUpperCase()}
            </span>
          </div>

          {product.shortSpec && (
            <p className="mt-4 text-[15px] leading-relaxed text-ink-2">{product.shortSpec}</p>
          )}

          {/* Condition — states what this listing actually is */}
          <div className="mt-6">
            <ConditionPanel product={product} />
          </div>

          {/* Price */}
          <div className="mt-6 rounded-xl border border-line bg-surface-2 p-5">
            <Price price={currentPrice} original={originalPrice} size="xl" />
            {originalPrice > currentPrice && (
              <p className="tnum mt-2 text-[13px] font-medium text-verified">
                You save {formatBDT(originalPrice - currentPrice)}
              </p>
            )}
            <p className="tnum mt-3 border-t border-line pt-3 text-[13px] text-ink-2">
              Or about {formatBDT(currentPrice / 12)}/month over 12 months with bank EMI.
            </p>
          </div>

          {/* Variants */}
          {product.variants && product.variants.length > 0 && (
            <fieldset className="mt-6">
              <legend className="eyebrow mb-2.5">Configuration</legend>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v, i) => (
                  <button
                    key={`${v.label}-${i}`}
                    onClick={() => setSelectedVariant(i)}
                    aria-pressed={selectedVariant === i}
                    className={`rounded-lg border px-3.5 py-2 text-[13px] font-medium transition-colors ${
                      selectedVariant === i
                        ? 'border-ink bg-inverse text-inverse-ink'
                        : 'border-line text-ink-2 hover:border-line-2 hover:text-ink'
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {/* Colours */}
          {product.colors && product.colors.length > 0 && (
            <fieldset className="mt-6">
              <legend className="eyebrow mb-2.5">
                Finish — <span className="normal-case tracking-normal text-ink">{product.colors[selectedColor]}</span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {product.colors.map((c, i) => (
                  <button
                    key={c}
                    onClick={() => setSelectedColor(i)}
                    aria-pressed={selectedColor === i}
                    className={`rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors ${
                      selectedColor === i
                        ? 'border-ink bg-inverse text-inverse-ink'
                        : 'border-line text-ink-2 hover:border-line-2 hover:text-ink'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {/* Stock */}
          <div className="mt-6 flex items-center gap-2 text-[13px]">
            {isPreorder ? (
              <span className="inline-flex items-center gap-1.5 text-accent-ink">
                <CalendarClock className="h-4 w-4" strokeWidth={2} />
                {releaseDate ? `Expected ${releaseDate}` : 'Available to reserve'}
              </span>
            ) : product.stock === 'out_of_stock' ? (
              <span className="inline-flex items-center gap-1.5 text-danger">
                <X className="h-4 w-4" strokeWidth={2} />
                Out of stock
              </span>
            ) : product.stock === 'low_stock' ? (
              <span className="tnum inline-flex items-center gap-1.5 text-certified">
                <Package className="h-4 w-4" strokeWidth={2} />
                Only {product.stockCount} left in stock
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-verified">
                <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
                In stock, ready to ship
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="mt-5 space-y-3">
            {isPreorder ? (
              <>
                <div className="rounded-xl border border-accent-line bg-accent-soft p-4">
                  <p className="flex items-center gap-2 text-[13px] font-medium text-accent-ink">
                    <CalendarClock className="h-4 w-4" strokeWidth={2} />
                    Pre-order
                  </p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">
                    {releaseDate ? `Not in stock yet — expected ${releaseDate}. ` : 'Not in stock yet. '}
                    Reserve a unit with a {depositPct}% deposit; stock is allocated by queue position
                    on arrival, and the deposit is refundable until allocation.
                  </p>
                </div>
                <button
                  onClick={() => setShowPreBookingModal(true)}
                  className="tnum inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-accent text-[15px] font-medium text-on-accent transition-colors hover:bg-accent-hover"
                >
                  Reserve for {formatBDT(requiredAdvance)}
                </button>
                <p className="tnum text-center text-xs text-ink-3">
                  Remaining {formatBDT(currentPrice - requiredAdvance)} payable on delivery.
                </p>
              </>
            ) : (
              <>
                <button
                  onClick={() => addToCart(product, cartVariant)}
                  disabled={product.stock === 'out_of_stock'}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-accent text-[15px] font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:pointer-events-none disabled:opacity-45"
                >
                  <ShoppingBag className="h-4 w-4" strokeWidth={2} />
                  Add to cart — {formatBDT(currentPrice)}
                </button>
                {product.stock !== 'out_of_stock' && (
                  <Link
                    href="/checkout"
                    onClick={() => addToCart(product, cartVariant)}
                    className="inline-flex h-12 w-full items-center justify-center rounded-lg border border-line bg-surface text-[15px] font-medium text-ink transition-colors hover:border-line-2 hover:bg-surface-2"
                  >
                    Buy it now
                  </Link>
                )}
              </>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => toggleWishlist(product)}
                aria-pressed={wishlisted}
                className={`inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border text-[13px] font-medium transition-colors ${
                  wishlisted
                    ? 'border-danger-line bg-danger-soft text-danger'
                    : 'border-line text-ink-2 hover:border-line-2 hover:text-ink'
                }`}
              >
                <Heart className={`h-4 w-4 ${wishlisted ? 'fill-danger' : ''}`} strokeWidth={2} />
                {wishlisted ? 'Saved' : 'Save'}
              </button>
              <button
                onClick={() => addToCompare(product)}
                aria-pressed={compared}
                className={`inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border text-[13px] font-medium transition-colors ${
                  compared
                    ? 'border-accent-line bg-accent-soft text-accent-ink'
                    : 'border-line text-ink-2 hover:border-line-2 hover:text-ink'
                }`}
              >
                {compared ? (
                  <Check className="h-4 w-4" strokeWidth={2.5} />
                ) : (
                  <GitCompareArrows className="h-4 w-4" strokeWidth={2} />
                )}
                {compared ? 'In comparison' : 'Compare'}
              </button>
            </div>
          </div>

          {/* Assurances */}
          <ul className="mt-6 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
            {[
              { Icon: ShieldCheck, t: product.warranty, s: 'Warranty included' },
              { Icon: RotateCcw, t: '7-day returns', s: 'Original condition' },
              { Icon: Truck, t: '24–48 hrs', s: 'Dhaka delivery' },
            ].map(({ Icon, t, s }) => (
              <li key={s} className="bg-surface px-4 py-3.5">
                <Icon className="h-4 w-4 text-ink-3" strokeWidth={2} />
                <p className="mt-2 text-[13px] font-medium leading-snug text-ink">{t}</p>
                <p className="text-xs text-ink-3">{s}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Tabs */}
      <section className="mt-16">
        <div className="overflow-x-auto border-b border-line scrollbar-none">
          <div role="tablist" className="flex min-w-max">
            {TABS.map((tab) => (
              <button
                key={tab}
                role="tab"
                aria-selected={activeTab === tab}
                onClick={() => setActiveTab(tab)}
                className={`-mb-px shrink-0 border-b-2 px-4 py-3 text-[13.5px] font-medium transition-colors ${
                  activeTab === tab
                    ? 'border-ink text-ink'
                    : 'border-transparent text-ink-3 hover:text-ink'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-8">
          {activeTab === 'Overview' && (
            <div className="grid gap-10 md:grid-cols-2">
              <div>
                <h3 className="font-display text-base font-semibold tracking-tight text-ink">
                  Key specification
                </h3>
                {specEntries.length > 0 ? (
                  <dl className="mt-4 space-y-2.5">
                    {specEntries.map(([k, v]) => (
                      <div key={k} className="flex gap-3 text-[13.5px]">
                        <dt className="w-32 shrink-0 text-ink-3">{k}</dt>
                        <dd className="text-ink">{v}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="mt-4 text-[13.5px] text-ink-3">
                    Full specification is being catalogued — ask us and we will confirm any detail.
                  </p>
                )}
              </div>
              <div>
                <h3 className="font-display text-base font-semibold tracking-tight text-ink">
                  In the box
                </h3>
                <ul className="mt-4 space-y-2.5">
                  {[
                    'The device itself',
                    'Original charger and cable',
                    'Warranty certificate in your name',
                    'Signed inspection checksheet',
                    ...(preOwned ? ['Protective packaging — original box where available'] : ['Original manufacturer packaging']),
                  ].map((i) => (
                    <li key={i} className="flex items-start gap-2.5 text-[13.5px] text-ink-2">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-verified" strokeWidth={2.5} />
                      {i}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'Specifications' && (
            <div className="overflow-hidden rounded-xl border border-line">
              {specEntries.length > 0 ? (
                <table className="w-full">
                  <tbody className="divide-y divide-line">
                    {specEntries.map(([k, v]) => (
                      <tr key={k} className="odd:bg-surface even:bg-surface-2">
                        <th
                          scope="row"
                          className="w-1/3 px-5 py-3.5 text-left text-[13.5px] font-medium text-ink"
                        >
                          {k}
                        </th>
                        <td className="px-5 py-3.5 text-[13.5px] text-ink-2">{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="bg-surface px-5 py-10 text-center text-[13.5px] text-ink-3">
                  No detailed specification recorded for this listing yet.
                </p>
              )}
            </div>
          )}

          {activeTab === 'Condition report' && (
            <div className="grid gap-8 md:grid-cols-12">
              <div className="md:col-span-5">
                <ConditionPanel product={product} />

                <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line">
                  <div className="bg-surface p-4">
                    <dt className="text-xs text-ink-3">Battery health</dt>
                    <dd className="tnum mt-1 font-display text-lg font-semibold text-ink">
                      {product.batteryHealth != null
                        ? `${product.batteryHealth}%`
                        : grade === 'new'
                          ? '100%'
                          : 'On request'}
                    </dd>
                  </div>
                  <div className="bg-surface p-4">
                    <dt className="text-xs text-ink-3">Cosmetic grade</dt>
                    <dd className="mt-1 font-display text-lg font-semibold text-ink">
                      {gradeMeta.short}
                    </dd>
                  </div>
                </dl>

                {preOwned && product.batteryHealth == null && (
                  <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-ink-3">
                    <BatteryCharging className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                    We measure battery capacity on every pre-owned unit. Contact us and we will send
                    this unit&rsquo;s reading before you order.
                  </p>
                )}
              </div>

              <div className="md:col-span-7">
                <h3 className="font-display text-base font-semibold tracking-tight text-ink">
                  What we check
                </h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">
                  Every device passes the same inspection before it is listed, whether it is sealed
                  from the distributor or traded in.
                </p>
                <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
                  {INSPECTION_CHECKS.map((c) => (
                    <li key={c} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-ink-2">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-verified" strokeWidth={2.5} />
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'Availability' && (
            <div className="max-w-2xl">
              <h3 className="font-display text-base font-semibold tracking-tight text-ink">
                Where this unit is
              </h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">
                Choose store pickup at checkout to collect in person, or have it couriered.
              </p>
              <ul className="mt-5 divide-y divide-line overflow-hidden rounded-xl border border-line">
                {stockLocations.map(({ label, available, Icon }) => (
                  <li key={label} className="flex items-center justify-between gap-4 bg-surface px-5 py-4">
                    <span className="flex items-center gap-3 text-[13.5px] text-ink">
                      <Icon className="h-4 w-4 shrink-0 text-ink-3" strokeWidth={2} />
                      {label}
                    </span>
                    {available && product.stock !== 'out_of_stock' ? (
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-verified-line bg-verified-soft px-2 py-0.5 text-[11px] font-medium text-verified">
                        <Check className="h-3 w-3" strokeWidth={2.5} />
                        Available
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-md border border-line bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink-3">
                        Not available
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <Link
                href="/stores"
                className="group mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-accent"
              >
                <MapPin className="h-3.5 w-3.5" strokeWidth={2} />
                Store addresses and opening hours
                <ArrowRight
                  className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                  strokeWidth={2}
                />
              </Link>
            </div>
          )}

          {activeTab === 'Warranty & returns' && (
            <div className="grid max-w-4xl gap-8 md:grid-cols-2">
              <div className="rounded-xl border border-line bg-surface p-6">
                <ShieldCheck className="h-5 w-5 text-verified" strokeWidth={2} />
                <h3 className="mt-3 font-display text-base font-semibold tracking-tight text-ink">
                  Warranty
                </h3>
                <p className="mt-1 text-[13.5px] font-medium text-ink">{product.warranty}</p>
                <p className="mt-3 text-[13.5px] leading-relaxed text-ink-2">
                  {preOwned
                    ? 'Certified pre-owned devices are covered by SMSTech directly for hardware faults. Bring the device to either store, or arrange a collection — we handle the diagnosis and the repair.'
                    : 'This device carries the manufacturer’s warranty, registered in your name at the point of sale. Claims can be made through the brand’s service network or through us.'}
                </p>
                <p className="mt-3 text-xs leading-relaxed text-ink-3">
                  Accidental damage, liquid ingress and unauthorised repairs are not covered.
                </p>
              </div>

              <div className="rounded-xl border border-line bg-surface p-6">
                <RotateCcw className="h-5 w-5 text-ink-2" strokeWidth={2} />
                <h3 className="mt-3 font-display text-base font-semibold tracking-tight text-ink">
                  Returns
                </h3>
                <p className="mt-1 text-[13.5px] font-medium text-ink">7 days from delivery</p>
                <p className="mt-3 text-[13.5px] leading-relaxed text-ink-2">
                  If the device is not what you expected, return it within seven days in its original
                  condition with all accessories for a full refund. No restocking fee.
                </p>
                <p className="mt-3 text-xs leading-relaxed text-ink-3">
                  If a pre-owned device differs from its published grade in any way, we cover return
                  shipping as well.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Pre-booking modal */}
      {showPreBookingModal && (
        <div
          className="fixed inset-0 z-70 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 animate-fade-in bg-inverse/50 backdrop-blur-sm"
            onClick={() => setShowPreBookingModal(false)}
          />
          <div className="relative w-full max-w-md animate-rise-in overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
            {!pbSuccess ? (
              <form onSubmit={handlePreBookingSubmit}>
                <div className="flex items-center justify-between border-b border-line px-5 py-4">
                  <h2 className="font-display text-base font-semibold tracking-tight text-ink">
                    Reserve this device
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowPreBookingModal(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" strokeWidth={2} />
                  </button>
                </div>

                <div className="space-y-4 p-5">
                  <div className="rounded-lg border border-line bg-surface-2 p-4">
                    <p className="text-[13px] font-medium text-ink">{product.name}</p>
                    <dl className="mt-3 space-y-1.5 text-[13px]">
                      <div className="flex justify-between">
                        <dt className="text-ink-2">Full price</dt>
                        <dd className="tnum text-ink">{formatBDT(currentPrice)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-ink-2">Deposit ({depositPct}%)</dt>
                        <dd className="tnum font-medium text-ink">{formatBDT(requiredAdvance)}</dd>
                      </div>
                      {releaseDate && (
                        <div className="flex justify-between">
                          <dt className="text-ink-2">Expected</dt>
                          <dd className="text-ink">{releaseDate}</dd>
                        </div>
                      )}
                    </dl>
                  </div>

                  {[
                    { id: 'pb-name', label: 'Full name', value: pbName, set: setPbName, type: 'text', ph: 'Shakib Ahmed', required: true },
                    { id: 'pb-phone', label: 'Phone (bKash / Nagad)', value: pbPhone, set: setPbPhone, type: 'tel', ph: '017…', required: true },
                    { id: 'pb-email', label: 'Email (optional)', value: pbEmail, set: setPbEmail, type: 'email', ph: 'you@example.com', required: false },
                  ].map((f) => (
                    <div key={f.id}>
                      <label
                        htmlFor={f.id}
                        className="mb-1.5 block text-[13px] font-medium text-ink"
                      >
                        {f.label}
                        {f.required && <span className="text-danger"> *</span>}
                      </label>
                      <input
                        id={f.id}
                        type={f.type}
                        value={f.value}
                        onChange={(e) => f.set(e.target.value)}
                        placeholder={f.ph}
                        required={f.required}
                        className="h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15"
                      />
                    </div>
                  ))}

                  {pbError && (
                    <p className="rounded-lg border border-danger-line bg-danger-soft px-3 py-2 text-[13px] text-danger">
                      {pbError}
                    </p>
                  )}
                </div>

                <div className="border-t border-line bg-surface-2 p-5">
                  <button
                    type="submit"
                    disabled={pbSubmitting}
                    className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-accent text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-50"
                  >
                    {pbSubmitting
                      ? 'Confirming…'
                      : `Pay ${formatBDT(requiredAdvance)} deposit`}
                  </button>
                  <p className="mt-2.5 text-center text-xs text-ink-3">
                    Refundable until your unit is allocated.
                  </p>
                </div>
              </form>
            ) : (
              <div className="p-8 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-verified-soft text-verified">
                  <CheckCircle2 className="h-6 w-6" strokeWidth={1.75} />
                </span>
                <h2 className="mt-4 font-display text-lg font-semibold tracking-tight text-ink">
                  Reservation confirmed
                </h2>
                <p className="tnum mt-1 text-[13px] text-ink-3">
                  Booking #{pbSuccess.booking_number}
                </p>
                <p className="tnum mt-4 rounded-lg border border-verified-line bg-verified-soft px-4 py-3 text-[13px] font-medium text-verified">
                  Queue position #{pbSuccess.queue_priority}
                </p>
                <button
                  onClick={() => {
                    setShowPreBookingModal(false)
                    setPbSuccess(null)
                    router.push('/account')
                  }}
                  className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-lg bg-accent text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover"
                >
                  Track it in your account
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Related */}
      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="mb-6 font-display text-xl font-semibold tracking-tight text-ink md:text-2xl">
            You may also like
          </h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </Container>
  )
}

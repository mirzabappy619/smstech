'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useApp } from '../../../store/AppContext'
import { normalizeProduct, Product } from '../../../data/products'
import ProductCard from '../../../components/ProductCard'
import { trackMetaViewContent } from '@/presentation/components/meta-pixel'

const fmt = (n: number) => '৳' + (Number(n) || 0).toLocaleString('en-BD')

const BRANCH_AVAILABILITY = [
  { name: 'Multiplan Branch (Elephant Road)', leadTime: 'Instant (In Stock)', ready: true, address: 'Level-3, Shop 309' },
  { name: 'Banani Branch (Road 11)', leadTime: 'Instant (In Stock)', ready: true, address: 'Block D, Banani' },
  { name: 'IDB Bhaban Branch (Agargaon)', leadTime: '30 Minutes Transfer', ready: true, address: 'BCS Computer City' },
  { name: 'Uttara Branch (Sector 3)', leadTime: '2 Hours Express', ready: true, address: 'Commercial Area' },
  { name: 'Chattogram Branch (GEC Circle)', leadTime: 'Pre-Order / 24hr Dispatch', ready: false, address: 'Central Plaza' },
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
  const [activeTab, setActiveTab] = useState('Overview')
  const [selectedVariant, setSelectedVariant] = useState(0)
  const [selectedColor, setSelectedColor] = useState(0)
  const [conditionGrade, setConditionGrade] = useState<'brand_new' | 'pre_owned_a_plus'>('brand_new')

  // Pre-Booking Modal State
  const [showPreBookingModal, setShowPreBookingModal] = useState(false)
  const [pbName, setPbName] = useState('')
  const [pbPhone, setPbPhone] = useState('')
  const [pbEmail, setPbEmail] = useState('')
  const [pbSubmitting, setPbSubmitting] = useState(false)
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

          // Track Meta Pixel & CAPI ViewContent
          try {
            trackMetaViewContent({
              productId: norm.id,
              productName: norm.name,
              price: norm.price,
              currency: 'BDT',
            })
          } catch {}

          // Load related products
          const relRes = await fetch(`/api/v1/products?show_all=true&limit=10`)
          const relJson = await relRes.json()
          if (relJson.success && Array.isArray(relJson.data)) {
            const mappedRel = relJson.data
              .map(normalizeProduct)
              .filter((p: Product) => p.slug !== norm.slug)
              .slice(0, 4)
            setRelated(mappedRel)
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
      <div className="max-w-7xl mx-auto px-4 py-20 text-center text-slate-500 dark:text-slate-400">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-3" />
        Loading product details from database...
      </div>
    )
  }

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-800 text-slate-900 dark:text-white mb-4">Product Not Found</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-6">The product you are looking for does not exist in the database.</p>
        <Link href="/laptops" className="px-6 py-3 bg-blue-600 text-white font-600 rounded-xl">
          Browse Laptops
        </Link>
      </div>
    )
  }

  const wishlisted = isWishlisted(product.id)
  const compared = isCompared(product.id)

  const rawPrice = product.variants && product.variants[selectedVariant] ? product.variants[selectedVariant].price : product.price
  const currentPrice = conditionGrade === 'pre_owned_a_plus' ? Math.round(rawPrice * 0.82) : rawPrice
  const originalPrice = conditionGrade === 'pre_owned_a_plus' ? rawPrice : product.originalPrice
  const discount = Math.round(((originalPrice - currentPrice) / originalPrice) * 100)

  // Pre-order is a per-product setting; the deposit percentage comes with it
  const isPreorder = Boolean(product.isPreorder)
  const depositPct = Number(product.preorderDepositPct) || 10
  const requiredAdvance = Math.round(currentPrice * (depositPct / 100))
  const releaseDate = product.preorderReleaseDate
    ? new Date(product.preorderReleaseDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  const tabs = ['Overview', 'Specifications', 'Store Availability', 'Reviews', 'Warranty Terms']

  const handlePreBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pbName || !pbPhone) {
      alert('Please provide your name and phone number.')
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
          payment_method: 'bkash'
        })
      })
      const json = await res.json()
      if (json.success) {
        setPbSuccess(json.data)
      } else {
        alert(json.error || 'Failed to submit pre-booking')
      }
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      setPbSubmitting(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-8">
        <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400">Home</Link>
        <span>›</span>
        <Link href={`/${product.category}s`} className="hover:text-blue-600 dark:hover:text-blue-400 capitalize">{product.category}s</Link>
        <span>›</span>
        <span className="text-slate-900 dark:text-white font-600 line-clamp-1">{product.name}</span>
      </nav>

      <div className="grid lg:grid-cols-2 gap-12 mb-16">
        {/* Gallery */}
        <div className="space-y-4">
          <div className="aspect-square rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 relative">
            <img
              src={product.images[activeImage] || product.image}
              alt={product.name}
              className="w-full h-full object-cover"
            />
            {conditionGrade === 'pre_owned_a_plus' && (
              <div className="absolute top-3 left-3 bg-amber-500 text-white text-xs font-black px-3 py-1 rounded-lg shadow-md">
                Certified Pre-Owned A+
              </div>
            )}
          </div>
          <div className="flex gap-3">
            {product.images.map((img, i) => (
              <button
                key={i}
                onClick={() => setActiveImage(i)}
                className={`w-20 h-20 rounded-xl overflow-hidden border-2 transition-all ${activeImage === i ? 'border-blue-600 dark:border-blue-400' : 'border-slate-200 dark:border-slate-700'}`}
              >
                <img src={img} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>

          {/* Pre-Owned Metric Transparency Card */}
          <div className="p-4 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-zinc-900 dark:text-white uppercase tracking-wider">
                🔍 Hardware Transparency Metrics
              </span>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">100% Tested & Verified</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <p className="text-[10px] text-zinc-500 font-semibold">Battery Health</p>
                <p className="text-sm font-black text-emerald-600 mt-0.5">
                  {conditionGrade === 'pre_owned_a_plus' ? '96%' : '100% (New)'}
                </p>
              </div>
              <div className="p-2.5 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <p className="text-[10px] text-zinc-500 font-semibold">Cycle Count</p>
                <p className="text-sm font-black text-zinc-900 dark:text-white mt-0.5">
                  {conditionGrade === 'pre_owned_a_plus' ? '38 cycles' : '0 cycles'}
                </p>
              </div>
              <div className="p-2.5 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <p className="text-[10px] text-zinc-500 font-semibold">Cosmetic Grade</p>
                <p className="text-sm font-black text-amber-500 mt-0.5">
                  {conditionGrade === 'pre_owned_a_plus' ? 'Grade A+' : 'Brand New'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Info & Options */}
        <div className="space-y-5">
          <div>
            <span className="text-sm font-700 text-blue-600 dark:text-blue-400 uppercase tracking-wide">{product.brand}</span>
            <h1 className="text-2xl md:text-3xl font-800 text-slate-900 dark:text-white mt-1 leading-tight">{product.name}</h1>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">SKU: SMST-{product.id.slice(0, 8).toUpperCase()}-2026</p>
          </div>

          {/* Condition Grade Switcher */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Select Device Condition
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setConditionGrade('brand_new')}
                className={`p-3 rounded-xl border-2 text-left transition-all ${
                  conditionGrade === 'brand_new'
                    ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                }`}
              >
                <p className="font-extrabold text-xs">✨ Brand New (Official)</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Factory sealed box with standard brand warranty</p>
              </button>

              <button
                type="button"
                onClick={() => setConditionGrade('pre_owned_a_plus')}
                className={`p-3 rounded-xl border-2 text-left transition-all ${
                  conditionGrade === 'pre_owned_a_plus'
                    ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-extrabold text-xs">💎 Pre-Owned Like New A+</p>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">Save ~18%</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Certified 95%+ battery with 6-month shop warranty</p>
              </button>
            </div>
          </div>

          {/* Price */}
          <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/80 rounded-2xl p-5">
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-800 text-slate-900 dark:text-white">{fmt(currentPrice)}</span>
              {originalPrice > currentPrice && (
                <>
                  <span className="text-slate-400 dark:text-slate-500 line-through text-lg">{fmt(originalPrice)}</span>
                  <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-sm font-700 px-2.5 py-1 rounded-lg">-{discount}%</span>
                </>
              )}
            </div>
            {originalPrice > currentPrice && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400 font-600 mt-1">You save {fmt(originalPrice - currentPrice)}</p>
            )}
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Or from ৳{Math.round(currentPrice / 12).toLocaleString()}/month with SSLCommerz Bank EMI</p>
          </div>

          {/* Variants */}
          {product.variants && product.variants.length > 0 && (
            <div>
              <p className="text-sm font-700 text-slate-700 dark:text-slate-300 mb-2">Storage / RAM Option</p>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedVariant(i)}
                    className={`px-4 py-2 rounded-xl text-sm font-600 border-2 transition-all
                      ${selectedVariant === i
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 dark:border-blue-500 text-blue-700 dark:text-blue-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-300'}`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Colors */}
          {product.colors && product.colors.length > 0 && (
            <div>
              <p className="text-sm font-700 text-slate-700 dark:text-slate-300 mb-2">Color: <span className="font-600 text-slate-900 dark:text-white">{product.colors[selectedColor]}</span></p>
              <div className="flex gap-2">
                {product.colors.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedColor(i)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-600 border-2 transition-all
                      ${selectedColor === i
                        ? 'border-blue-600 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 dark:border-blue-500'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-300'}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Actions & Pre-Booking Option */}
          <div className="flex flex-col gap-3 pt-2">
            {isPreorder ? (
              <>
                <div className="rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
                  <p className="text-sm font-700 text-amber-800 dark:text-amber-300">⏳ Pre-Order Item</p>
                  <p className="text-xs text-amber-700 dark:text-amber-400/90 mt-1">
                    {releaseDate
                      ? `Not in stock yet — expected ${releaseDate}. `
                      : 'Not in stock yet. '}
                    Reserve your unit with a {depositPct}% deposit and we will allocate stock by queue position on arrival.
                  </p>
                </div>

                <button
                  onClick={() => setShowPreBookingModal(true)}
                  className="py-3.5 font-700 bg-amber-500 hover:bg-amber-600 text-white rounded-xl transition-colors text-sm shadow-md"
                >
                  ⏳ Pre-Book Now · Deposit {fmt(requiredAdvance)}
                </button>
                <p className="text-xs text-slate-500 dark:text-slate-400 text-center -mt-1">
                  Remaining {fmt(currentPrice - requiredAdvance)} payable on delivery. Deposit is refundable until allocation.
                </p>
              </>
            ) : (
              <>
                <button
                  onClick={() => addToCart(product, `${product.variants?.[selectedVariant]?.label || ''} (${conditionGrade === 'pre_owned_a_plus' ? 'Pre-Owned A+' : 'Brand New'})`)}
                  className="py-3.5 font-700 bg-blue-600 text-white rounded-xl hover:bg-blue-700 active:scale-[0.98] transition-all text-sm shadow-md"
                >
                  Add to Cart · {fmt(currentPrice)}
                </button>

                <Link
                  href="/checkout"
                  onClick={() => addToCart(product, `${product.variants?.[selectedVariant]?.label || ''} (${conditionGrade === 'pre_owned_a_plus' ? 'Pre-Owned A+' : 'Brand New'})`)}
                  className="py-3 font-700 border-2 border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-500 rounded-xl text-center hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-colors text-xs"
                >
                  ⚡ Buy Now (Express)
                </Link>
              </>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => toggleWishlist(product)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 border rounded-xl text-sm font-600 transition-all
                  ${wishlisted ? 'border-red-300 text-red-500 bg-red-50 dark:bg-red-950/40' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-red-300'}`}
              >
                {wishlisted ? '❤️ Wishlisted' : '🤍 Add to Wishlist'}
              </button>
              <button
                onClick={() => addToCompare(product)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 border rounded-xl text-sm font-600 transition-all
                  ${compared ? 'border-blue-300 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-300'}`}
              >
                {compared ? '✓ In Compare (4 Max)' : '⚖️ Add to Compare'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-12">
        <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`shrink-0 px-5 py-3 text-sm font-bold transition-all border-b-2 -mb-px
                ${activeTab === tab
                  ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400 font-extrabold'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {activeTab === 'Store Availability' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Multi-Branch Real-Time Stock & Lead Times</h3>
                <p className="text-xs text-slate-500">Pick up in-store or get express courier delivery from the closest store location.</p>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {BRANCH_AVAILABILITY.map((b, idx) => (
                  <div key={idx} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm text-slate-900 dark:text-white">{b.name}</p>
                      <p className="text-xs text-slate-500">{b.address}</p>
                    </div>
                    <div className="text-right">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-extrabold ${
                        b.ready ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      }`}>
                        {b.leadTime}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'Overview' && (
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="font-700 text-slate-900 dark:text-white mb-3">Key Highlights</h3>
                <ul className="space-y-2">
                  {Object.entries(product.specs).map(([k, v]) => (
                    <li key={k} className="flex items-start gap-2.5 text-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 mt-2 shrink-0" />
                      <span className="text-slate-600 dark:text-slate-300"><strong className="text-slate-900 dark:text-white">{k}:</strong> {v}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-700 text-slate-900 dark:text-white mb-3">What's in the Box</h3>
                <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  {['Device', 'Original Fast Charging Adapter', 'USB-C Cable', 'Warranty Certificate', 'Physical Inspection Checksheet'].map((i) => (
                    <li key={i} className="flex items-center gap-2"><span className="text-emerald-500 dark:text-emerald-400">✓</span>{i}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'Specifications' && (
            <div className="overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-700">
              <table className="w-full text-sm">
                <tbody>
                  {Object.entries(product.specs).map(([k, v], i) => (
                    <tr key={k} className={i % 2 === 0 ? 'bg-slate-50 dark:bg-slate-800' : 'bg-white dark:bg-slate-900'}>
                      <td className="px-5 py-3.5 font-700 text-slate-700 dark:text-slate-200 w-1/3">{k}</td>
                      <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* --- PRE-BOOKING MODAL --- */}
      {showPreBookingModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            {!pbSuccess ? (
              <form onSubmit={handlePreBookingSubmit} className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                  <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">Pre-Book Device Slot</h2>
                  <button type="button" onClick={() => setShowPreBookingModal(false)} className="text-slate-400 font-bold">✕</button>
                </div>

                <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl text-xs space-y-1">
                  <p className="font-bold text-blue-900 dark:text-blue-200">{product.name}</p>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Full Device Price:</span>
                    <span className="font-bold">{fmt(currentPrice)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-600 font-extrabold">
                    <span>Advance Deposit ({depositPct}%):</span>
                    <span>{fmt(requiredAdvance)}</span>
                  </div>
                  {releaseDate && (
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>Expected Availability:</span>
                      <span className="font-bold">{releaseDate}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Your Full Name *</label>
                    <input
                      type="text"
                      value={pbName}
                      onChange={e => setPbName(e.target.value)}
                      placeholder="e.g. Shakib Ahmed"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Phone Number (bKash/Nagad) *</label>
                    <input
                      type="tel"
                      value={pbPhone}
                      onChange={e => setPbPhone(e.target.value)}
                      placeholder="017..."
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Email Address (Optional)</label>
                    <input
                      type="email"
                      value={pbEmail}
                      onChange={e => setPbEmail(e.target.value)}
                      placeholder="customer@email.com"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={pbSubmitting}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50"
                >
                  {pbSubmitting ? 'Confirming Queue Slot...' : `Pay Advance Deposit ${fmt(requiredAdvance)} & Lock Priority`}
                </button>
              </form>
            ) : (
              <div className="text-center space-y-3">
                <span className="text-4xl">🎉</span>
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">Pre-Booking Confirmed!</h2>
                <p className="text-xs text-slate-500">Booking #{pbSuccess.booking_number}</p>
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-bold">
                  Queue Priority Rank: #{pbSuccess.queue_priority}
                </div>
                <button
                  onClick={() => {
                    setShowPreBookingModal(false)
                    setPbSuccess(null)
                    router.push('/account')
                  }}
                  className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold"
                >
                  Track in Customer Account →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Related Products */}
      {related.length > 0 && (
        <div>
          <h2 className="text-xl font-800 text-slate-900 dark:text-white mb-6">You May Also Like</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {related.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </div>
      )}
    </div>
  )
}

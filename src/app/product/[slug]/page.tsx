'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useApp } from '../../../store/AppContext'
import { normalizeProduct, Product } from '../../../data/products'
import ProductCard from '../../../components/ProductCard'

const fmt = (n: number) => '৳' + n.toLocaleString('en-BD')

export default function ProductDetail() {
  const params = useParams()
  const slug = (params?.slug as string) || ''
  const [product, setProduct] = useState<Product | null>(null)
  const [related, setRelated] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  const { addToCart, toggleWishlist, isWishlisted, addToCompare, isCompared } = useApp()
  const [activeImage, setActiveImage] = useState(0)
  const [activeTab, setActiveTab] = useState('Overview')
  const [selectedVariant, setSelectedVariant] = useState(0)
  const [selectedColor, setSelectedColor] = useState(0)
  const [qty, setQty] = useState(1)

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
  const discount = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
  const tabs = ['Overview', 'Specifications', 'Reviews', 'Warranty', 'Store Availability']

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
          <div className="aspect-square rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <img
              src={product.images[activeImage] || product.image}
              alt={product.name}
              className="w-full h-full object-cover"
            />
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
        </div>

        {/* Info */}
        <div className="space-y-5">
          <div>
            <span className="text-sm font-700 text-blue-600 dark:text-blue-400 uppercase tracking-wide">{product.brand}</span>
            <h1 className="text-2xl md:text-3xl font-800 text-slate-900 dark:text-white mt-1 leading-tight">{product.name}</h1>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">SKU: SMST-{product.id.slice(0, 8).toUpperCase()}-2026</p>
          </div>

          {/* Rating */}
          <div className="flex items-center gap-3">
            <div className="flex">
              {[1,2,3,4,5].map((s) => (
                <svg key={s} viewBox="0 0 12 12" className={`w-4 h-4 ${s <= Math.round(product.rating) ? 'fill-amber-400' : 'fill-slate-200 dark:fill-slate-700'}`}>
                  <path d="M6 1l1.4 2.8L10.6 4.3 8.3 6.5l.5 3.2L6 8.1 3.2 9.7l.5-3.2L1.4 4.3l3.2-.5z" />
                </svg>
              ))}
            </div>
            <span className="font-600 text-slate-900 dark:text-white text-sm">{product.rating}</span>
            <span className="text-slate-400 dark:text-slate-500 text-sm">({product.reviews} reviews)</span>
          </div>

          {/* Price */}
          <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/80 rounded-2xl p-5">
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-800 text-slate-900 dark:text-white">{fmt(product.variants && product.variants[selectedVariant] ? product.variants[selectedVariant].price : product.price)}</span>
              {product.originalPrice > product.price && (
                <>
                  <span className="text-slate-400 dark:text-slate-500 line-through text-lg">{fmt(product.originalPrice)}</span>
                  <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-sm font-700 px-2.5 py-1 rounded-lg">-{discount}%</span>
                </>
              )}
            </div>
            {product.originalPrice > product.price && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400 font-600 mt-1">You save {fmt(product.originalPrice - product.price)}</p>
            )}
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Or from ৳{Math.round((product.variants && product.variants[selectedVariant] ? product.variants[selectedVariant].price : product.price) / 12).toLocaleString()}/month with EMI</p>
          </div>

          {/* Stock */}
          <div className="flex items-center gap-2">
            {product.stock === 'out_of_stock' ? (
              <><span className="w-2 h-2 rounded-full bg-red-500" /><span className="text-sm font-600 text-red-500 dark:text-red-400">Out of Stock</span></>
            ) : product.stock === 'low_stock' ? (
              <><span className="w-2 h-2 rounded-full bg-amber-500" /><span className="text-sm font-600 text-amber-600 dark:text-amber-400">Only {product.stockCount} left in stock</span></>
            ) : (
              <><span className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-sm font-600 text-emerald-600 dark:text-emerald-400">In Stock — Ready to ship</span></>
            )}
          </div>

          {/* Variants */}
          {product.variants && product.variants.length > 0 && (
            <div>
              <p className="text-sm font-700 text-slate-700 dark:text-slate-300 mb-2">Storage / RAM</p>
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

          {/* Qty */}
          <div className="flex items-center gap-3">
            <p className="text-sm font-700 text-slate-700 dark:text-slate-300">Quantity</p>
            <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
              <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-9 h-9 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xl">−</button>
              <span className="w-10 h-9 flex items-center justify-center font-700 text-sm text-slate-900 dark:text-white">{qty}</span>
              <button onClick={() => setQty(qty + 1)} className="w-9 h-9 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xl">+</button>
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-col gap-3">
            {product.stock === 'out_of_stock' ? (
              <button className="py-3.5 font-700 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300">Notify When Available</button>
            ) : (
              <>
                <button
                  onClick={() => addToCart(product, product.variants?.[selectedVariant]?.label)}
                  className="py-3.5 font-700 bg-blue-600 text-white rounded-xl hover:bg-blue-700 active:scale-[0.98] transition-all text-sm"
                >
                  Add to Cart
                </button>
                <Link
                  href="/checkout"
                  onClick={() => addToCart(product, product.variants?.[selectedVariant]?.label)}
                  className="py-3.5 font-700 border-2 border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-500 rounded-xl text-center hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-colors text-sm"
                >
                  Buy Now
                </Link>
              </>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => toggleWishlist(product)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 border rounded-xl text-sm font-600 transition-all
                  ${wishlisted ? 'border-red-300 text-red-500 bg-red-50 dark:bg-red-950/40' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-red-300'}`}
              >
                <svg viewBox="0 0 24 24" className={`w-4 h-4 ${wishlisted ? 'fill-red-500' : 'fill-none'} stroke-current`} strokeWidth={2}>
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
                {wishlisted ? 'Wishlisted' : 'Wishlist'}
              </button>
              <button
                onClick={() => addToCompare(product)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 border rounded-xl text-sm font-600 transition-all
                  ${compared ? 'border-blue-300 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-300'}`}
              >
                {compared ? '✓ In Compare' : '+ Compare'}
              </button>
            </div>
          </div>

          {/* Trust badges */}
          <div className="grid grid-cols-2 gap-3">
            {[['🛡️', product.warranty], ['✅', 'Authentic Product'], ['🚚', '24–48hr Delivery'], ['🏪', 'Store Pickup Available']].map(([icon, label]) => (
              <div key={label as string} className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700/60">
                <span className="text-base">{icon}</span>
                <span className="text-xs font-600 text-slate-700 dark:text-slate-300">{label as string}</span>
              </div>
            ))}
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
              className={`shrink-0 px-5 py-3 text-sm font-600 transition-all border-b-2 -mb-px
                ${activeTab === tab
                  ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="mt-6">
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
                  {['Device', 'Charging Adapter', 'USB-C Cable', 'Documentation', 'Warranty Card'].map((i) => (
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

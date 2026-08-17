'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import ProductCard from '../components/ProductCard'
import HeroSlider from '../components/HeroSlider'
import { brands, normalizeProduct, Product } from '../data/products'

const categories = [
  { name: 'Laptops', desc: 'For work, study & gaming', count: 48, href: '/laptops', img: 'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=300&h=200&fit=crop&auto=format', color: 'from-blue-50 to-blue-100 dark:from-blue-950/60 dark:to-blue-900/60' },
  { name: 'Smartphones', desc: 'Latest Android & iOS', count: 64, href: '/smartphones', img: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=300&h=200&fit=crop&auto=format', color: 'from-violet-50 to-violet-100 dark:from-violet-950/60 dark:to-violet-900/60' },
  { name: 'Gaming Laptops', desc: 'Built to dominate', count: 18, href: '/laptops?cat=gaming', img: 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=300&h=200&fit=crop&auto=format', color: 'from-red-50 to-red-100 dark:from-red-950/60 dark:to-red-900/60' },
  { name: 'MacBooks', desc: 'Apple performance', count: 12, href: '/laptops?brand=apple', img: 'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=300&h=200&fit=crop&auto=format', color: 'from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900' },
  { name: 'iPhones', desc: 'Premium iOS experience', count: 14, href: '/smartphones?brand=apple', img: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=300&h=200&fit=crop&auto=format', color: 'from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900' },
  { name: 'Android Phones', desc: 'Samsung, Xiaomi & more', count: 50, href: '/smartphones?cat=android', img: 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=300&h=200&fit=crop&auto=format', color: 'from-emerald-50 to-emerald-100 dark:from-emerald-950/60 dark:to-emerald-900/60' },
  { name: 'Accessories', desc: 'Cases, cables & more', count: 92, href: '#', img: 'https://images.unsplash.com/photo-1585060544812-6b45742d762f?w=300&h=200&fit=crop&auto=format', color: 'from-amber-50 to-amber-100 dark:from-amber-950/60 dark:to-amber-900/60' },
]

const laptopTabs = ['Gaming', 'Business', 'Student', 'Creator', 'Premium', 'MacBook']
const phoneTabs = ['iPhone', 'Samsung', 'Xiaomi', 'OnePlus', 'Google']

const reviews = [
  { name: 'Rahim Hossain', product: 'ASUS ROG Strix G16', rating: 5, text: 'Excellent service and genuine product. The laptop performs exactly as advertised. The SMSTech team was very helpful in choosing the right spec.', city: 'Dhaka' },
  { name: 'Priya Das', product: 'iPhone 17 Pro', rating: 5, text: 'Got my phone with full Apple warranty. Very smooth ordering process and fast delivery. Will definitely buy again from SMSTech.', city: 'Chittagong' },
  { name: 'Karim Ahmed', product: 'MacBook Air M3', rating: 5, text: 'Visited the physical store and the staff helped me pick the right configuration. Great experience overall. Highly recommended!', city: 'Dhaka' },
  { name: 'Tasnim Akter', product: 'Samsung Galaxy S26', rating: 4, text: 'Good prices and authentic products. The comparison feature on the website really helped me decide between two models.', city: 'Rajshahi' },
  { name: 'Sabbir Khan', product: 'Lenovo LOQ 15', rating: 5, text: 'Ordered online and picked up from Store 02. Super convenient. The laptop came sealed with official warranty card.', city: 'Dhaka' },
]

const faqs = [
  { q: 'Are your products genuine?', a: 'Yes — all products at SMSTech are 100% genuine, sourced from authorized brand distributors and channels.' },
  { q: 'What warranty do your products have?', a: 'Warranty varies by brand and product. Most laptops carry 1–2 year manufacturer warranties; smartphones typically carry 1 year. Warranty details are shown on each product page.' },
  { q: 'Can I order online and pick up from a store?', a: 'Absolutely. Select "Store Pickup" at checkout and choose your preferred SMSTech store. You\'ll receive a notification when your order is ready.' },
  { q: 'How long does delivery take?', a: 'Dhaka metro deliveries are typically completed within 24–48 hours. Outside Dhaka may take 2–4 business days depending on location.' },
  { q: 'What payment methods are supported?', a: 'We accept Cash on Delivery, bKash, Nagad, debit/credit cards (Visa/Mastercard), and online payment gateways.' },
]
export default function Home() {
  const [laptopTab, setLaptopTab] = useState('Gaming')
  const [phoneTab, setPhoneTab] = useState('iPhone')
  const [countdown, setCountdown] = useState({ h: 11, m: 43, s: 22 })
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [allDbProducts, setAllDbProducts] = useState<Product[]>([])

  useEffect(() => {
    async function loadDb() {
      try {
        const res = await fetch('/api/v1/products?show_all=true&limit=100')
        const json = await res.json()
        if (json.success && Array.isArray(json.data)) {
          setAllDbProducts(json.data.map(normalizeProduct))
        }
      } catch (e) {
        console.error('Failed to load homepage products from db:', e)
      }
    }
    loadDb()
  }, [])

  useEffect(() => {
    const t = setInterval(() => {
      setCountdown((prev) => {
        let { h, m, s } = prev
        s--; if (s < 0) { s = 59; m-- } if (m < 0) { m = 59; h-- } if (h < 0) { h = 23 }
        return { h, m, s }
      })
    }, 1000)
    return () => clearInterval(t)
  }, [])

  const laptops = allDbProducts.filter((p) => p.category === 'laptop' || p.subcategory === 'macbook' || p.subcategory === 'gaming')
  const smartphones = allDbProducts.filter((p) => p.category === 'smartphone' || p.subcategory === 'flagship' || p.subcategory === 'mid-range')
  const preOwnedLaptops = allDbProducts.filter((p) => p.subcategory === 'pre-owned' || p.badges.includes('Pre-Owned'))

  const filteredLaptops = laptops.filter((l) => {
    if (laptopTab === 'MacBook') return l.brand === 'Apple'
    if (laptopTab === 'Premium') return l.price >= 200000
    return l.subcategory === laptopTab.toLowerCase()
  }).slice(0, 4)

  const filteredPhones = smartphones.filter((p) => {
    const tab = phoneTab.toLowerCase()
    if (tab === 'iphone') return p.brand === 'Apple'
    if (tab === 'samsung') return p.brand === 'Samsung'
    if (tab === 'xiaomi') return p.brand === 'Xiaomi'
    if (tab === 'oneplus') return p.brand === 'OnePlus'
    if (tab === 'google') return p.brand === 'Google'
    return true
  }).slice(0, 4)

  const dealProducts = allDbProducts.filter((p) => p.badges.includes('Hot Deal') || p.originalPrice > p.price).slice(0, 4)

  const pad = (n: number) => String(n).padStart(2, '0')

  return (
    <div>
      {/* Hero Slider Carousel */}
      <HeroSlider />

      {/* Trust bar */}
      <div className="bg-blue-600 dark:bg-blue-700 text-white">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap justify-center gap-6 text-xs font-600">
          {['✅ 100% Genuine Products', '🛡️ Official Warranty', '🚚 Fast Delivery', '🏪 2 Physical Stores', '💳 Flexible Payment'].map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      </div>

      {/* Shop by Category */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-800 text-slate-900 dark:text-white">Shop by Category</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Find exactly what you're looking for</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
          {categories.map((cat) => (
            <Link
              key={cat.name}
              href={cat.href}
              className={`group relative rounded-2xl bg-gradient-to-br ${cat.color} overflow-hidden border border-white/50 dark:border-slate-700/60 hover:shadow-lg hover:scale-105 transition-all duration-300 flex flex-col`}
            >
              <div className="aspect-video overflow-hidden">
                <img src={cat.img} alt={cat.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
              </div>
              <div className="p-3">
                <h3 className="font-700 text-slate-900 dark:text-white text-sm leading-tight">{cat.name}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{cat.desc}</p>
                <p className="text-xs text-blue-600 dark:text-blue-400 font-600 mt-1">{cat.count} products →</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Today's Best Deals */}
      <section className="bg-slate-900 dark:bg-slate-950 py-16 transition-colors">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
            <div>
              <h2 className="text-2xl md:text-3xl font-800 text-white">Today's Best Deals</h2>
              <p className="text-slate-400 mt-1 text-sm">Exclusive savings on premium tech</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-slate-400 text-sm font-600">Ends in</span>
              <div className="flex gap-1.5">
                {[pad(countdown.h), pad(countdown.m), pad(countdown.s)].map((v, i) => (
                  <div key={i} className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                    <span className="font-800 text-white text-lg">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {dealProducts.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
          <div className="text-center mt-8">
            <Link href="/deals" className="inline-block px-8 py-3 border border-slate-600 text-white font-600 rounded-xl hover:bg-white hover:text-slate-900 transition-all text-sm">
              View All Deals →
            </Link>
          </div>
        </div>
      </section>

      {/* Laptop Showcase */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-2xl md:text-3xl font-800 text-slate-900 dark:text-white">Find Your Perfect Laptop</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Curated picks for every need</p>
          </div>
          <Link href="/laptops" className="text-blue-600 dark:text-blue-400 font-600 text-sm hover:underline hidden sm:block">View All →</Link>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-none">
          {laptopTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setLaptopTab(tab)}
              className={`shrink-0 px-4 py-2 rounded-xl text-sm font-600 transition-all
                ${laptopTab === tab
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-none'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {(filteredLaptops.length > 0 ? filteredLaptops : laptops.slice(0, 4)).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {/* Smartphone Showcase */}
      <section className="bg-slate-50 dark:bg-slate-900/60 py-16 transition-colors">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-end justify-between mb-6">
            <div>
              <h2 className="text-2xl md:text-3xl font-800 text-slate-900 dark:text-white">Latest Smartphones</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Flagship to mid-range, all genuine</p>
            </div>
            <Link href="/smartphones" className="text-blue-600 dark:text-blue-400 font-600 text-sm hover:underline hidden sm:block">View All →</Link>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
            {phoneTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setPhoneTab(tab)}
                className={`shrink-0 px-4 py-2 rounded-xl text-sm font-600 transition-all
                  ${phoneTab === tab
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-none'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'}`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {(filteredPhones.length > 0 ? filteredPhones : smartphones.slice(0, 4)).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </section>

      {/* Pre-Owned Laptops Section */}
      {preOwnedLaptops.length > 0 && (
        <section className="bg-slate-900 text-white py-16 transition-colors">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <div>
                <span className="inline-block px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-800 rounded-full uppercase tracking-wide mb-2">
                  Certified Quality
                </span>
                <h2 className="text-2xl md:text-3xl font-800 text-white">Certified Pre-Owned Laptops</h2>
                <p className="text-slate-400 text-sm mt-1">High quality business laptops with 6 months warranty & original charger</p>
              </div>
              <Link href="/laptops?cat=pre-owned" className="text-amber-400 font-700 text-sm hover:underline hidden sm:block">
                View Pre-Owned Laptops →
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {preOwnedLaptops.slice(0, 4).map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Brands */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <h2 className="text-2xl md:text-3xl font-800 text-slate-900 dark:text-white mb-2 text-center">Shop by Brand</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm text-center mb-10">Authorized resellers of the world's leading technology brands</p>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
          {brands.map((brand) => (
            <Link
              key={brand.name}
              href={`/brand/${brand.name.toLowerCase()}`}
              className="group flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-500 hover:shadow-md transition-all bg-white dark:bg-slate-800"
            >
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-900 group-hover:bg-blue-50 dark:group-hover:bg-blue-950 flex items-center justify-center text-xl font-800 text-slate-600 dark:text-slate-300 transition-colors">
                {brand.logo}
              </div>
              <span className="text-sm font-600 text-slate-700 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{brand.name}</span>
              <span className="text-xs text-slate-400 dark:text-slate-500">{brand.count} products</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Why SMSTech */}
      <section className="bg-blue-600 dark:bg-blue-700 py-16">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-800 text-white text-center mb-2">Why Shop with SMSTech?</h2>
          <p className="text-blue-200 text-sm text-center mb-12">We're here to make technology accessible and trustworthy</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {[
              { icon: '✅', title: 'Authentic Products', desc: '100% genuine products from trusted brands and authorized channels.' },
              { icon: '🛡️', title: 'Official Warranty', desc: 'Warranty support for eligible products — no grey market, no surprises.' },
              { icon: '🏪', title: 'Two Physical Stores', desc: 'Visit us in person, inspect products and get expert assistance before you buy.' },
              { icon: '🔒', title: 'Secure Shopping', desc: 'Safe and reliable online ordering with encrypted transactions.' },
              { icon: '🚚', title: 'Fast Delivery', desc: 'Reliable delivery across Bangladesh — Dhaka metro within 24–48 hours.' },
              { icon: '💬', title: 'Expert Support', desc: 'Get help choosing the right device for your needs from our knowledgeable team.' },
            ].map((f) => (
              <div key={f.title} className="bg-white/10 backdrop-blur rounded-2xl p-5 border border-white/20">
                <div className="text-2xl mb-3">{f.icon}</div>
                <h3 className="font-700 text-white mb-2">{f.title}</h3>
                <p className="text-blue-100 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Store Locations */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-800 text-slate-900 dark:text-white mb-2">Visit SMSTech</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Prefer to shop in person? Visit one of our stores.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          {[1, 2].map((n) => (
            <div key={n} className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800 overflow-hidden hover:shadow-lg transition-all">
              <div className="h-48 bg-slate-100 dark:bg-slate-900 relative overflow-hidden">
                <img
                  src={`https://images.unsplash.com/photo-154${n === 1 ? '7836114731' : '1807084-5c52b6b3adef'}?w=600&h=300&fit=crop&auto=format`}
                  alt={`Store ${n}`}
                  className="w-full h-full object-cover opacity-60"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent flex items-end p-5">
                  <span className="font-700 text-white text-lg">SMSTech — Store 0{n}</span>
                </div>
              </div>
              <div className="p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-blue-600 dark:text-blue-400 mt-0.5">📍</span>
                  <div>
                    <p className="font-600 text-slate-900 dark:text-white text-sm">Dhaka, Bangladesh</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Exact address displayed in store locator</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-blue-600 dark:text-blue-400">📞</span>
                  <p className="text-sm text-slate-700 dark:text-slate-300">+880 1XXX-XXXXXX</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-blue-600 dark:text-blue-400">🕐</span>
                  <p className="text-sm text-slate-700 dark:text-slate-300">Sun–Thu 10am–8pm · Fri–Sat 12pm–8pm</p>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {['Laptops', 'Smartphones', 'Accessories'].map((c) => (
                    <span key={c} className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs font-600 rounded-lg">{c}</span>
                  ))}
                </div>
                <div className="flex gap-2 pt-2">
                  <Link href="/stores" className="flex-1 py-2 text-center text-sm font-600 border border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors">
                    Get Directions
                  </Link>
                  <Link href="/stores" className="flex-1 py-2 text-center text-sm font-600 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors">
                    View Store
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* New Arrivals promo */}
      <section className="bg-slate-50 dark:bg-slate-900/60 py-16 transition-colors">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-800 text-slate-900 dark:text-white">New Arrivals</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Just landed — fresh from the brands</p>
            </div>
            <Link href="/new-arrivals" className="text-blue-600 dark:text-blue-400 font-600 text-sm hover:underline">View All →</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[...laptops, ...smartphones].filter((p) => p.isNew).slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </section>

      {/* Promo banner */}
      <section className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-5">
          <div className="relative rounded-2xl overflow-hidden bg-slate-900 dark:bg-slate-950 p-8 flex flex-col justify-between min-h-48">
            <img src="https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=600&h=300&fit=crop&auto=format" alt="Gaming" className="absolute inset-0 w-full h-full object-cover opacity-25" />
            <div className="relative">
              <span className="text-xs font-700 text-red-400 uppercase tracking-wide">🎮 Gaming</span>
              <h3 className="text-2xl font-800 text-white mt-2">Gaming Starts Here.</h3>
              <p className="text-slate-400 text-sm mt-1">RTX 4060 &amp; above · Up to ৳25,000 off</p>
            </div>
            <Link href="/laptops?cat=gaming" className="relative self-start mt-4 px-5 py-2.5 bg-red-500 text-white font-700 rounded-xl text-sm hover:bg-red-600 transition-colors">
              Shop Gaming Laptops
            </Link>
          </div>
          <div className="relative rounded-2xl overflow-hidden bg-blue-50 dark:bg-slate-800 border border-blue-100 dark:border-slate-700 p-8 flex flex-col justify-between min-h-48">
            <img src="https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=600&h=300&fit=crop&auto=format" alt="Smartphones" className="absolute inset-0 w-full h-full object-cover opacity-20" />
            <div className="relative">
              <span className="text-xs font-700 text-blue-600 dark:text-blue-400 uppercase tracking-wide">📱 Flagship</span>
              <h3 className="text-2xl font-800 text-slate-900 dark:text-white mt-2">Your Next Smartphone Is Here.</h3>
              <p className="text-slate-600 dark:text-slate-300 text-sm mt-1">iPhone 17 · Galaxy S26 · OnePlus 13</p>
            </div>
            <Link href="/smartphones" className="relative self-start mt-4 px-5 py-2.5 bg-blue-600 text-white font-700 rounded-xl text-sm hover:bg-blue-700 transition-colors">
              Shop Flagship Phones
            </Link>
          </div>
        </div>
      </section>

      {/* Reviews */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <h2 className="text-2xl md:text-3xl font-800 text-slate-900 dark:text-white text-center mb-2">Trusted by Our Customers</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm text-center mb-10">Real experiences from real buyers</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
          {reviews.map((r, i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/80 p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex mb-3">
                {[1,2,3,4,5].map((s) => (
                  <svg key={s} viewBox="0 0 12 12" className={`w-3.5 h-3.5 ${s <= r.rating ? 'fill-amber-400' : 'fill-slate-200 dark:fill-slate-700'}`}>
                    <path d="M6 1l1.4 2.8L10.6 4.3 8.3 6.5l.5 3.2L6 8.1 3.2 9.7l.5-3.2L1.4 4.3l3.2-.5z" />
                  </svg>
                ))}
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-4">"{r.text}"</p>
              <div className="pt-3 border-t border-slate-50 dark:border-slate-700/60">
                <p className="font-700 text-slate-900 dark:text-white text-sm">{r.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{r.city}</p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-500">Purchased: {r.product}</p>
                <span className="inline-block mt-1 text-[10px] px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded-full font-600">✓ Verified Purchase</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-slate-50 dark:bg-slate-900/60 py-16 transition-colors">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-800 text-slate-900 dark:text-white text-center mb-2">Frequently Asked Questions</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm text-center mb-10">Got questions? We've got answers.</p>
          <div className="space-y-3">
            {faqs.map((f, i) => (
              <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/80 overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full px-5 py-4 flex items-center justify-between text-left"
                >
                  <span className="font-600 text-slate-900 dark:text-white text-sm">{f.q}</span>
                  <svg viewBox="0 0 24 24" className={`w-5 h-5 text-slate-400 dark:text-slate-500 shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4">
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{f.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link href="/faq" className="text-blue-600 dark:text-blue-400 font-600 text-sm hover:underline">View All FAQs →</Link>
          </div>
        </div>
      </section>

      {/* Newsletter CTA */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <div className="bg-slate-900 dark:bg-slate-950 rounded-3xl p-10 text-center relative overflow-hidden transition-colors">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, #2563EB 0%, transparent 50%), radial-gradient(circle at 70% 50%, #7C3AED 0%, transparent 50%)' }} />
          <div className="relative">
            <h2 className="text-2xl md:text-3xl font-800 text-white mb-2">Stay Updated with the Latest Tech</h2>
            <p className="text-slate-400 text-sm mb-8">Get notified about new arrivals, exclusive deals, and product launches.</p>
            <div className="flex gap-2 max-w-md mx-auto">
              <input
                type="email"
                placeholder="Enter your email address"
                className="flex-1 px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-slate-400 text-sm focus:outline-none focus:border-blue-400"
              />
              <button className="px-5 py-3 bg-blue-600 text-white font-700 rounded-xl text-sm hover:bg-blue-700 transition-colors whitespace-nowrap">
                Subscribe
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-3">No spam. Unsubscribe anytime.</p>
          </div>
        </div>
      </section>
    </div>
  )
}

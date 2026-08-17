'use client'

import { useState } from 'react'
import Link from 'next/link'

const categories = ['All', 'Orders', 'Delivery', 'Payments', 'Warranty', 'Returns', 'Store Pickup', 'Authenticity']

const faqs = [
  { cat: 'Authenticity', q: 'Are your products genuine?', a: 'Yes. Every product at SMSTech is 100% genuine, sourced from authorized brand distributors and official channels. We do not sell grey market or refurbished products unless explicitly stated.' },
  { cat: 'Warranty', q: 'What warranty do your products have?', a: 'Warranty varies by brand and product. Most laptops carry 1–2 year official manufacturer warranties, and smartphones typically carry 1 year. The exact warranty for each product is listed on its product page.' },
  { cat: 'Store Pickup', q: 'Can I order online and pick up from a store?', a: 'Yes! Select "Store Pickup" during checkout and choose Store 01 or Store 02. Your order will be ready for pickup within a few hours and you\'ll receive an SMS notification.' },
  { cat: 'Delivery', q: 'How long does delivery take?', a: 'Within Dhaka metro: 24–48 hours. Outside Dhaka: typically 2–4 business days depending on the destination. Express delivery options may be available for certain areas.' },
  { cat: 'Payments', q: 'What payment methods are supported?', a: 'We accept: Cash on Delivery (COD), bKash, Nagad, Rocket, Visa and Mastercard debit/credit cards, and bank transfer. Payment options are shown at checkout.' },
  { cat: 'Orders', q: 'How can I check product availability at a specific store?', a: 'Each product page shows real-time availability for Store 01, Store 02, and online delivery under the "Store Availability" tab. You can also call us directly to confirm.' },
  { cat: 'Returns', q: 'What is your return policy?', a: 'We accept returns within 7 days of purchase for products in original, unused condition with all original packaging. Warranty claims are handled separately through the brand\'s service center.' },
  { cat: 'Orders', q: 'Can I cancel or modify my order?', a: 'Orders can be cancelled or modified before dispatch. Contact us immediately via phone or email. Once shipped, changes are not possible but returns can be arranged post-delivery.' },
  { cat: 'Delivery', q: 'Is delivery available outside Dhaka?', a: 'Yes. We deliver across Bangladesh through our courier partners. Delivery times and charges vary by location. Free delivery is available on qualifying orders.' },
  { cat: 'Warranty', q: 'What happens if my product has a defect?', a: 'Contact us immediately. For genuine manufacturing defects within the warranty period, we\'ll help facilitate the warranty claim with the brand\'s authorized service center.' },
]

export default function FAQ() {
  const [activeCategory, setActiveCategory] = useState('All')
  const [openItem, setOpenItem] = useState<number | null>(null)

  const filtered = activeCategory === 'All' ? faqs : faqs.filter((f) => f.cat === activeCategory)

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-800 text-slate-900 dark:text-white mb-2">Frequently Asked Questions</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm">Find answers to common questions about shopping at SMSTech.</p>
      </div>

      {/* Categories */}
      <div className="flex flex-wrap gap-2 mb-8 justify-center">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => { setActiveCategory(cat); setOpenItem(null) }}
            className={`px-4 py-2 rounded-full text-sm font-600 transition-all
              ${activeCategory === cat ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Accordion */}
      <div className="space-y-3">
        {filtered.map((item, i) => (
          <div key={i} className="border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800/80 rounded-2xl overflow-hidden hover:border-blue-200 dark:hover:border-blue-500 transition-colors">
            <button
              onClick={() => setOpenItem(openItem === i ? null : i)}
              className="w-full flex items-center justify-between px-6 py-4 text-left"
            >
              <div>
                <span className="text-xs font-700 text-blue-600 dark:text-blue-400 uppercase tracking-wide mr-3">{item.cat}</span>
                <span className="font-600 text-slate-900 dark:text-white text-sm">{item.q}</span>
              </div>
              <svg viewBox="0 0 24 24" className={`w-5 h-5 text-slate-400 dark:text-slate-500 shrink-0 ml-4 transition-transform ${openItem === i ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {openItem === i && (
              <div className="px-6 pb-5">
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{item.a}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-12 bg-blue-50 dark:bg-blue-950/60 rounded-2xl p-8 text-center border border-blue-100 dark:border-blue-900">
        <h3 className="font-700 text-slate-900 dark:text-white mb-2">Still have questions?</h3>
        <p className="text-slate-600 dark:text-slate-300 text-sm mb-4">Our team is happy to help. Reach out through any of the options below.</p>
        <div className="flex gap-3 justify-center">
          <Link href="/contact" className="px-5 py-2.5 bg-blue-600 text-white font-600 rounded-xl text-sm hover:bg-blue-700 transition-colors">Contact Us</Link>
          <Link href="/stores" className="px-5 py-2.5 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-600 rounded-xl text-sm hover:bg-blue-50 dark:hover:bg-blue-900 transition-colors">Visit a Store</Link>
        </div>
      </div>
    </div>
  )
}

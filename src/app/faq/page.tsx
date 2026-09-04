'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, MessageCircle, Search, Store } from 'lucide-react'
import Container from '../../components/ui/container'
import { Breadcrumbs } from '../../components/CollectionView'

const categories = [
  'All',
  'Condition & grading',
  'Warranty',
  'Returns',
  'Delivery',
  'Payments',
  'Orders',
  'Store pickup',
]

const faqs: { cat: string; q: string; a: string }[] = [
  {
    cat: 'Condition & grading',
    q: 'What do your condition grades actually mean?',
    a: 'We use five grades. Brand New is factory sealed. Open Box (A+) has been opened but never used, with no cosmetic marks. Grade A is excellent — light use, nothing visible at arm’s length, battery health 90% or better. Grade B has minor cosmetic marks that do not affect use, battery health 85% or better. Grade C has visible chassis wear but is fully tested and functionally sound. The grade appears on every listing, on the product card, and in your cart.',
  },
  {
    cat: 'Condition & grading',
    q: 'Do you publish battery health on used devices?',
    a: 'Yes. We measure capacity against the original design capacity on every pre-owned device, and the figure appears on the listing. If a listing does not show one yet, contact us and we will send that specific unit’s reading before you order. Batteries are consumables, so they are not covered by the hardware warranty.',
  },
  {
    cat: 'Condition & grading',
    q: 'What is checked in the 32-point inspection?',
    a: 'Display (dead pixels, backlight bleed, brightness uniformity), chassis and hinges, every key and the trackpad, all ports, Wi-Fi, Bluetooth and cellular radios, storage health via SMART data, sustained thermal load, and measured battery capacity. It is done by hand on every unit, not sampled across a batch.',
  },
  {
    cat: 'Condition & grading',
    q: 'What if the device does not match its published grade?',
    a: 'Send it back. If a pre-owned device differs from its published grade in any way, we refund in full and cover the return shipping as well.',
  },
  {
    cat: 'Warranty',
    q: 'What warranty comes with my purchase?',
    a: 'Brand new devices carry the full manufacturer warranty — typically 1–2 years for laptops and 1 year for smartphones — registered in your name at the point of sale. Certified pre-owned devices ship with six months of SMSTech cover on hardware faults. The exact term is stated on every product page.',
  },
  {
    cat: 'Warranty',
    q: 'How do I make a warranty claim?',
    a: 'Bring the device to either store with your order number, or contact us to arrange a collection. For new devices we can either handle the claim through the brand’s authorised service network or point you to it directly. For pre-owned devices we diagnose and repair in-house.',
  },
  {
    cat: 'Warranty',
    q: 'What is not covered?',
    a: 'Accidental damage, liquid ingress, unauthorised repairs, and normal battery capacity decline. Cosmetic marks already disclosed in the listing grade are also not defects.',
  },
  {
    cat: 'Returns',
    q: 'What is your return policy?',
    a: 'Seven days from delivery. Return the device in its original condition with all accessories and packaging for a full refund. There is no restocking fee. Warranty claims run separately for the full term stated on the product page.',
  },
  {
    cat: 'Orders',
    q: 'Are your products genuine?',
    a: 'Yes. New stock is sourced through authorised brand distributors, and every pre-owned unit is logged against its serial number or IMEI before listing. If a device ever fails an authenticity check, we refund in full.',
  },
  {
    cat: 'Orders',
    q: 'Can I cancel or change my order?',
    a: 'Yes, any time before dispatch — call or email us and we will amend it. Once the device has been handed to the courier we cannot change it, but the seven-day return still applies after delivery.',
  },
  {
    cat: 'Orders',
    q: 'How do I know whether a device is in stock at a particular store?',
    a: 'The Availability tab on each product page shows whether that unit is held online, at Store 01 or at Store 02. You can also call either store to confirm before travelling.',
  },
  {
    cat: 'Delivery',
    q: 'How long does delivery take?',
    a: 'Dhaka metro is typically 24–48 hours. Outside Dhaka is 2–4 business days depending on the destination. Delivery is free on orders above ৳1,00,000.',
  },
  {
    cat: 'Delivery',
    q: 'Do you deliver outside Dhaka?',
    a: 'Yes, nationwide through our courier partners. Charges and timings vary by location and are calculated at checkout.',
  },
  {
    cat: 'Payments',
    q: 'What payment methods do you accept?',
    a: 'Cash on delivery, bKash, Nagad, Rocket, Visa and Mastercard debit and credit cards, and bank transfer. Bank EMI is available on qualifying purchases.',
  },
  {
    cat: 'Store pickup',
    q: 'Can I order online and collect in store?',
    a: 'Yes. Choose Store Pickup at checkout and select your branch. We notify you by SMS once the device has passed its final inspection and is ready — usually the same day.',
  },
]

export default function FAQ() {
  const [activeCategory, setActiveCategory] = useState('All')
  const [openItem, setOpenItem] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()
  const filtered = faqs.filter((f) => {
    const matchesCat = activeCategory === 'All' || f.cat === activeCategory
    const matchesQuery = !q || f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q)
    return matchesCat && matchesQuery
  })

  return (
    <Container className="py-8 md:py-12">
      <Breadcrumbs items={[{ label: 'FAQ' }]} />

      <div className="mx-auto max-w-3xl">
        <header className="mb-8">
          <h1 className="font-display text-[30px] font-semibold leading-tight tracking-[-0.025em] text-ink md:text-[38px]">
            Frequently asked questions
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
            Grading, warranty, returns and delivery — the things worth knowing before you buy a
            device this expensive.
          </p>
        </header>

        <div className="relative mb-5">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"
            strokeWidth={2}
          />
          <label htmlFor="faq-search" className="sr-only">
            Search questions
          </label>
          <input
            id="faq-search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpenItem(null)
            }}
            placeholder="Search questions…"
            className="h-11 w-full rounded-lg border border-line bg-surface-2 pl-10 pr-3 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:bg-surface focus:outline-none focus:ring-3 focus:ring-accent/15"
          />
        </div>

        <div className="mb-8 flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setActiveCategory(cat)
                setOpenItem(null)
              }}
              className={`rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors ${
                activeCategory === cat
                  ? 'border-ink bg-inverse text-inverse-ink'
                  : 'border-line text-ink-2 hover:border-line-2 hover:text-ink'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="rounded-xl border border-line bg-surface px-6 py-14 text-center text-[13.5px] text-ink-2">
            No questions match that search.{' '}
            <Link href="/contact" className="font-medium text-accent">
              Ask us directly
            </Link>{' '}
            and we&rsquo;ll answer within a few hours.
          </p>
        ) : (
          <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {filtered.map((item) => {
              const open = openItem === item.q
              return (
                <div key={item.q}>
                  <h2>
                    <button
                      onClick={() => setOpenItem(open ? null : item.q)}
                      aria-expanded={open}
                      className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-surface-2"
                    >
                      <span className="min-w-0">
                        <span className="eyebrow block">{item.cat}</span>
                        <span className="mt-1 block text-[14.5px] font-medium tracking-tight text-ink">
                          {item.q}
                        </span>
                      </span>
                      <ChevronDown
                        className={`mt-1 h-4 w-4 shrink-0 text-ink-3 transition-transform ${open ? 'rotate-180' : ''}`}
                        strokeWidth={2}
                      />
                    </button>
                  </h2>
                  {open && (
                    <div className="animate-fade-in px-5 pb-5">
                      <p className="max-w-2xl text-[13.5px] leading-relaxed text-ink-2">{item.a}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-10 rounded-xl border border-line bg-surface-2 p-6 text-center">
          <h2 className="font-display text-base font-semibold tracking-tight text-ink">
            Still not answered?
          </h2>
          <p className="mx-auto mt-1.5 max-w-md text-[13.5px] leading-relaxed text-ink-2">
            Ask us anything about a specific unit — its grade, its battery, what it comes with. We
            reply within a few hours, seven days a week.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link
              href="/contact"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover"
            >
              <MessageCircle className="h-4 w-4" strokeWidth={2} />
              Contact us
            </Link>
            <Link
              href="/stores"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-surface px-4 text-sm font-medium text-ink transition-colors hover:border-line-2"
            >
              <Store className="h-4 w-4" strokeWidth={2} />
              Visit a store
            </Link>
          </div>
        </div>
      </div>
    </Container>
  )
}

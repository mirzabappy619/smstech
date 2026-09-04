'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Clock, Mail, MapPin, Phone, ShieldCheck } from 'lucide-react'
import Container from '../../components/ui/container'
import { Breadcrumbs } from '../../components/CollectionView'
import { stores } from '../../data/stores'

export default function Stores() {
  const [activeStore, setActiveStore] = useState(stores[0])

  return (
    <Container className="py-8 md:py-12">
      <Breadcrumbs items={[{ label: 'Stores' }]} />

      <header className="mb-10 max-w-2xl">
        <h1 className="font-display text-[30px] font-semibold leading-tight tracking-[-0.025em] text-ink md:text-[38px]">
          Visit us in person
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
          For a purchase this size, most people would rather hold the thing first. Come in, compare
          configurations side by side, and ask the person who inspected the device.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Store list */}
        <div className="space-y-4">
          {stores.map((store) => {
            const active = activeStore.id === store.id
            return (
              <button
                key={store.id}
                onClick={() => setActiveStore(store)}
                aria-pressed={active}
                className={`block w-full overflow-hidden rounded-xl border bg-surface text-left transition-colors ${
                  active ? 'border-ink' : 'border-line hover:border-line-2'
                }`}
              >
                <div className="border-b border-line px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
                        {store.name}
                      </h2>
                      <p className="mt-0.5 text-[13px] text-ink-3">{store.area}</p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-verified-line bg-verified-soft px-2 py-0.5 text-[11px] font-medium text-verified">
                      <span className="h-1.5 w-1.5 rounded-full bg-verified" />
                      Open today
                    </span>
                  </div>
                </div>

                <dl className="space-y-3 px-5 py-4 text-[13.5px]">
                  <div className="flex gap-3">
                    <dt className="sr-only">Address</dt>
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" strokeWidth={2} />
                    <dd className="leading-relaxed text-ink">{store.address}</dd>
                  </div>
                  <div className="flex gap-3">
                    <dt className="sr-only">Phone</dt>
                    <Phone className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" strokeWidth={2} />
                    <dd className="tnum text-ink">{store.phone}</dd>
                  </div>
                  <div className="flex gap-3">
                    <dt className="sr-only">Email</dt>
                    <Mail className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" strokeWidth={2} />
                    <dd className="text-ink">{store.email}</dd>
                  </div>
                  <div className="flex gap-3">
                    <dt className="sr-only">Opening hours</dt>
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" strokeWidth={2} />
                    <dd className="text-ink">{store.hours}</dd>
                  </div>
                </dl>

                <div className="flex flex-wrap gap-1.5 px-5 pb-4">
                  {store.stocks.map((s) => (
                    <span
                      key={s}
                      className="rounded-md border border-line bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink-2"
                    >
                      {s}
                    </span>
                  ))}
                </div>

                <div className="flex gap-2 border-t border-line p-4">
                  <a
                    href={`https://www.google.com/maps?q=${encodeURIComponent(store.mapQuery)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent text-[13px] font-medium text-on-accent transition-colors hover:bg-accent-hover"
                  >
                    Get directions
                    <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
                  </a>
                  <a
                    href={`tel:${store.phone.split('/')[0].trim()}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-line text-[13px] font-medium text-ink transition-colors hover:border-line-2 hover:bg-surface-2"
                  >
                    <Phone className="h-3.5 w-3.5" strokeWidth={2} />
                    Call the store
                  </a>
                </div>
              </button>
            )
          })}

          <div className="flex items-start gap-3 rounded-xl border border-line bg-surface-2 p-5">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-verified" strokeWidth={2} />
            <p className="text-[13px] leading-relaxed text-ink-2">
              <strong className="font-medium text-ink">Reserve before you travel.</strong> Order
              online with Store Pickup and we&rsquo;ll hold the exact unit — inspected, graded and
              ready — so you don&rsquo;t make the trip for something that has already sold.
            </p>
          </div>
        </div>

        {/* Map */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="h-80 overflow-hidden rounded-xl border border-line bg-surface-2 lg:h-[460px]">
            <iframe
              title={`${activeStore.name} location`}
              src={`https://maps.google.com/maps?q=${encodeURIComponent(activeStore.mapQuery)}&t=&z=16&ie=UTF8&iwloc=&output=embed`}
              className="h-full w-full border-0"
              loading="lazy"
            />
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-line bg-surface">
            <div className="border-b border-line px-5 py-3.5">
              <h2 className="font-display text-[15px] font-semibold tracking-tight text-ink">
                What you can do in store
              </h2>
            </div>
            <ul className="divide-y divide-line text-[13.5px]">
              {[
                'Inspect any device, including graded pre-owned stock, before paying',
                'Compare two configurations of the same model side by side',
                'Collect an online order the same day it clears inspection',
                'Bring in a device for a warranty claim or diagnosis',
              ].map((t) => (
                <li key={t} className="px-5 py-3 leading-relaxed text-ink-2">
                  {t}
                </li>
              ))}
            </ul>
            <div className="border-t border-line bg-surface-2 px-5 py-3.5">
              <Link href="/contact" className="text-[13px] font-medium text-accent">
                Questions before you visit? Contact us →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Container>
  )
}

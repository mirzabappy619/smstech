'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Clock,
  Facebook,
  Instagram,
  MapPin,
  MessageCircle,
  Phone,
  RotateCcw,
  ShieldCheck,
  Youtube,
} from 'lucide-react'
import Container from './ui/container'

type Settings = {
  store_name?: string
  store_address?: string
  store_phone?: string
  social_facebook?: string
  social_instagram?: string
  social_youtube?: string
  social_whatsapp?: string
  social_twitter?: string
}

const columns: { heading: string; links: [string, string][] }[] = [
  {
    heading: 'Shop',
    links: [
      ['Laptops', '/laptops'],
      ['Smartphones', '/smartphones'],
      ['Certified pre-owned', '/laptops?cat=pre-owned'],
      ['Deals', '/deals'],
      ['New arrivals', '/new-arrivals'],
      ['All brands', '/brands'],
    ],
  },
  {
    heading: 'Support',
    links: [
      ['Track your order', '/track-order'],
      ['Contact us', '/contact'],
      ['Warranty claims', '/faq?cat=warranty'],
      ['Returns & refunds', '/faq?cat=returns'],
      ['FAQ', '/faq'],
      ['Compare devices', '/compare'],
    ],
  },
  {
    heading: 'Company',
    links: [
      ['About SMSTech', '/about'],
      ['Our stores', '/stores'],
      ['How we grade devices', '/about#grading'],
      ['Privacy policy', '/faq?cat=privacy'],
      ['Terms & conditions', '/faq?cat=terms'],
    ],
  },
]

const guarantees = [
  { icon: ShieldCheck, title: 'Authenticity guaranteed', body: 'Sourced through authorised channels only.' },
  { icon: RotateCcw, title: '7-day returns', body: 'Change your mind within a week of delivery.' },
  { icon: MapPin, title: 'Walk-in showroom', body: 'Inspect any device in person before you buy.' },
]

export default function Footer() {
  const [settings, setSettings] = useState<Settings>({
    store_name: 'SMSTech BD',
    store_address:
      'Shop 309, Level 03, Computer City Market (Multiplan), New Elephant Road (69–71), Dhaka 1205',
    store_phone: '01781485588, 01723249598',
    social_facebook: 'https://facebook.com',
    social_instagram: 'https://instagram.com',
    social_youtube: 'https://youtube.com',
    social_whatsapp: 'https://wa.me/8801781485588',
  })

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/v1/settings')
        const data = await res.json()
        if (data) setSettings((prev) => ({ ...prev, ...data }))
      } catch (e) {
        console.error('Failed to load footer settings:', e)
      }
    }
    loadSettings()
  }, [])

  const socials = [
    { href: settings.social_facebook, label: 'Facebook', Icon: Facebook },
    { href: settings.social_instagram, label: 'Instagram', Icon: Instagram },
    { href: settings.social_youtube, label: 'YouTube', Icon: Youtube },
    { href: settings.social_whatsapp, label: 'WhatsApp', Icon: MessageCircle },
  ].filter((s) => Boolean(s.href))

  return (
    <footer className="mt-24 border-t border-line bg-surface">
      {/* Guarantee strip */}
      <div className="border-b border-line">
        <Container className="grid gap-6 py-8 sm:grid-cols-3">
          {guarantees.map((g) => {
            const Icon = g.icon
            return (
              <div key={g.title} className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 text-ink">
                  <Icon className="h-4 w-4" strokeWidth={2} />
                </span>
                <div>
                  <p className="text-sm font-medium text-ink">{g.title}</p>
                  <p className="mt-0.5 text-[13px] text-ink-3">{g.body}</p>
                </div>
              </div>
            )
          })}
        </Container>
      </div>

      <Container className="grid gap-10 py-14 md:grid-cols-12">
        {/* Brand */}
        <div className="md:col-span-4">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-inverse font-display text-[13px] font-bold tracking-tight text-inverse-ink">
              SM
            </span>
            <span className="font-display text-[19px] font-semibold tracking-tight text-ink">
              SMSTech
              <span className="ml-1 align-super text-[10px] font-medium tracking-[0.14em] text-ink-3">
                BD
              </span>
            </span>
          </Link>

          <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-ink-2">
            Bangladesh&rsquo;s specialist in high-end laptops and smartphones — brand new and
            certified pre-owned, every unit inspected and graded before it is listed.
          </p>

          {socials.length > 0 && (
            <div className="mt-6 flex gap-2">
              {socials.map(({ href, label, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  title={label}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink-2 transition-colors hover:border-line-2 hover:bg-surface-2 hover:text-ink"
                >
                  <Icon className="h-4 w-4" strokeWidth={2} />
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Link columns */}
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:col-span-5">
          {columns.map((col) => (
            <div key={col.heading}>
              <p className="eyebrow mb-3.5">{col.heading}</p>
              <ul className="space-y-2.5">
                {col.links.map(([label, href]) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="text-[13.5px] text-ink-2 transition-colors hover:text-accent"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Store card */}
        <div className="md:col-span-3">
          <p className="eyebrow mb-3.5">Visit us</p>
          <div className="rounded-xl border border-line bg-surface-2 p-4">
            <p className="text-sm font-medium text-ink">
              {settings.store_name || 'SMSTech'} — Multiplan
            </p>
            <ul className="mt-3 space-y-2.5 text-[13px] text-ink-2">
              <li className="flex gap-2.5">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-3" strokeWidth={2} />
                <span className="leading-relaxed">{settings.store_address}</span>
              </li>
              <li className="flex gap-2.5">
                <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-3" strokeWidth={2} />
                <span className="tnum">{settings.store_phone}</span>
              </li>
              <li className="flex gap-2.5">
                <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-3" strokeWidth={2} />
                <span>10:00 AM – 8:00 PM daily</span>
              </li>
            </ul>
            <Link
              href="/stores"
              className="group mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-accent"
            >
              Directions &amp; map
              <ArrowRight
                className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                strokeWidth={2}
              />
            </Link>
          </div>
        </div>
      </Container>

      <div className="border-t border-line">
        <Container className="flex flex-col items-center justify-between gap-4 py-5 sm:flex-row">
          <p className="text-xs text-ink-3">
            © {new Date().getFullYear()} {settings.store_name || 'SMSTech'}. All rights reserved.
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-3">We accept</span>
            {['Visa', 'Mastercard', 'bKash', 'Nagad', 'Cash on delivery'].map((m) => (
              <span
                key={m}
                className="rounded border border-line px-1.5 py-0.5 text-[10px] font-medium text-ink-3"
              >
                {m}
              </span>
            ))}
          </div>
        </Container>
      </div>
    </footer>
  )
}

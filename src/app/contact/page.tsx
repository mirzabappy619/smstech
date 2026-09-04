'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
} from 'lucide-react'
import Container from '../../components/ui/container'
import { Breadcrumbs } from '../../components/CollectionView'

const FIELDS = [
  { label: 'Full name', field: 'name', type: 'text', ph: 'Your name', required: true },
  { label: 'Phone number', field: 'phone', type: 'tel', ph: '017…', required: true },
  { label: 'Email address', field: 'email', type: 'email', ph: 'you@example.com', required: false },
  { label: 'Subject', field: 'subject', type: 'text', ph: 'What is this about?', required: false },
] as const

export default function Contact() {
  const [form, setForm] = useState({ name: '', phone: '', email: '', subject: '', message: '' })
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
  }

  return (
    <Container className="py-8 md:py-12">
      <Breadcrumbs items={[{ label: 'Contact' }]} />

      <header className="mb-10 max-w-2xl">
        <h1 className="font-display text-[30px] font-semibold leading-tight tracking-[-0.025em] text-ink md:text-[38px]">
          Get in touch
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
          Questions about a specific unit — its grade, battery reading, or what&rsquo;s in the box?
          Ask. We answer within a few hours, seven days a week.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Form */}
        <div className="lg:col-span-7">
          {submitted ? (
            <div className="rounded-xl border border-line bg-surface px-6 py-16 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-verified-line bg-verified-soft text-verified">
                <CheckCircle2 className="h-6 w-6" strokeWidth={1.75} />
              </span>
              <h2 className="mt-4 font-display text-lg font-semibold tracking-tight text-ink">
                Message sent
              </h2>
              <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed text-ink-2">
                Thanks — we&rsquo;ll get back to you within 24 hours, usually much sooner.
              </p>
              <button
                onClick={() => {
                  setSubmitted(false)
                  setForm({ name: '', phone: '', email: '', subject: '', message: '' })
                }}
                className="mt-6 inline-flex h-10 items-center rounded-lg border border-line px-4 text-sm font-medium text-ink transition-colors hover:border-line-2 hover:bg-surface-2"
              >
                Send another message
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="overflow-hidden rounded-xl border border-line bg-surface"
            >
              <div className="border-b border-line px-6 py-4">
                <h2 className="font-display text-base font-semibold tracking-tight text-ink">
                  Send a message
                </h2>
              </div>

              <div className="space-y-4 p-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  {FIELDS.map((f) => (
                    <div key={f.field}>
                      <label
                        htmlFor={`contact-${f.field}`}
                        className="mb-1.5 block text-[13px] font-medium text-ink"
                      >
                        {f.label}
                        {f.required && <span className="text-danger"> *</span>}
                      </label>
                      <input
                        id={`contact-${f.field}`}
                        type={f.type}
                        required={f.required}
                        value={form[f.field]}
                        onChange={(e) => setForm({ ...form, [f.field]: e.target.value })}
                        placeholder={f.ph}
                        className="h-11 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:bg-surface focus:outline-none focus:ring-3 focus:ring-accent/15"
                      />
                    </div>
                  ))}
                </div>

                <div>
                  <label
                    htmlFor="contact-message"
                    className="mb-1.5 block text-[13px] font-medium text-ink"
                  >
                    Message <span className="text-danger">*</span>
                  </label>
                  <textarea
                    id="contact-message"
                    rows={6}
                    required
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    placeholder="If it's about a specific device, include the model or the order number and we can answer precisely."
                    className="w-full resize-none rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:bg-surface focus:outline-none focus:ring-3 focus:ring-accent/15"
                  />
                </div>
              </div>

              <div className="border-t border-line bg-surface-2 px-6 py-4">
                <button
                  type="submit"
                  className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-accent text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover sm:w-auto sm:px-6"
                >
                  Send message
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Details */}
        <div className="space-y-4 lg:col-span-5">
          <ul className="grid gap-px overflow-hidden rounded-xl border border-line bg-line">
            {[
              { Icon: Phone, t: 'Phone', v: '01781485588 · 01723249598', href: 'tel:+8801781485588' },
              { Icon: Mail, t: 'Email', v: 'info@smstech.bd', href: 'mailto:info@smstech.bd' },
              { Icon: MessageCircle, t: 'WhatsApp', v: 'Message us', href: 'https://wa.me/8801781485588' },
              { Icon: Clock, t: 'Hours', v: '10:00 AM – 8:00 PM, daily' },
            ].map(({ Icon, t, v, href }) => (
              <li key={t} className="bg-surface">
                {href ? (
                  <a
                    href={href}
                    className="flex items-center gap-3.5 px-5 py-4 transition-colors hover:bg-surface-2"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-ink-3" strokeWidth={2} />
                    <span className="min-w-0">
                      <span className="block text-xs text-ink-3">{t}</span>
                      <span className="tnum block truncate text-[14px] font-medium text-ink">
                        {v}
                      </span>
                    </span>
                  </a>
                ) : (
                  <div className="flex items-center gap-3.5 px-5 py-4">
                    <Icon className="h-4 w-4 shrink-0 text-ink-3" strokeWidth={2} />
                    <span>
                      <span className="block text-xs text-ink-3">{t}</span>
                      <span className="block text-[14px] font-medium text-ink">{v}</span>
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>

          <div className="rounded-xl border border-line bg-surface p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-[15px] font-semibold tracking-tight text-ink">
                SMSTech — Multiplan
              </h2>
              <span className="shrink-0 rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-ink-3">
                Main store
              </span>
            </div>
            <p className="mt-3 flex gap-2.5 text-[13px] leading-relaxed text-ink-2">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-3" strokeWidth={2} />
              Shop 309, Level 03, Computer City Market (Multiplan), New Elephant Road (69–71), Dhaka
              1205
            </p>
            <Link
              href="/stores"
              className="group mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-accent"
            >
              Map and directions
              <ArrowRight
                className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                strokeWidth={2}
              />
            </Link>
          </div>

          <div className="rounded-xl border border-line bg-surface-2 p-5">
            <p className="text-[13px] leading-relaxed text-ink-2">
              Chasing an existing order?{' '}
              <Link href="/track-order" className="font-medium text-accent">
                Track it here
              </Link>{' '}
              with your order number — it&rsquo;s faster than emailing.
            </p>
          </div>
        </div>
      </div>
    </Container>
  )
}

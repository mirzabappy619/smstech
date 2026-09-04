import Link from 'next/link'
import {
  ArrowRight,
  BadgeCheck,
  BatteryCharging,
  ClipboardCheck,
  Cpu,
  MessageCircle,
  RotateCcw,
  ShieldCheck,
  Store,
  Truck,
} from 'lucide-react'
import Container from '../../components/ui/container'
import { Breadcrumbs } from '../../components/CollectionView'
import { CONDITION_META, type ConditionGrade } from '../../components/ui/condition'

export const metadata = {
  title: 'About',
  description:
    'How SMSTech sources, inspects and grades every laptop and smartphone it sells — new and certified pre-owned.',
}

const GRADE_ORDER: ConditionGrade[] = ['new', 'like-new', 'excellent', 'good', 'fair']

const values = [
  {
    Icon: BadgeCheck,
    title: 'Authenticity first',
    body: 'New stock comes through authorised distributors. Every unit — new or traded in — is logged against its serial number or IMEI before it reaches the shop floor.',
  },
  {
    Icon: ShieldCheck,
    title: 'Warranty on everything',
    body: 'Manufacturer warranty on new devices, six months of SMSTech cover on certified pre-owned. No device leaves without one.',
  },
  {
    Icon: ClipboardCheck,
    title: 'Published, not implied',
    body: 'Condition grade, battery capacity and cosmetic marks are on the listing. If we know it, you know it before you pay.',
  },
  {
    Icon: Store,
    title: 'A place you can walk into',
    body: 'A Dhaka showroom, not just a website. Handle the device, compare configurations, and ask the person who inspected it.',
  },
  {
    Icon: Truck,
    title: 'Delivery that holds up',
    body: 'Dhaka metro in 24–48 hours, nationwide in 2–4 business days, packed to survive the trip.',
  },
  {
    Icon: RotateCcw,
    title: 'Seven days to disagree',
    body: 'Return anything in original condition within a week. If a pre-owned device misses its published grade, we cover the return shipping too.',
  },
]

export default function About() {
  return (
    <>
      <Container className="pt-8">
        <Breadcrumbs items={[{ label: 'About' }]} />
      </Container>

      {/* Intro */}
      <Container as="section" className="pb-16 md:pb-20">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-7">
            <p className="eyebrow">About SMSTech</p>
            <h1 className="mt-3 font-display text-[34px] font-semibold leading-[1.1] tracking-[-0.03em] text-ink md:text-[48px]">
              Second-hand shouldn&rsquo;t mean second-guessing
            </h1>
            <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-ink-2">
              <p>
                SMSTech sells high-end laptops and smartphones in Bangladesh — brand new from
                authorised distributors, and certified pre-owned from trade-ins we inspect ourselves.
              </p>
              <p>
                The used market runs on missing information: no grade, no battery reading, no
                serial, no warranty. We built the opposite. Every device goes through the same
                32-point inspection, gets a published grade, and ships with warranty attached
                regardless of whether it is sealed or six months old.
              </p>
              <p>
                We also keep a physical showroom in Dhaka, because for a purchase this size a lot of
                people would rather hold the thing first. That is a reasonable instinct and we have
                never tried to design it away.
              </p>
            </div>
          </div>

          <div className="lg:col-span-5">
            <img
              src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=900&h=700&fit=crop&auto=format"
              alt="The SMSTech showroom"
              className="aspect-[4/3] w-full rounded-2xl border border-line object-cover"
            />
            <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line">
              {[
                ['1', 'Dhaka showroom'],
                ['32', 'Inspection points'],
                ['500+', 'Devices listed'],
                ['7 day', 'Return window'],
              ].map(([v, l]) => (
                <div key={l} className="bg-surface px-5 py-4">
                  <dt className="tnum font-display text-xl font-semibold tracking-tight text-ink">
                    {v}
                  </dt>
                  <dd className="mt-0.5 text-xs text-ink-3">{l}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </Container>

      {/* Grading */}
      <section id="grading" className="border-y border-line bg-surface scroll-mt-24">
        <Container className="py-16 md:py-24">
          <div className="max-w-2xl">
            <p className="eyebrow">Grading</p>
            <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink md:text-[34px]">
              How we grade a device
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
              One scale, applied the same way every time. The grade is on the listing, on the card,
              and in your cart — you should never have to ask what condition means here.
            </p>
          </div>

          <ol className="mt-10 grid gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-5">
            {GRADE_ORDER.map((g) => {
              const meta = CONDITION_META[g]
              return (
                <li key={g} className="bg-surface p-6">
                  <span
                    className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${
                      meta.tone === 'verified'
                        ? 'border-verified-line bg-verified-soft text-verified'
                        : 'border-certified-line bg-certified-soft text-certified'
                    }`}
                  >
                    {meta.short}
                  </span>
                  <h3 className="mt-3.5 text-[14px] font-semibold tracking-tight text-ink">
                    {meta.label}
                  </h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{meta.blurb}</p>
                </li>
              )
            })}
          </ol>

          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {[
              {
                Icon: Cpu,
                t: 'What gets tested',
                b: 'Display, chassis, hinges, keyboard, trackpad, every port, all radios, storage health and sustained thermal load. Tested by hand, not sampled.',
              },
              {
                Icon: BatteryCharging,
                t: 'What gets measured',
                b: 'Battery capacity against original design capacity, and charge cycle count where the platform reports it. Published on the listing.',
              },
              {
                Icon: ShieldCheck,
                t: 'What gets attached',
                b: 'A warranty certificate in your name, a signed inspection checksheet, and the serial or IMEI recorded against your order.',
              },
            ].map(({ Icon, t, b }) => (
              <div key={t}>
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface-2 text-ink">
                  <Icon className="h-4 w-4" strokeWidth={2} />
                </span>
                <h3 className="mt-4 text-[15px] font-semibold tracking-tight text-ink">{t}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">{b}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Values */}
      <Container as="section" className="py-16 md:py-24">
        <div className="mb-10 max-w-2xl">
          <p className="eyebrow">What we hold to</p>
          <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink md:text-[34px]">
            Six commitments, no asterisks
          </h2>
        </div>
        <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {values.map(({ Icon, title, body }) => (
            <div key={title} className="bg-surface p-6">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface-2 text-ink">
                <Icon className="h-4 w-4" strokeWidth={2} />
              </span>
              <h3 className="mt-4 text-[15px] font-semibold tracking-tight text-ink">{title}</h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">{body}</p>
            </div>
          ))}
        </div>
      </Container>

      {/* CTA */}
      <Container as="section" className="pb-20">
        <div className="bg-grid overflow-hidden rounded-2xl border border-line bg-surface px-6 py-14 text-center md:px-12">
          <h2 className="mx-auto max-w-xl font-display text-2xl font-semibold tracking-tight text-ink md:text-[30px]">
            Come and see for yourself
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-[15px] leading-relaxed text-ink-2">
            The showroom is open seven days a week. Bring a checklist — our team would rather you
            asked the hard questions before you buy than after.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-2">
            <Link
              href="/stores"
              className="group inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-5 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover"
            >
              Find the showroom
              <ArrowRight
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                strokeWidth={2}
              />
            </Link>
            <Link
              href="/contact"
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-line px-5 text-sm font-medium text-ink transition-colors hover:border-line-2 hover:bg-surface-2"
            >
              <MessageCircle className="h-4 w-4" strokeWidth={2} />
              Talk to us
            </Link>
          </div>
        </div>
      </Container>
    </>
  )
}

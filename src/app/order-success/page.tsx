import Link from 'next/link'
import { Suspense } from 'react'
import { CheckCircle2, Mail, RotateCcw, ShieldCheck, Truck } from 'lucide-react'
import Container from '../../components/ui/container'

// The order number comes from the checkout redirect. It was previously invented
// here with Math.random(), which both broke hydration (server and client rolled
// different numbers) and showed the customer a reference that matched no order.
async function OrderNumber({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>
}) {
  const { order } = await searchParams
  if (!order) return null
  return (
    <p className="tnum mt-4 inline-flex items-center rounded-lg border border-line bg-surface-2 px-4 py-2 font-display text-base font-semibold tracking-tight text-ink">
      {order.startsWith('#') ? order : `#${order}`}
    </p>
  )
}

export default function OrderSuccess({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>
}) {
  return (
    <Container className="py-16 md:py-24">
      <div className="mx-auto max-w-xl text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl border border-verified-line bg-verified-soft text-verified">
          <CheckCircle2 className="h-7 w-7" strokeWidth={1.75} />
        </span>

        <h1 className="mt-6 font-display text-[30px] font-semibold leading-tight tracking-[-0.025em] text-ink md:text-[38px]">
          Order confirmed
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
          Thank you. Your order is in our system and we&rsquo;ve started the final inspection.
        </p>

        <Suspense fallback={<div className="mt-4 h-10" />}>
          <OrderNumber searchParams={searchParams} />
        </Suspense>

        <ol className="mt-10 space-y-px overflow-hidden rounded-xl border border-line bg-line text-left">
          {[
            {
              Icon: ShieldCheck,
              t: 'Final inspection',
              s: 'We re-check the device and record its serial or IMEI against your order.',
            },
            {
              Icon: Mail,
              t: 'Confirmation sent',
              s: 'You’ll get the order details and warranty certificate by email and SMS.',
            },
            {
              Icon: Truck,
              t: 'Dispatch',
              s: 'Dhaka metro within 24–48 hours; 2–4 business days elsewhere.',
            },
            {
              Icon: RotateCcw,
              t: 'Seven days to change your mind',
              s: 'Return in original condition for a full refund, no restocking fee.',
            },
          ].map(({ Icon, t, s }) => (
            <li key={t} className="flex gap-3.5 bg-surface px-5 py-4">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" strokeWidth={2} />
              <div>
                <p className="text-[14px] font-medium text-ink">{t}</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-ink-2">{s}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <Link
            href="/"
            className="inline-flex h-11 items-center rounded-lg bg-accent px-5 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover"
          >
            Continue shopping
          </Link>
          <Link
            href="/track-order"
            className="inline-flex h-11 items-center rounded-lg border border-line px-5 text-sm font-medium text-ink transition-colors hover:border-line-2 hover:bg-surface-2"
          >
            Track this order
          </Link>
          <Link
            href="/account"
            className="inline-flex h-11 items-center rounded-lg border border-line px-5 text-sm font-medium text-ink transition-colors hover:border-line-2 hover:bg-surface-2"
          >
            My account
          </Link>
        </div>
      </div>
    </Container>
  )
}

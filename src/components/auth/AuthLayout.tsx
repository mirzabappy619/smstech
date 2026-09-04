import Link from 'next/link'
import { ArrowLeft, BadgeCheck, RotateCcw, ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'

const points = [
  { Icon: BadgeCheck, t: 'Every device logged', s: 'Serial or IMEI recorded against your order.' },
  { Icon: ShieldCheck, t: 'Warranty in your name', s: 'Certificate issued at the point of sale.' },
  { Icon: RotateCcw, t: 'Seven-day returns', s: 'Original condition, no restocking fee.' },
]

/** Split screen used by sign-in and registration — form left, reassurance right. */
export default function AuthLayout({
  title,
  lede,
  children,
  footer,
}: {
  title: string
  lede: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="grid min-h-screen bg-bg lg:grid-cols-2">
      {/* Form */}
      <div className="flex flex-col px-5 py-8 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between">
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
          <Link
            href="/"
            className="group inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-3 transition-colors hover:text-ink"
          >
            <ArrowLeft
              className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5"
              strokeWidth={2}
            />
            Back to store
          </Link>
        </header>

        <div className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-sm">
            <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.025em] text-ink">
              {title}
            </h1>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-2">{lede}</p>
            <div className="mt-8">{children}</div>
          </div>
        </div>

        {footer && <footer className="text-center text-xs text-ink-3">{footer}</footer>}
      </div>

      {/* Reassurance */}
      <aside className="bg-grid relative hidden border-l border-line bg-surface lg:flex lg:flex-col lg:justify-center lg:px-14">
        <blockquote className="max-w-md">
          <p className="font-display text-[28px] font-semibold leading-[1.2] tracking-[-0.025em] text-ink">
            Buying used shouldn&rsquo;t mean buying blind.
          </p>
          <p className="mt-5 text-[15px] leading-relaxed text-ink-2">
            Every laptop and phone we list — sealed or six months old — passes the same 32-point
            inspection, gets a published condition grade, and ships with warranty attached.
          </p>
        </blockquote>

        <ul className="mt-12 max-w-md space-y-px overflow-hidden rounded-xl border border-line bg-line">
          {points.map(({ Icon, t, s }) => (
            <li key={t} className="flex gap-3.5 bg-surface px-5 py-4">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" strokeWidth={2} />
              <div>
                <p className="text-[14px] font-medium text-ink">{t}</p>
                <p className="mt-0.5 text-[13px] text-ink-2">{s}</p>
              </div>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}

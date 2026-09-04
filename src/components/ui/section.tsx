import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'

/** Consistent section masthead: eyebrow, title, optional lede and a trailing link. */
export default function SectionHeading({
  eyebrow,
  title,
  lede,
  href,
  linkLabel = 'View all',
  align = 'left',
  actions,
  className = '',
}: {
  eyebrow?: string
  title: string
  lede?: string
  href?: string
  linkLabel?: string
  align?: 'left' | 'center'
  actions?: ReactNode
  className?: string
}) {
  const centered = align === 'center'

  return (
    <div
      className={`mb-8 flex gap-4 ${
        centered
          ? 'flex-col items-center text-center'
          : 'flex-col items-start sm:flex-row sm:items-end sm:justify-between'
      } ${className}`}
    >
      <div className={centered ? 'max-w-2xl' : 'max-w-2xl'}>
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h2 className="font-display text-2xl font-semibold tracking-tight text-ink md:text-[32px] md:leading-[1.15]">
          {title}
        </h2>
        {lede && <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{lede}</p>}
      </div>

      {actions}

      {href && !actions && (
        <Link
          href={href}
          className="group inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-ink-2 transition-colors hover:text-accent"
        >
          {linkLabel}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  )
}

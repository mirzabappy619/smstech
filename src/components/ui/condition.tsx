import { BadgeCheck, ShieldCheck, Sparkles } from 'lucide-react'
import type { Product } from '@/data/products'
import Badge from './badge'

export type ConditionGrade =
  | 'new'
  | 'like-new'
  | 'excellent'
  | 'good'
  | 'fair'

type GradeMeta = {
  label: string
  short: string
  /** Plain-language promise — this is what actually builds buyer trust. */
  blurb: string
  tone: 'verified' | 'certified'
}

export const CONDITION_META: Record<ConditionGrade, GradeMeta> = {
  'new': {
    label: 'Brand New · Sealed',
    short: 'New',
    blurb: 'Factory sealed, never opened. Full manufacturer warranty.',
    tone: 'verified',
  },
  'like-new': {
    label: 'Open Box · Grade A+',
    short: 'Open Box',
    blurb: 'Opened but unused. No cosmetic marks, complete original box.',
    tone: 'verified',
  },
  'excellent': {
    label: 'Excellent · Grade A',
    short: 'Grade A',
    blurb: 'Light use, no visible scratches at arm’s length. Battery health 90%+.',
    tone: 'certified',
  },
  'good': {
    label: 'Good · Grade B',
    short: 'Grade B',
    blurb: 'Minor cosmetic marks that do not affect use. Battery health 85%+.',
    tone: 'certified',
  },
  'fair': {
    label: 'Fair · Grade C',
    short: 'Grade C',
    blurb: 'Visible wear on the chassis. Fully tested and functionally sound.',
    tone: 'certified',
  },
}

const ALIASES: Record<string, ConditionGrade> = {
  'new': 'new',
  'brand new': 'new',
  'sealed': 'new',
  'like new': 'like-new',
  'like-new': 'like-new',
  'open box': 'like-new',
  'open-box': 'like-new',
  'a+': 'like-new',
  'excellent': 'excellent',
  'grade a': 'excellent',
  'a': 'excellent',
  'good': 'good',
  'grade b': 'good',
  'b': 'good',
  'fair': 'fair',
  'grade c': 'fair',
  'c': 'fair',
}

/**
 * Resolve a grade from whatever the catalogue happens to carry. Explicit
 * `condition` wins; otherwise anything flagged pre-owned falls back to
 * Grade A, and everything else is treated as new.
 */
export function resolveCondition(product: Product): ConditionGrade {
  const raw = (
    product.condition ||
    product.specs?.condition ||
    product.specs?.Condition ||
    ''
  )
    .toString()
    .trim()
    .toLowerCase()

  if (raw && ALIASES[raw]) return ALIASES[raw]

  return isPreOwned(product) ? 'excellent' : 'new'
}

export function isPreOwned(product: Product): boolean {
  return (
    product.subcategory === 'pre-owned' ||
    product.badges.some((b) => /pre[- ]?owned|used|refurb/i.test(b)) ||
    ['like-new', 'excellent', 'good', 'fair'].includes(
      (product.condition || '').toLowerCase(),
    )
  )
}

export function ConditionBadge({
  product,
  className = '',
  withIcon = true,
}: {
  product: Product
  className?: string
  withIcon?: boolean
}) {
  const grade = resolveCondition(product)
  const meta = CONDITION_META[grade]
  const Icon = grade === 'new' ? Sparkles : grade === 'like-new' ? BadgeCheck : ShieldCheck

  return (
    <Badge
      tone={meta.tone}
      className={className}
      icon={withIcon ? <Icon className="h-3 w-3" strokeWidth={2.25} /> : undefined}
    >
      {meta.short}
    </Badge>
  )
}

/** Full condition explainer — used on the product detail page. */
export function ConditionPanel({ product }: { product: Product }) {
  const grade = resolveCondition(product)
  const meta = CONDITION_META[grade]
  const preOwned = isPreOwned(product)

  return (
    <div
      className={`rounded-xl border p-4 ${
        meta.tone === 'verified'
          ? 'border-verified-line bg-verified-soft'
          : 'border-certified-line bg-certified-soft'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            meta.tone === 'verified' ? 'bg-verified text-white' : 'bg-certified text-white'
          }`}
        >
          {grade === 'new' ? (
            <Sparkles className="h-4 w-4" strokeWidth={2.25} />
          ) : (
            <ShieldCheck className="h-4 w-4" strokeWidth={2.25} />
          )}
        </div>
        <div className="min-w-0">
          <p
            className={`font-display text-sm font-semibold ${
              meta.tone === 'verified' ? 'text-verified' : 'text-certified'
            }`}
          >
            {meta.label}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{meta.blurb}</p>
          {preOwned && (
            <p className="mt-2 text-xs text-ink-3">
              Every pre-owned device passes a 32-point inspection before listing.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

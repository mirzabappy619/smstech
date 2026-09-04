// Single money implementation shared by the storefront and the admin panel.
import { formatBDT } from '@/lib/currency'

export { formatBDT }

export function discountPct(price: number, original: number) {
  if (!original || original <= price) return 0
  return Math.round(((original - price) / original) * 100)
}

type Size = 'sm' | 'md' | 'lg' | 'xl'

const current: Record<Size, string> = {
  sm: 'text-[15px]',
  md: 'text-lg',
  lg: 'text-2xl',
  xl: 'text-[32px] leading-none',
}

const struck: Record<Size, string> = {
  sm: 'text-xs',
  md: 'text-[13px]',
  lg: 'text-sm',
  xl: 'text-base',
}

export default function Price({
  price,
  original,
  size = 'md',
  className = '',
}: {
  price: number
  original?: number
  size?: Size
  className?: string
}) {
  const pct = discountPct(price, original ?? 0)

  return (
    <div className={`flex flex-wrap items-baseline gap-x-2 gap-y-0.5 ${className}`}>
      <span className={`tnum font-display font-semibold tracking-tight text-ink ${current[size]}`}>
        {formatBDT(price)}
      </span>
      {pct > 0 && (
        <>
          <span className={`tnum text-ink-3 line-through ${struck[size]}`}>
            {formatBDT(original!)}
          </span>
          <span className={`tnum font-medium text-verified ${struck[size]}`}>−{pct}%</span>
        </>
      )}
    </div>
  )
}

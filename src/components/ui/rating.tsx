import { Star } from 'lucide-react'

export default function Rating({
  value,
  count,
  size = 12,
  className = '',
  showValue = true,
}: {
  value: number
  count?: number
  size?: number
  className?: string
  showValue?: boolean
}) {
  const rounded = Math.round(value)

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <div className="flex items-center gap-px" aria-label={`Rated ${value} out of 5`}>
        {[1, 2, 3, 4, 5].map((s) => (
          <Star
            key={s}
            width={size}
            height={size}
            strokeWidth={0}
            className={s <= rounded ? 'fill-certified' : 'fill-line-2'}
          />
        ))}
      </div>
      {showValue && (
        <span className="tnum text-xs text-ink-3">
          {value.toFixed(1)}
          {count != null && count > 0 ? ` (${count})` : ''}
        </span>
      )}
    </div>
  )
}

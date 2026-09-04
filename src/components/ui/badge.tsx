import type { ReactNode } from 'react'

export type BadgeTone =
  | 'neutral'
  | 'accent'
  | 'verified'
  | 'certified'
  | 'danger'
  | 'solid'

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-surface-2 text-ink-2 border-line',
  accent: 'bg-accent-soft text-accent-ink border-accent-line',
  verified: 'bg-verified-soft text-verified border-verified-line',
  certified: 'bg-certified-soft text-certified border-certified-line',
  danger: 'bg-danger-soft text-danger border-danger-line',
  solid: 'bg-inverse text-inverse-ink border-transparent',
}

type Props = {
  children: ReactNode
  tone?: BadgeTone
  icon?: ReactNode
  className?: string
}

export default function Badge({ children, tone = 'neutral', icon, className = '' }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-4 ${tones[tone]} ${className}`}
    >
      {icon}
      {children}
    </span>
  )
}

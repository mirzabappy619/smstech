import type { ButtonHTMLAttributes } from 'react'

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'inverse'
  | 'danger'
  | 'verified'
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg'

const base =
  'inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap rounded-lg ' +
  'transition-[background-color,border-color,color,box-shadow,transform] duration-150 ' +
  'active:scale-[0.985] disabled:opacity-45 disabled:pointer-events-none select-none'

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-on-accent hover:bg-accent-hover shadow-xs',
  secondary:
    'bg-surface text-ink border border-line hover:border-line-2 hover:bg-surface-2',
  ghost:
    'text-ink-2 hover:text-ink hover:bg-surface-2',
  inverse:
    'bg-inverse text-inverse-ink hover:opacity-90',
  danger:
    'bg-danger-soft text-danger border border-danger-line hover:bg-danger hover:text-white hover:border-danger',
  verified:
    'bg-verified text-white hover:opacity-90',
}

const sizes: Record<ButtonSize, string> = {
  xs: 'h-7 px-2.5 text-xs',
  sm: 'h-9 px-3.5 text-[13px]',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-[15px]',
}

/** Shared class string so `<Link>` and `<button>` render identically. */
export function buttonStyles(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  className = '',
) {
  return `${base} ${variants[variant]} ${sizes[size]} ${className}`
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  block?: boolean
}

export default function Button({
  variant = 'primary',
  size = 'md',
  block,
  className = '',
  ...props
}: Props) {
  return (
    <button
      className={buttonStyles(variant, size, `${block ? 'w-full' : ''} ${className}`)}
      {...props}
    />
  )
}

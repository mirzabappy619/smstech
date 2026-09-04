import type { ElementType, ReactNode } from 'react'

/** One page gutter, one max width — used by every storefront section. */
export default function Container({
  children,
  className = '',
  as: Tag = 'div',
  wide,
}: {
  children: ReactNode
  className?: string
  as?: ElementType
  wide?: boolean
}) {
  return (
    <Tag className={`mx-auto w-full ${wide ? 'max-w-[1600px]' : 'max-w-[1280px]'} px-4 sm:px-6 lg:px-8 ${className}`}>
      {children}
    </Tag>
  )
}

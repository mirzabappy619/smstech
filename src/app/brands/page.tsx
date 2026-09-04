import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import Container from '../../components/ui/container'
import { Breadcrumbs } from '../../components/CollectionView'
import { brands } from '../../data/products'

export const metadata = {
  title: 'Brands',
  description:
    'Every laptop and smartphone brand stocked at SMSTech — new and certified pre-owned.',
}

export default function Brands() {
  return (
    <Container className="py-8 md:py-10">
      <Breadcrumbs items={[{ label: 'Brands' }]} />

      <header className="mb-10 max-w-2xl">
        <h1 className="font-display text-[30px] font-semibold leading-tight tracking-[-0.025em] text-ink md:text-[38px]">
          Brands we stock
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
          New stock comes through authorised distributors. Pre-owned stock is inspected, graded and
          logged against its serial number — whatever the badge on the lid says.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {brands.map((brand) => (
          <Link
            key={brand.slug}
            href={`/brand/${brand.slug}`}
            className="group flex flex-col justify-between rounded-xl border border-line bg-surface p-6 transition-[border-color,box-shadow] hover:border-line-2 hover:shadow-md"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-xl border border-line bg-surface-2 font-display text-base font-bold tracking-tight text-ink-2 transition-colors group-hover:border-accent-line group-hover:bg-accent-soft group-hover:text-accent-ink">
              {brand.mark}
            </span>
            <div className="mt-6">
              <p className="font-display text-[15px] font-semibold tracking-tight text-ink">
                {brand.name}
              </p>
              <p className="tnum mt-0.5 text-xs text-ink-3">{brand.count} listings</p>
            </div>
            <span className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-3 transition-colors group-hover:text-accent">
              Browse
              <ArrowRight
                className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                strokeWidth={2}
              />
            </span>
          </Link>
        ))}
      </div>
    </Container>
  )
}

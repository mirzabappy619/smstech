'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Check, Minus, Plus, Scale, X } from 'lucide-react'
import { useApp } from '../../store/AppContext'
import { normalizeProduct, type Product } from '../../data/products'
import Container from '../../components/ui/container'
import { Breadcrumbs } from '../../components/CollectionView'
import Price, { formatBDT } from '../../components/ui/price'
import Rating from '../../components/ui/rating'
import { CONDITION_META, resolveCondition } from '../../components/ui/condition'

const SPEC_ROWS: { label: string; key: string }[] = [
  { label: 'Processor / chipset', key: 'Processor' },
  { label: 'Memory', key: 'RAM' },
  { label: 'Storage', key: 'Storage' },
  { label: 'Graphics', key: 'GPU' },
  { label: 'Display', key: 'Display' },
  { label: 'Operating system', key: 'OS' },
]

export default function Compare() {
  const { compareList, removeFromCompare, addToCompare } = useApp()
  const [search, setSearch] = useState('')
  const [catalogue, setCatalogue] = useState<Product[]>([])

  // The compare tray lets you add devices inline, so it needs the catalogue.
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/v1/products?show_all=true&limit=100')
        const json = await res.json()
        if (json.success && Array.isArray(json.data)) {
          setCatalogue(json.data.map(normalizeProduct))
        }
      } catch (e) {
        console.error('Failed to load catalogue for comparison:', e)
      }
    }
    load()
  }, [])

  const suggestions = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    return catalogue
      .filter(
        (p) =>
          !compareList.some((c) => c.id === p.id) &&
          (p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q)),
      )
      .slice(0, 6)
  }, [search, catalogue, compareList])

  const cheapest = compareList.length
    ? Math.min(...compareList.map((p) => p.price))
    : 0

  const labelCell = 'sticky left-0 z-10 bg-surface-2 px-4 py-3 text-left text-[13px] font-medium text-ink'
  const valueCell = 'px-4 py-3 align-top text-[13px] text-ink-2'

  return (
    <Container className="py-8 md:py-10">
      <Breadcrumbs items={[{ label: 'Compare' }]} />

      <header className="mb-8 max-w-2xl">
        <h1 className="font-display text-[30px] font-semibold leading-tight tracking-[-0.025em] text-ink md:text-[38px]">
          Compare devices
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
          Put up to four devices side by side — specification, condition grade, warranty term and
          where each one is physically in stock.
        </p>
      </header>

      {compareList.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface px-6 py-20 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-surface-2 text-ink-3">
            <Scale className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <h2 className="mt-4 font-display text-lg font-semibold text-ink">
            Your comparison is empty
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-[13.5px] leading-relaxed text-ink-2">
            Add devices from any listing using the compare icon on the product card.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Link
              href="/laptops"
              className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover"
            >
              Browse laptops
            </Link>
            <Link
              href="/smartphones"
              className="inline-flex h-10 items-center rounded-lg border border-line px-4 text-sm font-medium text-ink transition-colors hover:border-line-2 hover:bg-surface-2"
            >
              Browse phones
            </Link>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full min-w-[720px] border-collapse">
            <caption className="sr-only">Device comparison</caption>
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 z-10 w-52 bg-surface p-4 align-top">
                  {compareList.length < 4 ? (
                    <div className="rounded-lg border border-dashed border-line-2 bg-surface-2 p-3 text-left">
                      <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
                        <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                        Add a device
                      </span>
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search the catalogue…"
                        className="mt-2.5 h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-[13px] font-normal text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
                      />
                      {suggestions.length > 0 && (
                        <ul className="mt-2 overflow-hidden rounded-lg border border-line bg-surface">
                          {suggestions.map((s) => (
                            <li key={s.id}>
                              <button
                                onClick={() => {
                                  addToCompare(s)
                                  setSearch('')
                                }}
                                className="w-full border-b border-line px-2.5 py-2 text-left text-xs font-normal text-ink transition-colors last:border-0 hover:bg-surface-2"
                              >
                                {s.brand} {s.name}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      {search.trim() && suggestions.length === 0 && (
                        <p className="mt-2 text-xs font-normal text-ink-3">No matches.</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-left text-xs font-normal text-ink-3">
                      Comparison is full. Remove one to add another.
                    </p>
                  )}
                </th>

                {compareList.map((p) => (
                  <th key={p.id} scope="col" className="min-w-[220px] p-4 align-top">
                    <div className="relative text-left">
                      <button
                        onClick={() => removeFromCompare(p.id)}
                        className="absolute right-0 top-0 flex h-7 w-7 items-center justify-center rounded-lg border border-line bg-surface text-ink-3 transition-colors hover:border-danger-line hover:bg-danger-soft hover:text-danger"
                        aria-label={`Remove ${p.name} from comparison`}
                      >
                        <X className="h-3.5 w-3.5" strokeWidth={2} />
                      </button>
                      <Link href={`/product/${p.slug}`}>
                        <img
                          src={p.image}
                          alt=""
                          className="h-28 w-full rounded-lg border border-line bg-surface-2 object-contain p-2"
                        />
                      </Link>
                      <p className="eyebrow mt-3">{p.brand}</p>
                      <Link
                        href={`/product/${p.slug}`}
                        className="mt-1 line-clamp-2 block text-[13.5px] font-semibold leading-snug text-ink hover:text-accent"
                      >
                        {p.name}
                      </Link>
                      <div className="mt-2">
                        <Price price={p.price} original={p.originalPrice} size="sm" />
                      </div>
                      {p.price === cheapest && compareList.length > 1 && (
                        <span className="mt-2 inline-flex items-center gap-1 rounded-md border border-verified-line bg-verified-soft px-1.5 py-0.5 text-[11px] font-medium text-verified">
                          <Check className="h-3 w-3" strokeWidth={2.5} />
                          Lowest price
                        </span>
                      )}
                      <Link
                        href={`/product/${p.slug}`}
                        className="mt-3 flex h-9 items-center justify-center rounded-lg bg-accent text-[13px] font-medium text-on-accent transition-colors hover:bg-accent-hover"
                      >
                        View details
                      </Link>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-line border-t border-line">
              <tr>
                <th scope="row" className={labelCell}>
                  Condition
                </th>
                {compareList.map((p) => {
                  const meta = CONDITION_META[resolveCondition(p)]
                  return (
                    <td key={p.id} className={valueCell}>
                      <span
                        className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${
                          meta.tone === 'verified'
                            ? 'border-verified-line bg-verified-soft text-verified'
                            : 'border-certified-line bg-certified-soft text-certified'
                        }`}
                      >
                        {meta.label}
                      </span>
                    </td>
                  )
                })}
              </tr>

              <tr>
                <th scope="row" className={labelCell}>
                  Rating
                </th>
                {compareList.map((p) => (
                  <td key={p.id} className={valueCell}>
                    {p.reviews > 0 ? (
                      <Rating value={p.rating} count={p.reviews} />
                    ) : (
                      <span className="text-ink-3">No reviews yet</span>
                    )}
                  </td>
                ))}
              </tr>

              {SPEC_ROWS.map(({ label, key }) => (
                <tr key={key}>
                  <th scope="row" className={labelCell}>
                    {label}
                  </th>
                  {compareList.map((p) => (
                    <td key={p.id} className={valueCell}>
                      {p.specs[key] || <span className="text-ink-3">—</span>}
                    </td>
                  ))}
                </tr>
              ))}

              <tr>
                <th scope="row" className={labelCell}>
                  Battery health
                </th>
                {compareList.map((p) => (
                  <td key={p.id} className={`${valueCell} tnum`}>
                    {p.batteryHealth != null ? (
                      `${p.batteryHealth}%`
                    ) : resolveCondition(p) === 'new' ? (
                      <span className="text-ink-3">New — 100%</span>
                    ) : (
                      <span className="text-ink-3">—</span>
                    )}
                  </td>
                ))}
              </tr>

              <tr>
                <th scope="row" className={labelCell}>
                  Warranty
                </th>
                {compareList.map((p) => (
                  <td key={p.id} className={valueCell}>
                    {p.warranty}
                  </td>
                ))}
              </tr>

              <tr>
                <th scope="row" className={labelCell}>
                  Availability
                </th>
                {compareList.map((p) => {
                  const where = [
                    p.storeAvailability?.online && 'Online',
                    p.storeAvailability?.store1 && 'Store 01',
                    p.storeAvailability?.store2 && 'Store 02',
                  ].filter(Boolean) as string[]

                  return (
                    <td key={p.id} className={valueCell}>
                      {p.stock === 'out_of_stock' ? (
                        <span className="inline-flex items-center gap-1 text-danger">
                          <Minus className="h-3.5 w-3.5" strokeWidth={2} />
                          Out of stock
                        </span>
                      ) : where.length > 0 ? (
                        <ul className="space-y-1">
                          {where.map((w) => (
                            <li key={w} className="inline-flex items-center gap-1 text-verified">
                              <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                              {w}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-ink-3">Ask us</span>
                      )}
                    </td>
                  )
                })}
              </tr>

              <tr>
                <th scope="row" className={labelCell}>
                  You save
                </th>
                {compareList.map((p) => {
                  const saving = Math.max(0, p.originalPrice - p.price)
                  return (
                    <td key={p.id} className={`${valueCell} tnum`}>
                      {saving > 0 ? (
                        <span className="font-medium text-verified">{formatBDT(saving)}</span>
                      ) : (
                        <span className="text-ink-3">—</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </Container>
  )
}

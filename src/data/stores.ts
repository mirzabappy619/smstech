export type Store = {
  id: string
  /** Matches the `store_availability` keys on a product. */
  key: 'store1' | 'store2'
  name: string
  shortName: string
  area: string
  address: string
  phone: string
  email: string
  hours: string
  stocks: string[]
  mapQuery: string
}

/**
 * Verified store records. Anything shown to a customer as a physical location
 * comes from here — the storefront should never invent a branch it cannot
 * actually send someone to.
 */
export const stores: Store[] = [
  {
    id: '1',
    key: 'store1',
    name: 'SMSTech — Multiplan',
    shortName: 'Multiplan',
    area: 'Computer City Market, Elephant Road, Dhaka',
    address:
      'Shop 309, Level 03, Computer City Market (Multiplan), New Elephant Road (69–71), Dhaka 1205',
    phone: '01781485588 / 01723249598',
    email: 'info@smstech.bd',
    hours: '10:00 AM – 8:00 PM, daily',
    stocks: ['Laptops', 'Smartphones', 'Certified pre-owned', 'Accessories'],
    mapQuery: 'Computer City Center Multiplan Dhaka',
  },
]

export const primaryStore = stores[0]

export function storeLabel(key: 'store1' | 'store2'): string | null {
  return stores.find((s) => s.key === key)?.name ?? null
}

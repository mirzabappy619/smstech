export type Product = {
  id: string
  slug: string
  brand: string
  name: string
  category: 'laptop' | 'smartphone'
  subcategory: string
  image: string
  images: string[]
  price: number
  originalPrice: number
  specs: Record<string, string>
  shortSpec: string
  rating: number
  reviews: number
  stock: 'in_stock' | 'low_stock' | 'out_of_stock'
  stockCount?: number
  storeAvailability: { store1: boolean; store2: boolean; online: boolean }
  badges: string[]
  warranty: string
  /**
   * Condition grade for the unit on sale. Free-form on the wire (the catalogue
   * may say "Grade A", "open box", ...); resolveCondition() in components/ui
   * maps it onto the canonical grade scale.
   */
  condition?: string
  /** Battery health percentage, surfaced for pre-owned devices. */
  batteryHealth?: number
  colors?: string[]
  variants?: { label: string; price: number }[]
  isNew?: boolean
  isPreorder?: boolean
  preorderReleaseDate?: string | null
  preorderDepositPct?: number
}

export function normalizeProduct(p: any): Product {
  let parsedImages: string[] = []
  if (Array.isArray(p.images)) {
    parsedImages = p.images
  } else if (typeof p.images === 'string') {
    try { parsedImages = JSON.parse(p.images) } catch { parsedImages = [] }
  }

  const mainImage = p.image || p.image_url || parsedImages[0] || 'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=600&h=450&fit=crop&auto=format'
  if (parsedImages.length === 0) {
    parsedImages = [mainImage]
  }

  let parsedSpecs: Record<string, string> = {}
  if (p.specs && typeof p.specs === 'object') {
    parsedSpecs = p.specs
  }

  let parsedBadges: string[] = []
  if (Array.isArray(p.badges)) {
    parsedBadges = p.badges
  } else if (typeof p.badges === 'string') {
    try { parsedBadges = JSON.parse(p.badges) } catch { parsedBadges = [] }
  }

  let parsedColors: string[] = []
  if (Array.isArray(p.colors)) {
    parsedColors = p.colors
  } else if (typeof p.colors === 'string') {
    try { parsedColors = JSON.parse(p.colors) } catch { parsedColors = [] }
  }

  const basePrice = Number(p.base_price ?? p.price ?? 0)
  const comparePrice = Number(p.compare_at_price ?? p.original_price ?? p.originalPrice ?? basePrice)

  // Derive variants from product_variations if available
  let variants = p.variants || []
  if (variants.length === 0 && Array.isArray(p.product_variations)) {
    variants = p.product_variations.map((v: any) => ({
      label: v.name || v.sku || 'Default Variant',
      price: Number(v.price ?? basePrice),
    }))
  }

  return {
    id: String(p.id),
    slug: p.slug || String(p.id),
    brand: p.brand || p.attributes?.brand || 'Brand',
    name: p.name || 'Product',
    category: (p.category === 'smartphone' || p.category?.slug === 'smartphones') ? 'smartphone' : 'laptop',
    subcategory: p.subcategory || 'general',
    image: mainImage,
    images: parsedImages,
    price: basePrice,
    originalPrice: comparePrice > basePrice ? comparePrice : basePrice,
    specs: parsedSpecs,
    shortSpec: p.short_spec || p.shortSpec || p.short_description || '',
    rating: Number(p.average_rating ?? p.rating ?? 5.0),
    reviews: Number(p.review_count ?? p.reviews ?? 0),
    stock: p.stock_status || p.stock || 'in_stock',
    stockCount: p.stock_count ?? p.stockCount ?? 10,
    storeAvailability: p.store_availability || p.storeAvailability || { store1: true, store2: true, online: true },
    badges: parsedBadges,
    warranty: p.warranty || '1 Year Official Warranty',
    condition: p.condition ?? p.condition_grade ?? p.specs?.condition ?? undefined,
    batteryHealth:
      p.battery_health != null || p.batteryHealth != null
        ? Number(p.battery_health ?? p.batteryHealth)
        : undefined,
    colors: parsedColors,
    variants,
    isNew: Boolean(p.is_new ?? p.isNew ?? false),
    isPreorder: Boolean(p.is_preorder ?? p.isPreorder ?? false),
    preorderReleaseDate: p.preorder_release_date ?? p.preorderReleaseDate ?? null,
    preorderDepositPct: Number(p.preorder_deposit_pct ?? p.preorderDepositPct ?? 10),
  }
}

// All products are now dynamically loaded from Database API
export const laptops: Product[] = []
export const smartphones: Product[] = []
export const allProducts: Product[] = []

export const getProductBySlug = (_slug: string) => undefined

export const brands = [
  { name: 'Apple', slug: 'apple', count: 24, mark: 'A' },
  { name: 'Samsung', slug: 'samsung', count: 32, mark: 'S' },
  { name: 'ASUS', slug: 'asus', count: 18, mark: 'AS' },
  { name: 'Lenovo', slug: 'lenovo', count: 15, mark: 'L' },
  { name: 'HP', slug: 'hp', count: 12, mark: 'HP' },
  { name: 'Dell', slug: 'dell', count: 10, mark: 'D' },
  { name: 'Acer', slug: 'acer', count: 8, mark: 'AC' },
  { name: 'MSI', slug: 'msi', count: 6, mark: 'MSI' },
  { name: 'Xiaomi', slug: 'xiaomi', count: 14, mark: 'MI' },
  { name: 'OnePlus', slug: 'oneplus', count: 10, mark: '1+' },
  { name: 'Google', slug: 'google', count: 8, mark: 'G' },
  { name: 'Microsoft', slug: 'microsoft', count: 7, mark: 'MS' },
]

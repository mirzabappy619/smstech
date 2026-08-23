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
  colors?: string[]
  variants?: { label: string; price: number }[]
  isNew?: boolean
}

export function normalizeProduct(p: any): Product {
  let parsedImages: string[] = []
  if (Array.isArray(p.images)) {
    parsedImages = p.images
  } else if (typeof p.images === 'string') {
    try { parsedImages = JSON.parse(p.images) } catch { parsedImages = [] }
  }

  let mainImage = p.image || p.image_url || parsedImages[0] || 'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=600&h=450&fit=crop&auto=format'
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
    colors: parsedColors,
    variants,
    isNew: Boolean(p.is_new ?? p.isNew ?? false),
  }
}

// All products are now dynamically loaded from Database API
export const laptops: Product[] = []
export const smartphones: Product[] = []
export const allProducts: Product[] = []

export const getProductBySlug = (_slug: string) => undefined

export const brands = [
  { name: 'Apple', count: 24, logo: '🍎' },
  { name: 'Samsung', count: 32, logo: '⚡' },
  { name: 'ASUS', count: 18, logo: '⊕' },
  { name: 'Lenovo', count: 15, logo: 'L' },
  { name: 'HP', count: 12, logo: 'H' },
  { name: 'Dell', count: 10, logo: 'D' },
  { name: 'Acer', count: 8, logo: 'A' },
  { name: 'MSI', count: 6, logo: 'M' },
  { name: 'Xiaomi', count: 14, logo: 'X' },
  { name: 'OnePlus', count: 10, logo: '1+' },
  { name: 'Google', count: 8, logo: 'G' },
]

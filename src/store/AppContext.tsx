'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { Product } from '../data/products'
import { trackMetaAddToCart } from '@/presentation/components/meta-pixel'
import { notify } from '@/components/ui/toast'

type CartItem = {
  product: Product
  quantity: number
  variant?: string
}

type AppState = {
  cart: CartItem[]
  wishlist: Product[]
  compareList: Product[]
  cartOpen: boolean
  searchOpen: boolean
  announcementDismissed: boolean
  addToCart: (product: Product, variant?: string) => void
  removeFromCart: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  toggleWishlist: (product: Product) => void
  isWishlisted: (productId: string) => boolean
  addToCompare: (product: Product) => void
  removeFromCompare: (productId: string) => void
  isCompared: (productId: string) => boolean
  setCartOpen: (open: boolean) => void
  setSearchOpen: (open: boolean) => void
  dismissAnnouncement: () => void
  cartCount: number
  cartTotal: number
}

const AppContext = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [wishlist, setWishlist] = useState<Product[]>([])
  const [compareList, setCompareList] = useState<Product[]>([])
  const [cartOpen, setCartOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [announcementDismissed, setAnnouncementDismissed] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem('smstech_cart')
      if (savedCart) setCart(JSON.parse(savedCart))

      const savedWishlist = localStorage.getItem('smstech_wishlist')
      if (savedWishlist) setWishlist(JSON.parse(savedWishlist))

      const savedCompare = localStorage.getItem('smstech_compare')
      if (savedCompare) setCompareList(JSON.parse(savedCompare))
    } catch {}
    setIsLoaded(true)
  }, [])

  // Save to localStorage whenever states change
  useEffect(() => {
    if (!isLoaded) return
    try {
      localStorage.setItem('smstech_cart', JSON.stringify(cart))
    } catch {}
  }, [cart, isLoaded])

  useEffect(() => {
    if (!isLoaded) return
    try {
      localStorage.setItem('smstech_wishlist', JSON.stringify(wishlist))
    } catch {}
  }, [wishlist, isLoaded])

  useEffect(() => {
    if (!isLoaded) return
    try {
      localStorage.setItem('smstech_compare', JSON.stringify(compareList))
    } catch {}
  }, [compareList, isLoaded])

  const addToCart = useCallback((product: Product, variant?: string) => {
    // Pre-order products are sold through the pre-booking queue, not the cart.
    // The UI hides Add to Cart for them; this stops stale carts and any other
    // call site from slipping one through.
    if (product.isPreorder) {
      notify.info(`${product.name} is a pre-order — reserve it from the product page.`)
      return
    }

    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id && i.variant === variant)
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id && i.variant === variant
            ? { ...i, quantity: i.quantity + 1 }
            : i
        )
      }
      return [...prev, { product, quantity: 1, variant }]
    })
    setCartOpen(true)

    // Fire Meta Pixel & CAPI AddToCart event
    try {
      trackMetaAddToCart({
        productId: product.id,
        productName: product.name,
        price: product.price,
        quantity: 1,
        currency: 'BDT',
      })
    } catch {}
  }, [])

  const removeFromCart = useCallback((productId: string) => {
    const item = cart.find((i) => i.product.id === productId)
    setCart((prev) => prev.filter((i) => i.product.id !== productId))
    if (item) notify.info(`${item.product.name} removed from your cart.`)
  }, [cart])

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((i) => i.product.id !== productId))
    } else {
      setCart((prev) =>
        prev.map((i) => (i.product.id === productId ? { ...i, quantity } : i))
      )
    }
  }, [])

  const toggleWishlist = useCallback((product: Product) => {
    const exists = wishlist.some((p) => p.id === product.id)
    setWishlist((prev) =>
      exists ? prev.filter((p) => p.id !== product.id) : [...prev, product],
    )
    if (exists) notify.info(`${product.name} removed from your saved items.`)
    else notify.success(`${product.name} saved.`, { description: 'Find it under Saved items.' })
  }, [wishlist])

  const isWishlisted = useCallback(
    (productId: string) => wishlist.some((p) => p.id === productId),
    [wishlist]
  )

  const addToCompare = useCallback((product: Product) => {
    if (compareList.some((p) => p.id === product.id)) {
      notify.info(`${product.name} is already in your comparison.`)
      return
    }
    if (compareList.length >= 4) {
      notify.warning('You can compare four products at a time.', {
        description: 'Remove one from the comparison to add another.',
      })
      return
    }
    setCompareList((prev) => [...prev, product])
    notify.success(`${product.name} added to compare.`)
  }, [compareList])

  const removeFromCompare = useCallback((productId: string) => {
    const item = compareList.find((p) => p.id === productId)
    setCompareList((prev) => prev.filter((p) => p.id !== productId))
    if (item) notify.info(`${item.name} removed from your comparison.`)
  }, [compareList])

  const isCompared = useCallback(
    (productId: string) => compareList.some((p) => p.id === productId),
    [compareList]
  )

  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0)
  const cartTotal = cart.reduce((sum, i) => sum + i.product.price * i.quantity, 0)

  return (
    <AppContext.Provider
      value={{
        cart,
        wishlist,
        compareList,
        cartOpen,
        searchOpen,
        announcementDismissed,
        addToCart,
        removeFromCart,
        updateQuantity,
        toggleWishlist,
        isWishlisted,
        addToCompare,
        removeFromCompare,
        isCompared,
        setCartOpen,
        setSearchOpen,
        dismissAnnouncement: () => setAnnouncementDismissed(true),
        cartCount,
        cartTotal,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

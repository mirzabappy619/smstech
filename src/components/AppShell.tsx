'use client'

import { usePathname } from 'next/navigation'
import Header from './Header'
import Footer from './Footer'
import CartDrawer from './CartDrawer'
import MobileNav from './MobileNav'
import { AppProvider } from '../store/AppContext'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isStandalone =
    pathname?.startsWith('/admin') ||
    pathname?.startsWith('/landing') ||
    pathname === '/login' ||
    pathname === '/register'

  if (isStandalone) {
    return <AppProvider>{children}</AppProvider>
  }

  return (
    <AppProvider>
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 pb-16 md:pb-0">{children}</main>
        <Footer />
        <CartDrawer />
        <MobileNav />
      </div>
    </AppProvider>
  )
}

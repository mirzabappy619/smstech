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
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-100 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-on-accent"
      >
        Skip to content
      </a>
      <div className="flex min-h-screen flex-col bg-bg">
        <Header />
        <main id="main" className="flex-1 pb-16 lg:pb-0">
          {children}
        </main>
        <Footer />
        <CartDrawer />
        <MobileNav />
      </div>
    </AppProvider>
  )
}

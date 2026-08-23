'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

export type HeroSlide = {
  id: string
  title: string
  subtitle: string
  badge: string
  image_url: string
  link_url: string
  button_text: string
  sort_order: number
  is_active: boolean
}

const fallbackSlides: HeroSlide[] = [
  {
    id: 'slide-1',
    title: 'Next-Gen Laptops & Workstations',
    subtitle: 'Experience unmatched speed with Apple M3, Intel 14th Gen & RTX 40-series gaming laptops.',
    badge: '⚡ NEW ARRIVALS 2026',
    image_url: 'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=1200&h=600&fit=crop&auto=format',
    link_url: '/laptops',
    button_text: 'Explore Laptops',
    sort_order: 1,
    is_active: true,
  },
  {
    id: 'slide-2',
    title: 'Certified Pre-Owned Laptops',
    subtitle: 'Premium business laptops from HP, Dell & Microsoft at unbeatable prices with 6 months warranty.',
    badge: '🔥 PRE-OWNED DEALS',
    image_url: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=1200&h=600&fit=crop&auto=format',
    link_url: '/laptops?cat=pre-owned',
    button_text: 'Shop Pre-Owned',
    sort_order: 2,
    is_active: true,
  },
  {
    id: 'slide-3',
    title: 'Flagship Smartphones & Accessories',
    subtitle: 'Upgrade to iPhone 17 Pro & Galaxy S26 Ultra with official brand warranty & EMI options.',
    badge: '📱 OFFICIAL WARRANTY',
    image_url: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=1200&h=600&fit=crop&auto=format',
    link_url: '/smartphones',
    button_text: 'Browse Smartphones',
    sort_order: 3,
    is_active: true,
  },
]

export default function HeroSlider() {
  const [slides, setSlides] = useState<HeroSlide[]>(fallbackSlides)
  const [current, setCurrent] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    async function loadSliders() {
      try {
        const res = await fetch('/api/v1/admin/sliders')
        const data = await res.json()
        const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []
        if (list.length > 0) {
          const active = list.filter((s: HeroSlide) => s.is_active !== false)
          if (active.length > 0) {
            setSlides(active)
          }
        }
      } catch {
        // use fallback
      }
    }
    loadSliders()
  }, [])

  useEffect(() => {
    if (isPaused || slides.length <= 1) return
    timerRef.current = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length)
    }, 5000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isPaused, slides.length])

  const nextSlide = () => setCurrent((prev) => (prev + 1) % slides.length)
  const prevSlide = () => setCurrent((prev) => (prev - 1 + slides.length) % slides.length)

  if (slides.length === 0) return null

  return (
    <div
      className="relative bg-slate-950 overflow-hidden group transition-colors"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Background Slides Stack */}
      <div className="relative min-h-[420px] md:min-h-[480px] lg:min-h-[520px] flex items-center">
        {slides.map((slide, index) => {
          const isActive = index === current
          return (
            <div
              key={slide.id}
              className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                isActive ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'
              }`}
            >
              {/* Image & Dark Gradient Overlay */}
              <div className="absolute inset-0">
                <img
                  src={slide.image_url}
                  alt={slide.title}
                  className="w-full h-full object-cover object-center opacity-40 scale-105 transition-transform duration-1000"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />
              </div>

              {/* Slide Content */}
              <div className="relative max-w-7xl mx-auto px-4 h-full flex flex-col justify-center py-16">
                <div className="max-w-2xl space-y-4">
                  {slide.badge && (
                    <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-blue-600/90 text-white text-xs font-800 tracking-wider uppercase backdrop-blur-md border border-blue-400/40 shadow-lg shadow-blue-500/20">
                      {slide.badge}
                    </span>
                  )}

                  <h1 className="text-3xl md:text-5xl lg:text-6xl font-800 text-white leading-tight drop-shadow-md">
                    {slide.title}
                  </h1>

                  <p className="text-slate-300 text-sm md:text-base leading-relaxed max-w-xl">
                    {slide.subtitle}
                  </p>

                  <div className="pt-3 flex flex-wrap gap-4 items-center">
                    <Link
                      href={slide.link_url || '/laptops'}
                      className="px-6 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-700 text-sm rounded-xl shadow-lg shadow-blue-600/30 hover:shadow-blue-500/50 active:scale-95 transition-all flex items-center gap-2"
                    >
                      <span>{slide.button_text || 'Shop Now'}</span>
                      <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current" fill="currentColor">
                        <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </Link>

                    <Link
                      href="/stores"
                      className="px-5 py-3.5 bg-white/10 hover:bg-white/20 text-white font-600 text-sm rounded-xl border border-white/20 backdrop-blur transition-all"
                    >
                      Visit Our Store
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Prev / Next Controls */}
      {slides.length > 1 && (
        <>
          <button
            onClick={prevSlide}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-slate-900/60 hover:bg-blue-600 text-white border border-white/20 backdrop-blur flex items-center justify-center transition-all opacity-80 group-hover:opacity-100 hover:scale-110"
            aria-label="Previous Slide"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current" strokeWidth={2.5}>
              <path d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={nextSlide}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-slate-900/60 hover:bg-blue-600 text-white border border-white/20 backdrop-blur flex items-center justify-center transition-all opacity-80 group-hover:opacity-100 hover:scale-110"
            aria-label="Next Slide"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-none stroke-current" strokeWidth={2.5}>
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}

      {/* Pagination Dot Indicators */}
      {slides.length > 1 && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-2.5 rounded-full transition-all duration-300 ${
                i === current ? 'w-8 bg-blue-500' : 'w-2.5 bg-white/40 hover:bg-white/70'
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

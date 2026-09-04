'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import Container from './ui/container'

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
    title: 'High-end laptops, without the guesswork',
    subtitle:
      'Apple M-series, Intel Core Ultra and RTX-class machines — every unit specified in full, warranty-backed and ready to ship today.',
    badge: 'New arrivals',
    image_url:
      'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=1400&h=1000&fit=crop&auto=format',
    link_url: '/laptops',
    button_text: 'Shop laptops',
    sort_order: 1,
    is_active: true,
  },
  {
    id: 'slide-2',
    title: 'Certified pre-owned, honestly graded',
    subtitle:
      'Business-class ThinkPads, Latitudes and MacBooks put through a 32-point inspection, graded A to C, and covered for six months.',
    badge: 'Certified pre-owned',
    image_url:
      'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=1400&h=1000&fit=crop&auto=format',
    link_url: '/laptops?cat=pre-owned',
    button_text: 'Shop pre-owned',
    sort_order: 2,
    is_active: true,
  },
  {
    id: 'slide-3',
    title: 'Flagship phones with battery health published',
    subtitle:
      'iPhone and Galaxy, new and pre-owned. We list the measured battery capacity on every used handset before you add it to your cart.',
    badge: 'Smartphones',
    image_url:
      'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=1400&h=1000&fit=crop&auto=format',
    link_url: '/smartphones',
    button_text: 'Shop smartphones',
    sort_order: 3,
    is_active: true,
  },
]

const SLIDE_MS = 6500

export default function HeroSlider() {
  const [slides, setSlides] = useState<HeroSlide[]>(fallbackSlides)
  const [current, setCurrent] = useState(0)
  const [paused, setPaused] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    async function loadSliders() {
      try {
        const res = await fetch('/api/v1/admin/sliders')
        const data = await res.json()
        const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []
        if (list.length > 0) {
          const active = list.filter((s: HeroSlide) => s.is_active !== false)
          if (active.length > 0) setSlides(active)
        }
      } catch {
        // keep fallback
      }
    }
    loadSliders()
  }, [])

  useEffect(() => {
    if (paused || slides.length <= 1) return
    timerRef.current = setInterval(
      () => setCurrent((prev) => (prev + 1) % slides.length),
      SLIDE_MS,
    )
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [paused, slides.length])

  if (slides.length === 0) return null

  const go = (dir: 1 | -1) =>
    setCurrent((prev) => (prev + dir + slides.length) % slides.length)

  const slide = slides[current]

  return (
    <section
      className="relative border-b border-line bg-surface"
      aria-roledescription="carousel"
      aria-label="Featured collections"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <Container className="relative">
        <div className="grid items-center gap-8 py-12 md:min-h-[520px] md:grid-cols-2 md:gap-12 md:py-16">
          {/* Copy */}
          <div key={slide.id} className="animate-rise-in max-w-xl">
            {slide.badge && (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-2">
                {slide.badge}
              </span>
            )}

            <h1 className="mt-5 font-display text-[34px] font-semibold leading-[1.08] tracking-[-0.03em] text-ink sm:text-5xl lg:text-[56px]">
              {slide.title}
            </h1>

            <p className="mt-5 text-[15px] leading-relaxed text-ink-2 sm:text-base">
              {slide.subtitle}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href={slide.link_url || '/laptops'}
                className="group inline-flex h-12 items-center gap-2 rounded-lg bg-accent px-6 text-[15px] font-medium text-on-accent transition-colors hover:bg-accent-hover"
              >
                {slide.button_text || 'Shop now'}
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                  strokeWidth={2}
                />
              </Link>
              <Link
                href="/stores"
                className="inline-flex h-12 items-center rounded-lg border border-line bg-surface px-6 text-[15px] font-medium text-ink transition-colors hover:border-line-2 hover:bg-surface-2"
              >
                Visit a store
              </Link>
            </div>

            {/* Proof points */}
            <dl className="mt-10 grid max-w-md grid-cols-3 gap-6 border-t border-line pt-6">
              {[
                { v: '32', l: 'Point inspection' },
                { v: '6 mo', l: 'Pre-owned warranty' },
                { v: '7 day', l: 'Return window' },
              ].map((s) => (
                <div key={s.l}>
                  <dt className="tnum font-display text-xl font-semibold tracking-tight text-ink">
                    {s.v}
                  </dt>
                  <dd className="mt-0.5 text-xs leading-snug text-ink-3">{s.l}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Media */}
          <div className="relative">
            <div className="bg-grid relative overflow-hidden rounded-2xl border border-line bg-surface-2">
              <div className="relative aspect-[4/3] w-full md:aspect-[5/4]">
                {slides.map((s, i) => (
                  <img
                    key={s.id}
                    src={s.image_url}
                    alt={i === current ? s.title : ''}
                    aria-hidden={i !== current}
                    className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-out ${
                      i === current ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Controls — in flow so they never collide with the proof points */}
        {slides.length > 1 && (
          <div className="flex items-center justify-between gap-4 border-t border-line py-5">
            <div className="flex items-center gap-1">
              <button
                onClick={() => go(-1)}
                aria-label="Previous slide"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink-2 transition-colors hover:border-line-2 hover:bg-surface-2 hover:text-ink"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={2} />
              </button>
              <button
                onClick={() => go(1)}
                aria-label="Next slide"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink-2 transition-colors hover:border-line-2 hover:bg-surface-2 hover:text-ink"
              >
                <ChevronRight className="h-4 w-4" strokeWidth={2} />
              </button>
              <button
                onClick={() => setPaused((p) => !p)}
                aria-label={paused ? 'Resume autoplay' : 'Pause autoplay'}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink-2 transition-colors hover:border-line-2 hover:bg-surface-2 hover:text-ink"
              >
                {paused ? (
                  <Play className="h-3.5 w-3.5" strokeWidth={2} />
                ) : (
                  <Pause className="h-3.5 w-3.5" strokeWidth={2} />
                )}
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => setCurrent(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  aria-current={i === current}
                  className={`h-1 rounded-full transition-all duration-300 ${
                    i === current ? 'w-8 bg-ink' : 'w-4 bg-line-2 hover:bg-ink-3'
                  }`}
                />
              ))}
            </div>
          </div>
        )}
      </Container>
    </section>
  )
}

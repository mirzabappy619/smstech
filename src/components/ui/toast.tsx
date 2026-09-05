'use client'

/**
 * Global toast notifications.
 *
 * Replaces `window.alert()` across the storefront and the admin panel. The
 * store lives outside React so any code — event handlers, async callbacks,
 * plain helpers — can raise a toast with `notify.success(...)` without
 * threading a hook through the tree. `<Toaster />` is mounted once in the root
 * layout and subscribes to that store.
 */

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'

export type ToastTone = 'success' | 'error' | 'warning' | 'info'

export type ToastOptions = {
  /** Secondary line under the title. */
  description?: string
  /** Milliseconds before auto-dismiss. `0` keeps the toast until dismissed. */
  duration?: number
  /** Supply to replace an existing toast instead of stacking a new one. */
  id?: string
  tone?: ToastTone
}

export type ToastRecord = {
  id: string
  tone: ToastTone
  title: string
  description?: string
  duration: number
  /** Bumped when the same message fires again while it is still on screen. */
  count: number
  createdAt: number
  leaving?: boolean
}

/** How long each tone stays up by default — failures get longer to read. */
const DEFAULT_DURATION: Record<ToastTone, number> = {
  success: 4000,
  info: 4500,
  warning: 6000,
  error: 7000,
}

const MAX_STACK = 5
const EXIT_MS = 200

let toasts: ToastRecord[] = []
const listeners = new Set<() => void>()

type Timer = {
  handle: ReturnType<typeof setTimeout>
  remaining: number
  startedAt: number
}
const timers = new Map<string, Timer>()
let paused = false

const EMPTY: ToastRecord[] = []

function emit() {
  toasts = [...toasts]
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot() {
  return toasts
}

function getServerSnapshot() {
  return EMPTY
}

function clearTimer(id: string) {
  const t = timers.get(id)
  if (t) {
    clearTimeout(t.handle)
    timers.delete(id)
  }
}

function schedule(id: string, duration: number) {
  clearTimer(id)
  if (duration <= 0) return
  if (paused) {
    timers.set(id, { handle: 0 as unknown as ReturnType<typeof setTimeout>, remaining: duration, startedAt: 0 })
    return
  }
  timers.set(id, {
    handle: setTimeout(() => dismiss(id), duration),
    remaining: duration,
    startedAt: Date.now(),
  })
}

/** Freeze every countdown — used while the pointer is over the stack. */
function pauseAll() {
  if (paused) return
  paused = true
  timers.forEach((t, id) => {
    clearTimeout(t.handle)
    const elapsed = t.startedAt ? Date.now() - t.startedAt : 0
    timers.set(id, { ...t, remaining: Math.max(t.remaining - elapsed, 600), startedAt: 0 })
  })
}

function resumeAll() {
  if (!paused) return
  paused = false
  timers.forEach((t, id) => {
    timers.set(id, {
      handle: setTimeout(() => dismiss(id), t.remaining),
      remaining: t.remaining,
      startedAt: Date.now(),
    })
  })
}

export function dismiss(id: string) {
  clearTimer(id)
  const target = toasts.find((t) => t.id === id)
  if (!target || target.leaving) return
  toasts = toasts.map((t) => (t.id === id ? { ...t, leaving: true } : t))
  emit()
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id)
    emit()
  }, EXIT_MS)
}

export function dismissAll() {
  toasts.forEach((t) => dismiss(t.id))
}

/**
 * `alert()` stringified anything it was handed, and plenty of call sites pass
 * an API error envelope straight through. Do the same, but readably.
 */
function toMessage(value: unknown): string {
  if (typeof value === 'string') return value
  if (value == null) return ''
  if (value instanceof Error) return value.message
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const nested = obj.message ?? obj.error ?? obj.detail
    if (typeof nested === 'string') return nested
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

function push(tone: ToastTone, message: unknown, options: ToastOptions = {}): string {
  const title = toMessage(message).trim() || 'Something happened.'
  const description = options.description?.trim() || undefined
  const duration = options.duration ?? DEFAULT_DURATION[tone]

  // Explicit id: replace in place, so repeated saves don't pile up.
  if (options.id) {
    const existing = toasts.find((t) => t.id === options.id && !t.leaving)
    if (existing) {
      toasts = toasts.map((t) =>
        t.id === options.id ? { ...t, tone, title, description, duration } : t,
      )
      emit()
      schedule(options.id, duration)
      return options.id
    }
  }

  // Same message fired twice in a row — count it rather than stack duplicates.
  const duplicate = toasts.find(
    (t) => !t.leaving && t.tone === tone && t.title === title && t.description === description,
  )
  if (duplicate) {
    toasts = toasts.map((t) =>
      t.id === duplicate.id ? { ...t, count: t.count + 1, createdAt: Date.now() } : t,
    )
    emit()
    schedule(duplicate.id, duration)
    return duplicate.id
  }

  const id = options.id ?? `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
  toasts = [{ id, tone, title, description, duration, count: 1, createdAt: Date.now() }, ...toasts]

  // Retire the oldest once the stack is full so it never covers the screen.
  const live = toasts.filter((t) => !t.leaving)
  if (live.length > MAX_STACK) {
    live.slice(MAX_STACK).forEach((t) => dismiss(t.id))
  }

  emit()
  schedule(id, duration)
  return id
}

export const notify = {
  success: (message: unknown, options?: ToastOptions) => push('success', message, options),
  error: (message: unknown, options?: ToastOptions) => push('error', message, options),
  warning: (message: unknown, options?: ToastOptions) => push('warning', message, options),
  info: (message: unknown, options?: ToastOptions) => push('info', message, options),
  show: (message: unknown, options: ToastOptions = {}) => push(options.tone ?? 'info', message, options),
  dismiss,
  dismissAll,
}

/** Hook form, for components that prefer it. Same object as `notify`. */
export function useToast() {
  return notify
}

const TONE_STYLES: Record<
  ToastTone,
  { bar: string; icon: string; iconWrap: string; Icon: typeof CheckCircle2; label: string }
> = {
  success: {
    bar: 'bg-verified',
    icon: 'text-verified',
    iconWrap: 'bg-verified-soft border-verified-line',
    Icon: CheckCircle2,
    label: 'Success',
  },
  error: {
    bar: 'bg-danger',
    icon: 'text-danger',
    iconWrap: 'bg-danger-soft border-danger-line',
    Icon: XCircle,
    label: 'Error',
  },
  warning: {
    bar: 'bg-certified',
    icon: 'text-certified',
    iconWrap: 'bg-certified-soft border-certified-line',
    Icon: AlertTriangle,
    label: 'Warning',
  },
  info: {
    bar: 'bg-accent',
    icon: 'text-accent',
    iconWrap: 'bg-accent-soft border-accent-line',
    Icon: Info,
    label: 'Notice',
  },
}

function ToastCard({ toast, onDismiss }: { toast: ToastRecord; onDismiss: (id: string) => void }) {
  const tone = TONE_STYLES[toast.tone]
  const { Icon } = tone
  const urgent = toast.tone === 'error' || toast.tone === 'warning'

  return (
    <div
      role={urgent ? 'alert' : 'status'}
      aria-live={urgent ? 'assertive' : 'polite'}
      className={`toast-item pointer-events-auto relative w-full overflow-hidden rounded-xl border border-line bg-surface shadow-lg ${
        toast.leaving ? 'toast-item-out' : 'toast-item-in'
      }`}
    >
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${tone.bar}`} />

      <div className="flex items-start gap-3 py-3.5 pl-4 pr-9">
        <span
          className={`mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${tone.iconWrap}`}
        >
          <Icon className={`h-3.5 w-3.5 ${tone.icon}`} strokeWidth={2.2} aria-hidden />
        </span>

        <div className="min-w-0 flex-1">
          <p className="whitespace-pre-line break-words text-[13.5px] font-medium leading-snug text-ink">
            <span className="sr-only">{tone.label}: </span>
            {toast.title}
          </p>
          {toast.description && (
            <p className="mt-1 whitespace-pre-line break-words text-[12.5px] leading-snug text-ink-2">
              {toast.description}
            </p>
          )}
        </div>

        {toast.count > 1 && (
          <span className="tnum mt-px shrink-0 rounded-full bg-surface-3 px-1.5 py-0.5 text-[11px] font-semibold leading-4 text-ink-2">
            ×{toast.count}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="absolute right-2 top-2.5 flex h-6 w-6 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <X className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden />
      </button>

      {toast.duration > 0 && !toast.leaving && (
        <span
          aria-hidden
          key={`${toast.count}-${toast.createdAt}`}
          className={`toast-progress absolute bottom-0 left-0 h-0.5 w-full origin-left ${tone.bar} opacity-30`}
          style={{ animationDuration: `${toast.duration}ms` }}
        />
      )}
    </div>
  )
}

/**
 * Mount once, near the root. Renders the stack in the top-right corner —
 * newest first, capped at {@link MAX_STACK}, paused while hovered or focused.
 */
export function Toaster() {
  // getServerSnapshot keeps SSR (and hydration) rendering an empty stack, so
  // no toast can exist before the client takes over.
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const hovering = useRef(false)

  // Countdowns shouldn't burn down in a background tab.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) pauseAll()
      else if (!hovering.current) resumeAll()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  const hold = useCallback(() => {
    hovering.current = true
    pauseAll()
  }, [])

  const release = useCallback(() => {
    hovering.current = false
    if (!document.hidden) resumeAll()
  }, [])

  if (items.length === 0) return null

  return (
    <div
      className="toast-viewport pointer-events-none fixed right-3 top-3 z-[200] flex w-[min(calc(100vw-1.5rem),24rem)] flex-col items-end sm:right-4 sm:top-4"
      onMouseEnter={hold}
      onMouseLeave={release}
      onFocusCapture={hold}
      onBlurCapture={release}
    >
      {items.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
      ))}
    </div>
  )
}

export default Toaster

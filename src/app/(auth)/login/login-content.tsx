'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, Eye, EyeOff } from 'lucide-react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'

export default function LoginFormContent() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/'
  const errorParam = searchParams.get('error')
  const justRegistered = searchParams.get('registered') === 'true'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (errorParam === 'forbidden') {
      setError('Access denied. Admin privileges are required for that page.')
    } else if (errorParam === 'account_setup_required') {
      setError('Your account still needs to be set up. Please contact an administrator.')
    }
  }, [errorParam])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Sign in with browser Supabase client to store session cookies in browser
      const supabase = createBrowserSupabaseClient()
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

      if (authError) {
        throw new Error(authError.message || 'Invalid login credentials')
      }

      // Validate with backend API for status & role resolution
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || 'Login failed')
      }

      // Send staff to the admin portal unless a destination was explicitly requested
      const userRole = data.data?.user?.role || data.user?.role
      let destination = redirectTo
      if ((!redirectTo || redirectTo === '/') && (userRole === 'admin' || userRole === 'owner')) {
        destination = '/admin'
      }

      // Full page transition so every auth cookie is loaded cleanly
      window.location.href = destination
    } catch (err: any) {
      setError(err.message || 'An error occurred during login')
    } finally {
      setLoading(false)
    }
  }

  const field =
    'h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15'

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {justRegistered && !error && (
        <p className="flex items-start gap-2 rounded-lg border border-verified-line bg-verified-soft px-3.5 py-3 text-[13px] text-verified">
          <CheckCircle2 className="mt-px h-4 w-4 shrink-0" strokeWidth={2} />
          Account created. Sign in to continue.
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-danger-line bg-danger-soft px-3.5 py-3 text-[13px] text-danger"
        >
          {error}
        </p>
      )}

      <div>
        <label htmlFor="email" className="mb-1.5 block text-[13px] font-medium text-ink">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className={field}
        />
      </div>

      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <label htmlFor="password" className="text-[13px] font-medium text-ink">
            Password
          </label>
          <Link href="/forgot-password" className="text-[13px] font-medium text-accent">
            Forgot it?
          </Link>
        </div>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className={`${field} pr-11`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-ink-3 transition-colors hover:text-ink"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" strokeWidth={2} />
            ) : (
              <Eye className="h-4 w-4" strokeWidth={2} />
            )}
          </button>
        </div>
      </div>

      <label className="flex items-center gap-2.5 pt-1 text-[13px] text-ink-2">
        <input
          id="remember-me"
          name="remember-me"
          type="checkbox"
          className="h-4 w-4 rounded border-line-2 accent-[var(--accent)]"
        />
        Keep me signed in
      </label>

      <button
        type="submit"
        disabled={loading}
        className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-accent text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-50"
      >
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}

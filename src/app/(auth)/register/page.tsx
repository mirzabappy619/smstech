'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import AuthLayout from '@/components/auth/AuthLayout'
import { isValidBDPhone, BD_PHONE_ERROR_MESSAGE } from '@/lib/bd-phone-validator'

export default function RegisterPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [acceptTerms, setAcceptTerms] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (formData.password !== formData.confirmPassword) {
      setError('Those passwords don’t match.')
      setLoading(false)
      return
    }

    if (formData.password.length < 8) {
      setError('Please use a password of at least 8 characters.')
      setLoading(false)
      return
    }

    if (formData.phone && !isValidBDPhone(formData.phone)) {
      setError(BD_PHONE_ERROR_MESSAGE)
      setLoading(false)
      return
    }

    if (!acceptTerms) {
      setError('Please accept the terms and privacy policy to continue.')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          password: formData.password,
          phone: formData.phone,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || 'Registration failed')
      }

      router.push('/login?registered=true')
    } catch (err: any) {
      setError(err.message || 'An error occurred during registration')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const field =
    'h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/15'
  const labelCls = 'mb-1.5 block text-[13px] font-medium text-ink'

  return (
    <AuthLayout
      title="Create your account"
      lede={
        <>
          Already registered?{' '}
          <Link href="/login" className="font-medium text-accent">
            Sign in
          </Link>
          .
        </>
      }
      footer={
        <>
          Your details are used to fulfil orders and register warranties — nothing else.
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && (
          <p
            role="alert"
            className="rounded-lg border border-danger-line bg-danger-soft px-3.5 py-3 text-[13px] text-danger"
          >
            {error}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="firstName" className={labelCls}>
              First name
            </label>
            <input
              id="firstName"
              name="firstName"
              type="text"
              autoComplete="given-name"
              required
              value={formData.firstName}
              onChange={handleChange}
              placeholder="Shakib"
              className={field}
            />
          </div>
          <div>
            <label htmlFor="lastName" className={labelCls}>
              Last name
            </label>
            <input
              id="lastName"
              name="lastName"
              type="text"
              autoComplete="family-name"
              required
              value={formData.lastName}
              onChange={handleChange}
              placeholder="Ahmed"
              className={field}
            />
          </div>
        </div>

        <div>
          <label htmlFor="email" className={labelCls}>
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={formData.email}
            onChange={handleChange}
            placeholder="you@example.com"
            className={field}
          />
        </div>

        <div>
          <label htmlFor="phone" className={labelCls}>
            Phone number <span className="font-normal text-ink-3">(optional)</span>
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            value={formData.phone}
            onChange={handleChange}
            placeholder="017XXXXXXXX"
            className={field}
          />
        </div>

        <div>
          <label htmlFor="password" className={labelCls}>
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              value={formData.password}
              onChange={handleChange}
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
          <p className="mt-1.5 text-xs text-ink-3">At least 8 characters.</p>
        </div>

        <div>
          <label htmlFor="confirmPassword" className={labelCls}>
            Confirm password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            required
            value={formData.confirmPassword}
            onChange={handleChange}
            placeholder="••••••••"
            className={field}
          />
        </div>

        <label className="flex items-start gap-2.5 pt-1 text-[13px] leading-relaxed text-ink-2">
          <input
            id="accept-terms"
            type="checkbox"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-line-2 accent-[var(--accent)]"
          />
          <span>
            I agree to the{' '}
            <Link href="/faq?cat=terms" className="font-medium text-accent">
              terms and conditions
            </Link>{' '}
            and the{' '}
            <Link href="/faq?cat=privacy" className="font-medium text-accent">
              privacy policy
            </Link>
            .
          </span>
        </label>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-accent text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthLayout>
  )
}

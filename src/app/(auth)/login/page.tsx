import { Suspense } from 'react'
import Link from 'next/link'
import LoginFormContent from './login-content'
import AuthLayout from '@/components/auth/AuthLayout'
import { Skeleton } from '@/components/ui/skeleton'

export default function LoginPage() {
  return (
    <AuthLayout
      title="Sign in"
      lede={
        <>
          New here?{' '}
          <Link href="/register" className="font-medium text-accent">
            Create an account
          </Link>{' '}
          to track orders and keep your warranty certificates in one place.
        </>
      }
    >
      <Suspense fallback={<LoginFormSkeleton />}>
        <LoginFormContent />
      </Suspense>
    </AuthLayout>
  )
}

function LoginFormSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-11 w-full rounded-lg" />
      <Skeleton className="h-11 w-full rounded-lg" />
      <Skeleton className="h-11 w-full rounded-lg" />
    </div>
  )
}

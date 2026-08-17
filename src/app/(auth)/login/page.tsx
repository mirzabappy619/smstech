import { Suspense } from 'react';
import LoginFormContent from './login-content';

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <Suspense fallback={<LoginPageSkeleton />}>
        <LoginFormContent />
      </Suspense>
    </div>
  );
}

function LoginPageSkeleton() {
  return (
    <div className="max-w-md w-full space-y-8">
      <div>
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 bg-blue-600 rounded-lg" />
        </div>
        <div className="h-8 bg-zinc-300 dark:bg-zinc-700 rounded mx-auto w-3/4 mb-4" />
        <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded mx-auto w-1/2" />
      </div>
      <div className="space-y-4">
        <div className="h-10 bg-zinc-200 dark:bg-zinc-800 rounded" />
        <div className="h-10 bg-zinc-200 dark:bg-zinc-800 rounded" />
        <div className="h-10 bg-zinc-200 dark:bg-zinc-800 rounded" />
      </div>
    </div>
  );
}

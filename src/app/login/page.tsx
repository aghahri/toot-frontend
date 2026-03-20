import { Suspense } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import LoginClient from './LoginClient';

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-md p-4">
          <Spinner label="در حال آماده‌سازی..." />
        </main>
      }
    >
      <LoginClient />
    </Suspense>
  );
}


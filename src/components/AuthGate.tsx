'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAccessToken } from '@/lib/auth';
import { Spinner } from './ui/Spinner';
import type { ReactNode } from 'react';

export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace('/login');
      return;
    }
    setChecking(false);
  }, [router]);

  if (checking) return <Spinner label="در حال بررسی دسترسی..." />;
  return <>{children}</>;
}


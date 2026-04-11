'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthGate } from '@/components/AuthGate';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { Spinner } from '@/components/ui/Spinner';

export default function ProfileIndexPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = getAccessToken();
    if (!t) return;
    let cancelled = false;
    (async () => {
      try {
        const me = await apiFetch<{ id: string }>('users/me', { method: 'GET', token: t });
        if (!cancelled) {
          router.replace(`/profile/${me.id}`);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'خطا در بارگذاری');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <AuthGate>
      <main className="flex min-h-[40dvh] flex-col items-center justify-center p-6">
        {error ? (
          <p className="text-center text-sm font-semibold text-red-600">{error}</p>
        ) : (
          <Spinner label="در حال بارگذاری پروفایل…" />
        )}
      </main>
    </AuthGate>
  );
}

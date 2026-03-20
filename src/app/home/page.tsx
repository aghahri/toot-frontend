'use client';

import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { AuthGate } from '@/components/AuthGate';
import { clearAccessToken, getAccessToken } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export default function HomePage() {
  const router = useRouter();

  const token = useMemo(() => getAccessToken(), []);

  function onLogout() {
    clearAccessToken();
    router.replace('/login');
  }

  return (
    <AuthGate>
      <main className="mx-auto w-full max-w-md p-4">
        <div className="mb-4">
          <h1 className="text-2xl font-extrabold">خانه</h1>
          <p className="mt-1 text-sm text-slate-700">به پنل اصلی خوش آمدید.</p>
        </div>

        <Card>
          <div className="space-y-3">
            <div className="text-sm">
              وضعیت احراز هویت: <span className="font-semibold text-emerald-700">فعال</span>
            </div>
            <div className="break-all text-xs text-slate-500">
              توکن: {token ? `${token.slice(0, 16)}...` : '-'}
            </div>
            <Button type="button" onClick={onLogout}>
              خروج از حساب
            </Button>
          </div>
        </Card>
      </main>
    </AuthGate>
  );
}


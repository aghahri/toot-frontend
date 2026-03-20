'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getHealth } from '@/lib/api';
import { Card } from '@/components/ui/Card';

export default function LandingPage() {
  const [health, setHealth] = useState<{ status: string; timestamp?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getHealth()
      .then((data) => {
        if (!cancelled) setHealth(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'خطا در دریافت وضعیت API');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto w-full max-w-md p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold">توت</h1>
        <p className="mt-2 text-sm text-slate-700">پلتفرم پیام‌رسان اجتماعی (MVP)</p>
      </div>

      <Card>
        <h2 className="mb-3 text-lg font-bold">وضعیت API</h2>
        {loading ? (
          <p className="text-sm text-slate-700">در حال بررسی...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : (
          <div className="text-sm">
            <div>
              وضعیت: <span className="font-semibold">{health?.status ?? '-'}</span>
            </div>
            {health?.timestamp ? (
              <div className="mt-1 text-xs text-slate-500">آخرین زمان: {health.timestamp}</div>
            ) : null}
          </div>
        )}
      </Card>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Link
          href="/login"
          className="rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white"
        >
          ورود
        </Link>
        <Link
          href="/register"
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-900"
        >
          ثبت‌نام
        </Link>
      </div>
    </main>
  );
}


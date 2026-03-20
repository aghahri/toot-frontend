'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { login } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TextInput } from '@/components/forms/TextInput';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '/home';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await login(email.trim(), password);
      router.replace(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ورود');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-md p-4">
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold">ورود</h1>
        <p className="mt-1 text-sm text-slate-700">برای شروع وارد حساب خود شوید.</p>
      </div>

      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          <TextInput
            label="ایمیل"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            required
          />
          <TextInput
            label="رمز عبور"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            required
          />

          {error ? <div className="text-sm font-semibold text-red-600">{error}</div> : null}

          <Button type="submit" loading={loading}>
            {loading ? 'در حال ورود...' : 'ورود'}
          </Button>
        </form>

        <div className="mt-4 text-center text-sm text-slate-700">
          حساب ندارید؟{' '}
          <a className="font-semibold text-slate-900" href="/register">
            ثبت‌نام
          </a>
        </div>
      </Card>
    </main>
  );
}


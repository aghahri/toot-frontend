'use client';

import type { FormEvent } from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { register } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TextInput } from '@/components/forms/TextInput';

export default function RegisterPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [bio, setBio] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await register({
        email: email.trim(),
        password,
        name: name.trim(),
        mobile: mobile.trim() ? mobile.trim() : undefined,
        bio: bio.trim() ? bio.trim() : undefined,
      });
      router.replace('/login?next=/home');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ثبت‌نام');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-md p-4">
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold">ثبت‌نام</h1>
        <p className="mt-1 text-sm text-slate-700">ساخت حساب جدید در چند دقیقه.</p>
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
            label="نام"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
            required
          />
          <TextInput
            label="موبایل (اختیاری)"
            type="tel"
            inputMode="tel"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            disabled={loading}
          />
          <label className="block">
            <div className="mb-1 text-sm font-semibold text-slate-700">بیو (اختیاری)</div>
            <textarea
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none focus:border-slate-400"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              disabled={loading}
              rows={3}
              maxLength={512}
            />
          </label>

          <TextInput
            label="رمز عبور"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            required
          />

          {error ? <div className="text-sm font-semibold text-red-600">{error}</div> : null}

          <Button type="submit" loading={loading}>
            {loading ? 'در حال ثبت...' : 'ثبت‌نام'}
          </Button>
        </form>

        <div className="mt-4 text-center text-sm text-slate-700">
          قبلا ثبت‌نام کرده‌اید؟{' '}
          <a className="font-semibold text-slate-900" href="/login">
            ورود
          </a>
        </div>
      </Card>
    </main>
  );
}


'use client';

import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthGate } from '@/components/AuthGate';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TextInput } from '@/components/forms/TextInput';

type MeProfile = {
  id: string;
  name: string;
  username: string;
  avatar: string | null;
  bio: string | null;
};

export default function ProfileEditPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState('');

  useEffect(() => {
    const t = getAccessToken();
    if (!t) return;
    let cancelled = false;
    (async () => {
      try {
        const me = await apiFetch<MeProfile>('users/me', { method: 'GET', token: t });
        if (cancelled) return;
        setUserId(me.id);
        setName(me.name);
        setUsername(me.username);
        setBio(me.bio ?? '');
        setAvatar(me.avatar ?? '');
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'خطا در بارگذاری');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const t = getAccessToken();
    if (!t) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await apiFetch<MeProfile>('users/me', {
        method: 'PATCH',
        token: t,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          username: username.trim().toLowerCase(),
          bio: bio.trim() || undefined,
          avatar: avatar.trim() || undefined,
        }),
      });
      setSuccess('ذخیره شد.');
      if (userId) {
        router.push(`/profile/${userId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ذخیره ناموفق بود');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthGate>
      <main className="mx-auto w-full max-w-md p-4 pb-28" dir="rtl">
        <div className="mb-4 flex items-center gap-2">
          <Link
            href={userId ? `/profile/${userId}` : '/profile'}
            className="text-sm font-bold text-sky-700 hover:underline"
          >
            ← بازگشت
          </Link>
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900">ویرایش پروفایل</h1>
        <p className="mt-1 text-sm text-slate-600">نام، نام کاربری، بیو و آدرس تصویر آواتار.</p>

        <Card className="mt-6">
          {loading ? (
            <p className="text-sm text-slate-500">در حال بارگذاری…</p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              {success ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                  {success}
                </div>
              ) : null}
              <TextInput
                label="نام نمایشی"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={saving}
                required
                minLength={2}
              />
              <TextInput
                label="نام کاربری"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={saving}
                required
                dir="ltr"
                className="font-mono"
              />
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-800">بیوگرافی</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  disabled={saving}
                  rows={3}
                  maxLength={500}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400/60"
                />
              </div>
              <TextInput
                label="آدرس تصویر (URL)"
                value={avatar}
                onChange={(e) => setAvatar(e.target.value)}
                disabled={saving}
                dir="ltr"
                placeholder="https://…"
              />
              {error ? <div className="text-sm font-semibold text-red-600">{error}</div> : null}
              <Button type="submit" loading={saving}>
                ذخیره
              </Button>
            </form>
          )}
        </Card>
      </main>
    </AuthGate>
  );
}

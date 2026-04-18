'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthGate } from '@/components/AuthGate';
import { apiFetch, getApiBaseUrl, getErrorMessageFromResponse } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

const CATS = [
  'رستوران',
  'فروشگاه',
  'خدمات فنی',
  'زیبایی',
  'پزشکی',
  'آموزش',
  'فناوری',
  'مالی',
  'حقوقی',
  'املاک',
  'خودرو',
  'گردشگری',
  'خانگی',
  'سایر',
];

async function uploadMediaId(token: string, file: File): Promise<string> {
  const uploadUrl = `${getApiBaseUrl().replace(/\/+$/, '')}/media/upload`;
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error(await getErrorMessageFromResponse(res));
  const data = (await res.json()) as { media?: { id?: string } };
  const id = data.media?.id;
  if (!id) throw new Error('شناسه رسانه دریافت نشد');
  return id;
}

function NewListingInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const networkId = sp.get('networkId')?.trim() || '';
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState(CATS[0]);
  const [city, setCity] = useState('');
  const [description, setDescription] = useState('');
  const [imageMediaId, setImageMediaId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const token = getAccessToken();
    if (!file || !token) return;
    try {
      const id = await uploadMediaId(token, file);
      setImageMediaId(id);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'آپلود ناموفق');
    }
  }

  async function submit() {
    const token = getAccessToken();
    if (!token || !networkId || !businessName.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const created = await apiFetch<{ id: string }>('business/directory', {
        method: 'POST',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          networkId,
          businessName: businessName.trim(),
          category,
          city: city.trim() || undefined,
          description: description.trim() || undefined,
          imageMediaId: imageMediaId ?? undefined,
        }),
      });
      router.replace(`/spaces/business/directory/${created.id}?networkId=${encodeURIComponent(networkId)}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'خطا');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="theme-page-bg mx-auto max-w-md space-y-3 px-4 pb-16 pt-4" dir="rtl">
      <Link href={networkId ? `/spaces/business/directory?networkId=${encodeURIComponent(networkId)}` : '/spaces/business'}>←</Link>
      <h1 className="text-lg font-black">ثبت کسب‌وکار</h1>
      <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="نام" className="w-full rounded-xl border px-3 py-2" />
      <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-xl border px-3 py-2">
        {CATS.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="شهر" className="w-full rounded-xl border px-3 py-2" />
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="توضیح" rows={3} className="w-full rounded-xl border px-3 py-2" />
      <label className="block text-sm">
        لوگو / تصویر
        <input type="file" accept="image/*" onChange={(e) => void onFile(e)} className="mt-1 w-full text-xs" />
      </label>
      {imageMediaId ? <p className="text-[10px] text-emerald-700">تصویر ثبت شد</p> : null}
      {err ? <p className="text-red-600">{err}</p> : null}
      <button
        type="button"
        disabled={busy || !networkId}
        onClick={() => void submit()}
        className="w-full rounded-full bg-[var(--accent)] py-3 font-extrabold text-[var(--accent-contrast)] disabled:opacity-50"
      >
        {busy ? '…' : 'ثبت'}
      </button>
    </main>
  );
}

export default function NewListingPage() {
  return (
    <AuthGate>
      <Suspense fallback={<p className="p-6">…</p>}>
        <NewListingInner />
      </Suspense>
    </AuthGate>
  );
}

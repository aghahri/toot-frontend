'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthGate } from '@/components/AuthGate';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

function NewProjectInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const networkId = sp.get('networkId')?.trim() || '';
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    const token = getAccessToken();
    if (!token || !networkId || !title.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const created = await apiFetch<{ id: string }>('business/projects', {
        method: 'POST',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ networkId, title: title.trim(), description: description.trim() || undefined }),
      });
      router.replace(`/spaces/business/projects/${created.id}?networkId=${encodeURIComponent(networkId)}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'خطا');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="theme-page-bg mx-auto max-w-md space-y-3 px-4 pb-16 pt-4" dir="rtl">
      <Link href={networkId ? `/spaces/business/projects?networkId=${encodeURIComponent(networkId)}` : '/spaces/business'}>←</Link>
      <h1 className="text-lg font-black">پروژه جدید</h1>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان" className="w-full rounded-xl border px-3 py-2" />
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="توضیح" rows={3} className="w-full rounded-xl border px-3 py-2" />
      {err ? <p className="text-red-600">{err}</p> : null}
      <button
        type="button"
        disabled={busy || !networkId}
        onClick={() => void submit()}
        className="w-full rounded-full bg-[var(--accent)] py-3 font-extrabold text-[var(--accent-contrast)] disabled:opacity-50"
      >
        {busy ? '…' : 'ایجاد'}
      </button>
    </main>
  );
}

export default function NewProjectPage() {
  return (
    <AuthGate>
      <Suspense fallback={<p className="p-6">…</p>}>
        <NewProjectInner />
      </Suspense>
    </AuthGate>
  );
}

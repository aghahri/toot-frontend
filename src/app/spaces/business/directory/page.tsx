'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthGate } from '@/components/AuthGate';
import { fetchBusinessDirectory, type DirectoryRow } from '@/lib/businessSpace';

function DirInner() {
  const sp = useSearchParams();
  const networkId = sp.get('networkId')?.trim() || '';
  const [cat, setCat] = useState('');
  const [rows, setRows] = useState<DirectoryRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!networkId) {
      setRows([]);
      setLoading(false);
      return;
    }
    let c = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetchBusinessDirectory(networkId, cat.trim() ? { category: cat.trim() } : undefined);
        if (!c) setRows(res.data);
      } catch (e) {
        if (!c) {
          setErr(e instanceof Error ? e.message : 'خطا');
          setRows([]);
        }
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [networkId, cat]);

  return (
    <main className="theme-page-bg mx-auto max-w-md space-y-3 px-4 pb-16 pt-4" dir="rtl">
      <Link href="/spaces/business">←</Link>
      <h1 className="text-lg font-black">فهرست کسب‌وکارها</h1>
      {networkId ? (
        <p className="rounded-xl border border-[var(--border-soft)] bg-[var(--card-bg)] px-3 py-2 text-xs font-bold text-[var(--text-secondary)]">
          برای <span className="text-[var(--text-primary)]">مشاوره آنلاین</span> وارد صفحه هر کسب‌وکار شوید.
        </p>
      ) : null}
      {!networkId ? <p className="text-sm text-amber-800">networkId لازم است</p> : null}
      <input
        value={cat}
        onChange={(e) => setCat(e.target.value)}
        placeholder="فیلتر دسته (مثلاً رستوران)"
        className="w-full rounded-xl border px-3 py-2 text-sm"
      />
      {loading ? <p>…</p> : null}
      {err ? <p className="text-red-600">{err}</p> : null}
      <ul className="space-y-3">
        {(rows ?? []).map((r) => (
          <li key={r.id}>
            <Link href={`/spaces/business/directory/${r.id}?networkId=${encodeURIComponent(networkId)}`} className="flex gap-3 rounded-2xl border p-3">
              {r.imageMedia?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.imageMedia.url} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-soft)] text-xl">🏪</div>
              )}
              <div className="min-w-0">
                <p className="font-bold">{r.businessName}</p>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  {r.category}
                  {r.city ? ` · ${r.city}` : ''}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {networkId ? (
        <Link
          href={`/spaces/business/directory/new?networkId=${encodeURIComponent(networkId)}`}
          className="mt-4 block rounded-full bg-[var(--accent)] py-3 text-center font-extrabold text-[var(--accent-contrast)]"
        >
          ثبت کسب‌وکار
        </Link>
      ) : null}
    </main>
  );
}

export default function DirectoryPage() {
  return (
    <AuthGate>
      <Suspense fallback={<p className="p-6">…</p>}>
        <DirInner />
      </Suspense>
    </AuthGate>
  );
}

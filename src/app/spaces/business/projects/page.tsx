'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthGate } from '@/components/AuthGate';
import { fetchBusinessProjects, type BusinessProjectRow } from '@/lib/businessSpace';

const ST_FA: Record<string, string> = {
  PLANNING: 'برنامه‌ریزی',
  ACTIVE: 'فعال',
  PAUSED: 'متوقف موقت',
  DONE: 'پایان',
};

function ProjectsInner() {
  const sp = useSearchParams();
  const networkId = sp.get('networkId')?.trim() || '';
  const [rows, setRows] = useState<BusinessProjectRow[] | null>(null);
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
        const res = await fetchBusinessProjects(networkId);
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
  }, [networkId]);

  return (
    <main className="theme-page-bg mx-auto w-full max-w-md space-y-3 px-4 pb-16 pt-4" dir="rtl">
      <Link href="/spaces/business">←</Link>
      <h1 className="text-lg font-black">پروژه‌ها</h1>
      {!networkId ? <p className="text-sm text-amber-800">networkId لازم است</p> : null}
      {loading ? <p>…</p> : null}
      {err ? <p className="text-red-600">{err}</p> : null}
      <ul className="space-y-2">
        {(rows ?? []).map((p) => (
          <li key={p.id}>
            <Link
              href={`/spaces/business/projects/${p.id}?networkId=${encodeURIComponent(networkId)}`}
              className="block rounded-2xl border border-[var(--border-soft)] p-3"
            >
              <p className="font-bold">{p.title}</p>
              <p className="text-[11px] text-[var(--text-secondary)]">
                {ST_FA[p.status] ?? p.status}
                {p._count ? ` · ${p._count.tasks} وظیفه` : ''}
              </p>
            </Link>
          </li>
        ))}
      </ul>
      {networkId ? (
        <Link
          href={`/spaces/business/projects/new?networkId=${encodeURIComponent(networkId)}`}
          className="mt-4 block rounded-full bg-[var(--accent)] py-3 text-center font-extrabold text-[var(--accent-contrast)]"
        >
          پروژه جدید
        </Link>
      ) : null}
    </main>
  );
}

export default function ProjectsPage() {
  return (
    <AuthGate>
      <Suspense fallback={<p className="p-6">…</p>}>
        <ProjectsInner />
      </Suspense>
    </AuthGate>
  );
}

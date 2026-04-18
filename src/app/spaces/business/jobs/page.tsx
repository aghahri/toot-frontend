'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthGate } from '@/components/AuthGate';
import { fetchBusinessJobs, type BusinessJobRow } from '@/lib/businessSpace';

const JOB_FA: Record<string, string> = {
  FULL_TIME: 'تمام‌وقت',
  PART_TIME: 'پاره‌وقت',
  FREELANCE: 'فریلنس',
  INTERNSHIP: 'کارآموزی',
};

function JobsListInner() {
  const searchParams = useSearchParams();
  const networkId = searchParams.get('networkId')?.trim() || '';
  const [rows, setRows] = useState<BusinessJobRow[] | null>(null);
  const [q, setQ] = useState('');
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
      setErr(null);
      try {
        const res = await fetchBusinessJobs(networkId, q.trim() ? { q: q.trim() } : undefined);
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
  }, [networkId, q]);

  return (
    <main className="theme-page-bg mx-auto w-full max-w-md space-y-4 px-4 pb-16 pt-4" dir="rtl">
      <div className="flex items-center gap-2">
        <Link href="/spaces/business" className="text-[var(--text-secondary)]">
          ←
        </Link>
        <h1 className="text-lg font-black text-[var(--text-primary)]">فرصت‌های شغلی</h1>
      </div>
      {!networkId ? (
        <p className="text-sm text-amber-800">پارامتر networkId لازم است. از فضای کسب‌وکار وارد شوید.</p>
      ) : null}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="جستجو در عنوان یا شرکت…"
        className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
      />
      {loading ? <p className="text-sm text-[var(--text-secondary)]">…</p> : null}
      {err ? <p className="text-sm text-red-600">{err}</p> : null}
      <ul className="space-y-2">
        {(rows ?? []).map((j) => (
          <li key={j.id}>
            <Link
              href={`/spaces/business/jobs/${j.id}?networkId=${encodeURIComponent(networkId)}`}
              className="block rounded-2xl border border-[var(--border-soft)] bg-[var(--card-bg)] p-3 ring-1 ring-[var(--border-soft)]"
            >
              <p className="text-sm font-black text-[var(--text-primary)]">{j.title}</p>
              <p className="text-[11px] text-[var(--text-secondary)]">
                {j.companyName} · {JOB_FA[j.jobType] ?? j.jobType}
                {j.remote ? ' · دورکار' : ''}
                {j.city ? ` · ${j.city}` : ''}
              </p>
            </Link>
          </li>
        ))}
      </ul>
      {!loading && rows?.length === 0 && networkId ? (
        <p className="text-center text-sm text-[var(--text-secondary)]">آگهی فعالی نیست.</p>
      ) : null}
      {networkId ? (
        <Link
          href={`/spaces/business/jobs/new?networkId=${encodeURIComponent(networkId)}`}
          className="mt-4 block rounded-full bg-[var(--accent)] py-3 text-center text-sm font-extrabold text-[var(--accent-contrast)]"
        >
          ثبت آگهی جدید
        </Link>
      ) : null}
    </main>
  );
}

export default function BusinessJobsPage() {
  return (
    <AuthGate>
      <Suspense fallback={<p className="p-6 text-center text-sm">…</p>}>
        <JobsListInner />
      </Suspense>
    </AuthGate>
  );
}

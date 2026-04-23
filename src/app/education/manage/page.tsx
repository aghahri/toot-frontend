'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AuthGate } from '@/components/AuthGate';
import { fetchCreatorCourses, type CreatorCourseRow } from '@/lib/education';

const SECTION =
  'rounded-3xl border border-[var(--border-soft)] bg-[var(--card-bg)] p-4 shadow-sm ring-1 ring-[var(--border-soft)]';

export default function EducationManagePage() {
  const [rows, setRows] = useState<CreatorCourseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchCreatorCourses(60));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AuthGate>
      <div className="mx-auto max-w-md px-4 pb-8 pt-2">
        <div className="mb-3">
          <Link href="/spaces/education" className="text-[12px] font-bold text-[var(--text-secondary)]">
            ← فضای آموزش
          </Link>
        </div>

        <header className="mb-4 rounded-3xl border border-[var(--border-soft)] bg-gradient-to-br from-violet-950/35 via-[var(--card-bg)] to-[var(--card-bg)] p-5 ring-1 ring-[var(--border-soft)]">
          <h1 className="text-2xl font-black text-[var(--text-primary)]">مدیریت آموزش</h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">مدیریت دوره‌ها و جلسات آموزشی شما</p>
          <div className="mt-3 flex gap-2">
            <Link href="/education/new" className="rounded-xl bg-violet-700 px-3 py-2 text-xs font-extrabold text-white">
              ایجاد دوره جدید
            </Link>
            <Link href="/education/manage" className="rounded-xl border border-[var(--border-soft)] px-3 py-2 text-xs font-bold text-[var(--text-secondary)]">
              دوره‌های من
            </Link>
          </div>
        </header>

        {error ? (
          <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-200">
            {error}
          </div>
        ) : null}

        <section className={SECTION}>
          <h2 className="mb-3 text-sm font-extrabold text-[var(--text-primary)]">دوره‌های من</h2>
          {loading ? (
            <div className="space-y-2">
              <div className="h-20 animate-pulse rounded-2xl bg-[var(--surface-soft)]" />
              <div className="h-20 animate-pulse rounded-2xl bg-[var(--surface-soft)]" />
            </div>
          ) : rows.length ? (
            <ul className="space-y-2">
              {rows.map((r) => (
                <li key={r.id} className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3 ring-1 ring-[var(--border-soft)]">
                  <p className="line-clamp-1 text-sm font-extrabold text-[var(--text-primary)]">{r.title}</p>
                  {r.summary ? (
                    <p className="mt-1 line-clamp-2 text-[11px] text-[var(--text-secondary)]">{r.summary}</p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                    {r.enrolledCount} هنرجو · {r.upcomingMeetingsCount} جلسه پیش‌رو
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Link href={`/education/${r.id}/edit`} className="rounded-lg border border-[var(--border-soft)] px-2 py-1 text-[11px] font-bold text-[var(--text-primary)]">
                      ویرایش
                    </Link>
                    <Link href={`/education/${r.id}/sessions`} className="rounded-lg border border-[var(--border-soft)] px-2 py-1 text-[11px] font-bold text-[var(--text-primary)]">
                      جلسات
                    </Link>
                    <Link href={`/education/${r.id}`} className="rounded-lg border border-[var(--border-soft)] px-2 py-1 text-[11px] font-bold text-[var(--text-primary)]">
                      مشاهده
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">هنوز دوره‌ای ایجاد نکرده‌اید.</p>
          )}
        </section>
      </div>
    </AuthGate>
  );
}

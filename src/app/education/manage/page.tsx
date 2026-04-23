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

  const totalStudents = rows.reduce((sum, row) => sum + row.enrolledCount, 0);
  const totalUpcomingSessions = rows.reduce((sum, row) => sum + row.upcomingMeetingsCount, 0);
  const totalTodaySessions = rows.reduce((sum, row) => sum + (row.todaySessionsCount ?? 0), 0);
  const totalRecentAttendances = rows.reduce((sum, row) => sum + (row.recentAttendanceCount ?? 0), 0);

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
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            مدیریت دوره‌ها، وضعیت انتشار و برنامه‌ریزی جلسات آموزشی
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/education/new"
              className="rounded-xl bg-violet-700 px-3 py-2 text-xs font-extrabold text-white"
            >
              ایجاد دوره جدید
            </Link>
            <Link
              href="/spaces/education"
              className="rounded-xl border border-[var(--border-soft)] px-3 py-2 text-xs font-bold text-[var(--text-secondary)]"
            >
              بازگشت به فضای آموزش
            </Link>
            <Link
              href="/education/manage"
              className="rounded-xl border border-[var(--border-soft)] px-3 py-2 text-xs font-bold text-[var(--text-secondary)]"
            >
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
          {!loading ? (
            <div className="mb-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-2 text-center">
                <p className="text-[10px] font-bold text-[var(--text-secondary)]">جلسات امروز</p>
                <p className="mt-1 text-sm font-black text-[var(--text-primary)]">{totalTodaySessions}</p>
              </div>
              <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-2 text-center">
                <p className="text-[10px] font-bold text-[var(--text-secondary)]">جلسات آینده</p>
                <p className="mt-1 text-sm font-black text-[var(--text-primary)]">{totalUpcomingSessions}</p>
              </div>
              <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-2 text-center">
                <p className="text-[10px] font-bold text-[var(--text-secondary)]">دانشجویان فعال</p>
                <p className="mt-1 text-sm font-black text-[var(--text-primary)]">{totalStudents}</p>
              </div>
              <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-2 text-center">
                <p className="text-[10px] font-bold text-[var(--text-secondary)]">آخرین حضورها</p>
                <p className="mt-1 text-sm font-black text-[var(--text-primary)]">{totalRecentAttendances}</p>
              </div>
              <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-2 text-center col-span-2">
                <p className="text-[10px] font-bold text-[var(--text-secondary)]">تعداد دوره‌ها</p>
                <p className="mt-1 text-sm font-black text-[var(--text-primary)]">{rows.length}</p>
              </div>
            </div>
          ) : null}
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-extrabold text-[var(--text-primary)]">دوره‌های من</h2>
            {!loading ? (
              <span className="rounded-lg bg-[var(--surface-soft)] px-2 py-1 text-[11px] font-bold text-[var(--text-secondary)]">
                {rows.length} دوره
              </span>
            ) : null}
          </div>
          {loading ? (
            <div className="space-y-2">
              <div className="h-20 animate-pulse rounded-2xl bg-[var(--surface-soft)]" />
              <div className="h-20 animate-pulse rounded-2xl bg-[var(--surface-soft)]" />
            </div>
          ) : rows.length ? (
            <ul className="space-y-2">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3 ring-1 ring-[var(--border-soft)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-2 break-words text-sm font-extrabold text-[var(--text-primary)]">
                      {r.title}
                    </p>
                    <span
                      className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-extrabold ${
                        r.published
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                          : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                      }`}
                    >
                      {r.published ? 'منتشرشده' : 'پیش‌نویس'}
                    </span>
                  </div>
                  {r.summary ? (
                    <p className="mt-1 line-clamp-2 break-words text-[11px] text-[var(--text-secondary)]">
                      {r.summary}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[var(--text-secondary)]">
                    <span className="rounded-lg border border-[var(--border-soft)] px-2 py-1">
                      وضعیت: {r.published ? 'منتشرشده' : 'پیش‌نویس'}
                    </span>
                    <span className="rounded-lg border border-[var(--border-soft)] px-2 py-1">
                      هنرجو: {r.enrolledCount}
                    </span>
                    <span className="rounded-lg border border-[var(--border-soft)] px-2 py-1">
                      جلسه پیش‌رو: {r.upcomingMeetingsCount}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href={`/education/${r.id}/edit`}
                      className="rounded-lg border border-[var(--border-soft)] px-2.5 py-1.5 text-[11px] font-bold text-[var(--text-primary)]"
                    >
                      ویرایش
                    </Link>
                    <Link
                      href={`/education/${r.id}/sessions`}
                      className="rounded-lg border border-[var(--border-soft)] px-2.5 py-1.5 text-[11px] font-bold text-[var(--text-primary)]"
                    >
                      جلسات دوره
                    </Link>
                    <Link
                      href={`/education/${r.id}`}
                      className="rounded-lg bg-violet-700 px-2.5 py-1.5 text-[11px] font-extrabold text-white"
                    >
                      صفحه دوره
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-8 text-center">
              <p className="text-sm font-extrabold text-[var(--text-primary)]">هنوز دوره‌ای ایجاد نکرده‌اید</p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                برای شروع اولین دوره خود را بسازید
              </p>
              <Link
                href="/education/new"
                className="mt-4 inline-flex rounded-xl bg-violet-700 px-3 py-2 text-xs font-extrabold text-white"
              >
                ایجاد اولین دوره
              </Link>
            </div>
          )}
        </section>
      </div>
    </AuthGate>
  );
}

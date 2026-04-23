'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthGate } from '@/components/AuthGate';
import {
  createCourseSession,
  fetchCourseSessions,
  fetchEducationCourse,
  type CourseSessionRow,
} from '@/lib/education';
import { formatAppDateTime } from '@/lib/locale-date';

function toLocalDateTimeInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function EducationSessionsPage() {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : '';
  const [title, setTitle] = useState('جلسه آموزشی');
  const [startsAt, setStartsAt] = useState(toLocalDateTimeInput(new Date(Date.now() + 60 * 60 * 1000)));
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [sessions, setSessions] = useState<CourseSessionRow[]>([]);
  const [courseTitle, setCourseTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [course, rows] = await Promise.all([fetchEducationCourse(id), fetchCourseSessions(id)]);
      if (!course._meta?.canManage) throw new Error('فقط صاحب دوره یا ادمین امکان مدیریت جلسات دارد.');
      setCourseTitle(course.title);
      setSessions(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا');
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!id || saving) return;
    setSaving(true);
    setError(null);
    try {
      await createCourseSession(id, {
        title: title.trim(),
        startsAt: new Date(startsAt).toISOString(),
        durationMinutes,
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا');
    } finally {
      setSaving(false);
    }
  }

  const upcoming = useMemo(
    () => {
      const rank = (s: CourseSessionRow) => {
        if (s.isLive) return 0;
        if (!s.hasEnded) return 1;
        return 2;
      };
      return [...sessions].sort((a, b) => {
        const rankDiff = rank(a) - rank(b);
        if (rankDiff !== 0) return rankDiff;
        return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
      });
    },
    [sessions],
  );

  return (
    <AuthGate>
      <div className="mx-auto max-w-md px-4 pb-8 pt-3">
        <div className="mb-3">
          <Link
            href={id ? `/education/${id}` : '/education/manage'}
            className="text-[12px] font-bold text-[var(--text-secondary)]"
          >
            ← بازگشت
          </Link>
        </div>
        <header className="mb-4 rounded-3xl border border-[var(--border-soft)] bg-[var(--card-bg)] p-4 ring-1 ring-[var(--border-soft)]">
          <h1 className="text-lg font-black text-[var(--text-primary)]">مدیریت جلسات دوره</h1>
          <p className="mt-1 line-clamp-2 break-words text-xs text-[var(--text-secondary)]">
            {courseTitle || '...'}
          </p>
          <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
            با ایجاد هر جلسه، یک کلاس مرتبط برای این دوره ساخته می‌شود.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={id ? `/education/${id}/edit` : '/education/manage'}
              className="rounded-lg border border-[var(--border-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--text-primary)]"
            >
              ویرایش دوره
            </Link>
            <Link
              href={id ? `/education/${id}` : '/education/manage'}
              className="rounded-lg border border-[var(--border-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--text-primary)]"
            >
              صفحه دوره
            </Link>
            <Link
              href="/education/manage"
              className="rounded-lg border border-[var(--border-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--text-secondary)]"
            >
              مدیریت آموزش
            </Link>
          </div>
        </header>
        {error ? (
          <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-200">
            {error}
          </div>
        ) : null}

        <form
          onSubmit={onCreate}
          className="mb-4 space-y-2 rounded-2xl border border-[var(--border-soft)] bg-[var(--card-bg)] p-3 ring-1 ring-[var(--border-soft)]"
        >
          <h2 className="text-sm font-extrabold text-[var(--text-primary)]">ایجاد جلسه جدید</h2>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">عنوان جلسه</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              minLength={2}
              className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
              placeholder="عنوان جلسه"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">
              تاریخ و زمان شروع
            </span>
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              required
              className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">
              مدت جلسه (دقیقه)
            </span>
            <input
              type="number"
              min={5}
              max={24 * 60}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Math.max(5, Number(e.target.value) || 60))}
              className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-violet-700 px-3 py-2 text-xs font-extrabold text-white disabled:opacity-50"
          >
            {saving ? 'در حال ایجاد…' : 'ایجاد جلسه'}
          </button>
        </form>

        <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--card-bg)] p-3 ring-1 ring-[var(--border-soft)]">
          <h2 className="mb-2 text-sm font-extrabold text-[var(--text-primary)]">جلسات پیش‌رو</h2>
          {loading ? (
            <div className="h-16 animate-pulse rounded-xl bg-[var(--surface-soft)]" />
          ) : upcoming.length ? (
            <ul className="space-y-2">
              {upcoming.map((s) => (
                <li
                  key={s.id}
                  className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-2 break-words text-sm font-bold text-[var(--text-primary)]">
                      {s.title}
                    </p>
                    <span className="shrink-0 rounded-lg bg-[var(--card-bg)] px-2 py-1 text-[10px] font-bold text-[var(--text-secondary)]">
                      {s.durationMinutes} دقیقه
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-[var(--text-secondary)]">{formatAppDateTime(s.startsAt)}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {s.isToday ? (
                      <span className="rounded-lg bg-violet-500/15 px-2 py-0.5 text-[10px] font-extrabold text-violet-700 dark:text-violet-300">
                        امروز
                      </span>
                    ) : null}
                    {s.isLive ? (
                      <span className="rounded-lg bg-red-500/15 px-2 py-0.5 text-[10px] font-extrabold text-red-700 dark:text-red-300">
                        زنده
                      </span>
                    ) : null}
                    {!s.isLive && !s.hasEnded && (s.startsInMinutes ?? 9999) >= 0 && (s.startsInMinutes ?? 9999) <= 30 ? (
                      <span className="rounded-lg bg-amber-500/15 px-2 py-0.5 text-[10px] font-extrabold text-amber-700 dark:text-amber-300">
                        تا ۳۰ دقیقه دیگر
                      </span>
                    ) : null}
                    {!s.isLive &&
                    !s.hasEnded &&
                    (s.startsInMinutes ?? 9999) > 30 &&
                    (s.startsInMinutes ?? 9999) <= 60 ? (
                      <span className="rounded-lg bg-amber-500/15 px-2 py-0.5 text-[10px] font-extrabold text-amber-700 dark:text-amber-300">
                        تا ۱ ساعت دیگر
                      </span>
                    ) : null}
                    {s.hasEnded ? (
                      <span className="rounded-lg bg-zinc-500/20 px-2 py-0.5 text-[10px] font-extrabold text-zinc-700 dark:text-zinc-300">
                        پایان یافته
                      </span>
                    ) : null}
                    <span className="rounded-lg bg-[var(--card-bg)] px-2 py-0.5 text-[10px] font-bold text-[var(--text-secondary)]">
                      حضور ثبت‌شده: {s.checkedInCount ?? 0}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Link
                      href={`/meetings/${s.id}`}
                      className="rounded-lg bg-violet-700 px-2.5 py-1 text-[11px] font-extrabold text-white"
                    >
                      ورود به کلاس
                    </Link>
                    <Link
                      href={id ? `/education/${id}` : '/education/manage'}
                      className="rounded-lg border border-[var(--border-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--text-secondary)]"
                    >
                      صفحه دوره
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-5 text-center">
              <p className="text-xs font-extrabold text-[var(--text-primary)]">
                هنوز جلسه‌ای برای این دوره برنامه‌ریزی نشده است
              </p>
              <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                از فرم بالا برای ایجاد اولین جلسه استفاده کنید.
              </p>
            </div>
          )}
        </section>
      </div>
    </AuthGate>
  );
}

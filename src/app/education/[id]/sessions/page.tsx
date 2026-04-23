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
      if (!course._meta?.isOwner) throw new Error('فقط سازنده دوره امکان مدیریت جلسات دارد.');
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
    () =>
      [...sessions].sort(
        (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
      ),
    [sessions],
  );

  return (
    <AuthGate>
      <div className="mx-auto max-w-md px-4 pb-8 pt-3">
        <div className="mb-3">
          <Link href={id ? `/education/${id}` : '/education/manage'} className="text-[12px] font-bold text-[var(--text-secondary)]">
            ← بازگشت
          </Link>
        </div>
        <header className="mb-4 rounded-3xl border border-[var(--border-soft)] bg-[var(--card-bg)] p-4 ring-1 ring-[var(--border-soft)]">
          <h1 className="text-lg font-black text-[var(--text-primary)]">مدیریت جلسات دوره</h1>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">{courseTitle || '...'}</p>
        </header>
        {error ? (
          <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-200">
            {error}
          </div>
        ) : null}

        <form onSubmit={onCreate} className="mb-4 space-y-2 rounded-2xl border border-[var(--border-soft)] bg-[var(--card-bg)] p-3 ring-1 ring-[var(--border-soft)]">
          <h2 className="text-sm font-extrabold text-[var(--text-primary)]">ایجاد جلسه جدید</h2>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required minLength={2} className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm" placeholder="عنوان جلسه" />
          <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm" />
          <input type="number" min={5} max={24 * 60} value={durationMinutes} onChange={(e) => setDurationMinutes(Math.max(5, Number(e.target.value) || 60))} className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm" />
          <button type="submit" disabled={saving} className="w-full rounded-xl bg-violet-700 px-3 py-2 text-xs font-extrabold text-white disabled:opacity-50">
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
                <li key={s.id} className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">
                  <p className="line-clamp-1 text-sm font-bold text-[var(--text-primary)]">{s.title}</p>
                  <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                    {formatAppDateTime(s.startsAt)} · {s.durationMinutes} دقیقه
                  </p>
                  <Link href={`/meetings/${s.id}`} className="mt-2 inline-block text-[11px] font-extrabold text-violet-700 dark:text-violet-300">
                    مشاهده جلسه
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-[var(--text-secondary)]">هنوز جلسه‌ای ثبت نشده است.</p>
          )}
        </section>
      </div>
    </AuthGate>
  );
}

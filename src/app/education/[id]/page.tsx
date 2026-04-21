'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { AuthGate } from '@/components/AuthGate';
import {
  enrollCourse,
  fetchEducationCourse,
  type EducationCourse,
  unenrollCourse,
} from '@/lib/education';
import { formatAppDateTime } from '@/lib/locale-date';

export default function EducationCourseDetailPage() {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : '';
  const [course, setCourse] = useState<EducationCourse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      setCourse(await fetchEducationCourse(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا');
      setCourse(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const isOwner = !!course?._meta?.isOwner;
  const isEnrolled = !!course?.me || !!course?.enrollments?.length;

  async function toggleEnroll() {
    if (!course || busy || isOwner) return;
    setBusy(true);
    const prev = course;
    setCourse({
      ...prev,
      me: isEnrolled ? null : { id: 'optimistic', role: 'STUDENT' },
      _count: {
        enrollments: Math.max(0, prev._count.enrollments + (isEnrolled ? -1 : 1)),
      },
    });
    try {
      if (isEnrolled) await unenrollCourse(course.id);
      else await enrollCourse(course.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا');
      setCourse(prev);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthGate>
      <div className="mx-auto max-w-md px-4 pb-8 pt-3">
        <div className="mb-3">
          <Link href="/spaces/education" className="text-[12px] font-bold text-[var(--text-secondary)]">
            ← بازگشت به آموزش
          </Link>
        </div>
        {error ? (
          <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-200">
            {error}
          </div>
        ) : null}
        {loading ? (
          <div className="space-y-3">
            <div className="h-44 animate-pulse rounded-3xl bg-[var(--surface-soft)]" />
            <div className="h-24 animate-pulse rounded-2xl bg-[var(--surface-soft)]" />
          </div>
        ) : !course ? (
          <p className="text-sm text-[var(--text-secondary)]">دوره پیدا نشد.</p>
        ) : (
          <div className="space-y-3">
            <section className="overflow-hidden rounded-3xl border border-[var(--border-soft)] bg-[var(--card-bg)] ring-1 ring-[var(--border-soft)]">
              {course.coverImageUrl ? (
                <img src={course.coverImageUrl} alt="" className="h-36 w-full object-cover" />
              ) : (
                <div className="h-24 w-full bg-gradient-to-br from-violet-900/60 to-zinc-900/30" />
              )}
              <div className="p-4">
                <h1 className="text-lg font-black text-[var(--text-primary)]">{course.title}</h1>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">مدرس: {course.owner.name}</p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">{course._count.enrollments} عضو</p>
                {!isOwner ? (
                  <button
                    type="button"
                    onClick={() => void toggleEnroll()}
                    disabled={busy}
                    className="mt-3 rounded-xl bg-violet-700 px-3 py-2 text-xs font-extrabold text-white disabled:opacity-50"
                  >
                    {isEnrolled ? 'عضو شدید' : 'ثبت‌نام در دوره'}
                  </button>
                ) : (
                  <Link
                    href="/education/new"
                    className="mt-3 inline-block rounded-xl border border-[var(--border-soft)] px-3 py-2 text-xs font-bold text-[var(--text-secondary)]"
                  >
                    ویرایش/مدیریت دوره
                  </Link>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--card-bg)] p-4 ring-1 ring-[var(--border-soft)]">
              <h2 className="text-sm font-extrabold text-[var(--text-primary)]">جلسه بعدی</h2>
              {course.nextMeeting ? (
                <div className="mt-2 space-y-1">
                  <p className="text-sm font-bold text-[var(--text-primary)]">{course.nextMeeting.title}</p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {formatAppDateTime(course.nextMeeting.startsAt)}
                  </p>
                  <Link
                    href={`/meetings/${course.nextMeeting.id}`}
                    className="inline-block rounded-lg bg-violet-700 px-3 py-1.5 text-xs font-extrabold text-white"
                  >
                    ورود به جلسه
                  </Link>
                </div>
              ) : (
                <p className="mt-2 text-xs text-[var(--text-secondary)]">جلسه‌ای لینک نشده است.</p>
              )}
            </section>

            <section className="grid grid-cols-2 gap-2">
              <Link
                href={
                  course.channel
                    ? `/channels/${course.channel.id}`
                    : '/channels/new?preset=teacher&spaceKey=EDUCATION'
                }
                className="rounded-2xl border border-[var(--border-soft)] bg-[var(--card-bg)] p-3 text-xs font-bold text-[var(--text-primary)] ring-1 ring-[var(--border-soft)]"
              >
                کانال مدرس
                <p className="mt-1 text-[11px] font-normal text-[var(--text-secondary)]">
                  {course.channel?.name ?? 'اتصال کانال'}
                </p>
              </Link>
              <Link
                href={
                  course.group
                    ? `/groups/${course.group.id}`
                    : '/groups/new?kind=community&spaceKey=EDUCATION&preset=study'
                }
                className="rounded-2xl border border-[var(--border-soft)] bg-[var(--card-bg)] p-3 text-xs font-bold text-[var(--text-primary)] ring-1 ring-[var(--border-soft)]"
              >
                گروه مطالعه
                <p className="mt-1 text-[11px] font-normal text-[var(--text-secondary)]">
                  {course.group?.name ?? 'اتصال گروه'}
                </p>
              </Link>
            </section>

            <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--card-bg)] p-4 ring-1 ring-[var(--border-soft)]">
              <h2 className="text-sm font-extrabold text-[var(--text-primary)]">درباره دوره</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                {course.description || 'توضیحی برای دوره ثبت نشده است.'}
              </p>
            </section>
          </div>
        )}
      </div>
    </AuthGate>
  );
}

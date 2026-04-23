'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { AuthGate } from '@/components/AuthGate';
import {
  checkInEducationSession,
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
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkInMessage, setCheckInMessage] = useState<string | null>(null);

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

  const canManage = !!course?._meta?.canManage;
  const isEnrolled = !!course?.me || !!course?.enrollments?.length;

  async function toggleEnroll() {
    if (!course || busy || canManage) return;
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

  async function onCheckIn() {
    if (!course?.nextMeeting || checkingIn) return;
    setCheckingIn(true);
    setCheckInMessage(null);
    try {
      const res = await checkInEducationSession(course.nextMeeting.id);
      setCourse((prev) =>
        prev && prev.nextMeeting ? { ...prev, nextMeeting: { ...prev.nextMeeting, checkedIn: true } } : prev,
      );
      setCheckInMessage(res.alreadyCheckedIn ? 'حضور شما قبلا ثبت شده است' : 'حضور شما ثبت شد');
    } catch (e) {
      setCheckInMessage(e instanceof Error ? e.message : 'خطا در ثبت حضور');
    } finally {
      setCheckingIn(false);
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
        {checkInMessage ? (
          <div className="mb-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-200">
            {checkInMessage}
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
                <p className="mt-1 text-xs text-[var(--text-secondary)]">{course._count.enrollments} عضو</p>
                {!canManage ? (
                  <button
                    type="button"
                    onClick={() => void toggleEnroll()}
                    disabled={busy}
                    className="mt-3 rounded-xl bg-violet-700 px-3 py-2 text-xs font-extrabold text-white disabled:opacity-50"
                  >
                    {isEnrolled ? 'عضو شدید' : 'ثبت‌نام در دوره'}
                  </button>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href={`/education/${course.id}/edit`}
                      className="inline-block rounded-xl border border-[var(--border-soft)] px-3 py-2 text-xs font-bold text-[var(--text-secondary)]"
                    >
                      ویرایش دوره
                    </Link>
                    <Link
                      href={`/education/${course.id}/sessions`}
                      className="inline-block rounded-xl border border-[var(--border-soft)] px-3 py-2 text-xs font-bold text-[var(--text-secondary)]"
                    >
                      مدیریت جلسات
                    </Link>
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--card-bg)] p-4 ring-1 ring-[var(--border-soft)]">
              <h2 className="text-sm font-extrabold text-[var(--text-primary)]">مدرس</h2>
              <div className="mt-2 flex items-center gap-3">
                {course.owner.avatar ? (
                  <img
                    src={course.owner.avatar}
                    alt={course.owner.name}
                    className="h-11 w-11 rounded-full border border-[var(--border-soft)] object-cover"
                  />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border-soft)] bg-[var(--surface-soft)] text-xs font-extrabold text-[var(--text-secondary)]">
                    {course.owner.name.slice(0, 1)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="line-clamp-1 text-sm font-extrabold text-[var(--text-primary)]">{course.owner.name}</p>
                  <p className="line-clamp-1 text-[11px] text-[var(--text-secondary)]">@{course.owner.username}</p>
                </div>
                <span className="mr-auto rounded-lg bg-violet-500/15 px-2 py-1 text-[10px] font-extrabold text-violet-700 dark:text-violet-300">
                  مدرس
                </span>
              </div>
            </section>

            <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--card-bg)] p-4 ring-1 ring-[var(--border-soft)]">
              <h2 className="text-sm font-extrabold text-[var(--text-primary)]">جلسه بعدی</h2>
              {course.nextMeeting ? (
                <div className="mt-2 space-y-1">
                  <p className="text-sm font-bold text-[var(--text-primary)]">{course.nextMeeting.title}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs text-[var(--text-secondary)]">
                      {formatAppDateTime(course.nextMeeting.startsAt)}
                    </p>
                    {course.nextMeeting.isLive ? (
                      <span className="rounded-lg bg-red-500/15 px-2 py-0.5 text-[10px] font-extrabold text-red-700 dark:text-red-300">
                        زنده
                      </span>
                    ) : null}
                    {course.nextMeeting.startsSoon ? (
                      <span className="rounded-lg bg-amber-500/15 px-2 py-0.5 text-[10px] font-extrabold text-amber-700 dark:text-amber-300">
                        تا ۱ ساعت دیگر
                      </span>
                    ) : null}
                    {course.nextMeeting.hasEnded ? (
                      <span className="rounded-lg bg-zinc-500/20 px-2 py-0.5 text-[10px] font-extrabold text-zinc-700 dark:text-zinc-300">
                        پایان یافته
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Link
                      href={`/meetings/${course.nextMeeting.id}`}
                      className="inline-block rounded-lg bg-violet-700 px-3 py-1.5 text-xs font-extrabold text-white"
                    >
                      ورود به جلسه
                    </Link>
                    <button
                      type="button"
                      onClick={() => void onCheckIn()}
                      disabled={checkingIn || !!course.nextMeeting.checkedIn}
                      className="rounded-lg border border-[var(--border-soft)] px-3 py-1.5 text-xs font-bold text-[var(--text-primary)] disabled:opacity-50"
                    >
                      {course.nextMeeting.checkedIn
                        ? 'حضور شما ثبت شد'
                        : checkingIn
                          ? 'در حال ثبت…'
                          : 'حضور در کلاس'}
                    </button>
                  </div>
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

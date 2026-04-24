'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthGate } from '@/components/AuthGate';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import {
  checkInEducationSession,
  enrollCourse,
  fetchCourseSessions,
  fetchEducationCourse,
  type CourseSessionRow,
  type EducationCourse,
  unenrollCourse,
} from '@/lib/education';
import { formatAppDateTime } from '@/lib/locale-date';

export default function EducationCourseDetailPage() {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : '';
  const [course, setCourse] = useState<EducationCourse | null>(null);
  const [sessions, setSessions] = useState<CourseSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkInMessage, setCheckInMessage] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [sharingToStory, setSharingToStory] = useState(false);
  const [showInvitePrompt, setShowInvitePrompt] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [courseRes, sessionsRes] = await Promise.all([
        fetchEducationCourse(id),
        fetchCourseSessions(id),
      ]);
      setCourse(courseRes);
      setSessions(sessionsRes);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا');
      setCourse(null);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const canManage = !!course?._meta?.canManage;
  const isEnrolled = !!course?.me || !!course?.enrollments?.length;
  const upcomingSessions = useMemo(
    () => sessions.filter((s) => !s.hasEnded).sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),
    [sessions],
  );
  const nextSession = useMemo(() => {
    if (course?.nextMeeting) return course.nextMeeting;
    return upcomingSessions[0] ?? null;
  }, [course?.nextMeeting, upcomingSessions]);
  const nextSessionId = nextSession?.id ?? null;
  const hasAttendanceHistory = useMemo(() => sessions.some((s) => !!s.checkedIn), [sessions]);
  const courseStateLabel = useMemo(() => {
    if (nextSession?.isLive) return 'فعال';
    if (nextSession?.startsSoon) return 'شروع به‌زودی';
    if (upcomingSessions.length > 0) return 'فعال';
    return 'آرام';
  }, [nextSession?.isLive, nextSession?.startsSoon, upcomingSessions.length]);
  const nextSessionUrgencyText = useMemo(() => {
    if (!nextSession) return null;
    if (nextSession.isLive) return 'کلاس هم‌اکنون در حال برگزاری است';
    const mins = nextSession.startsInMinutes ?? null;
    if (mins !== null && mins >= 0 && mins <= 30) return 'جلسه بعدی تا ۳۰ دقیقه دیگر آغاز می‌شود';
    if (mins !== null && mins > 30 && mins <= 60) return 'جلسه بعدی تا ۱ ساعت دیگر آغاز می‌شود';
    return null;
  }, [nextSession]);

  async function toggleEnroll() {
    if (!course || busy || canManage) return;
    const wasEnrolled = isEnrolled;
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
      if (!wasEnrolled) setShowInvitePrompt(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا');
      setCourse(prev);
    } finally {
      setBusy(false);
    }
  }

  function getSharePayload() {
    const shareUrl =
      (course?.shareUrl && /^https?:\/\//i.test(course.shareUrl)
        ? course.shareUrl
        : `${window.location.origin}${course?.shareUrl || `/education/${id}`}`) || window.location.href;
    return {
      url: shareUrl,
      title: course?.shareTitle || `${course?.title || 'دوره آموزشی'} | آموزش توت`,
      text: course?.shareText || `دوره «${course?.title || ''}» را در توت ببینید.`,
    };
  }

  async function copyCourseLink() {
    try {
      const { url } = getSharePayload();
      await navigator.clipboard.writeText(url);
      setShareMessage('لینک دوره کپی شد.');
    } catch {
      setShareMessage('کپی لینک انجام نشد.');
    }
  }

  async function shareCourse() {
    const payload = getSharePayload();
    if (navigator.share) {
      try {
        await navigator.share(payload);
        setShareMessage('دوره با موفقیت آماده اشتراک‌گذاری شد.');
        return;
      } catch {
        // dismissed
      }
    }
    await copyCourseLink();
  }

  async function shareCourseToStory() {
    if (!course || sharingToStory) return;
    const token = getAccessToken();
    if (!token) {
      setShareMessage('برای اشتراک در استوری وارد شوید.');
      return;
    }
    setSharingToStory(true);
    try {
      await apiFetch('posts', {
        method: 'POST',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `دوره «${course.title}» را پیشنهاد می‌کنم.`,
          educationCourseId: course.id,
        }),
      });
      setShareMessage('دوره در استوری شما منتشر شد.');
    } catch (e) {
      setShareMessage(e instanceof Error ? e.message : 'انتشار در استوری انجام نشد.');
    } finally {
      setSharingToStory(false);
    }
  }

  async function onCheckIn() {
    if (!nextSessionId || checkingIn) return;
    setCheckingIn(true);
    setCheckInMessage(null);
    try {
      const res = await checkInEducationSession(nextSessionId);
      setCourse((prev) =>
        prev && prev.nextMeeting && prev.nextMeeting.id === nextSessionId
          ? { ...prev, nextMeeting: { ...prev.nextMeeting, checkedIn: true } }
          : prev,
      );
      setSessions((prev) => prev.map((s) => (s.id === nextSessionId ? { ...s, checkedIn: true } : s)));
      setCheckInMessage(res.alreadyCheckedIn ? 'حضور شما قبلا ثبت شده است' : 'حضور شما ثبت شد');
    } catch (e) {
      setCheckInMessage(e instanceof Error ? e.message : 'خطا در ثبت حضور');
    } finally {
      setCheckingIn(false);
    }
  }

  return (
    <AuthGate>
      <div className="mx-auto max-w-md px-4 pb-24 pt-3 md:pb-8">
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
        {shareMessage ? (
          <div className="mb-3 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-sm text-violet-700 dark:text-violet-200">
            {shareMessage}
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
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-lg bg-violet-500/15 px-2 py-0.5 text-[10px] font-extrabold text-violet-700 dark:text-violet-300">
                    {course.status === 'PUBLISHED' ? 'منتشرشده' : 'پیش‌نویس'}
                  </span>
                  <span className="rounded-lg bg-[var(--surface-soft)] px-2 py-0.5 text-[10px] font-extrabold text-[var(--text-secondary)]">
                    {courseStateLabel}
                  </span>
                  <span className="rounded-lg bg-[var(--surface-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--text-secondary)]">
                    {course.visibility === 'PUBLIC' ? 'عمومی' : 'خصوصی'}
                  </span>
                </div>
                <h1 className="text-lg font-black text-[var(--text-primary)]">{course.title}</h1>
                <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)] break-words">
                  {course.description || 'درباره این دوره توضیح کوتاهی ثبت نشده است.'}
                </p>
                {isEnrolled && hasAttendanceHistory ? (
                  <p className="mt-2 rounded-lg bg-emerald-500/10 px-2 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                    شما در این دوره فعال هستید
                  </p>
                ) : null}
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-2 py-2">
                    <p className="text-[10px] font-bold text-[var(--text-secondary)]">دانشجو</p>
                    <p className="mt-0.5 text-sm font-black text-[var(--text-primary)]">{course._count.enrollments}</p>
                  </div>
                  <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-2 py-2">
                    <p className="text-[10px] font-bold text-[var(--text-secondary)]">جلسات آینده</p>
                    <p className="mt-0.5 text-sm font-black text-[var(--text-primary)]">{upcomingSessions.length}</p>
                  </div>
                  <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-2 py-2">
                    <p className="text-[10px] font-bold text-[var(--text-secondary)]">وضعیت</p>
                    <p className="mt-0.5 text-sm font-black text-[var(--text-primary)]">{courseStateLabel}</p>
                  </div>
                </div>
                <div className="mt-3">
                  {canManage ? (
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/education/${course.id}/sessions`}
                        className="inline-block rounded-xl bg-violet-700 px-3 py-2 text-xs font-extrabold text-white"
                      >
                        جلسات دوره
                      </Link>
                      <Link
                        href={`/education/${course.id}/edit`}
                        className="inline-block rounded-xl border border-[var(--border-soft)] px-3 py-2 text-xs font-bold text-[var(--text-secondary)]"
                      >
                        ویرایش دوره
                      </Link>
                      <button
                        type="button"
                        onClick={() => void shareCourse()}
                        className="rounded-xl border border-[var(--border-soft)] px-3 py-2 text-xs font-bold text-[var(--text-secondary)]"
                      >
                        اشتراک دوره
                      </button>
                      <button
                        type="button"
                        onClick={() => void shareCourseToStory()}
                        disabled={sharingToStory}
                        className="rounded-xl border border-[var(--border-soft)] px-3 py-2 text-xs font-bold text-[var(--text-secondary)] disabled:opacity-60"
                      >
                        {sharingToStory ? 'در حال انتشار…' : 'اشتراک در استوری'}
                      </button>
                    </div>
                  ) : isEnrolled ? (
                    <div className="flex flex-wrap gap-2">
                      {nextSession && !nextSession.hasEnded ? (
                        <Link
                          href={`/meetings/${nextSession.id}`}
                          className="inline-block rounded-xl bg-violet-700 px-3 py-2 text-xs font-extrabold text-white"
                        >
                          ورود به جلسه بعدی
                        </Link>
                      ) : (
                        <Link
                          href={`/education/${course.id}/sessions`}
                          className="inline-block rounded-xl bg-violet-700 px-3 py-2 text-xs font-extrabold text-white"
                        >
                          مشاهده
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={() => void shareCourse()}
                        className="rounded-xl border border-[var(--border-soft)] px-3 py-2 text-xs font-bold text-[var(--text-secondary)]"
                      >
                        اشتراک‌گذاری
                      </button>
                      <button
                        type="button"
                        onClick={() => void shareCourseToStory()}
                        disabled={sharingToStory}
                        className="rounded-xl border border-[var(--border-soft)] px-3 py-2 text-xs font-bold text-[var(--text-secondary)] disabled:opacity-60"
                      >
                        {sharingToStory ? 'در حال انتشار…' : 'اشتراک در استوری'}
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void toggleEnroll()}
                        disabled={busy}
                        className="rounded-xl bg-violet-700 px-3 py-2 text-xs font-extrabold text-white disabled:opacity-50"
                      >
                        {busy ? 'در حال ثبت‌نام…' : 'ثبت‌نام در دوره'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void shareCourse()}
                        className="rounded-xl border border-[var(--border-soft)] px-3 py-2 text-xs font-bold text-[var(--text-secondary)]"
                      >
                        اشتراک دوره
                      </button>
                      <button
                        type="button"
                        onClick={() => void shareCourseToStory()}
                        disabled={sharingToStory}
                        className="rounded-xl border border-[var(--border-soft)] px-3 py-2 text-xs font-bold text-[var(--text-secondary)] disabled:opacity-60"
                      >
                        {sharingToStory ? 'در حال انتشار…' : 'اشتراک در استوری'}
                      </button>
                    </div>
                  )}
                </div>
                {nextSessionUrgencyText ? (
                  <p className="mt-2 rounded-lg bg-amber-500/10 px-2 py-1 text-[11px] font-bold text-amber-800 dark:text-amber-200">
                    {nextSessionUrgencyText}
                  </p>
                ) : null}
                {showInvitePrompt && isEnrolled ? (
                  <div className="mt-3 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2">
                    <p className="text-xs font-extrabold text-violet-700 dark:text-violet-200">
                      دوستان خود را هم دعوت کنید
                    </p>
                    <button
                      type="button"
                      onClick={() => void shareCourse()}
                      className="mt-2 rounded-lg bg-violet-700 px-3 py-1.5 text-xs font-extrabold text-white"
                    >
                      اشتراک‌گذاری
                    </button>
                  </div>
                ) : null}
              </div>
            </section>

            <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--card-bg)] p-4 ring-1 ring-[var(--border-soft)]">
              <h2 className="text-sm font-extrabold text-[var(--text-primary)]">جلسه بعدی</h2>
              {nextSession ? (
                <div className="mt-2 space-y-1">
                  <p className="text-sm font-bold text-[var(--text-primary)]">{nextSession.title}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs text-[var(--text-secondary)]">
                      {formatAppDateTime(nextSession.startsAt)}
                    </p>
                    {nextSession.isLive ? (
                      <span className="rounded-lg bg-red-500/15 px-2 py-0.5 text-[10px] font-extrabold text-red-700 dark:text-red-300">
                        فعال
                      </span>
                    ) : null}
                    {nextSession.startsSoon ? (
                      <span className="rounded-lg bg-amber-500/15 px-2 py-0.5 text-[10px] font-extrabold text-amber-700 dark:text-amber-300">
                        {(nextSession.startsInMinutes ?? 9999) <= 30 ? 'تا ۳۰ دقیقه دیگر' : 'تا ۱ ساعت دیگر'}
                      </span>
                    ) : null}
                    {nextSession.hasEnded ? (
                      <span className="rounded-lg bg-zinc-500/20 px-2 py-0.5 text-[10px] font-extrabold text-zinc-700 dark:text-zinc-300">
                        پایان یافته
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Link
                      href={`/meetings/${nextSession.id}`}
                      className="inline-block rounded-lg bg-violet-700 px-3 py-1.5 text-xs font-extrabold text-white"
                    >
                      ورود به کلاس
                    </Link>
                    <button
                      type="button"
                      onClick={() => void onCheckIn()}
                      disabled={checkingIn || !!nextSession.checkedIn}
                      className="rounded-lg border border-[var(--border-soft)] px-3 py-1.5 text-xs font-bold text-[var(--text-primary)] disabled:opacity-50"
                    >
                      {nextSession.checkedIn
                        ? 'حضور شما ثبت شد'
                        : checkingIn
                          ? 'در حال ثبت…'
                          : 'حضور در کلاس'}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-xs text-[var(--text-secondary)]">هنوز جلسه‌ای برنامه‌ریزی نشده است</p>
              )}
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
                  <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">{course._count.enrollments} دانشجو</p>
                </div>
                <span className="mr-auto rounded-lg bg-violet-500/15 px-2 py-1 text-[10px] font-extrabold text-violet-700 dark:text-violet-300">
                  مدرس
                </span>
              </div>
            </section>

            <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--card-bg)] p-4 ring-1 ring-[var(--border-soft)]">
              <h2 className="text-sm font-extrabold text-[var(--text-primary)]">درباره این دوره</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                {course.description || 'توضیحی برای دوره ثبت نشده است.'}
              </p>
            </section>

            <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--card-bg)] p-4 ring-1 ring-[var(--border-soft)]">
              <h2 className="text-sm font-extrabold text-[var(--text-primary)]">جلسات</h2>
              {upcomingSessions.length ? (
                <ul className="mt-2 space-y-2">
                  {upcomingSessions.slice(0, 4).map((session) => (
                    <li key={session.id} className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">
                      <p className="line-clamp-1 text-sm font-bold text-[var(--text-primary)]">{session.title}</p>
                      <p className="mt-1 text-[11px] text-[var(--text-secondary)]">{formatAppDateTime(session.startsAt)}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Link
                          href={`/meetings/${session.id}`}
                          className="rounded-lg border border-[var(--border-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--text-primary)]"
                        >
                          ورود به کلاس
                        </Link>
                        {session.startsSoon ? (
                          <span className="rounded-lg bg-amber-500/15 px-2 py-1 text-[10px] font-extrabold text-amber-700 dark:text-amber-300">
                            شروع به‌زودی
                          </span>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-[var(--text-secondary)]">هنوز جلسه‌ای برنامه‌ریزی نشده است</p>
              )}
            </section>

            <div className="grid grid-cols-2 gap-2">
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
            </div>

            {!canManage ? (
              <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--border-soft)] bg-[var(--card-bg)]/95 p-3 backdrop-blur md:hidden">
                {isEnrolled ? (
                  nextSession && !nextSession.hasEnded ? (
                    <Link
                      href={`/meetings/${nextSession.id}`}
                      className="block w-full rounded-xl bg-violet-700 px-3 py-2 text-center text-sm font-extrabold text-white"
                    >
                      ورود به کلاس
                    </Link>
                  ) : (
                    <Link
                      href={`/education/${course.id}/sessions`}
                      className="block w-full rounded-xl bg-violet-700 px-3 py-2 text-center text-sm font-extrabold text-white"
                    >
                      مشاهده
                    </Link>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={() => void toggleEnroll()}
                    disabled={busy}
                    className="block w-full rounded-xl bg-violet-700 px-3 py-2 text-center text-sm font-extrabold text-white disabled:opacity-50"
                  >
                    {busy ? 'در حال ثبت‌نام…' : 'ثبت‌نام در دوره'}
                  </button>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </AuthGate>
  );
}

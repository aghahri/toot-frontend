'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthGate } from '@/components/AuthGate';
import {
  checkInEducationSession,
  fetchMyEducationDashboard,
  type EducationMyCourse,
  type EducationMyDashboard,
  type EducationMyUpcomingMeeting,
} from '@/lib/education';
import { formatAppDateTime } from '@/lib/locale-date';

const SECTION =
  'rounded-3xl border border-[var(--border-soft)] bg-[var(--card-bg)] p-4 shadow-sm ring-1 ring-[var(--border-soft)]';

function CourseCard({ course }: { course: EducationMyCourse }) {
  return (
    <Link
      href={`/education/${course.id}`}
      className="block rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3 ring-1 ring-[var(--border-soft)] transition hover:border-violet-400/40"
    >
      <h3 className="line-clamp-1 text-sm font-extrabold text-[var(--text-primary)]">{course.title}</h3>
      <p className="mt-1 text-[11px] text-[var(--text-secondary)]">مدرس: {course.owner.name}</p>
      {course.description ? (
        <p className="mt-1 line-clamp-2 break-words text-[11px] text-[var(--text-secondary)]">
          {course.description}
        </p>
      ) : null}
      <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
        {course.nextMeeting
          ? `جلسه بعدی: ${formatAppDateTime(course.nextMeeting.startsAt)}`
          : 'جلسه بعدی هنوز تعیین نشده است'}
      </p>
    </Link>
  );
}

export default function MyLearningPage() {
  const [data, setData] = useState<EducationMyDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkingMeetingId, setCheckingMeetingId] = useState<string | null>(null);
  const [checkInFeedback, setCheckInFeedback] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchMyEducationDashboard());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const courses = useMemo(() => data?.enrolledCourses ?? [], [data]);
  const upcoming = useMemo(() => data?.upcomingMeetings ?? [], [data]);
  const liveNow = useMemo(() => upcoming.filter((m) => m.isLive), [upcoming]);
  const startsSoon = useMemo(
    () => upcoming.filter((m) => !m.isLive && !m.hasEnded && m.startsSoon),
    [upcoming],
  );
  const continueLearning = useMemo(
    () => courses.filter((course) => course.nextMeeting || course.channel || course.group).slice(0, 8),
    [courses],
  );
  const shortcuts = useMemo(
    () =>
      courses
        .map((course) => ({
          courseId: course.id,
          courseTitle: course.title,
          group: course.group,
          channel: course.channel,
          nextMeeting: course.nextMeeting,
        }))
        .filter((x) => x.group || x.channel || x.nextMeeting),
    [courses],
  );

  const isEmpty = !loading && courses.length === 0;
  const attendedCount = data?.attendedCount ?? 0;
  const nextAction = data?.nextAction ?? (upcoming.length ? 'join_next' : courses.length ? 'continue' : 'browse_courses');
  const nextMeetingForAction = liveNow[0] ?? startsSoon[0] ?? upcoming[0] ?? null;

  async function onCheckIn(meetingId: string) {
    if (checkingMeetingId) return;
    setCheckInFeedback(null);
    setCheckingMeetingId(meetingId);
    try {
      const res = await checkInEducationSession(meetingId);
      setData((prev) =>
        prev
          ? {
              ...prev,
              upcomingMeetings: prev.upcomingMeetings.map((m) =>
                m.id === meetingId ? { ...m, checkedIn: true } : m,
              ),
            }
          : prev,
      );
      setCheckInFeedback(res.alreadyCheckedIn ? 'حضور شما قبلا ثبت شده است' : 'حضور شما ثبت شد');
    } catch (e) {
      setCheckInFeedback(e instanceof Error ? e.message : 'خطا در ثبت حضور');
    } finally {
      setCheckingMeetingId(null);
    }
  }

  function MeetingUrgencyBadge({ meeting }: { meeting: EducationMyUpcomingMeeting }) {
    const text = meeting.isLive ? 'زنده' : meeting.hasEnded ? 'پایان یافته' : meeting.startsSoon ? 'تا ۱ ساعت دیگر' : null;
    if (!text) return null;
    const className = meeting.isLive
      ? 'bg-red-500/15 text-red-700 dark:text-red-300'
      : meeting.hasEnded
        ? 'bg-zinc-500/20 text-zinc-700 dark:text-zinc-300'
        : 'bg-amber-500/15 text-amber-700 dark:text-amber-300';
    return <span className={`rounded-lg px-2 py-0.5 text-[10px] font-extrabold ${className}`}>{text}</span>;
  }

  return (
    <AuthGate>
      <div className="mx-auto max-w-md px-4 pb-8 pt-2">
        <div className="mb-3">
          <Link href="/spaces/education" className="text-[12px] font-bold text-[var(--text-secondary)]">
            ← فضای آموزش
          </Link>
        </div>

        <header className="mb-4 rounded-3xl border border-[var(--border-soft)] bg-gradient-to-br from-violet-950/30 via-[var(--card-bg)] to-[var(--card-bg)] p-5 ring-1 ring-[var(--border-soft)]">
          <h1 className="text-2xl font-black tracking-tight text-[var(--text-primary)]">یادگیری من</h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            دوره‌های ثبت‌نام‌شده، کلاس‌های پیش‌رو و دسترسی‌های سریع شما.
          </p>
        </header>

        {error ? (
          <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-200">
            {error}
          </div>
        ) : null}
        {checkInFeedback ? (
          <div className="mb-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-200">
            {checkInFeedback}
          </div>
        ) : null}

        {isEmpty ? (
          <section className="rounded-3xl border border-dashed border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-10 text-center ring-1 ring-[var(--border-soft)]">
            <p className="text-sm font-extrabold text-[var(--text-primary)]">هنوز دوره‌ای نگرفته‌اید</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              برای شروع، دوره‌ها را در فضای آموزش ببینید
            </p>
            <Link
              href="/spaces/education"
              className="mt-4 inline-flex rounded-xl bg-violet-700 px-3 py-2 text-xs font-extrabold text-white"
            >
              مشاهده فضای آموزش
            </Link>
          </section>
        ) : (
          <div className="space-y-4">
            <section className={SECTION}>
              <h2 className="mb-3 text-sm font-extrabold text-[var(--text-primary)]">گام بعدی شما</h2>
              {nextAction === 'join_next' && nextMeetingForAction ? (
                <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">
                  <p className="line-clamp-1 text-sm font-extrabold text-[var(--text-primary)]">
                    {nextMeetingForAction.title}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                    {formatAppDateTime(nextMeetingForAction.startsAt)}
                  </p>
                  <Link
                    href={`/meetings/${nextMeetingForAction.id}`}
                    className="mt-2 inline-flex rounded-lg bg-violet-700 px-3 py-1.5 text-xs font-extrabold text-white"
                  >
                    ورود به کلاس بعدی
                  </Link>
                </div>
              ) : nextAction === 'continue' && continueLearning[0] ? (
                <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">
                  <p className="line-clamp-1 text-sm font-extrabold text-[var(--text-primary)]">
                    {continueLearning[0].title}
                  </p>
                  <Link
                    href={`/education/${continueLearning[0].id}`}
                    className="mt-2 inline-flex rounded-lg bg-violet-700 px-3 py-1.5 text-xs font-extrabold text-white"
                  >
                    ادامه یادگیری
                  </Link>
                </div>
              ) : (
                <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">
                  <p className="text-sm text-[var(--text-secondary)]">
                    برای شروع مسیر یادگیری، دوره‌های آموزشی را مرور کنید.
                  </p>
                  <Link
                    href="/spaces/education"
                    className="mt-2 inline-flex rounded-lg bg-violet-700 px-3 py-1.5 text-xs font-extrabold text-white"
                  >
                    مشاهده دوره‌ها
                  </Link>
                </div>
              )}
            </section>

            <section className={SECTION}>
              <h2 className="mb-3 text-sm font-extrabold text-[var(--text-primary)]">حضورهای ثبت‌شده</h2>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">
                  <p className="text-[11px] font-bold text-[var(--text-secondary)]">تعداد کلاس‌های حضور یافته</p>
                  <p className="mt-1 text-lg font-black text-[var(--text-primary)]">{attendedCount}</p>
                </div>
                <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">
                  <p className="text-[11px] font-bold text-[var(--text-secondary)]">آخرین حضور</p>
                  <p className="mt-1 text-[12px] font-bold text-[var(--text-primary)]">
                    {data?.lastAttendanceAt ? formatAppDateTime(data.lastAttendanceAt) : 'ثبت نشده'}
                  </p>
                </div>
              </div>
            </section>

            <section className={SECTION}>
              <h2 className="mb-3 text-sm font-extrabold text-[var(--text-primary)]">کلاس زنده اکنون</h2>
              {loading ? (
                <div className="h-14 animate-pulse rounded-xl bg-[var(--surface-soft)]" />
              ) : liveNow.length ? (
                <ul className="space-y-2">
                  {liveNow.map((m) => (
                    <li
                      key={m.id}
                      className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3 ring-1 ring-[var(--border-soft)]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="line-clamp-1 text-sm font-extrabold text-[var(--text-primary)]">{m.title}</p>
                        <MeetingUrgencyBadge meeting={m} />
                      </div>
                      <p className="mt-1 line-clamp-1 text-[11px] text-[var(--text-secondary)]">مرتبط با: {m.course.title}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Link
                          href={`/meetings/${m.id}`}
                          className="rounded-lg bg-violet-700 px-2.5 py-1 text-[11px] font-extrabold text-white"
                        >
                          ورود به کلاس زنده
                        </Link>
                        <button
                          type="button"
                          onClick={() => void onCheckIn(m.id)}
                          disabled={!!m.checkedIn || checkingMeetingId === m.id}
                          className="rounded-lg border border-[var(--border-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--text-primary)] disabled:opacity-50"
                        >
                          {m.checkedIn ? 'حضور شما ثبت شد' : checkingMeetingId === m.id ? 'در حال ثبت…' : 'حضور در کلاس'}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-[var(--text-secondary)]">فعلا جلسه‌ای پیش‌رو ندارید</p>
              )}
            </section>

            <section className={SECTION}>
              <h2 className="mb-3 text-sm font-extrabold text-[var(--text-primary)]">شروع به‌زودی</h2>
              {loading ? (
                <div className="h-14 animate-pulse rounded-xl bg-[var(--surface-soft)]" />
              ) : startsSoon.length ? (
                <ul className="space-y-2">
                  {startsSoon.map((m) => (
                    <li
                      key={m.id}
                      className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3 ring-1 ring-[var(--border-soft)]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="line-clamp-1 text-sm font-extrabold text-[var(--text-primary)]">{m.title}</p>
                        <MeetingUrgencyBadge meeting={m} />
                      </div>
                      <p className="mt-1 text-[11px] text-[var(--text-secondary)]">{formatAppDateTime(m.startsAt)}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Link
                          href={`/meetings/${m.id}`}
                          className="rounded-lg border border-[var(--border-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--text-primary)]"
                        >
                          مشاهده کلاس
                        </Link>
                        <button
                          type="button"
                          onClick={() => void onCheckIn(m.id)}
                          disabled={!!m.checkedIn || checkingMeetingId === m.id}
                          className="rounded-lg border border-[var(--border-soft)] px-2.5 py-1 text-[11px] font-bold text-[var(--text-primary)] disabled:opacity-50"
                        >
                          {m.checkedIn ? 'حضور شما ثبت شد' : checkingMeetingId === m.id ? 'در حال ثبت…' : 'حضور در کلاس'}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-[var(--text-secondary)]">کلاسی که به‌زودی شروع شود پیدا نشد.</p>
              )}
            </section>

            <section className={SECTION}>
              <h2 className="mb-3 text-sm font-extrabold text-[var(--text-primary)]">دوره‌های من</h2>
              {loading ? (
                <div className="space-y-2">
                  <div className="h-20 animate-pulse rounded-2xl bg-[var(--surface-soft)]" />
                  <div className="h-20 animate-pulse rounded-2xl bg-[var(--surface-soft)]" />
                </div>
              ) : (
                <ul className="space-y-2">
                  {courses.map((course) => (
                    <li key={course.id}>
                      <CourseCard course={course} />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className={SECTION}>
              <h2 className="mb-3 text-sm font-extrabold text-[var(--text-primary)]">ادامه یادگیری</h2>
              {loading ? (
                <div className="space-y-2">
                  <div className="h-14 animate-pulse rounded-xl bg-[var(--surface-soft)]" />
                </div>
              ) : continueLearning.length ? (
                <ul className="space-y-2">
                  {continueLearning.map((course) => (
                    <li
                      key={course.id}
                      className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3 ring-1 ring-[var(--border-soft)]"
                    >
                      <p className="line-clamp-1 text-sm font-extrabold text-[var(--text-primary)]">
                        {course.title}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Link
                          href={`/education/${course.id}`}
                          className="rounded-lg border border-[var(--border-soft)] px-2 py-1 text-[11px] font-bold text-[var(--text-primary)]"
                        >
                          دوره
                        </Link>
                        {course.nextMeeting ? (
                          <Link
                            href={`/meetings/${course.nextMeeting.id}`}
                            className="rounded-lg border border-[var(--border-soft)] px-2 py-1 text-[11px] font-bold text-[var(--text-primary)]"
                          >
                            جلسه بعدی
                          </Link>
                        ) : null}
                        {course.group ? (
                          <Link
                            href={`/groups/${course.group.id}`}
                            className="rounded-lg border border-[var(--border-soft)] px-2 py-1 text-[11px] font-bold text-[var(--text-primary)]"
                          >
                            گروه
                          </Link>
                        ) : null}
                        {course.channel ? (
                          <Link
                            href={`/channels/${course.channel.id}`}
                            className="rounded-lg border border-[var(--border-soft)] px-2 py-1 text-[11px] font-bold text-[var(--text-primary)]"
                          >
                            کانال
                          </Link>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-[var(--text-secondary)]">موردی برای ادامه یادگیری ثبت نشده است.</p>
              )}
            </section>

            <section className={SECTION}>
              <h2 className="mb-3 text-sm font-extrabold text-[var(--text-primary)]">دسترسی‌های سریع</h2>
              {shortcuts.length ? (
                <ul className="space-y-2">
                  {shortcuts.map((s) => (
                    <li key={s.courseId} className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3 ring-1 ring-[var(--border-soft)]">
                      <p className="line-clamp-1 text-xs font-extrabold text-[var(--text-primary)]">{s.courseTitle}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Link href={`/education/${s.courseId}`} className="rounded-lg border border-[var(--border-soft)] px-2 py-1 text-[11px] font-bold text-[var(--text-primary)]">
                          صفحه دوره
                        </Link>
                        {s.group ? (
                          <Link href={`/groups/${s.group.id}`} className="rounded-lg border border-[var(--border-soft)] px-2 py-1 text-[11px] font-bold text-[var(--text-primary)]">
                            گروه
                          </Link>
                        ) : null}
                        {s.channel ? (
                          <Link href={`/channels/${s.channel.id}`} className="rounded-lg border border-[var(--border-soft)] px-2 py-1 text-[11px] font-bold text-[var(--text-primary)]">
                            کانال
                          </Link>
                        ) : null}
                        {s.nextMeeting ? (
                          <Link href={`/meetings/${s.nextMeeting.id}`} className="rounded-lg border border-[var(--border-soft)] px-2 py-1 text-[11px] font-bold text-[var(--text-primary)]">
                            جلسه
                          </Link>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-[var(--text-secondary)]">برای دوره‌های شما هنوز لینک سریع ثبت نشده است.</p>
              )}
            </section>
          </div>
        )}
      </div>
    </AuthGate>
  );
}

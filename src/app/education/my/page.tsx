'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthGate } from '@/components/AuthGate';
import {
  fetchMyEducationDashboard,
  type EducationMyCourse,
  type EducationMyDashboard,
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

        {isEmpty ? (
          <section className="rounded-3xl border border-dashed border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-10 text-center ring-1 ring-[var(--border-soft)]">
            <p className="text-sm font-extrabold text-[var(--text-primary)]">هنوز در دوره‌ای ثبت‌نام نکرده‌اید</p>
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
              <h2 className="mb-3 text-sm font-extrabold text-[var(--text-primary)]">کلاس‌های پیش‌رو</h2>
              {loading ? (
                <div className="space-y-2">
                  <div className="h-14 animate-pulse rounded-xl bg-[var(--surface-soft)]" />
                </div>
              ) : upcoming.length ? (
                <ul className="space-y-2">
                  {upcoming.map((m) => (
                    <li
                      key={m.id}
                      className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3 ring-1 ring-[var(--border-soft)]"
                    >
                      <p className="line-clamp-1 text-sm font-extrabold text-[var(--text-primary)]">{m.title}</p>
                      <p className="mt-1 line-clamp-1 text-[11px] text-[var(--text-secondary)]">
                        مرتبط با: {m.course.title}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-[var(--text-secondary)]">{formatAppDateTime(m.startsAt)}</span>
                        <Link href={`/meetings/${m.id}`} className="text-[11px] font-extrabold text-violet-700 dark:text-violet-300">
                          ورود / مشاهده
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-[var(--text-secondary)]">کلاس پیش‌رویی برای دوره‌های شما ثبت نشده است.</p>
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

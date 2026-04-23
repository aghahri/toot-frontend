'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthGate } from '@/components/AuthGate';
import { formatAppDateTime } from '@/lib/locale-date';
import { fetchEducationHub, type EducationCourse, type EducationMeetingMini } from '@/lib/education';

const SECTION =
  'rounded-3xl border border-[var(--border-soft)] bg-[var(--card-bg)] p-4 shadow-sm ring-1 ring-[var(--border-soft)] sm:p-5';
const BTN_PRI =
  'flex min-h-[3.75rem] flex-col justify-center rounded-2xl border border-[var(--border-soft)] bg-gradient-to-br from-violet-800/95 to-slate-900 px-3 py-3 text-center text-[12px] font-extrabold text-white shadow-md ring-1 ring-white/10 transition hover:brightness-110 active:scale-[0.99]';
const BTN_CARD =
  'flex min-h-[3.5rem] items-center justify-center rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-3 text-center text-[11px] font-extrabold text-[var(--text-primary)] ring-1 ring-[var(--border-soft)] transition hover:border-[var(--accent-ring)] hover:text-[var(--accent-hover)]';

function statusFa(status: string) {
  switch (status) {
    case 'SCHEDULED':
      return 'زمان‌بندی‌شده';
    case 'LIVE':
      return 'زنده';
    case 'ENDED':
      return 'پایان‌یافته';
    case 'CANCELED':
      return 'لغوشده';
    default:
      return status;
  }
}

function MeetingCard({ m, dense }: { m: EducationMeetingMini; dense?: boolean }) {
  const label = m.educationLabel?.trim() || 'جلسه آموزشی';
  return (
    <Link
      href={`/meetings/${m.id}`}
      className={`block rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3 ring-1 ring-[var(--border-soft)] transition hover:border-violet-400/50 ${
        dense ? '' : 'sm:p-4'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-violet-600 dark:text-violet-300">{label}</p>
          <h3 className="mt-0.5 truncate text-sm font-extrabold text-[var(--text-primary)]">{m.title}</h3>
          <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
            {formatAppDateTime(m.startsAt)} · {m.durationMinutes} دقیقه
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-[var(--surface-strong)] px-2 py-0.5 text-[10px] font-bold text-[var(--text-secondary)]">
          {statusFa(m.status)}
        </span>
      </div>
    </Link>
  );
}

function CourseCard({ c }: { c: EducationCourse }) {
  const isMember = !!c.me || !!c.enrollments?.length;
  const isNearSession =
    !!c.nextMeeting &&
    new Date(c.nextMeeting.startsAt).getTime() - Date.now() <= 24 * 60 * 60 * 1000 &&
    new Date(c.nextMeeting.startsAt).getTime() >= Date.now();
  return (
    <Link
      href={`/education/${c.id}`}
      className="block rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3 ring-1 ring-[var(--border-soft)] transition hover:border-violet-400/50"
    >
      <p className="text-[11px] font-bold text-violet-600 dark:text-violet-300">
        {c.visibility === 'PUBLIC' ? 'عمومی' : 'خصوصی'}
      </p>
      <h3 className="mt-0.5 line-clamp-1 text-sm font-extrabold text-[var(--text-primary)]">
        {c.title}
      </h3>
      <p className="mt-1 text-[11px] text-[var(--text-secondary)]">مدرس: {c.owner.name}</p>
      {c.description ? (
        <p className="mt-1 line-clamp-2 text-[11px] text-[var(--text-secondary)]">{c.description}</p>
      ) : null}
      <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-[var(--text-secondary)]">
        {isMember ? (
          <span className="rounded-lg bg-violet-500/15 px-1.5 py-0.5 font-extrabold text-violet-700 dark:text-violet-300">
            عضو هستید
          </span>
        ) : null}
        {isNearSession ? (
          <span className="rounded-lg bg-amber-500/15 px-1.5 py-0.5 font-extrabold text-amber-700 dark:text-amber-300">
            جلسه نزدیک
          </span>
        ) : null}
        <span className="rounded-lg border border-[var(--border-soft)] px-1.5 py-0.5">
          {c._count.enrollments} دانشجو
        </span>
        <span className="rounded-lg border border-[var(--border-soft)] px-1.5 py-0.5">
          {c.nextMeeting ? `جلسه بعدی: ${formatAppDateTime(c.nextMeeting.startsAt)}` : 'جلسه آینده ثبت نشده'}
        </span>
      </div>
    </Link>
  );
}

export default function EducationSpacePage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchEducationHub>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const hub = await fetchEducationHub();
      setData(hub);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const myCourses = useMemo(() => data?.myCourses ?? [], [data]);
  const publicCourses = useMemo(() => data?.publicCourses ?? [], [data]);
  const educationNetworks = useMemo(() => data?.educationNetworks ?? [], [data]);
  const canCreateEducationNetwork = !!data?.canCreateEducationNetwork;
  const createPolicyText =
    data?.createEducationNetworkPolicy === 'ANY_AUTHENTICATED_USER'
      ? 'همه کاربران واردشده می‌توانند شبکه آموزشی بسازند.'
      : 'ایجاد شبکه آموزشی محدود به کاربران مجاز است';

  return (
    <AuthGate>
      <div className="mx-auto max-w-md px-4 pb-6 pt-2">
        <div className="mb-4 flex items-center justify-between gap-2">
          <Link
            href="/spaces"
            className="text-[12px] font-bold text-[var(--text-secondary)] hover:text-[var(--accent-hover)]"
          >
            ← فضاها
          </Link>
        </div>

        <header className="mb-6 rounded-3xl border border-[var(--border-soft)] bg-gradient-to-br from-violet-950/40 via-[var(--card-bg)] to-[var(--card-bg)] p-5 ring-1 ring-[var(--border-soft)]">
          <p className="text-[11px] font-bold uppercase tracking-wide text-violet-300/90">Toot Education</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-[var(--text-primary)]">آموزش توت</h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
            کلاس آنلاین، دوره‌ها، جلسات و یادگیری محلی در یک فضای یکپارچه.
          </p>
        </header>

        {error ? (
          <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-200">
            {error}
          </div>
        ) : null}

        <section className={`${SECTION} mb-4`}>
          <h2 className="mb-3 text-sm font-extrabold text-[var(--text-primary)]">اقدام سریع</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Link href="/education/new" className={BTN_PRI}>
              ایجاد دوره
            </Link>
            <Link href="/meetings/new" className={BTN_CARD}>
              ایجاد جلسه زنده
            </Link>
            <Link href="/channels/new?preset=teacher&spaceKey=EDUCATION" className={BTN_CARD}>
              کانال مدرس
            </Link>
            <Link href="/groups/new?kind=community&spaceKey=EDUCATION&returnTo=spaces&preset=study" className={BTN_CARD}>
              گروه مطالعه
            </Link>
            <Link href="/meetings/my" className={`${BTN_CARD} col-span-2 sm:col-span-1`}>
              جلسات من
            </Link>
            <Link href="/education/manage" className={`${BTN_CARD} col-span-2 sm:col-span-1`}>
              مدیریت آموزش
            </Link>
          </div>
          <div className="mt-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2">
            <p className="text-[11px] font-extrabold text-[var(--text-primary)]">
              چه کسانی می‌توانند شبکه آموزشی بسازند؟
            </p>
            <p className="mt-1 text-[11px] text-[var(--text-secondary)]">{createPolicyText}</p>
          </div>
        </section>

        <section className={`${SECTION} mb-4`}>
          <h2 className="mb-3 text-sm font-extrabold text-[var(--text-primary)]">شبکه‌های آموزشی</h2>
          {loading ? (
            <p className="text-sm text-[var(--text-secondary)]">…</p>
          ) : educationNetworks.length ? (
            <ul className="space-y-2">
              {educationNetworks.map((n) => (
                <li key={n.id}>
                  <Link
                    href={`/networks/${n.id}`}
                    className="block rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 ring-1 ring-[var(--border-soft)] hover:border-violet-400/40"
                  >
                    <p className="font-extrabold text-[var(--text-primary)]">{n.name}</p>
                    {n.description ? (
                      <p className="mt-1 line-clamp-2 text-[11px] text-[var(--text-secondary)]">{n.description}</p>
                    ) : null}
                    <p className="mt-1 text-[10px] text-[var(--text-secondary)]">{n.membersCount} عضو</p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">هنوز شبکه آموزشی فعالی ثبت نشده است</p>
          )}
          <div className="mt-3">
            {canCreateEducationNetwork ? (
              <Link
                href="/spaces/EDUCATION"
                className="inline-flex rounded-xl bg-violet-700 px-3 py-2 text-xs font-extrabold text-white"
              >
                ایجاد شبکه آموزشی
              </Link>
            ) : (
              <p className="text-[11px] text-[var(--text-secondary)]">
                ایجاد شبکه آموزشی محدود به کاربران مجاز است
              </p>
            )}
          </div>
        </section>

        <section className={`${SECTION} mb-4`}>
          <h2 className="mb-3 text-sm font-extrabold text-[var(--text-primary)]">کلاس‌های من</h2>
          {loading ? (
            <p className="text-sm text-[var(--text-secondary)]">…</p>
          ) : myCourses.length ? (
            <ul className="space-y-2">
              {myCourses.slice(0, 8).map((c) => (
                <li key={c.id}>
                  <CourseCard c={c} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">هنوز دوره‌ای برای شما ثبت نشده است.</p>
          )}
        </section>

        <section className={`${SECTION} mb-4`}>
          <h2 className="mb-3 text-sm font-extrabold text-[var(--text-primary)]">جلسات آینده</h2>
          {loading ? (
            <p className="text-sm text-[var(--text-secondary)]">…</p>
          ) : data?.upcomingMeetings?.length ? (
            <ul className="space-y-2">
              {data.upcomingMeetings.slice(0, 8).map((m) => (
                <li key={m.id}>
                  <MeetingCard m={m} dense />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">جلسه‌ای در پیش رو نیست.</p>
          )}
        </section>

        <section className={`${SECTION} mb-4`}>
          <h2 className="mb-3 text-sm font-extrabold text-[var(--text-primary)]">دوره‌های عمومی</h2>
          {loading ? (
            <p className="text-sm text-[var(--text-secondary)]">…</p>
          ) : publicCourses.length ? (
            <ul className="space-y-2">
              {publicCourses.slice(0, 8).map((c) => (
                <li key={c.id}>
                  <CourseCard c={c} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">دوره عمومی برای نمایش موجود نیست.</p>
          )}
        </section>

        <section className={`${SECTION} mb-4`}>
          <h2 className="mb-3 text-sm font-extrabold text-[var(--text-primary)]">کانال‌های آموزشی</h2>
          {loading ? (
            <p className="text-sm text-[var(--text-secondary)]">…</p>
          ) : data?.teacherChannels?.length ? (
            <ul className="space-y-2">
              {data.teacherChannels.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/channels/${c.id}`}
                    className="block rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 ring-1 ring-[var(--border-soft)] hover:border-violet-400/40"
                  >
                    <span className="font-bold text-[var(--text-primary)]">{c.name}</span>
                    {c.description ? (
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-[var(--text-secondary)]">{c.description}</p>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">کانال آموزشی یافت نشد.</p>
          )}
        </section>

        <section className={SECTION}>
          <h2 className="mb-3 text-sm font-extrabold text-[var(--text-primary)]">گروه‌های آموزشی</h2>
          {loading ? (
            <p className="text-sm text-[var(--text-secondary)]">…</p>
          ) : data?.studyGroups?.length ? (
            <ul className="space-y-2">
              {data.studyGroups.map((g) => (
                <li key={g.id}>
                  <Link
                    href={`/groups/${g.id}`}
                    className="block rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 ring-1 ring-[var(--border-soft)] hover:border-violet-400/40"
                  >
                    <span className="font-bold text-[var(--text-primary)]">{g.name}</span>
                    {g.description ? (
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-[var(--text-secondary)]">{g.description}</p>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">گروه آموزشی یافت نشد.</p>
          )}
        </section>
      </div>
    </AuthGate>
  );
}

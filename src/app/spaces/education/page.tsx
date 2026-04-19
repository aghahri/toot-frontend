'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthGate } from '@/components/AuthGate';
import { formatAppDateTime } from '@/lib/locale-date';
import { fetchEducationHub, type MeetingRow } from '@/lib/meetings';

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

function MeetingCard({ m, dense }: { m: MeetingRow; dense?: boolean }) {
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

  const networkId = useMemo(() => {
    const mine = data?.myLearningNetworks?.[0]?.id;
    const sug = data?.suggestedNetworks?.[0]?.id;
    return mine ?? sug ?? '';
  }, [data]);

  const nid = networkId ? `&networkId=${encodeURIComponent(networkId)}` : '';

  const myUpcomingSessions = useMemo(() => {
    if (!data?.myHostedMeetings?.length) return [];
    const now = Date.now();
    return data.myHostedMeetings.filter((m) => {
      const t = new Date(m.startsAt).getTime();
      if (Number.isNaN(t)) return false;
      if (t < now) return false;
      return m.status === 'SCHEDULED' || m.status === 'LIVE';
    });
  }, [data]);

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
          <p className="text-[11px] font-bold uppercase tracking-wide text-violet-300/90">Education Space</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-[var(--text-primary)]">فضای آموزش</h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
            جلسات زنده، کلاس آنلاین و جامعه‌های یادگیری — یک پایه برای آموزش ساختاریافته در توت.
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
            <Link href={networkId ? `/meetings/new?networkId=${encodeURIComponent(networkId)}` : '/meetings/new'} className={BTN_PRI}>
              ایجاد جلسه
            </Link>
            <Link
              href={`/groups/new?kind=community&spaceKey=EDUCATION${nid}&returnTo=spaces&preset=class`}
              className={BTN_CARD}
            >
              ایجاد کلاس
            </Link>
            <Link href={`/channels/new?preset=teacher&spaceKey=EDUCATION${nid}`} className={BTN_CARD}>
              کانال مدرس
            </Link>
            <Link
              href={`/groups/new?kind=community&spaceKey=EDUCATION${nid}&returnTo=spaces&preset=study`}
              className={BTN_CARD}
            >
              گروه مطالعه
            </Link>
            <Link
              href={networkId ? `/networks/${encodeURIComponent(networkId)}` : '/spaces/education'}
              className={`${BTN_CARD} col-span-2 sm:col-span-1`}
            >
              فرم ثبت‌نام
            </Link>
          </div>
          {!networkId && !loading ? (
            <p className="mt-2 text-[11px] text-[var(--text-secondary)]">
              برای اتصال سریع به شبکه آموزشی، ابتدا به یک شبکه آموزشی بپیوندید یا از پیشنهادها یک شبکه انتخاب کنید.
            </p>
          ) : null}
        </section>

        <section className={`${SECTION} mb-4`}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-[var(--text-primary)]">جلسات پیش‌رو</h2>
            <Link href="/meetings/new" className="text-[11px] font-bold text-violet-600 dark:text-violet-300">
              + جلسه
            </Link>
          </div>
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
          <h2 className="mb-3 text-sm font-extrabold text-[var(--text-primary)]">کلاس‌ها و جلسات من</h2>
          {loading ? (
            <p className="text-sm text-[var(--text-secondary)]">…</p>
          ) : myUpcomingSessions.length ? (
            <ul className="space-y-2">
              {myUpcomingSessions.slice(0, 8).map((m) => (
                <li key={m.id}>
                  <MeetingCard m={m} dense />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">جلسه آموزشی فعال از طرف شما ثبت نشده.</p>
          )}
        </section>

        <section className={`${SECTION} mb-4`}>
          <h2 className="mb-3 text-sm font-extrabold text-[var(--text-primary)]">جامعه‌های یادگیری من</h2>
          {loading ? (
            <p className="text-sm text-[var(--text-secondary)]">…</p>
          ) : data?.myLearningNetworks?.length ? (
            <ul className="space-y-2">
              {data.myLearningNetworks.map((n) => (
                <li key={n.id}>
                  <Link
                    href={`/networks/${n.id}`}
                    className="block rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm font-bold text-[var(--text-primary)] ring-1 ring-[var(--border-soft)] hover:border-violet-400/40"
                  >
                    {n.name}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">هنوز به شبکه آموزشی نپیوسته‌اید.</p>
          )}
        </section>

        <section className={SECTION}>
          <h2 className="mb-3 text-sm font-extrabold text-[var(--text-primary)]">پیشنهاد: شبکه‌های آموزشی</h2>
          {loading ? (
            <p className="text-sm text-[var(--text-secondary)]">…</p>
          ) : data?.suggestedNetworks?.length ? (
            <ul className="space-y-2">
              {data.suggestedNetworks.map((n) => (
                <li key={n.id}>
                  <Link
                    href={`/networks/${n.id}`}
                    className="block rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 ring-1 ring-[var(--border-soft)] hover:border-violet-400/40"
                  >
                    <span className="font-bold text-[var(--text-primary)]">{n.name}</span>
                    {n.description ? (
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-[var(--text-secondary)]">{n.description}</p>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">پیشنهادی برای نمایش نیست.</p>
          )}
        </section>
      </div>
    </AuthGate>
  );
}

'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthGate } from '@/components/AuthGate';
import { getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { fetchBusinessStats, fetchMyBusinessCommunities, type BusinessStats } from '@/lib/businessSpace';

type NetRow = {
  id: string;
  name: string;
  networkType?: string | null;
  spaceCategory?: string | null;
  isMember?: boolean;
};

const SECTION =
  'rounded-3xl border border-[var(--border-soft)] bg-[var(--card-bg)] p-4 shadow-sm ring-1 ring-[var(--border-soft)] sm:p-5';
const BTN_PRI =
  'flex min-h-[4.5rem] flex-col justify-center rounded-2xl border border-[var(--border-soft)] bg-gradient-to-br from-slate-700/90 to-zinc-900 px-3 py-3 text-center text-[12px] font-extrabold text-white shadow-md ring-1 ring-white/10 transition hover:brightness-110 active:scale-[0.99]';
const BTN_CARD =
  'flex min-h-[3.75rem] items-center justify-center rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-3 text-center text-[11px] font-extrabold text-[var(--text-primary)] ring-1 ring-[var(--border-soft)] transition hover:border-[var(--accent-ring)] hover:text-[var(--accent-hover)]';

function isBusinessNetwork(n: NetRow) {
  return n.networkType === 'BUSINESS' || n.spaceCategory === 'PUBLIC_GENERAL';
}

function fa(n: number) {
  return n.toLocaleString('fa-IR');
}

function BusinessHubInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qpNetwork = searchParams.get('networkId')?.trim() || '';

  const [stats, setStats] = useState<BusinessStats | null>(null);
  const [networks, setNetworks] = useState<NetRow[] | null>(null);
  const [myComm, setMyComm] = useState<Awaited<ReturnType<typeof fetchMyBusinessCommunities>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const businessNets = useMemo(() => (networks ?? []).filter((n) => isBusinessNetwork(n) && n.isMember), [networks]);

  const networkId = useMemo(() => {
    if (qpNetwork && businessNets.some((n) => n.id === qpNetwork)) return qpNetwork;
    return businessNets[0]?.id ?? '';
  }, [qpNetwork, businessNets]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await fetchBusinessStats();
      setStats(s);
      const token = getAccessToken();
      if (token) {
        const list = await apiFetch<NetRow[]>('networks', { method: 'GET', token });
        setNetworks(Array.isArray(list) ? list : []);
      } else {
        setNetworks([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا');
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!networkId) {
      setMyComm(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const m = await fetchMyBusinessCommunities(networkId);
        if (!cancelled) setMyComm(m);
      } catch {
        if (!cancelled) setMyComm(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [networkId]);

  function setNetwork(id: string) {
    router.replace(`/spaces/business?networkId=${encodeURIComponent(id)}`);
  }

  return (
    <main className="theme-page-bg theme-text-primary mx-auto w-full max-w-md space-y-5 px-4 pb-16 pt-4 sm:pb-14" dir="rtl">
      <div className="flex items-center gap-3">
        <Link
          href="/spaces"
          className="flex h-10 min-w-[2.5rem] items-center justify-center rounded-full text-[var(--text-secondary)] transition hover:bg-[var(--surface-soft)]"
          aria-label="بازگشت"
        >
          ←
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--card-bg)] px-3 py-2 ring-1 ring-[var(--border-soft)]">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-600 via-slate-700 to-zinc-900 text-lg text-white"
            aria-hidden
          >
            💼
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-black text-[var(--text-primary)]">فضای کسب‌وکار</h1>
            <p className="truncate text-[11px] text-[var(--text-secondary)]">فرصت‌ها، همکاری، پروژه و رشد حرفه‌ای</p>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--text-secondary)]">در حال بارگذاری…</p>
      ) : error ? (
        <p className="text-sm font-semibold text-red-600">{error}</p>
      ) : null}

      {stats ? (
        <section className={SECTION} aria-label="آمار">
          <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
            <div>
              <p className="text-xl font-black tabular-nums text-[var(--text-primary)]">{fa(stats.jobsActive)}</p>
              <p className="mt-0.5 text-[10px] font-bold text-[var(--text-secondary)]">فرصت شغلی فعال</p>
            </div>
            <div>
              <p className="text-xl font-black tabular-nums text-[var(--text-primary)]">{fa(stats.projectsActive)}</p>
              <p className="mt-0.5 text-[10px] font-bold text-[var(--text-secondary)]">پروژه فعال</p>
            </div>
            <div>
              <p className="text-xl font-black tabular-nums text-[var(--text-primary)]">{fa(stats.channelsActive)}</p>
              <p className="mt-0.5 text-[10px] font-bold text-[var(--text-secondary)]">کانال کسب‌وکار</p>
            </div>
            <div>
              <p className="text-xl font-black tabular-nums text-[var(--text-primary)]">{fa(stats.businessesListed)}</p>
              <p className="mt-0.5 text-[10px] font-bold text-[var(--text-secondary)]">کسب‌وکار ثبت‌شده</p>
            </div>
          </div>
        </section>
      ) : null}

      <section className={SECTION}>
        <label className="mb-2 block text-[11px] font-extrabold text-[var(--text-secondary)]">شبکه کسب‌وکار</label>
        {businessNets.length === 0 ? (
          <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
            ابتدا به یک شبکه با نوع کسب‌وکار بپیوندید، سپس ابزارهای این صفحه فعال می‌شوند.
          </p>
        ) : (
          <select
            value={networkId}
            onChange={(e) => setNetwork(e.target.value)}
            className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2.5 text-sm font-bold"
          >
            {businessNets.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
        )}
      </section>

      {networkId && myComm ? (
        <section className={SECTION}>
          <h2 className="mb-3 text-sm font-black text-[var(--text-primary)]">جامعه‌های من در این شبکه</h2>
          <div className="space-y-3">
            <div>
              <p className="mb-1 text-[10px] font-extrabold text-[var(--text-secondary)]">گروه‌ها</p>
              {myComm.groups.length === 0 ? (
                <p className="text-[11px] text-[var(--text-secondary)]">—</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {myComm.groups.map((g) => (
                    <li key={g.id}>
                      <Link href={`/groups/${g.id}`} className="text-[11px] font-bold text-[var(--accent-hover)] underline">
                        {g.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="mb-1 text-[10px] font-extrabold text-[var(--text-secondary)]">کانال‌ها</p>
              {myComm.channels.length === 0 ? (
                <p className="text-[11px] text-[var(--text-secondary)]">—</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {myComm.channels.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/channels/${c.id}?network=${encodeURIComponent(networkId)}`}
                        className="text-[11px] font-bold text-[var(--accent-hover)] underline"
                      >
                        {c.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      ) : null}

      <section className={SECTION}>
        <h2 className="mb-3 text-sm font-black text-[var(--text-primary)]">اقدام سریع</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Link href={networkId ? `/spaces/business/jobs/new?networkId=${encodeURIComponent(networkId)}` : '#'} className={BTN_PRI}>
            ثبت فرصت شغلی
          </Link>
          <Link
            href={networkId ? `/spaces/business/projects/new?networkId=${encodeURIComponent(networkId)}` : '#'}
            className={BTN_PRI}
          >
            ایجاد پروژه
          </Link>
          <Link
            href={networkId ? `/channels/new?preset=professional&networkId=${encodeURIComponent(networkId)}` : '#'}
            className={BTN_PRI}
          >
            ساخت کانال کسب‌وکار
          </Link>
          <Link
            href={networkId ? `/spaces/business/directory/new?networkId=${encodeURIComponent(networkId)}` : '#'}
            className={BTN_PRI}
          >
            ثبت کسب‌وکار
          </Link>
          <Link href={networkId ? `/spaces/business/jobs?networkId=${encodeURIComponent(networkId)}` : '#'} className={BTN_PRI}>
            جستجوی فرصت‌ها
          </Link>
        </div>
        <Link
          href={networkId ? `/spaces/business/directory?networkId=${encodeURIComponent(networkId)}` : '/spaces/business/directory'}
          className="mt-3 flex items-center justify-between rounded-2xl border border-amber-200/70 bg-[linear-gradient(135deg,#FFF1E6,#FDE5D1)] px-3 py-3 text-right"
        >
          <div className="min-w-0">
            <p className="text-sm font-black text-amber-900">کسب‌وکارها</p>
            <p className="mt-1 text-[11px] leading-relaxed text-amber-800">
              فهرست کسب‌وکارها، خدمات و مشاوره آنلاین
            </p>
          </div>
          <span className="rounded-full bg-amber-900 px-2.5 py-1 text-[10px] font-extrabold text-amber-50">مشاهده فهرست</span>
        </Link>
        {!networkId ? (
          <p className="mt-3 text-[10px] text-amber-800 dark:text-amber-200">برای استفاده از اقدامات، ابتدا شبکه را انتخاب کنید.</p>
        ) : null}
      </section>

      <section className={SECTION}>
        <h2 className="mb-3 text-sm font-black text-[var(--text-primary)]">کاوش</h2>
        <p className="mb-3 text-[11px] leading-relaxed text-[var(--text-secondary)]">
          گروه‌ها و کانال‌های پرطرفدار، فرصت‌های استخدام و معرفی کسب‌وکار را از بخش‌های زیر ببینید.
        </p>
        <div className="grid grid-cols-1 gap-2">
          <Link href={`/spaces/PUBLIC_GENERAL`} className={BTN_CARD}>
            شبکه‌ها و گروه‌های کسب‌وکار (فضای اصلی)
          </Link>
          <Link href={networkId ? `/spaces/business/jobs?networkId=${encodeURIComponent(networkId)}` : '#'} className={BTN_CARD}>
            فرصت‌های شغلی
          </Link>
          <Link href={networkId ? `/spaces/business/directory?networkId=${encodeURIComponent(networkId)}` : '#'} className={BTN_CARD}>
            نزدیک‌ترین کسب‌وکارها
          </Link>
        </div>
      </section>

      <section className={SECTION}>
        <h2 className="mb-3 text-sm font-black text-[var(--text-primary)]">ابزارها</h2>
        <div className="grid grid-cols-2 gap-2">
          <Link href={networkId ? `/spaces/business/jobs?networkId=${encodeURIComponent(networkId)}` : '#'} className={BTN_CARD}>
            استخدام
          </Link>
          <Link href={networkId ? `/spaces/business/projects?networkId=${encodeURIComponent(networkId)}` : '#'} className={BTN_CARD}>
            پروژه‌ها
          </Link>
          <Link href={networkId ? `/spaces/business/directory?networkId=${encodeURIComponent(networkId)}` : '#'} className={BTN_CARD}>
            معرفی کسب‌وکار
          </Link>
          <Link
            href={networkId ? `/channels/new?preset=professional&networkId=${encodeURIComponent(networkId)}` : '#'}
            className={BTN_CARD}
          >
            کانال حرفه‌ای
          </Link>
          <Link href={networkId ? `/groups/new?kind=community&spaceKey=PUBLIC_GENERAL` : '#'} className="col-span-2 text-center">
            <span className={BTN_CARD + ' w-full'}>همکاری آزادکاران</span>
          </Link>
        </div>
      </section>
    </main>
  );
}

export default function BusinessSpacePage() {
  return (
    <AuthGate>
      <Suspense
        fallback={
          <div className="theme-page-bg px-4 py-10 text-center text-sm text-[var(--text-secondary)]" dir="rtl">
            …
          </div>
        }
      >
        <BusinessHubInner />
      </Suspense>
    </AuthGate>
  );
}

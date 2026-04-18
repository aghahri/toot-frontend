'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthGate } from '@/components/AuthGate';
import { NeighborhoodNetworkContext } from '@/components/neighborhood/NeighborhoodContextStrip';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import {
  dedupedGet,
  getCachedNetworksList,
  getCachedPublishedForms,
  NEIGHBORHOOD_NETWORKS_QUERY,
  readLastSelectedNetworkId,
  setCachedNetworksList,
  setCachedPublishedForms,
  writeLastSelectedNetworkId,
} from '@/lib/neighborhoodFormsPerf';
import { formStatusBadgeClass, formStatusLabel } from '@/lib/neighborhoodForms';
import { LinkCapabilityModal } from '@/components/capability/LinkCapabilityModal';

type NetworkRow = {
  id: string;
  name: string;
  spaceCategory: string;
  isMember?: boolean;
  myRole?: 'NETWORK_ADMIN' | 'MEMBER' | null;
};

type FormRow = {
  id: string;
  title: string;
  description: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED';
  publishedAt: string | null;
  closedAt: string | null;
  _count: { responses: number };
};

const SECTION_CARD =
  'rounded-3xl border border-[var(--border-soft)] bg-[var(--card-bg)] p-5 shadow-sm ring-1 ring-[var(--border-soft)] sm:p-6';
const PRIMARY_CTA =
  'rounded-2xl bg-[var(--accent)] px-4 py-2.5 text-xs font-extrabold text-[var(--accent-contrast)] shadow-sm transition hover:bg-[var(--accent-hover)]';
const SECONDARY_CTA =
  'rounded-2xl border border-[var(--border-soft)] bg-[var(--card-bg)] px-4 py-2.5 text-xs font-extrabold text-[var(--text-primary)] transition hover:bg-[var(--surface-soft)]';
const MUTED = 'text-[10px] leading-relaxed text-[var(--text-secondary)]';

const NETWORKS_PATH = `networks?${NEIGHBORHOOD_NETWORKS_QUERY}`;

export default function NeighborhoodFormsListPage() {
  const [networks, setNetworks] = useState<NetworkRow[]>([]);
  const [networkId, setNetworkId] = useState('');
  const [forms, setForms] = useState<FormRow[]>([]);
  const [networksLoading, setNetworksLoading] = useState(true);
  const [formsLoading, setFormsLoading] = useState(false);
  const [formsRefreshing, setFormsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareFormId, setShareFormId] = useState<string | null>(null);

  const activeNetwork = useMemo(() => networks.find((n) => n.id === networkId) ?? null, [networks, networkId]);
  const canManage = activeNetwork?.myRole === 'NETWORK_ADMIN';
  const adminNetworks = useMemo(
    () => networks.filter((n) => n.myRole === 'NETWORK_ADMIN'),
    [networks],
  );

  const loadNetworks = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setError('برای مشاهده فرم‌های محله باید وارد شوید.');
      return;
    }
    const cached = getCachedNetworksList<NetworkRow[]>(NEIGHBORHOOD_NETWORKS_QUERY);
    if (cached?.length) {
      setNetworks(cached);
      const last = readLastSelectedNetworkId();
      const pick = last && cached.some((n) => n.id === last) ? last : cached[0].id;
      setNetworkId((prev) => (prev && cached.some((n) => n.id === prev) ? prev : pick));
      setNetworksLoading(false);
    } else {
      setNetworksLoading(true);
    }
    setError(null);
    try {
      const fresh = await dedupedGet(`GET:${NETWORKS_PATH}`, () =>
        apiFetch<NetworkRow[]>(NETWORKS_PATH, { method: 'GET', token }),
      );
      setCachedNetworksList(NEIGHBORHOOD_NETWORKS_QUERY, fresh);
      setNetworks(fresh);
      setNetworkId((prev) => {
        if (prev && fresh.some((n) => n.id === prev)) return prev;
        const last = readLastSelectedNetworkId();
        if (last && fresh.some((n) => n.id === last)) return last;
        return fresh[0]?.id ?? '';
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'بارگذاری شبکه‌ها ممکن نیست');
    } finally {
      setNetworksLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNetworks();
  }, [loadNetworks]);

  useEffect(() => {
    if (!networkId) return;
    let cancelled = false;
    void (async () => {
      const cached = getCachedPublishedForms<FormRow[]>(networkId);
      if (cached) {
        setForms(cached);
        setFormsLoading(false);
      } else {
        setFormsLoading(true);
      }
      setFormsRefreshing(true);
      writeLastSelectedNetworkId(networkId);
      try {
        const token = getAccessToken();
        if (!token) {
          if (!cancelled) setError('برای مشاهده فرم‌های محله باید وارد شوید.');
          return;
        }
        const rows = await dedupedGet(`GET:networks/${networkId}/forms`, () =>
          apiFetch<FormRow[]>(`networks/${networkId}/forms`, { method: 'GET', token }),
        );
        if (cancelled) return;
        setCachedPublishedForms(networkId, rows);
        setForms(rows);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'بارگذاری فرم‌ها ممکن نیست');
      } finally {
        if (!cancelled) {
          setFormsLoading(false);
          setFormsRefreshing(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [networkId]);

  return (
    <AuthGate>
      <main className="theme-page-bg theme-text-primary mx-auto w-full max-w-md px-4 pb-12 pt-4 sm:pb-14" dir="rtl">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-extrabold text-[var(--text-primary)]">فرم‌های محله</h1>
            <p className={MUTED}>فقط فرم‌های منتشرشده برای شبکه انتخاب‌شده</p>
          </div>
          <Link href="/spaces/NEIGHBORHOOD" className={SECONDARY_CTA}>
            بازگشت
          </Link>
        </div>

        <section className={SECTION_CARD}>
          <label className="mb-1 block text-xs font-bold text-[var(--text-primary)]">انتخاب شبکه محله</label>
          {networksLoading ? (
            <div className="space-y-2">
              <div className="h-11 animate-pulse rounded-2xl bg-[var(--surface-soft)]" />
              <p className="text-[11px] text-[var(--text-secondary)]">در حال بارگذاری شبکه‌ها…</p>
            </div>
          ) : (
            <select
              value={networkId}
              onChange={(e) => setNetworkId(e.target.value)}
              className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
            >
              {networks.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                  {n.myRole === 'NETWORK_ADMIN' ? ' (ادمین)' : ''}
                </option>
              ))}
            </select>
          )}
          {activeNetwork && !networksLoading ? (
            <div className="mt-3 space-y-2">
              <NeighborhoodNetworkContext networkName={activeNetwork.name} role={activeNetwork.myRole} mode="forms">
                {!canManage ? (
                  <p className="mt-2 border-t border-[var(--border-soft)] pt-2 text-[10px] leading-relaxed text-[var(--text-secondary)]">
                    بخش مدیریت و ایجاد فرم فقط برای <strong className="text-[var(--text-primary)]">ادمین همان شبکه</strong>{' '}
                    است. شما همچنان می‌توانید فرم‌های <strong className="text-[var(--text-primary)]">منتشرشده</strong> را
                    ببینید و پر کنید.
                  </p>
                ) : (
                  <p className="mt-2 border-t border-[var(--border-soft)] pt-2 text-[10px] text-[var(--text-secondary)]">
                    این فهرست فقط فرم‌های با وضعیت «منتشر شده» را نشان می‌دهد؛ اعضای همین شبکه آن‌ها را می‌بینند.
                  </p>
                )}
              </NeighborhoodNetworkContext>
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {canManage ? (
              <Link href={`/spaces/neighborhood/forms/manage?networkId=${encodeURIComponent(networkId)}`} className={PRIMARY_CTA}>
                ایجاد / مدیریت فرم
              </Link>
            ) : null}
            {networkId && !networksLoading ? (
              <span className="rounded-full bg-[var(--surface-soft)] px-2.5 py-1 text-[10px] font-extrabold text-[var(--text-primary)] ring-1 ring-[var(--border-soft)]">
                فرم منتشرشده: {forms.length}
                {formsRefreshing ? ' · به‌روزرسانی' : ''}
              </span>
            ) : null}
          </div>
          {!networksLoading && !error && networks.length === 0 ? (
            <p className="mt-3 rounded-2xl bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-900 dark:text-amber-200">
              هنوز عضو هیچ شبکه محله‌ای نیستید. از{' '}
              <Link href="/spaces/NEIGHBORHOOD" className="font-bold underline">
                فضای محله
              </Link>{' '}
              به یک شبکه بپیوندید، بعد برگردید.
            </p>
          ) : null}
          {!networksLoading && networks.length > 0 && adminNetworks.length > 0 ? (
            <p className={'mt-2 ' + MUTED}>
              شبکه‌هایی که ادمین آن هستید: {adminNetworks.map((n) => n.name).join('، ')}
            </p>
          ) : null}
        </section>

        <section className={SECTION_CARD + ' mt-4'}>
          <p className="mb-2 text-[10px] font-bold text-[var(--text-secondary)]">فرم‌های منتشرشده همین شبکه</p>
          {formsLoading && forms.length === 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-[var(--text-secondary)]">در حال بارگذاری فرم‌ها…</p>
              <div className="h-20 animate-pulse rounded-2xl bg-[var(--surface-soft)]" />
              <div className="h-20 animate-pulse rounded-2xl bg-[var(--surface-soft)]" />
            </div>
          ) : null}
          {error ? <p className="rounded-2xl bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-700">{error}</p> : null}
          {!formsLoading && !error && networkId && forms.length === 0 ? (
            <div className="space-y-2 rounded-2xl bg-[var(--surface-soft)] px-3 py-3 text-sm text-[var(--text-primary)] ring-1 ring-[var(--border-soft)]">
              <p>
                هنوز <strong>هیچ فرم منتشرشده‌ای</strong> برای «{activeNetwork?.name ?? 'این شبکه'}» وجود ندارد — یعنی یا فرمی
                ساخته نشده، یا هنوز توسط ادمین <strong>منتشر</strong> نشده است.
              </p>
              {canManage ? (
                <p className={MUTED}>
                  از «ایجاد / مدیریت فرم» فرم بسازید و دکمه <strong>انتشار</strong> را بزنید تا اینجا ظاهر شود.
                </p>
              ) : (
                <p className={MUTED}>اگر ادمین شبکه فرم را منتشر کند، اینجا دیده می‌شود.</p>
              )}
            </div>
          ) : null}
          <ul className={`space-y-2.5 ${formsRefreshing && forms.length > 0 ? 'opacity-90 transition-opacity' : ''}`}>
            {forms.map((form) => (
              <li key={form.id} className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-extrabold text-[var(--text-primary)]">{form.title}</p>
                    {form.description ? (
                      <p className="mt-1 line-clamp-2 text-xs text-[var(--text-secondary)]">{form.description}</p>
                    ) : null}
                  </div>
                  <span className="rounded-full bg-[var(--card-bg)] px-2 py-0.5 text-[10px] font-bold text-[var(--accent-hover)] ring-1 ring-[var(--border-soft)]">
                    پاسخ: {form._count.responses}
                  </span>
                </div>
                <div className="mt-2">
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ring-1 ${formStatusBadgeClass(form.status)}`}>
                    {formStatusLabel(form.status)}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/spaces/neighborhood/forms/${form.id}?networkId=${encodeURIComponent(networkId)}`}
                    className={PRIMARY_CTA}
                  >
                    مشاهده / ثبت پاسخ
                  </Link>
                  {form.status === 'PUBLISHED' ? (
                    <button type="button" onClick={() => setShareFormId(form.id)} className={SECONDARY_CTA}>
                      اشتراک در جامعه
                    </button>
                  ) : null}
                  {canManage ? (
                    <Link
                      href={`/spaces/neighborhood/forms/${form.id}/responses?networkId=${encodeURIComponent(networkId)}`}
                      className={SECONDARY_CTA}
                    >
                      پاسخ‌ها
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {shareFormId && networkId ? (
          <LinkCapabilityModal
            open
            onClose={() => setShareFormId(null)}
            networkId={networkId}
            capabilityType="FORM"
            capabilityId={shareFormId}
          />
        ) : null}
      </main>
    </AuthGate>
  );
}

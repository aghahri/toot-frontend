'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AuthGate } from '@/components/AuthGate';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { formStatusBadgeClass, formStatusLabel } from '@/lib/neighborhoodForms';

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
  'rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-[0_10px_24px_rgba(15,23,42,0.06)]';
const PRIMARY_CTA =
  'rounded-2xl bg-emerald-700 px-4 py-2.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-emerald-600';
const SECONDARY_CTA =
  'rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-extrabold text-slate-700 transition hover:bg-slate-50';

export default function NeighborhoodFormsListPage() {
  const [networks, setNetworks] = useState<NetworkRow[]>([]);
  const [networkId, setNetworkId] = useState('');
  const [forms, setForms] = useState<FormRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeNetwork = useMemo(() => networks.find((n) => n.id === networkId) ?? null, [networks, networkId]);
  const canManage = activeNetwork?.myRole === 'NETWORK_ADMIN';

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const token = getAccessToken();
        if (!token) {
          setError('برای مشاهده فرم‌های محله باید وارد شوید.');
          return;
        }
        const allNetworks = await apiFetch<NetworkRow[]>('networks', { method: 'GET', token });
        const neighborhood = allNetworks.filter(
          (n) => n.spaceCategory === 'NEIGHBORHOOD' && (n.isMember ?? true),
        );
        if (cancelled) return;
        setNetworks(neighborhood);
        if (neighborhood[0]) {
          setNetworkId(neighborhood[0].id);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'بارگذاری شبکه‌ها ممکن نیست');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!networkId) return;
      setLoading(true);
      setError(null);
      try {
        const token = getAccessToken();
        if (!token) {
          setError('برای مشاهده فرم‌های محله باید وارد شوید.');
          return;
        }
        const rows = await apiFetch<FormRow[]>(`networks/${networkId}/forms`, { method: 'GET', token });
        if (!cancelled) setForms(rows);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'بارگذاری فرم‌ها ممکن نیست');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [networkId]);

  return (
    <AuthGate>
      <main className="mx-auto w-full max-w-md px-4 pb-12 pt-4 sm:pb-14" dir="rtl">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-extrabold text-slate-900">Neighborhood Forms</h1>
            <p className="text-xs text-slate-500">فرم‌های محلی شبکه‌های محله</p>
          </div>
          <Link href="/spaces/NEIGHBORHOOD" className={SECONDARY_CTA}>
            بازگشت
          </Link>
        </div>

        <section className={SECTION_CARD}>
          <label className="mb-1 block text-xs font-bold text-slate-700">انتخاب شبکه</label>
          <select
            value={networkId}
            onChange={(e) => setNetworkId(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-300"
          >
            {networks.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
          <div className="mt-3 flex flex-wrap gap-2">
            {canManage ? (
              <Link href={`/spaces/neighborhood/forms/manage?networkId=${encodeURIComponent(networkId)}`} className={PRIMARY_CTA}>
                ایجاد / مدیریت فرم
              </Link>
            ) : null}
            {networkId ? (
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold text-emerald-800 ring-1 ring-emerald-200/80">
                فرم‌های فعال: {forms.length}
              </span>
            ) : null}
          </div>
          {!loading && !error && networks.length === 0 ? (
            <p className="mt-3 rounded-2xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
              هنوز عضو شبکه محله‌ای نیستید؛ ابتدا به یک شبکه محله بپیوندید.
            </p>
          ) : null}
        </section>

        <section className={SECTION_CARD + ' mt-4'}>
          {loading ? (
            <div className="space-y-2">
              <p className="text-sm text-slate-500">در حال بارگذاری فرم‌ها…</p>
              <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
            </div>
          ) : null}
          {error ? <p className="rounded-2xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p> : null}
          {!loading && !error && forms.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 px-3 py-3 text-sm text-slate-600">
              در این شبکه هنوز فرم منتشرشده‌ای ثبت نشده است.
            </p>
          ) : null}
          <ul className="space-y-2.5">
            {forms.map((form) => (
              <li key={form.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-extrabold text-slate-900">{form.title}</p>
                    {form.description ? (
                      <p className="mt-1 line-clamp-2 text-xs text-slate-600">{form.description}</p>
                    ) : null}
                  </div>
                  <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700">
                    پاسخ: {form._count.responses}
                  </span>
                </div>
                <div className="mt-2">
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ring-1 ${formStatusBadgeClass(form.status)}`}>
                    {formStatusLabel(form.status)}
                  </span>
                </div>
                <div className="mt-3 flex gap-2">
                  <Link
                    href={`/spaces/neighborhood/forms/${form.id}?networkId=${encodeURIComponent(networkId)}`}
                    className={PRIMARY_CTA}
                  >
                    مشاهده / ثبت پاسخ
                  </Link>
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
      </main>
    </AuthGate>
  );
}

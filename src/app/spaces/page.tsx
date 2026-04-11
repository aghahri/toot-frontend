'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AuthGate } from '@/components/AuthGate';
import { getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';

type GroupRow = {
  id: string;
  name: string;
  description: string | null;
  networkId: string | null;
  joinable: boolean;
};

const SPACE_SECTIONS = [
  { key: 'PUBLIC_GENERAL', title: 'فضاهای عمومی', hint: 'گروه‌های عمومی و بدون شبکهٔ مشخص' },
  { key: 'NEIGHBORHOOD', title: 'فضای محله', hint: 'محله و همسایگی' },
  { key: 'EDUCATION', title: 'فضای آموزش', hint: 'آموزش و یادگیری' },
  { key: 'SPORT', title: 'فضای ورزش', hint: 'ورزش و تندرستی' },
  { key: 'TECH', title: 'فضای تکنولوژی', hint: 'فناوری و ابزار' },
] as const;

type SpaceKey = (typeof SPACE_SECTIONS)[number]['key'];

type SpacesGroupsResponse = Record<string, GroupRow[]>;

export default function SpacesPage() {
  const [bySpace, setBySpace] = useState<SpacesGroupsResponse | null>(null);
  const [selectedKey, setSelectedKey] = useState<SpaceKey>('PUBLIC_GENERAL');
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const token = getAccessToken();
        const data = await apiFetch<SpacesGroupsResponse>('discover/spaces/groups?limit=40', {
          method: 'GET',
          ...(token ? { token } : {}),
        });
        if (!cancelled) setBySpace(data && typeof data === 'object' ? data : {});
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'خطا');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedMeta = useMemo(
    () => SPACE_SECTIONS.find((s) => s.key === selectedKey) ?? SPACE_SECTIONS[0],
    [selectedKey],
  );

  const selectedGroups = useMemo(() => {
    const list = bySpace?.[selectedKey];
    return Array.isArray(list) ? list : [];
  }, [bySpace, selectedKey]);

  async function joinGroup(groupId: string) {
    const token = getAccessToken();
    if (!token) return;
    setJoining(groupId);
    setError(null);
    try {
      await apiFetch(`groups/${groupId}/join`, { method: 'POST', token });
      window.location.href = `/groups/${groupId}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'امکان پیوستن نیست (شبکه یا عضویت)');
    } finally {
      setJoining(null);
    }
  }

  return (
    <AuthGate>
      <main className="mx-auto w-full max-w-md px-4 pb-6 pt-2" dir="rtl">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-lg font-extrabold text-slate-900">فضاها</h1>
          <Link href="/groups" className="text-xs font-bold text-sky-700 underline">
            گروه‌های من
          </Link>
        </div>
        <p className="mb-3 text-sm leading-relaxed text-slate-600">
          یک فضا را انتخاب کنید؛ فهرست گروه‌های همان دستهٔ موقت در پایین نمایش داده می‌شود.
        </p>

        {loading ? (
          <p className="text-sm text-slate-500">در حال بارگذاری…</p>
        ) : error ? (
          <p className="text-sm font-semibold text-red-700">{error}</p>
        ) : (
          <>
            <div
              className="mb-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              role="tablist"
              aria-label="انتخاب فضا"
            >
              {SPACE_SECTIONS.map((section) => {
                const active = section.key === selectedKey;
                const count = (bySpace?.[section.key] ?? []).length;
                return (
                  <button
                    key={section.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSelectedKey(section.key)}
                    className={[
                      'flex min-w-[8.25rem] shrink-0 flex-col rounded-2xl border px-3 py-2.5 text-right transition',
                      active
                        ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-400/50'
                        : 'border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50',
                    ].join(' ')}
                  >
                    <span className="text-xs font-extrabold text-slate-900">{section.title}</span>
                    <span className="mt-0.5 text-[10px] font-medium text-slate-500">{count} گروه</span>
                  </button>
                );
              })}
            </div>

            <section
              className="overflow-hidden rounded-3xl border border-slate-200/90 bg-gradient-to-br from-white to-slate-50/90 shadow-sm ring-1 ring-slate-100/80"
              aria-labelledby="space-detail-title"
            >
              <div className="border-b border-slate-100/90 bg-slate-50/80 px-4 py-3">
                <h2 id="space-detail-title" className="text-base font-extrabold text-slate-900">
                  {selectedMeta.title}
                </h2>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{selectedMeta.hint}</p>
              </div>

              <div className="border-b border-dashed border-slate-100 px-4 py-3">
                <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-500">گروه‌ها</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                  شبکه و کانال هنوز برچسب «فضا» در بک‌اند ندارند؛ فقط گروه‌های دسته‌بندی‌شده نمایش داده می‌شوند.
                </p>
              </div>

              <ul className="divide-y divide-slate-100 px-2 py-1">
                {selectedGroups.length === 0 ? (
                  <li className="px-2 py-8 text-center text-xs text-slate-400">
                    در این فضا هنوز گروهی برای نمایش نیست
                  </li>
                ) : (
                  selectedGroups.map((g) => (
                    <li key={g.id} className="px-2 py-2">
                      <div className="flex items-start justify-between gap-3 rounded-2xl px-2 py-2">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-bold text-slate-900">{g.name}</div>
                          {g.description ? (
                            <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-slate-500">
                              {g.description}
                            </p>
                          ) : null}
                          {!g.joinable ? (
                            <p className="mt-1 text-[10px] font-medium text-slate-400">
                              گروه بدون شبکه — عضویت با دعوت
                            </p>
                          ) : null}
                        </div>
                        {g.joinable ? (
                          <button
                            type="button"
                            disabled={joining === g.id}
                            onClick={() => void joinGroup(g.id)}
                            className="shrink-0 rounded-xl bg-emerald-600 px-3 py-2 text-[11px] font-bold text-white shadow-sm disabled:opacity-50"
                          >
                            {joining === g.id ? '…' : 'پیوستن'}
                          </button>
                        ) : null}
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </section>
          </>
        )}
      </main>
    </AuthGate>
  );
}

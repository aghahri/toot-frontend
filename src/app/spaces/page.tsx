'use client';

import { useEffect, useState } from 'react';
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
  { key: 'PUBLIC_GENERAL', title: 'فضاهای عمومی' },
  { key: 'NEIGHBORHOOD', title: 'فضای محله' },
  { key: 'EDUCATION', title: 'فضای آموزش' },
  { key: 'SPORT', title: 'فضای ورزش' },
  { key: 'TECH', title: 'فضای تکنولوژی' },
] as const;

type SpacesGroupsResponse = Record<string, GroupRow[]>;

export default function SpacesPage() {
  const [bySpace, setBySpace] = useState<SpacesGroupsResponse | null>(null);
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
        const data = await apiFetch<SpacesGroupsResponse>('discover/spaces/groups?limit=18', {
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
        <p className="mb-4 text-sm leading-relaxed text-slate-600">
          گروه‌ها بر اساس دستهٔ موقت نمایش داده می‌شوند. برای گروه‌های زیر شبکه، پیوستن نیازمند عضویت در
          همان شبکه است.
        </p>
        {loading ? (
          <p className="text-sm text-slate-500">در حال بارگذاری…</p>
        ) : error ? (
          <p className="text-sm font-semibold text-red-700">{error}</p>
        ) : (
          <ul className="space-y-5">
            {SPACE_SECTIONS.map((section) => {
              const groups = (bySpace?.[section.key] ?? []) as GroupRow[];
              return (
                <li key={section.key}>
                  <section
                    className="overflow-hidden rounded-3xl border border-slate-200/90 bg-gradient-to-br from-white to-slate-50/90 shadow-sm ring-1 ring-slate-100/80"
                    aria-labelledby={`space-h-${section.key}`}
                  >
                    <div className="border-b border-slate-100/90 bg-slate-50/80 px-4 py-3">
                      <h2 id={`space-h-${section.key}`} className="text-base font-extrabold text-slate-900">
                        {section.title}
                      </h2>
                    </div>
                    <ul className="divide-y divide-slate-100 px-2 py-1">
                      {groups.length === 0 ? (
                        <li className="px-2 py-6 text-center text-xs text-slate-400">هنوز گروهی در این بخش نیست</li>
                      ) : (
                        groups.map((g) => (
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
                                  <p className="mt-1 text-[10px] font-medium text-slate-400">گروه بدون شبکه — عضویت با دعوت</p>
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
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </AuthGate>
  );
}

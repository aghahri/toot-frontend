'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AuthGate } from '@/components/AuthGate';
import { getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import {
  SPACE_CARD_META,
  SPACE_KEYS,
  type SpaceKey,
  type SpaceSummaryRow,
} from '@/lib/spacesCatalog';

type SummaryResponse = { spaces: SpaceSummaryRow[] };

function SpaceGlyph({ spaceKey }: { spaceKey: SpaceKey }) {
  const common = 'h-8 w-8 text-white drop-shadow-sm';
  switch (spaceKey) {
    case 'PUBLIC_GENERAL':
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4l2.5 2.5" strokeLinecap="round" />
        </svg>
      );
    case 'NEIGHBORHOOD':
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
          <path d="M4 10l8-6 8 6v10H4z" strokeLinejoin="round" />
          <path d="M10 22v-6h4v6" strokeLinejoin="round" />
        </svg>
      );
    case 'EDUCATION':
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
          <path d="M4 8l8-4 8 4-8 4-8-4z" strokeLinejoin="round" />
          <path d="M6 10v5.5c0 2 3.5 3.5 6 3.5s6-1.5 6-3.5V10" strokeLinejoin="round" />
        </svg>
      );
    case 'SPORT':
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M7 12h10M12 7c2 2 2 8 0 10M12 7c-2 2-2 8 0 10" strokeLinecap="round" />
        </svg>
      );
    case 'TECH':
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
          <rect x="5" y="7" width="14" height="10" rx="2" />
          <path d="M9 17h6" strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
}

export default function SpacesOverviewPage() {
  const [summary, setSummary] = useState<SpaceSummaryRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const token = getAccessToken();
        const data = await apiFetch<SummaryResponse>('discover/spaces/summary', {
          method: 'GET',
          ...(token ? { token } : {}),
        });
        if (cancelled) return;
        const rows = Array.isArray(data?.spaces) ? data.spaces : [];
        const byCat = new Map(rows.map((r) => [r.category, r] as const));
        const ordered = SPACE_KEYS.map(
          (k) =>
            byCat.get(k) ?? {
              category: k,
              groups: 0,
              networks: 0,
              channels: 0,
            },
        );
        setSummary(ordered);
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

  const rowsByKey = useMemo(() => {
    const m = new Map<SpaceKey, SpaceSummaryRow>();
    for (const r of summary ?? []) {
      if (SPACE_KEYS.includes(r.category as SpaceKey)) m.set(r.category as SpaceKey, r);
    }
    return m;
  }, [summary]);

  return (
    <AuthGate>
      <main className="mx-auto w-full max-w-md px-4 pb-8 pt-2" dir="rtl">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-lg font-extrabold text-slate-900">فضاها</h1>
          <Link href="/groups" className="text-xs font-bold text-sky-700 underline">
            گروه‌های من
          </Link>
        </div>
        <p className="mb-5 text-sm leading-relaxed text-slate-600">
          پنج فضای اصلی را انتخاب کنید؛ در هر فضا گروه‌ها، شبکه‌ها و کانال‌های مرتبط (بر اساس دستهٔ موقت در
          سرور) را می‌بینید.
        </p>

        {loading ? (
          <p className="text-sm text-slate-500">در حال بارگذاری…</p>
        ) : error ? (
          <p className="text-sm font-semibold text-red-700">{error}</p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {SPACE_KEYS.map((key) => {
              const meta = SPACE_CARD_META[key];
              const counts = rowsByKey.get(key);
              return (
                <li key={key}>
                  <Link
                    href={`/spaces/${key}`}
                    className={[
                      'group flex min-h-[9.5rem] flex-col overflow-hidden rounded-3xl bg-gradient-to-br p-4 text-white shadow-lg ring-2 ring-inset transition',
                      'hover:scale-[1.01] hover:shadow-xl active:scale-[0.99]',
                      meta.gradient,
                      meta.ring,
                    ].join(' ')}
                  >
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
                        <SpaceGlyph spaceKey={key} />
                      </span>
                      <span className="rounded-full bg-black/15 px-2 py-0.5 text-[10px] font-bold text-white/90">
                        ورود ←
                      </span>
                    </div>
                    <span className="text-lg font-extrabold leading-tight">{meta.title}</span>
                    <span className="mt-1 text-xs font-medium text-white/85">{meta.subtitle}</span>
                    <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
                      <span className="rounded-lg bg-black/20 px-2 py-1 text-[10px] font-bold text-white/95">
                        {counts?.groups ?? 0} گروه
                      </span>
                      <span className="rounded-lg bg-black/20 px-2 py-1 text-[10px] font-bold text-white/95">
                        {counts?.networks ?? 0} شبکه
                      </span>
                      <span className="rounded-lg bg-black/20 px-2 py-1 text-[10px] font-bold text-white/95">
                        {counts?.channels ?? 0} کانال
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </AuthGate>
  );
}

'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AuthGate } from '@/components/AuthGate';
import { apiFetch } from '@/lib/api';
import { VITRIN_CATALOG } from '@/config/vitrinCatalog';

function VitrinGlyph({ id }: { id: string }) {
  const common = 'h-5 w-5 text-white';
  switch (id) {
    case 'bamakhabar':
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M4 6h16v12H4z" />
          <path d="M8 10h8M8 14h5" strokeLinecap="round" />
        </svg>
      );
    case 'iranregions':
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M4 10l4-4 4 3 4-5 4 6v9H4z" strokeLinejoin="round" />
          <circle cx="10" cy="13" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'bamatel':
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <rect x="7" y="3" width="10" height="18" rx="2" />
          <path d="M10 18h4" strokeLinecap="round" />
        </svg>
      );
    case 'bamabank':
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M3 10h18v10H3z" />
          <path d="M12 6v4M6 10l6-4 6 4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return null;
  }
}

export default function VitrinPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ShowcasePayload | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch<ShowcasePayload>('showcase', { method: 'GET' });
        if (active) setData(res);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'خطا در دریافت ویترین');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const publishedAnnouncements = useMemo(() => data?.announcements ?? [], [data]);
  const coreLinks = useMemo(() => data?.coreLinks ?? [], [data]);
  const featuredNetworks = useMemo(() => data?.featuredNetworks ?? [], [data]);
  const featuredGroups = useMemo(() => data?.featuredGroups ?? [], [data]);
  const featuredChannels = useMemo(() => data?.featuredChannels ?? [], [data]);
  const fallbackByKey = useMemo(
    () => new Map(VITRIN_CATALOG.map((entry) => [entry.key, entry] as const)),
    [],
  );

  return (
    <AuthGate>
      <main className="mx-auto w-full max-w-md px-4 pb-6 pt-4" dir="rtl">
        {loading ? <p className="mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">در حال بارگذاری ویترین…</p> : null}
        {error ? <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

        <section className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-900">سرویس‌های اصلی ویترین</h2>
            <span className="rounded-full bg-indigo-50 px-2 py-1 text-[11px] font-bold text-indigo-700">
              {coreLinks.length} مورد
            </span>
          </div>
          {coreLinks.length === 0 ? (
            <p className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-xs text-[var(--ink-3)]">
              لینک‌های اصلی ویترین هنوز تنظیم نشده‌اند.
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-3">
              {coreLinks.map((item) => {
                const fallback = fallbackByKey.get(item.key);
                const brandClass =
                  fallback?.cardClass ??
                  'from-[var(--accent)] via-[var(--accent)] to-[var(--accent-hover)]';
                return (
                  <li key={item.key}>
                    <Link
                      href={`/vitrin/web?entry=${encodeURIComponent(item.key)}`}
                      className="group flex h-full min-h-[8.5rem] flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3 transition hover:bg-[var(--surface-2)]/60 active:scale-[0.99]"
                    >
                      <span
                        className={`mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br shadow-sm ${brandClass}`}
                        aria-hidden
                      >
                        <VitrinGlyph id={fallback?.id ?? item.key.toLowerCase()} />
                      </span>
                      <span className="line-clamp-2 text-[14px] font-extrabold leading-snug tracking-tight text-[var(--ink)]">
                        {item.title}
                      </span>
                      <span className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[var(--ink-3)]">
                        {item.subtitle}
                      </span>
                      <span className="mt-auto pt-2 text-[11px] font-bold text-[var(--accent-hover)]">مشاهده</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-900">اطلاعیه‌های زنده</h2>
            <span className="rounded-full bg-sky-50 px-2 py-1 text-[11px] font-bold text-sky-700">
              {publishedAnnouncements.length} مورد
            </span>
          </div>
          {publishedAnnouncements.length === 0 ? (
            <p className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-xs text-[var(--ink-3)]">
              فعلاً اطلاعیه‌ی منتشرشده‌ای وجود ندارد.
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-3">
              {publishedAnnouncements.map((item) => (
                <li key={item.id}>
                  <article className="group relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 transition hover:bg-[var(--surface-2)]/50">
                    <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-bold text-[var(--accent-hover)]">
                      اطلاعیه
                    </div>
                    <p className="text-[15px] font-extrabold leading-snug text-[var(--ink)]">{item.title}</p>
                    <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-[var(--ink-2)]">{item.body}</p>
                    <p className="mt-3 text-[11px] font-bold text-[var(--ink-3)]">اطلاعیه ویترین</p>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-900">فضاهای برجسته</h2>
            <span className="rounded-full bg-violet-50 px-2 py-1 text-[11px] font-bold text-violet-700">
              {featuredNetworks.length + featuredGroups.length + featuredChannels.length} مورد
            </span>
          </div>
          <div className="space-y-3">
            <FeaturedList title="شبکه‌ها" items={featuredNetworks} hrefBase="/networks" kindLabel="شبکه" />
            <FeaturedList title="گروه‌ها" items={featuredGroups} hrefBase="/groups" kindLabel="گروه" />
            <FeaturedList title="کانال‌ها" items={featuredChannels} hrefBase="/channels" kindLabel="کانال" />
          </div>
        </section>

        {coreLinks.length === 0 ? (
          <>
            <p className="mb-3 text-xs font-bold text-[var(--ink-3)]">سرویس‌های منتخب (پیش‌فرض)</p>
            <ul className="grid grid-cols-2 gap-3">
              {VITRIN_CATALOG.map((entry) => (
                <li key={entry.id}>
                  <Link
                    href={`/vitrin/web?entry=${encodeURIComponent(entry.id)}`}
                    className="group flex h-full min-h-[8.5rem] flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3 transition hover:bg-[var(--surface-2)]/60 active:scale-[0.99]"
                  >
                    <span
                      className={`mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br shadow-sm ${entry.cardClass}`}
                      aria-hidden
                    >
                      <VitrinGlyph id={entry.id} />
                    </span>
                    <span className="line-clamp-2 text-[14px] font-extrabold leading-snug tracking-tight text-[var(--ink)]">
                      {entry.title}
                    </span>
                    <span className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[var(--ink-3)]">
                      {entry.subtitle}
                    </span>
                    <span className="mt-auto pt-2 text-[11px] font-bold text-[var(--accent-hover)]">مشاهده</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </main>
    </AuthGate>
  );
}

type ShowcaseAnnouncement = {
  id: string;
  title: string;
  body: string;
};

type ShowcaseNode = {
  id: string;
  name: string;
  description: string | null;
};

type ShowcasePayload = {
  coreLinks: ShowcaseCoreLink[];
  announcements: ShowcaseAnnouncement[];
  featuredNetworks: ShowcaseNode[];
  featuredGroups: ShowcaseNode[];
  featuredChannels: ShowcaseNode[];
};

type ShowcaseCoreLink = {
  key: 'BAMA_BANK' | 'BAMA_KHABAR' | 'BAMATEL' | 'NEIGHBORHOOD_MAP';
  title: string;
  subtitle: string;
  url: string;
};

function FeaturedList({
  title,
  items,
  hrefBase,
  kindLabel,
}: {
  title: string;
  items: ShowcaseNode[];
  hrefBase: '/networks' | '/groups' | '/channels';
  kindLabel: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
      <p className="text-xs font-extrabold text-[var(--ink-2)]">{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 rounded-xl bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--ink-3)]">موردی برای نمایش وجود ندارد.</p>
      ) : (
        <ul className="mt-3 grid grid-cols-1 gap-2">
          {items.slice(0, 4).map((item) => (
            <li key={item.id}>
              <Link
                href={`${hrefBase}/${encodeURIComponent(item.id)}`}
                className="group block rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-3 text-xs text-[var(--ink-2)] transition hover:bg-[var(--surface-strong)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold text-[var(--ink)]">{item.name}</p>
                    {item.description ? <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--ink-2)]">{item.description}</p> : null}
                  </div>
                  <span className="shrink-0 rounded-full bg-[var(--surface)] px-2 py-1 text-[10px] font-bold text-[var(--ink-3)]">
                    {kindLabel}
                  </span>
                </div>
                <p className="mt-2 text-[11px] font-bold text-[var(--accent-hover)]">مشاهده {kindLabel}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

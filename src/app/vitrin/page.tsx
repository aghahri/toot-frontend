'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AuthGate } from '@/components/AuthGate';
import { apiFetch } from '@/lib/api';
import { VITRIN_CATALOG } from '@/config/vitrinCatalog';

function VitrinGlyph({ id }: { id: string }) {
  const common = 'h-6 w-6 text-white';
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
  const featuredNetworks = useMemo(() => data?.featuredNetworks ?? [], [data]);
  const featuredGroups = useMemo(() => data?.featuredGroups ?? [], [data]);
  const featuredChannels = useMemo(() => data?.featuredChannels ?? [], [data]);

  return (
    <AuthGate>
      <main className="mx-auto w-full max-w-md px-4 pb-6 pt-2" dir="rtl">
        <p className="mb-4 text-sm leading-relaxed text-slate-600">
          محتوای زنده‌ی ویترین از تنظیمات جاری سیستم بارگذاری می‌شود.
        </p>

        {loading ? <p className="mb-4 text-sm text-slate-500">در حال بارگذاری ویترین…</p> : null}
        {error ? <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-extrabold text-slate-900">اطلاعیه‌های زنده</h2>
          {publishedAnnouncements.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">فعلاً اطلاعیه‌ی منتشرشده‌ای وجود ندارد.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {publishedAnnouncements.map((item) => (
                <li key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-bold text-slate-900">{item.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-700">{item.body}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-extrabold text-slate-900">فضاهای برجسته</h2>
          <div className="mt-3 space-y-3">
            <FeaturedList title="شبکه‌ها" items={featuredNetworks} hrefBase="/networks" />
            <FeaturedList title="گروه‌ها" items={featuredGroups} hrefBase="/groups" />
            <FeaturedList title="کانال‌ها" items={featuredChannels} hrefBase="/channels" />
          </div>
        </section>

        <p className="mb-3 text-xs text-slate-500">سرویس‌های منتخب</p>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {VITRIN_CATALOG.map((entry) => (
            <li key={entry.id}>
              <Link
                href={`/vitrin/web?entry=${encodeURIComponent(entry.id)}`}
                className={[
                  'group relative flex min-h-[8.5rem] flex-col overflow-hidden rounded-3xl bg-gradient-to-br p-4 text-white shadow-lg ring-2 ring-inset transition',
                  'hover:scale-[1.01] hover:shadow-xl active:scale-[0.99]',
                  entry.cardClass,
                ].join(' ')}
              >
                <span
                  className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm"
                  aria-hidden
                >
                  <VitrinGlyph id={entry.id} />
                </span>
                <span className="text-lg font-extrabold leading-snug tracking-tight">{entry.title}</span>
                <span className="mt-1 text-xs font-medium leading-relaxed text-white/90">{entry.subtitle}</span>
                <span className="mt-auto pt-3 text-[11px] font-bold text-white/80">مشاهده</span>
              </Link>
            </li>
          ))}
        </ul>
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
  announcements: ShowcaseAnnouncement[];
  featuredNetworks: ShowcaseNode[];
  featuredGroups: ShowcaseNode[];
  featuredChannels: ShowcaseNode[];
};

function FeaturedList({
  title,
  items,
  hrefBase,
}: {
  title: string;
  items: ShowcaseNode[];
  hrefBase: '/networks' | '/groups' | '/channels';
}) {
  return (
    <div>
      <p className="text-xs font-bold text-slate-600">{title}</p>
      {items.length === 0 ? (
        <p className="mt-1 text-xs text-slate-500">موردی برای نمایش وجود ندارد.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.slice(0, 4).map((item) => (
            <li key={item.id}>
              <Link
                href={`${hrefBase}/${encodeURIComponent(item.id)}`}
                className="block rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 hover:bg-slate-50"
              >
                <p className="font-semibold">{item.name}</p>
                {item.description ? <p className="mt-1 line-clamp-2 text-slate-500">{item.description}</p> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

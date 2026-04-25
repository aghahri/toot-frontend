'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AuthGate } from '@/components/AuthGate';
import { apiFetch } from '@/lib/api';
import { formatCount } from '@/lib/format';
import { VITRIN_CATALOG } from '@/config/vitrinCatalog';
import { StoryCuratedRail } from '@/components/home/StoryCuratedRail';

/**
 * /vitrin — Toot daily-services dashboard.
 *
 * v1 visual migration toward docs/design/handoff/.../previews-v2.html. The
 * data path is unchanged: showcase + story/published live as before, the
 * VITRIN_CATALOG fallback still kicks in when the showcase response is empty.
 *
 * Layout (mobile-first, RTL):
 *   1. Utility 4-grid          — coreLinks (or VITRIN_CATALOG fallback)
 *   2. هشدارها و خبرها         — alert cards with handoff border-inline-start
 *   3. گزیده روز               — existing StoryCuratedRail (compact)
 *   4. فضاهای برجسته           — horizontal service-row of featured items
 */

type VitrinStoryItem = {
  id: string;
  title: string;
  summary: string | null;
  category: string | null;
  url: string | null;
  imageUrl?: string | null;
  publishedAt: string | null;
  storyKind?: 'TODAY' | 'LOCAL' | 'NETWORK';
  trustLabel?: string;
  source: { name: string };
};

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

/** Per-utility pastel/icon palette per the handoff. The four published Toot
 *  services (news, bank, telecom, neighborhood map) each carry a distinct
 *  warm-Persian tone that's calmer than full-saturation brand color. */
const UTILITY_TONES: Record<string, { tile: string; icon: string }> = {
  bamakhabar: { tile: '#EADFD2', icon: '#8B4E1E' },
  bamabank: { tile: '#DFE9DC', icon: '#2F7A4E' },
  bamatel: { tile: '#DCE5EE', icon: '#2B5E9C' },
  iranregions: { tile: '#EEE3DC', icon: '#B4532A' },
};

function VitrinGlyph({ id }: { id: string }) {
  const cls = 'h-5 w-5';
  switch (id) {
    case 'bamakhabar':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M4 6h12v12H4z" />
          <path d="M16 10h4v8a2 2 0 0 1-2 2h0a2 2 0 0 1-2-2z" />
          <path d="M7 9h6M7 12h6M7 15h3" />
        </svg>
      );
    case 'iranregions':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M9 3L3 5v16l6-2 6 2 6-2V3l-6 2z" />
          <path d="M9 3v16M15 5v16" />
        </svg>
      );
    case 'bamatel':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 4a2 2 0 0 0-2 2v1c0 9 7 16 16 16h1a2 2 0 0 0 2-2v-3a1 1 0 0 0-.75-.97l-4-1a1 1 0 0 0-1.06.36L15 18a12 12 0 0 1-6-6l1.6-2.2a1 1 0 0 0 .36-1.05l-1-4A1 1 0 0 0 9 4H5z" />
        </svg>
      );
    case 'bamabank':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 11l9-6 9 6M5 11v8h14v-8M9 15h6" />
        </svg>
      );
    default:
      return null;
  }
}

/** Inline alert glyph used by the alert-card pattern. Variant chooses the
 *  per-tone iconography described in the handoff: location pin for local,
 *  info-circle for info, sun for warning. */
function AlertGlyph({ tone }: { tone: 'local' | 'info' | 'warning' }) {
  const cls = 'h-4 w-4';
  if (tone === 'local') {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 22s8-7 8-13a8 8 0 1 0-16 0c0 6 8 13 8 13z" />
        <circle cx="12" cy="9" r="2.5" />
      </svg>
    );
  }
  if (tone === 'info') {
    return (
      <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
    );
  }
  return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4 12H2M22 12h-2M6 6L4.5 4.5M19.5 19.5L18 18M18 6l1.5-1.5M4.5 19.5L6 18" />
    </svg>
  );
}

const ALERT_TONES = {
  local: { color: 'var(--accent)' },
  info: { color: 'var(--info)' },
  warning: { color: 'var(--warning)' },
} as const;

type AlertTone = keyof typeof ALERT_TONES;

/** Pure-content classifier so an empty backend "type" still picks a sensible
 *  tone. We never invent text; only the visual lane shifts. */
function classifyAnnouncementTone(item: ShowcaseAnnouncement): AlertTone {
  const blob = `${item.title} ${item.body}`.toLowerCase();
  if (/(محله|الهیه|نارمک|ونک|همسایه|آب|برق|گاز|local|neighborhood)/.test(blob)) return 'local';
  if (/(یارانه|گرما|سرما|moj|warning|alert|هشدار|خطر)/.test(blob)) return 'warning';
  return 'info';
}

export default function VitrinPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ShowcasePayload | null>(null);
  const [storyLoading, setStoryLoading] = useState(true);
  const [storyItems, setStoryItems] = useState<VitrinStoryItem[]>([]);

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

  useEffect(() => {
    let active = true;
    setStoryLoading(true);
    void apiFetch<VitrinStoryItem[]>('story/published?scope=today&limit=6', { method: 'GET' })
      .then((rows) => {
        if (active) setStoryItems(rows);
      })
      .catch(() => {
        if (active) setStoryItems([]);
      })
      .finally(() => {
        if (active) setStoryLoading(false);
      });
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

  /** Merge the three featured kinds into one ordered service-row stream so the
   *  user gets a single horizontal scroll with mixed items, not three small
   *  rows that each look half-empty. Order: networks → groups → channels. */
  const featuredItems = useMemo(() => {
    const out: Array<{
      key: string;
      kind: 'network' | 'group' | 'channel';
      kindLabel: string;
      href: string;
      name: string;
      description: string | null;
      tone: 'a' | 'b' | 'c';
    }> = [];
    for (const n of featuredNetworks) {
      out.push({
        key: `n-${n.id}`,
        kind: 'network',
        kindLabel: 'شبکه',
        href: `/networks/${encodeURIComponent(n.id)}`,
        name: n.name,
        description: n.description,
        tone: 'a',
      });
    }
    for (const g of featuredGroups) {
      out.push({
        key: `g-${g.id}`,
        kind: 'group',
        kindLabel: 'گروه',
        href: `/groups/${encodeURIComponent(g.id)}`,
        name: g.name,
        description: g.description,
        tone: 'b',
      });
    }
    for (const c of featuredChannels) {
      out.push({
        key: `c-${c.id}`,
        kind: 'channel',
        kindLabel: 'کانال',
        href: `/channels/${encodeURIComponent(c.id)}`,
        name: c.name,
        description: c.description,
        tone: 'c',
      });
    }
    return out;
  }, [featuredNetworks, featuredGroups, featuredChannels]);

  const useFallbackUtilities = !loading && coreLinks.length === 0;

  return (
    <AuthGate>
      <main className="mx-auto w-full max-w-md px-3 pb-10 pt-4 bg-[var(--bg-page)] min-h-[100dvh]" dir="rtl">
        {error ? (
          <p
            className="mb-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--accent-hover)]"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {/* 1. Utility 4-grid */}
        <section aria-labelledby="vitrin-utilities" className="mb-5">
          <h2 id="vitrin-utilities" className="sr-only">سرویس‌های اصلی</h2>
          {loading && coreLinks.length === 0 ? (
            <ul className="grid grid-cols-4 gap-2.5" aria-hidden>
              {[0, 1, 2, 3].map((i) => (
                <li
                  key={i}
                  className="h-[5.25rem] animate-pulse rounded-2xl border border-[var(--line)] bg-[var(--surface-2)]"
                />
              ))}
            </ul>
          ) : (
            <ul className="grid grid-cols-4 gap-2.5">
              {(useFallbackUtilities
                ? VITRIN_CATALOG.map((e) => ({
                    key: e.key as string,
                    glyphId: e.id,
                    title: e.title,
                    href: `/vitrin/web?entry=${encodeURIComponent(e.id)}`,
                  }))
                : coreLinks.map((item) => {
                    const fallback = fallbackByKey.get(item.key);
                    return {
                      key: item.key as string,
                      glyphId: fallback?.id ?? item.key.toLowerCase(),
                      title: item.title,
                      href: `/vitrin/web?entry=${encodeURIComponent(item.key)}`,
                    };
                  })
              ).map((u) => {
                const tone = UTILITY_TONES[u.glyphId] ?? UTILITY_TONES.iranregions;
                return (
                  <li key={u.key}>
                    <Link
                      href={u.href}
                      className="flex h-full flex-col items-center gap-1.5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-1.5 py-2.5 text-center transition active:scale-[0.97]"
                    >
                      <span
                        className="flex h-10 w-10 items-center justify-center rounded-xl"
                        style={{ background: tone.tile, color: tone.icon }}
                        aria-hidden
                      >
                        <VitrinGlyph id={u.glyphId} />
                      </span>
                      <span className="line-clamp-2 text-[11px] font-bold leading-snug text-[var(--ink)]">
                        {u.title}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* 2. هشدارها و خبرها */}
        {publishedAnnouncements.length > 0 ? (
          <section aria-labelledby="vitrin-alerts" className="mb-5">
            <div className="mb-2 flex items-baseline justify-between px-1">
              <h2 id="vitrin-alerts" className="text-[15px] font-extrabold text-[var(--ink)]">هشدارها و خبرها</h2>
              <span className="text-[12px] font-bold text-[var(--accent-hover)]">
                {formatCount(publishedAnnouncements.length)} مورد
              </span>
            </div>
            <ul className="space-y-2.5">
              {publishedAnnouncements.map((item) => {
                const tone = classifyAnnouncementTone(item);
                const color = ALERT_TONES[tone].color;
                return (
                  <li key={item.id}>
                    <article
                      className="flex items-start gap-2.5 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3"
                      style={{ borderInlineStart: `3px solid ${color}` }}
                    >
                      <span
                        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-2)]"
                        style={{ color }}
                        aria-hidden
                      >
                        <AlertGlyph tone={tone} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-bold leading-tight text-[var(--ink)]">{item.title}</p>
                        <p className="mt-1 line-clamp-3 text-[11.5px] leading-relaxed text-[var(--ink-3)]">{item.body}</p>
                        <p className="mt-1.5 text-[10.5px] tabular-nums text-[var(--ink-4)]">
                          {tone === 'local' ? 'اعلان محلی' : tone === 'warning' ? 'هشدار' : 'باماخبر'}
                        </p>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {/* 3. Story rail (compact) */}
        {storyLoading || storyItems.length > 0 ? (
          <div className="mb-5 -mx-1">
            <StoryCuratedRail scope="today" loading={storyLoading} items={storyItems} />
          </div>
        ) : null}

        {/* 4. فضاهای برجسته as horizontal service-row */}
        {featuredItems.length > 0 ? (
          <section aria-labelledby="vitrin-spaces" className="mb-3">
            <div className="mb-2 flex items-baseline justify-between px-1">
              <h2 id="vitrin-spaces" className="text-[15px] font-extrabold text-[var(--ink)]">فضاهای برجسته</h2>
              <Link
                href="/spaces"
                className="text-[12px] font-bold text-[var(--accent-hover)]"
              >
                همه
              </Link>
            </div>
            <ul className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1 [&::-webkit-scrollbar]:hidden">
              {featuredItems.slice(0, 12).map((item) => (
                <li key={item.key} className="shrink-0">
                  <Link
                    href={item.href}
                    className="block w-[10rem] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] transition active:scale-[0.99]"
                  >
                    <div className={`h-20 w-full ${
                      item.tone === 'a'
                        ? 'bg-[linear-gradient(135deg,#EADFD2,#D1B28E)]'
                        : item.tone === 'b'
                          ? 'bg-[linear-gradient(135deg,#DFE9DC,#A5C5A0)]'
                          : 'bg-[linear-gradient(135deg,#DCE5EE,#A5B8CA)]'
                    }`} aria-hidden />
                    <div className="p-2.5">
                      <p className="line-clamp-1 text-[12px] font-bold text-[var(--ink)]">{item.name}</p>
                      <p className="mt-0.5 line-clamp-1 text-[10.5px] text-[var(--ink-3)]">
                        {item.description?.trim() || item.kindLabel}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </AuthGate>
  );
}

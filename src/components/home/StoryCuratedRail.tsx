'use client';

import Link from 'next/link';
import { toFaDigits } from '@/lib/format';

/**
 * Curated story rail mounted above the home feed.
 *
 * Inputs are the published-candidate shape returned by GET /story/published.
 * After backend commit 18ee602f, internal candidates arrive with rewritten
 * app routes (/home?postId=…, /groups/…, /channels/…) instead of internal://
 * pseudo-URLs, so we can drive them through next/link cleanly.
 */

type StoryItem = {
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

type Scope = 'today' | 'local' | 'networks';

function toRelativeFa(input?: string | null) {
  if (!input) return 'بدون زمان';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return 'بدون زمان';
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'همین حالا';
  if (minutes < 60) return `${toFaDigits(minutes)} دقیقه پیش`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${toFaDigits(hours)} ساعت پیش`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${toFaDigits(days)} روز پیش`;
  return date.toLocaleDateString('fa-IR');
}

function scopeLabel(scope: Scope) {
  if (scope === 'local') return 'محله من';
  if (scope === 'networks') return 'شبکه‌ها';
  return 'امروز';
}

function scopeHeader(scope: Scope) {
  if (scope === 'local') return 'گزیده محله';
  if (scope === 'networks') return 'گزیده شبکه‌ها';
  return 'گزیده امروز';
}

function kindLabel(kind?: StoryItem['storyKind']) {
  if (kind === 'LOCAL') return 'محله';
  if (kind === 'NETWORK') return 'شبکه';
  return 'امروز';
}

/** True when the rewritten URL is an internal app route. Lets the rail use
 *  next/link for prefetch + soft navigation; external URLs keep the new-tab
 *  <a target="_blank"> behaviour. */
function isInternalRoute(url: string): boolean {
  return url.startsWith('/');
}

export function StoryCuratedRail({
  scope,
  loading,
  items,
}: {
  scope: Scope;
  loading: boolean;
  items: StoryItem[];
}) {
  return (
    <section className="mx-2 mt-2.5">
      <div className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
        <div className="flex items-center justify-between px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-hover)]"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5V5a1 1 0 0 1 1-1h12a3 3 0 0 1 3 3v14.5l-4-2-4 2-4-2-4 2Z" />
              </svg>
            </span>
            <p className="text-xs font-extrabold text-[var(--ink)]">{scopeHeader(scope)}</p>
          </div>
          <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-bold text-[var(--ink-3)]">
            {scopeLabel(scope)}
          </span>
        </div>

        {loading ? (
          <div className="px-3 pb-3" aria-busy>
            <div className="flex gap-2.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-[10.5rem] w-[78vw] max-w-[18rem] shrink-0 animate-pulse rounded-xl border border-[var(--line)] bg-[var(--surface-2)]"
                />
              ))}
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="px-3 pb-3">
            <p className="text-[11px] text-[var(--ink-3)]">
              هنوز گزیده‌ای برای این بخش نیست.
            </p>
          </div>
        ) : (
          <div className="no-scrollbar overflow-x-auto px-3 pb-3">
            <div className="flex gap-2.5">
              {items.map((item) => {
                const href = item.url?.trim() || null;
                const internal = href ? isInternalRoute(href) : false;
                const cardCls =
                  'block w-[78vw] max-w-[18rem] shrink-0 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] transition hover:bg-[var(--surface-2)]/60';

                const inner = (
                  <>
                    <div className="relative h-24 w-full overflow-hidden bg-[var(--surface-2)]">
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-1">
                          <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[10px] font-bold text-[var(--ink-3)]">
                            {item.category || 'گزیده'}
                          </span>
                          <span className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[10px] font-semibold text-[var(--ink-3)]">
                            {item.source.name.slice(0, 18)}
                          </span>
                        </div>
                      )}
                      <span className="absolute right-2 top-2 rounded-full bg-[var(--ink)]/55 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        {toRelativeFa(item.publishedAt)}
                      </span>
                    </div>
                    <div className="px-2.5 py-2">
                      <div className="mb-1 flex items-center gap-1.5">
                        <span className="rounded-full bg-[var(--accent-soft)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--accent-hover)]">
                          {kindLabel(item.storyKind)}
                        </span>
                        {item.trustLabel ? (
                          <span className="rounded-full bg-[var(--surface-2)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--ink-3)]">
                            {item.trustLabel}
                          </span>
                        ) : null}
                      </div>
                      <p className="line-clamp-2 text-[12px] font-bold text-[var(--ink)]">
                        {item.title}
                      </p>
                      <p className="mt-1 line-clamp-2 text-[11px] text-[var(--ink-2)]">
                        {item.summary || 'گزیده کوتاه در دسترس نیست.'}
                      </p>
                      <div className="mt-1.5 flex items-center justify-between gap-1">
                        <p className="line-clamp-1 text-[10px] font-semibold text-[var(--accent-hover)]">
                          {item.source.name}
                        </p>
                        <span className="text-[9px] text-[var(--ink-3)]">
                          {toRelativeFa(item.publishedAt)}
                        </span>
                      </div>
                    </div>
                  </>
                );

                if (!href) {
                  return (
                    <div key={item.id} className={cardCls}>
                      {inner}
                    </div>
                  );
                }
                if (internal) {
                  return (
                    <Link key={item.id} href={href} prefetch={false} className={cardCls}>
                      {inner}
                    </Link>
                  );
                }
                return (
                  <a
                    key={item.id}
                    href={href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={cardCls}
                  >
                    {inner}
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

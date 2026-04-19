'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

type Props = {
  channelId: string;
  networkId: string;
  canShowComposer: boolean;
  canManageSchedule: boolean;
  canManagePins: boolean;
  onOpenTools: () => void;
  /** Scroll the timeline panel to top (فید) */
  scrollTimelineToTop: () => void;
};

/**
 * Fixed action row — does not scroll with messages; extras live under "بیشتر".
 */
export function ChannelActionStrip({
  channelId,
  networkId,
  canShowComposer,
  canManageSchedule,
  canManagePins,
  onOpenTools,
  scrollTimelineToTop,
}: Props) {
  const [moreOpen, setMoreOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return;
    function close(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setMoreOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [moreOpen]);

  const scrollToComposer = useCallback(() => {
    document.getElementById('channel-composer-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  return (
    <div className="theme-panel-bg z-20 flex shrink-0 items-center gap-1.5 border-b border-[var(--border-soft)] px-2 py-1.5 shadow-[0_1px_0_rgba(0,0,0,0.03)] backdrop-blur-md">
      <button
        type="button"
        onClick={onOpenTools}
        className="flex shrink-0 items-center gap-0.5 rounded-full border border-slate-200/90 bg-white px-2 py-1.5 text-[10px] font-extrabold text-slate-800 shadow-sm hover:bg-slate-50"
      >
        <span aria-hidden>🧰</span>
        ابزارها
      </button>
      <Link
        href="/search"
        className="flex shrink-0 items-center rounded-full border border-slate-200/90 bg-white px-2 py-1.5 text-[10px] font-extrabold text-slate-800 shadow-sm hover:bg-slate-50"
      >
        جستجو
      </Link>
      <button
        type="button"
        onClick={() => scrollTimelineToTop()}
        className="flex shrink-0 items-center rounded-full border border-slate-200/90 bg-white px-2 py-1.5 text-[10px] font-extrabold text-slate-800 shadow-sm hover:bg-slate-50"
      >
        فید
      </button>
      {canShowComposer ? (
        <button
          type="button"
          onClick={scrollToComposer}
          className="flex shrink-0 items-center rounded-full border border-violet-400/90 bg-violet-600 px-2 py-1.5 text-[10px] font-extrabold text-white shadow-sm hover:bg-violet-700"
        >
          انتشار
        </button>
      ) : null}
      <div className="relative ms-auto shrink-0" ref={wrapRef}>
        <button
          type="button"
          onClick={() => setMoreOpen((o) => !o)}
          className="rounded-full border border-slate-200/90 bg-white px-2.5 py-1.5 text-[12px] font-bold text-slate-700 shadow-sm hover:bg-slate-50"
          aria-expanded={moreOpen}
          aria-haspopup="menu"
        >
          ⋯
        </button>
        {moreOpen ? (
          <div
            className="theme-panel-bg absolute left-0 top-full z-50 mt-1 min-w-[11.5rem] rounded-xl border border-[var(--border-soft)] py-1 shadow-lg"
            role="menu"
          >
            <Link
              href={`/networks/${networkId}`}
              className="block px-3 py-2 text-right text-[11px] font-bold text-[var(--text-primary)] hover:bg-[var(--surface-soft)]"
              onClick={() => setMoreOpen(false)}
            >
              دربارهٔ شبکه
            </Link>
            {canManageSchedule ? (
              <Link
                href={`/channels/${encodeURIComponent(channelId)}/scheduled`}
                className="block px-3 py-2 text-right text-[11px] font-bold text-[var(--text-primary)] hover:bg-[var(--surface-soft)]"
                onClick={() => setMoreOpen(false)}
              >
                زمان‌بندی انتشار
              </Link>
            ) : null}
            {canManagePins ? (
              <Link
                href={`/channels/${encodeURIComponent(channelId)}/analytics`}
                className="block px-3 py-2 text-right text-[11px] font-bold text-[var(--text-primary)] hover:bg-[var(--surface-soft)]"
                onClick={() => setMoreOpen(false)}
              >
                آمار کانال
              </Link>
            ) : null}
            <Link
              href="/spaces"
              className="block px-3 py-2 text-right text-[11px] font-bold text-[var(--accent-hover)] hover:bg-[var(--surface-soft)]"
              onClick={() => setMoreOpen(false)}
            >
              فضاها
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchCapabilityLinksForTarget, type LinkedCapabilityRow } from '@/lib/capabilityLinks';
import type { ChannelMsg } from './channelTypes';
import { ChannelPublicationCard } from './ChannelPublicationCard';

function pickFeaturedLink(rows: LinkedCapabilityRow[]): LinkedCapabilityRow | null {
  const ok = rows.filter((r) => r.resolved.ok);
  if (!ok.length) return null;
  const bulletin = ok.find((r) => r.resolved.ok && r.resolved.kind === 'BULLETIN');
  if (bulletin) return bulletin;
  const pollOpen = ok.find((r) => r.resolved.ok && r.resolved.kind === 'POLL' && !r.resolved.effectiveClosed);
  if (pollOpen) return pollOpen;
  const job = ok.find((r) => r.resolved.ok && r.resolved.kind === 'JOB');
  if (job) return job;
  const form = ok.find((r) => r.resolved.ok && r.resolved.kind === 'FORM');
  if (form) return form;
  const project = ok.find((r) => r.resolved.ok && r.resolved.kind === 'PROJECT');
  if (project) return project;
  const listing = ok.find((r) => r.resolved.ok && r.resolved.kind === 'BUSINESS_LISTING');
  if (listing) return listing;
  const pollAny = ok.find((r) => r.resolved.ok && r.resolved.kind === 'POLL');
  return pollAny ?? null;
}

function LinkFeaturedCard({ row }: { row: LinkedCapabilityRow }) {
  const r = row.resolved;
  if (!r.ok) return null;
  const base =
    'group relative block overflow-hidden rounded-2xl border-2 border-amber-400/40 bg-[linear-gradient(125deg,rgba(251,191,36,0.12)_0%,rgba(255,255,255,0)_48%)] p-4 text-right shadow-lg transition hover:border-amber-500/55 hover:shadow-xl';
  if (r.kind === 'BULLETIN') {
    return (
      <Link href={r.href} className={base}>
        <p className="text-[11px] font-black text-amber-900">📌 اطلاعیه مهم</p>
        <p className="mt-2 line-clamp-3 text-[15px] font-bold leading-snug text-[var(--text-primary)]">{r.title}</p>
        <span className="mt-3 inline-block text-[11px] font-bold text-[var(--accent-hover)]">مشاهده →</span>
      </Link>
    );
  }
  if (r.kind === 'POLL') {
    return (
      <Link href={r.href} className={base}>
        <p className="text-[11px] font-black text-violet-900">🗳 نظرسنجی {r.effectiveClosed ? '' : 'فعال'}</p>
        <p className="mt-2 line-clamp-3 text-[15px] font-bold leading-snug text-[var(--text-primary)]">{r.title}</p>
        <span className="mt-3 inline-block text-[11px] font-bold text-[var(--accent-hover)]">شرکت در نظرسنجی →</span>
      </Link>
    );
  }
  if (r.kind === 'JOB') {
    return (
      <Link href={r.href} className={base}>
        <p className="text-[11px] font-black text-sky-900">💼 فرصت شغلی ویژه</p>
        <p className="mt-2 line-clamp-2 text-[15px] font-bold text-[var(--text-primary)]">{r.title}</p>
        <p className="mt-1 text-[12px] text-[var(--text-secondary)]">{r.companyName}</p>
        <span className="mt-3 inline-block text-[11px] font-bold text-[var(--accent-hover)]">جزئیات آگهی →</span>
      </Link>
    );
  }
  if (r.kind === 'FORM') {
    return (
      <Link href={r.href} className={base}>
        <p className="text-[11px] font-black text-emerald-900">📄 فرم ثبت‌نام / مشارکت</p>
        <p className="mt-2 line-clamp-3 text-[15px] font-bold leading-snug text-[var(--text-primary)]">{r.title}</p>
        <span className="mt-3 inline-block text-[11px] font-bold text-[var(--accent-hover)]">پر کردن فرم →</span>
      </Link>
    );
  }
  if (r.kind === 'PROJECT') {
    return (
      <Link href={r.href} className={base}>
        <p className="text-[11px] font-black text-indigo-900">📁 پروژه</p>
        <p className="mt-2 line-clamp-2 text-[15px] font-bold text-[var(--text-primary)]">{r.title}</p>
        <span className="mt-3 inline-block text-[11px] font-bold text-[var(--accent-hover)]">باز کردن →</span>
      </Link>
    );
  }
  if (r.kind === 'BUSINESS_LISTING') {
    return (
      <Link href={r.href} className={base}>
        <p className="text-[11px] font-black text-slate-800">🏪 معرفی کسب‌وکار</p>
        <p className="mt-2 line-clamp-2 text-[15px] font-bold text-[var(--text-primary)]">{r.businessName}</p>
        <span className="mt-3 inline-block text-[11px] font-bold text-[var(--accent-hover)]">مشاهده →</span>
      </Link>
    );
  }
  return null;
}

type Props = {
  channelId: string;
  /** Newest message in chronological feed (last item) */
  newestPost: ChannelMsg | null;
  onOpenTools: () => void;
  canPost: boolean;
  /** When the zone highlights the latest post (no link won), parent hides that id from the timeline */
  onTimelineExcludeId?: (messageId: string | null) => void;
};

/**
 * Priority: linked bulletin → active poll → job → form → project → listing → poll closed → latest post → empty.
 */
export function ChannelFeaturedZone({
  channelId,
  newestPost,
  onOpenTools,
  canPost,
  onTimelineExcludeId,
}: Props) {
  const [rows, setRows] = useState<LinkedCapabilityRow[] | null>(null);

  const load = useCallback(async () => {
    if (!channelId) return;
    try {
      const res = await fetchCapabilityLinksForTarget('CHANNEL', channelId);
      setRows(res.data);
    } catch {
      setRows([]);
    }
  }, [channelId]);

  useEffect(() => {
    void load();
  }, [load]);

  const featuredLink = useMemo(() => (rows ? pickFeaturedLink(rows) : null), [rows]);

  useEffect(() => {
    if (rows === null) return;
    if (featuredLink) {
      onTimelineExcludeId?.(null);
    } else if (newestPost) {
      onTimelineExcludeId?.(newestPost.id);
    } else {
      onTimelineExcludeId?.(null);
    }
  }, [rows, featuredLink, newestPost, onTimelineExcludeId]);

  const showLatestPostCard = !featuredLink && !!newestPost;

  if (rows === null) {
    return (
      <section className="rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--surface-soft)]/50 px-4 py-4">
        <p className="text-[11px] text-[var(--text-secondary)]">در حال آماده‌سازی بخش ویژه…</p>
      </section>
    );
  }

  if (featuredLink) {
    return (
      <section aria-label="محتوای ویژه کانال">
        <div className="mb-2 flex items-center justify-between px-0.5">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--text-secondary)]">ویژه</p>
          <button type="button" onClick={onOpenTools} className="text-[10px] font-bold text-[var(--accent-hover)] hover:underline">
            مدیریت ابزارها
          </button>
        </div>
        <LinkFeaturedCard row={featuredLink} />
      </section>
    );
  }

  if (showLatestPostCard && newestPost) {
    return (
      <section aria-label="آخرین انتشار">
        <div className="mb-2 flex items-center justify-between px-0.5">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--text-secondary)]">تازه‌ترین انتشار</p>
        </div>
        <ChannelPublicationCard message={newestPost} variant="featured" broadcastLabel="ویژه · انتشار" />
      </section>
    );
  }

  return (
    <section className="rounded-2xl border-2 border-dashed border-[var(--border-soft)] bg-[var(--surface-soft)]/70 px-4 py-5 text-center shadow-inner">
      <p className="text-[22px] leading-none" aria-hidden>
        📻
      </p>
      <p className="mt-3 text-[13px] font-bold text-[var(--text-primary)]">هنوز محتوای ویژه‌ای برای نمایش نیست</p>
      <p className="theme-text-secondary mt-2 text-[12px] leading-relaxed">
        با ابزارها نظرسنجی، اطلاعیه یا فرم را به کانال وصل کنید، یا {canPost ? 'اولین انتشار را بنویسید' : 'منتظر انتشار تیم باشید'}.
      </p>
      <button
        type="button"
        onClick={onOpenTools}
        className="mt-4 rounded-full border border-[var(--border-soft)] bg-[var(--card-bg)] px-4 py-2 text-[11px] font-extrabold text-[var(--accent-hover)] shadow-sm transition hover:bg-[var(--surface-soft)]"
      >
        باز کردن ابزارهای کانال
      </button>
    </section>
  );
}

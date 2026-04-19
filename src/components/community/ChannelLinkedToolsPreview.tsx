'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { fetchCapabilityLinksForTarget, type LinkedCapabilityRow } from '@/lib/capabilityLinks';

function CompactRow({ row }: { row: LinkedCapabilityRow }) {
  const r = row.resolved;
  if (!r.ok) return null;
  if (r.kind === 'POLL') {
    return (
      <Link
        href={r.href}
        className="group flex items-start gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2.5 shadow-sm transition hover:bg-[var(--surface-strong)]"
      >
        <span className="text-lg leading-none" aria-hidden>
          📊
        </span>
        <div className="min-w-0 flex-1 text-right">
          <p className="text-[10px] font-extrabold text-[var(--accent-hover)]">نظرسنجی</p>
          <p className="mt-0.5 line-clamp-2 text-[12px] font-bold text-[var(--text-primary)]">{r.title}</p>
          <p className="mt-0.5 text-[10px] text-[var(--text-secondary)]">{r.effectiveClosed ? 'پایان‌یافته' : 'فعال'}</p>
        </div>
        <span className="shrink-0 text-[10px] font-bold text-[var(--accent-hover)] opacity-0 transition group-hover:opacity-100">
          ←
        </span>
      </Link>
    );
  }
  if (r.kind === 'BULLETIN') {
    return (
      <Link
        href={r.href}
        className="group flex items-start gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2.5 shadow-sm transition hover:bg-[var(--surface-strong)]"
      >
        <span className="text-lg leading-none" aria-hidden>
          📌
        </span>
        <div className="min-w-0 flex-1 text-right">
          <p className="text-[10px] font-extrabold text-[var(--accent-hover)]">اطلاعیه</p>
          <p className="mt-0.5 line-clamp-2 text-[12px] font-bold text-[var(--text-primary)]">{r.title}</p>
        </div>
        <span className="shrink-0 text-[10px] font-bold text-[var(--accent-hover)] opacity-0 transition group-hover:opacity-100">
          ←
        </span>
      </Link>
    );
  }
  if (r.kind === 'FORM') {
    return (
      <Link
        href={r.href}
        className="group flex items-start gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2.5 shadow-sm transition hover:bg-[var(--surface-strong)]"
      >
        <span className="text-lg leading-none" aria-hidden>
          📋
        </span>
        <div className="min-w-0 flex-1 text-right">
          <p className="text-[10px] font-extrabold text-[var(--accent-hover)]">فرم</p>
          <p className="mt-0.5 line-clamp-2 text-[12px] font-bold text-[var(--text-primary)]">{r.title}</p>
        </div>
        <span className="shrink-0 text-[10px] font-bold text-[var(--accent-hover)] opacity-0 transition group-hover:opacity-100">
          ←
        </span>
      </Link>
    );
  }
  if (r.kind === 'JOB') {
    return (
      <Link
        href={r.href}
        className="group flex items-start gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2.5 shadow-sm transition hover:bg-[var(--surface-strong)]"
      >
        <span className="text-lg leading-none" aria-hidden>
          💼
        </span>
        <div className="min-w-0 flex-1 text-right">
          <p className="text-[10px] font-extrabold text-[var(--accent-hover)]">فرصت شغلی</p>
          <p className="mt-0.5 line-clamp-2 text-[12px] font-bold text-[var(--text-primary)]">{r.title}</p>
          <p className="mt-0.5 text-[10px] text-[var(--text-secondary)]">{r.companyName}</p>
        </div>
        <span className="shrink-0 text-[10px] font-bold text-[var(--accent-hover)] opacity-0 transition group-hover:opacity-100">
          ←
        </span>
      </Link>
    );
  }
  if (r.kind === 'PROJECT') {
    return (
      <Link
        href={r.href}
        className="group flex items-start gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2.5 shadow-sm transition hover:bg-[var(--surface-strong)]"
      >
        <span className="text-lg leading-none" aria-hidden>
          📁
        </span>
        <div className="min-w-0 flex-1 text-right">
          <p className="text-[10px] font-extrabold text-[var(--accent-hover)]">پروژه</p>
          <p className="mt-0.5 line-clamp-2 text-[12px] font-bold text-[var(--text-primary)]">{r.title}</p>
        </div>
        <span className="shrink-0 text-[10px] font-bold text-[var(--accent-hover)] opacity-0 transition group-hover:opacity-100">
          ←
        </span>
      </Link>
    );
  }
  if (r.kind === 'BUSINESS_LISTING') {
    return (
      <Link
        href={r.href}
        className="group flex items-start gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2.5 shadow-sm transition hover:bg-[var(--surface-strong)]"
      >
        <span className="text-lg leading-none" aria-hidden>
          🏪
        </span>
        <div className="min-w-0 flex-1 text-right">
          <p className="text-[10px] font-extrabold text-[var(--accent-hover)]">کسب‌وکار</p>
          <p className="mt-0.5 line-clamp-2 text-[12px] font-bold text-[var(--text-primary)]">{r.businessName}</p>
        </div>
        <span className="shrink-0 text-[10px] font-bold text-[var(--accent-hover)] opacity-0 transition group-hover:opacity-100">
          ←
        </span>
      </Link>
    );
  }
  return null;
}

type Props = {
  channelId: string;
  maxItems?: number;
  onOpenTools: () => void;
};

/** Compact linked-capability strip above the timeline — real data only, max N items. */
export function ChannelLinkedToolsPreview({ channelId, maxItems = 2, onOpenTools }: Props) {
  const [rows, setRows] = useState<LinkedCapabilityRow[] | null>(null);

  const load = useCallback(async () => {
    if (!channelId) return;
    try {
      const res = await fetchCapabilityLinksForTarget('CHANNEL', channelId);
      setRows(res.data.filter((r) => r.resolved.ok));
    } catch {
      setRows([]);
    }
  }, [channelId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!channelId || rows === null) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--card-bg)]/60 px-3 py-2.5">
        <p className="text-[11px] text-[var(--text-secondary)]">در حال بارگذاری ابزارهای مرتبط…</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <button
        type="button"
        onClick={onOpenTools}
        className="w-full rounded-2xl border border-dashed border-[var(--border-soft)] bg-gradient-to-l from-[var(--surface-soft)] to-transparent px-3 py-3 text-right shadow-sm transition hover:border-[var(--accent)]/30"
      >
        <p className="text-[11px] font-extrabold text-[var(--text-primary)]">ابزارهای مرتبط</p>
        <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-secondary)]">
          هنوز ابزاری به این کانال وصل نشده. برای نظرسنجی، اطلاعیه یا فرم، یک‌بار تپ کنید و از پنل ابزارها لینک دهید.
        </p>
      </button>
    );
  }

  const shown = rows.slice(0, maxItems);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <p className="text-[10px] font-extrabold uppercase tracking-wide text-[var(--text-secondary)]">ابزار و محتوای مرتبط</p>
        <button type="button" onClick={onOpenTools} className="text-[10px] font-bold text-[var(--accent-hover)] hover:underline">
          همه در ابزارها
        </button>
      </div>
      <ul className="space-y-2">
        {shown.map((row) => (
          <li key={row.id}>
            <CompactRow row={row} />
          </li>
        ))}
      </ul>
    </div>
  );
}

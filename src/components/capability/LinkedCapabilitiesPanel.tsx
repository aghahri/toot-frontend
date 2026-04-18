'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getCurrentUserIdFromAccessToken } from '@/lib/auth';
import {
  deleteCapabilityLink,
  fetchCapabilityLinksForTarget,
  type CapabilityTargetKind,
  type LinkedCapabilityRow,
} from '@/lib/capabilityLinks';
import { BULLETIN_KIND_LABELS } from '@/lib/neighborhoodPack';

const CARD =
  'rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3 text-right ring-1 ring-[var(--border-soft)]';

function ResolvedCard({ row }: { row: LinkedCapabilityRow }) {
  const r = row.resolved;
  if (!r.ok) {
    return (
      <div className={CARD}>
        <p className="text-[11px] font-bold text-[var(--text-secondary)]">محتوای اصلی دیگر در دسترس نیست</p>
        <p className="mt-1 text-[10px] text-[var(--text-secondary)]">نوع: {row.capabilityType}</p>
      </div>
    );
  }
  if (r.kind === 'POLL') {
    return (
      <div className={CARD}>
        <p className="text-[10px] font-extrabold text-[var(--accent-hover)]">📊 نظرسنجی محله</p>
        <p className="mt-1 text-sm font-bold text-[var(--text-primary)]">{r.title}</p>
        <p className="mt-1 text-[10px] text-[var(--text-secondary)]">
          {r.effectiveClosed ? 'پایان یافته' : 'فعال'}
        </p>
        <Link href={r.href} className="mt-2 inline-block text-[11px] font-extrabold text-[var(--accent-hover)] underline">
          مشاهده نظرسنجی
        </Link>
      </div>
    );
  }
  if (r.kind === 'BULLETIN') {
    return (
      <div className={CARD}>
        <p className="text-[10px] font-extrabold text-[var(--accent-hover)]">📌 اطلاعیه محله</p>
        <p className="mt-1 text-sm font-bold text-[var(--text-primary)]">{r.title}</p>
        <p className="mt-1 text-[10px] text-[var(--text-secondary)]">
          {BULLETIN_KIND_LABELS[r.bulletinKind as keyof typeof BULLETIN_KIND_LABELS] ?? r.bulletinKind}
        </p>
        <Link href={r.href} className="mt-2 inline-block text-[11px] font-extrabold text-[var(--accent-hover)] underline">
          مشاهده اطلاعیه
        </Link>
      </div>
    );
  }
  if (r.kind === 'FORM') {
    return (
      <div className={CARD}>
        <p className="text-[10px] font-extrabold text-[var(--accent-hover)]">📋 فرم محله</p>
        <p className="mt-1 text-sm font-bold text-[var(--text-primary)]">{r.title}</p>
        {r.description ? (
          <p className="mt-1 line-clamp-2 text-[11px] text-[var(--text-secondary)]">{r.description}</p>
        ) : null}
        <Link href={r.href} className="mt-2 inline-block text-[11px] font-extrabold text-[var(--accent-hover)] underline">
          پر کردن / مشاهده فرم
        </Link>
      </div>
    );
  }
  if (r.kind === 'JOB') {
    return (
      <div className={CARD}>
        <p className="text-[10px] font-extrabold text-[var(--accent-hover)]">💼 فرصت شغلی</p>
        <p className="mt-1 text-sm font-bold text-[var(--text-primary)]">{r.title}</p>
        <p className="mt-1 text-[11px] text-[var(--text-secondary)]">{r.companyName}</p>
        <Link href={r.href} className="mt-2 inline-block text-[11px] font-extrabold text-[var(--accent-hover)] underline">
          مشاهده آگهی
        </Link>
      </div>
    );
  }
  if (r.kind === 'PROJECT') {
    return (
      <div className={CARD}>
        <p className="text-[10px] font-extrabold text-[var(--accent-hover)]">📌 پروژه</p>
        <p className="mt-1 text-sm font-bold text-[var(--text-primary)]">{r.title}</p>
        <p className="mt-1 text-[10px] text-[var(--text-secondary)]">وضعیت: {r.status}</p>
        <Link href={r.href} className="mt-2 inline-block text-[11px] font-extrabold text-[var(--accent-hover)] underline">
          باز کردن پروژه
        </Link>
      </div>
    );
  }
  if (r.kind === 'BUSINESS_LISTING') {
    return (
      <div className={CARD}>
        <p className="text-[10px] font-extrabold text-[var(--accent-hover)]">🏪 کسب‌وکار</p>
        <p className="mt-1 text-sm font-bold text-[var(--text-primary)]">{r.businessName}</p>
        <p className="mt-1 text-[11px] text-[var(--text-secondary)]">{r.category}</p>
        <Link href={r.href} className="mt-2 inline-block text-[11px] font-extrabold text-[var(--accent-hover)] underline">
          مشاهده معرفی
        </Link>
      </div>
    );
  }
  return null;
}

export type LinkedCapabilitiesPanelProps = {
  targetType: CapabilityTargetKind;
  targetId: string;
  title?: string;
  className?: string;
  /** When true, show a friendly empty state instead of hiding. */
  showWhenEmpty?: boolean;
  emptyHint?: string;
  /** Lighter chrome when embedded in a bottom sheet */
  variant?: 'card' | 'plain';
};

export function LinkedCapabilitiesPanel({
  targetType,
  targetId,
  title = 'ابزارهای مرتبط',
  className = '',
  showWhenEmpty = false,
  emptyHint = 'ابزاری متصل نشده است. از صفحهٔ نظرسنجی، اطلاعیه یا فرم محله می‌توانید لینک بدهید.',
  variant = 'card',
}: LinkedCapabilitiesPanelProps) {
  const [rows, setRows] = useState<LinkedCapabilityRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!targetId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchCapabilityLinksForTarget(targetType, targetId);
      setRows(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [targetType, targetId]);

  useEffect(() => {
    void load();
  }, [load]);

  const viewerId = getCurrentUserIdFromAccessToken();

  async function onRemove(linkId: string) {
    setRemoving(linkId);
    setError(null);
    try {
      await deleteCapabilityLink(linkId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'حذف ممکن نیست');
    } finally {
      setRemoving(null);
    }
  }

  if (!targetId) return null;

  const wrapClass =
    variant === 'plain'
      ? `p-1 ${className}`
      : `rounded-2xl border border-[var(--border-soft)] bg-[var(--card-bg)] p-3 shadow-sm ${className}`;

  if (loading) {
    return (
      <section className={wrapClass} dir="rtl">
        <p className="text-[11px] text-[var(--text-secondary)]">در حال بارگذاری…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className={`rounded-2xl border border-amber-200/80 bg-amber-500/10 p-3 ${className}`} dir="rtl">
        <p className="text-[11px] font-semibold text-amber-900">{error}</p>
      </section>
    );
  }

  if (!rows || rows.length === 0) {
    if (!showWhenEmpty) return null;
    return (
      <section className={wrapClass} dir="rtl">
        {title ? <h2 className="text-[11px] font-extrabold text-[var(--text-secondary)]">{title}</h2> : null}
        <p className="mt-2 text-[12px] leading-relaxed text-[var(--text-secondary)]">{emptyHint}</p>
      </section>
    );
  }

  return (
    <section className={wrapClass} dir="rtl">
      {title ? (
        <h2 className="text-[11px] font-extrabold text-[var(--text-secondary)]">{title}</h2>
      ) : null}
      <ul className={`space-y-2 ${title ? 'mt-2' : ''}`}>
        {rows.map((row) => (
          <li key={row.id} className="relative">
            <ResolvedCard row={row} />
            {viewerId && row.linkedBy.id === viewerId ? (
              <button
                type="button"
                disabled={removing === row.id}
                onClick={() => void onRemove(row.id)}
                className="mt-1 text-[10px] font-bold text-[var(--text-secondary)] hover:text-red-600 disabled:opacity-50"
              >
                {removing === row.id ? '…' : 'حذف لینک'}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

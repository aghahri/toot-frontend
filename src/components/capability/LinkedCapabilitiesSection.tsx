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

type Props = {
  targetType: CapabilityTargetKind;
  targetId: string;
  /** Optional title override */
  title?: string;
  className?: string;
};

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
        <p className="text-[10px] font-extrabold text-[var(--accent-hover)]">نظرسنجی محله</p>
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
        <p className="text-[10px] font-extrabold text-[var(--accent-hover)]">اطلاعیه محله</p>
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
  return (
    <div className={CARD}>
      <p className="text-[10px] font-extrabold text-[var(--accent-hover)]">فرم محله</p>
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

export function LinkedCapabilitiesSection({ targetType, targetId, title = 'ابزارهای مرتبط', className = '' }: Props) {
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

  if (loading) {
    return (
      <section className={`rounded-2xl border border-[var(--border-soft)] bg-[var(--card-bg)] p-3 ${className}`} dir="rtl">
        <p className="text-[11px] text-[var(--text-secondary)]">در حال بارگذاری موارد لینک‌شده…</p>
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

  if (!rows || rows.length === 0) return null;

  return (
    <section className={`rounded-2xl border border-[var(--border-soft)] bg-[var(--card-bg)] p-3 shadow-sm ${className}`} dir="rtl">
      <h2 className="text-[11px] font-extrabold text-[var(--text-secondary)]">{title}</h2>
      <ul className="mt-2 space-y-2">
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

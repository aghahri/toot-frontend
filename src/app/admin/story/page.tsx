'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { formatCount, toFaDigits } from '@/lib/format';

/**
 * Admin: Story candidate queue.
 *
 * Backend `listStoryCandidates` returns the full StoryCandidate row spread by
 * presentCandidate — including viewCount / clickCount added in S2. This page
 * surfaces those telemetry columns plus computes a per-candidate CTR.
 */

type Quality = {
  qualityScore: number;
  titleQualityScore: number;
  mediaQualityScore: number;
  localityScore: number;
  duplicateRiskScore: number;
};

type StoryCandidate = {
  id: string;
  title: string;
  summary: string | null;
  url: string | null;
  category: string | null;
  storyKind?: 'TODAY' | 'LOCAL' | 'NETWORK';
  trustLabel?: string;
  quality?: Quality;
  imageUrl?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PUBLISHED';
  freshnessScore: number;
  trustScore: number;
  relevanceScore: number;
  viewCount: number;
  clickCount: number;
  createdAt: string;
  source: {
    id: string;
    name: string;
    type: string;
    regionScope: string;
    isActive: boolean;
  };
};

type CandidateResponse = {
  data: StoryCandidate[];
  meta: { total: number; limit: number; offset: number; hasMore: boolean };
};

const STATUS_FA: Record<StoryCandidate['status'], string> = {
  PENDING: 'در انتظار',
  APPROVED: 'تأییدشده',
  REJECTED: 'ردشده',
  PUBLISHED: 'منتشرشده',
};

const STATUS_TONE: Record<StoryCandidate['status'], string> = {
  PENDING: 'bg-[var(--surface-2)] text-[var(--ink-2)]',
  APPROVED: 'bg-[var(--accent-soft)] text-[var(--accent-hover)]',
  REJECTED: 'bg-[var(--surface-2)] text-[var(--ink-3)]',
  PUBLISHED: 'bg-[var(--accent)] text-[var(--accent-contrast)]',
};

const KIND_FA = (kind?: StoryCandidate['storyKind']) => {
  if (kind === 'LOCAL') return 'محله';
  if (kind === 'NETWORK') return 'شبکه';
  return 'امروز';
};

function fmtCtr(views: number, clicks: number): string {
  if (!views) return '—';
  const ratio = (clicks / views) * 100;
  return `${toFaDigits(ratio.toFixed(1))}٪`;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fa-IR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

type StatusFilter = 'ALL' | StoryCandidate['status'];

export default function AdminStoryQueuePage() {
  const [items, setItems] = useState<StoryCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionFlash, setActionFlash] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('ALL');

  const load = async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<CandidateResponse>('admin/story/candidates?limit=120', {
        method: 'GET',
        token,
      });
      setItems(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'بارگذاری نامزدها شکست خورد');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const patchStatus = async (id: string, action: 'approve' | 'reject' | 'publish') => {
    const token = getAccessToken();
    if (!token) return;
    setActionFlash(null);
    try {
      await apiFetch(`admin/story/candidates/${id}`, {
        method: 'PATCH',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      setActionFlash(
        action === 'approve' ? 'تأیید شد.' : action === 'reject' ? 'رد شد.' : 'منتشر شد.',
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'عملیات شکست خورد');
    }
  };

  const runGenerator = async () => {
    const token = getAccessToken();
    if (!token) return;
    setRunning(true);
    setError(null);
    setActionFlash(null);
    try {
      const res = await apiFetch<{ created?: number; scanned?: number }>(
        'admin/story/candidates/generate',
        {
          method: 'POST',
          token,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ limit: 20 }),
        },
      );
      setActionFlash(
        `تولید داخلی انجام شد · ${toFaDigits(res.created ?? 0)} نامزد جدید از ${toFaDigits(
          res.scanned ?? 0,
        )} مورد اسکن‌شده.`,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تولید نامزدها شکست خورد');
    } finally {
      setRunning(false);
    }
  };

  const visibleItems = filter === 'ALL' ? items : items.filter((i) => i.status === filter);
  const totalViews = items.reduce((sum, i) => sum + (i.viewCount || 0), 0);
  const totalClicks = items.reduce((sum, i) => sum + (i.clickCount || 0), 0);

  return (
    <div dir="rtl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-[var(--ink)]">صف ویراستاری استوری</h1>
          <p className="mt-1 text-sm text-[var(--ink-3)]">
            بررسی و انتشار نامزدهای داستان از منابع داخلی و خارجی.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs font-bold text-[var(--ink-2)] hover:bg-[var(--surface-2)]"
          >
            تازه‌سازی
          </button>
          <button
            type="button"
            disabled={running}
            onClick={() => void runGenerator()}
            className="rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-extrabold text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            {running ? '…' : 'تولید نامزدهای داخلی'}
          </button>
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--accent-hover)]"
        >
          {error}
        </p>
      ) : null}
      {actionFlash ? (
        <p
          role="status"
          className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--accent-soft)] px-3 py-2 text-sm font-semibold text-[var(--accent-hover)]"
        >
          {actionFlash}
        </p>
      ) : null}

      <section className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
          <p className="text-[11px] font-bold text-[var(--ink-3)]">کل نامزدها</p>
          <p className="mt-1 text-lg font-extrabold text-[var(--ink)]">{formatCount(items.length)}</p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
          <p className="text-[11px] font-bold text-[var(--ink-3)]">منتشرشده</p>
          <p className="mt-1 text-lg font-extrabold text-[var(--ink)]">
            {formatCount(items.filter((i) => i.status === 'PUBLISHED').length)}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
          <p className="text-[11px] font-bold text-[var(--ink-3)]">مجموع نمایش</p>
          <p className="mt-1 text-lg font-extrabold text-[var(--ink)]">{formatCount(totalViews)}</p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
          <p className="text-[11px] font-bold text-[var(--ink-3)]">CTR کل</p>
          <p className="mt-1 text-lg font-extrabold text-[var(--ink)]">
            {fmtCtr(totalViews, totalClicks)}
          </p>
        </div>
      </section>

      <div role="tablist" aria-label="فیلتر وضعیت" className="mt-4 flex flex-wrap items-center gap-2">
        {(['ALL', 'PENDING', 'APPROVED', 'PUBLISHED', 'REJECTED'] as StatusFilter[]).map((s) => {
          const active = filter === s;
          const label = s === 'ALL' ? 'همه' : STATUS_FA[s];
          return (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(s)}
              className={`rounded-full px-3.5 py-1.5 text-[12px] font-bold transition ${
                active
                  ? 'bg-[var(--ink)] text-white'
                  : 'bg-[var(--surface-2)] text-[var(--ink-2)] hover:bg-[var(--surface-strong)]'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-[var(--ink-3)]">در حال بارگذاری…</p>
      ) : visibleItems.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-6 text-center text-sm text-[var(--ink-3)]">
          {items.length === 0
            ? 'نامزدی موجود نیست. برای شروع روی «تولید نامزدهای داخلی» بزنید.'
            : 'موردی با این فیلتر یافت نشد.'}
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {visibleItems.map((item) => (
            <li
              key={item.id}
              className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--accent-hover)]">
                      {KIND_FA(item.storyKind)}
                    </span>
                    {item.trustLabel ? (
                      <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-bold text-[var(--ink-3)]">
                        {item.trustLabel}
                      </span>
                    ) : null}
                    {item.imageUrl ? (
                      <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-bold text-[var(--ink-3)]">
                        رسانه
                      </span>
                    ) : null}
                  </div>
                  <p className="line-clamp-2 text-base font-extrabold text-[var(--ink)]">
                    {item.title}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm text-[var(--ink-2)]">
                    {item.summary || 'بدون خلاصه'}
                  </p>
                  <p className="mt-2 text-[11px] text-[var(--ink-3)]">
                    منبع: {item.source.name} · {item.source.type} · {item.source.regionScope} ·{' '}
                    <span dir="ltr">{fmtDate(item.createdAt)}</span>
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--ink-3)]">
                    تازگی {toFaDigits(item.freshnessScore)} · اعتماد {toFaDigits(item.trustScore)} ·
                    ربط {toFaDigits(item.relevanceScore)}
                    {item.quality ? (
                      <>
                        {' · '}کیفیت {toFaDigits(item.quality.qualityScore)} · ریسک تکرار{' '}
                        {toFaDigits(item.quality.duplicateRiskScore)}
                      </>
                    ) : null}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--ink-3)]">
                    <span>
                      نمایش <span className="font-bold text-[var(--ink-2)]">{formatCount(item.viewCount ?? 0)}</span>
                    </span>
                    <span>
                      کلیک <span className="font-bold text-[var(--ink-2)]">{formatCount(item.clickCount ?? 0)}</span>
                    </span>
                    <span>
                      CTR <span className="font-bold text-[var(--ink-2)]">{fmtCtr(item.viewCount ?? 0, item.clickCount ?? 0)}</span>
                    </span>
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_TONE[item.status]}`}
                >
                  {STATUS_FA[item.status]}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={item.status === 'APPROVED' || item.status === 'PUBLISHED'}
                  onClick={() => void patchStatus(item.id, 'approve')}
                  className="rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-extrabold text-[var(--accent-hover)] hover:bg-[var(--surface-strong)] disabled:opacity-40"
                >
                  تأیید
                </button>
                <button
                  type="button"
                  disabled={item.status === 'REJECTED'}
                  onClick={() => void patchStatus(item.id, 'reject')}
                  className="rounded-full border border-[var(--line)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-extrabold text-[var(--ink-2)] hover:bg-[var(--surface-strong)] disabled:opacity-40"
                >
                  رد
                </button>
                <button
                  type="button"
                  disabled={item.status === 'PUBLISHED'}
                  onClick={() => void patchStatus(item.id, 'publish')}
                  className="rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-extrabold text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)] disabled:opacity-40"
                >
                  انتشار
                </button>
                {item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="ms-auto text-[11px] font-bold text-[var(--accent-hover)] underline-offset-2 hover:underline"
                  >
                    باز کردن منبع
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

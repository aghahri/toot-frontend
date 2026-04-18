'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthGate } from '@/components/AuthGate';
import { NeighborhoodNetworkContext, NeighborhoodVisibilityNote } from '@/components/neighborhood/NeighborhoodContextStrip';
import {
  closeNeighborhoodPoll,
  createNeighborhoodPoll,
  fetchMemberNeighborhoodNetworks,
  fetchNeighborhoodPolls,
  type NeighborhoodNetworkRow,
  type NeighborhoodPollRow,
  voteNeighborhoodPoll,
} from '@/lib/neighborhoodPack';

const CARD =
  'rounded-3xl border border-[var(--border-soft)] bg-[var(--card-bg)] p-4 shadow-sm ring-1 ring-[var(--border-soft)]';
const BTN_PRI =
  'rounded-full bg-[var(--accent)] px-4 py-2 text-[11px] font-extrabold text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)] disabled:opacity-50';
const BTN_SEC =
  'rounded-full border border-[var(--border-soft)] px-4 py-2 text-[11px] font-extrabold text-[var(--text-primary)] hover:bg-[var(--surface-soft)]';

function formatShortDate(iso: string | null) {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function NeighborhoodPollsPage() {
  const searchParams = useSearchParams();
  const [networks, setNetworks] = useState<NeighborhoodNetworkRow[]>([]);
  const [networkId, setNetworkId] = useState('');
  const [polls, setPolls] = useState<NeighborhoodPollRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [voting, setVoting] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [q, setQ] = useState('');
  const [opts, setOpts] = useState('گزینه ۱\nگزینه ۲');
  const [deadline, setDeadline] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const refreshPolls = useCallback(async () => {
    if (!networkId) {
      setPolls([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchNeighborhoodPolls(networkId);
      setPolls(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'بارگذاری نظرسنجی‌ها ممکن نیست');
    } finally {
      setLoading(false);
    }
  }, [networkId]);

  useEffect(() => {
    void (async () => {
      try {
        const list = await fetchMemberNeighborhoodNetworks();
        setNetworks(list);
        const q = searchParams.get('networkId');
        const pick = q && list.some((n) => n.id === q) ? q : list[0]?.id;
        if (pick) setNetworkId(pick);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'خطا');
      }
    })();
  }, [searchParams]);

  useEffect(() => {
    void refreshPolls();
  }, [refreshPolls]);

  const activeNetwork = useMemo(() => networks.find((n) => n.id === networkId) ?? null, [networks, networkId]);

  async function onVote(pollId: string, optionIndex: number) {
    if (!networkId) return;
    setVoting(pollId);
    setError(null);
    try {
      await voteNeighborhoodPoll(networkId, pollId, optionIndex);
      await refreshPolls();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'رأی ثبت نشد');
    } finally {
      setVoting(null);
    }
  }

  async function onClose(pollId: string) {
    if (!networkId) return;
    setError(null);
    try {
      await closeNeighborhoodPoll(networkId, pollId);
      await refreshPolls();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'بستن ممکن نیست');
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!networkId) return;
    const options = opts
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    if (options.length < 2) {
      setError('حداقل دو گزینه وارد کنید (هر خط یک گزینه).');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createNeighborhoodPoll(networkId, {
        question: q.trim(),
        options,
        deadlineAt: deadline ? new Date(deadline).toISOString() : undefined,
      });
      setQ('');
      setOpts('گزینه ۱\nگزینه ۲');
      setDeadline('');
      setShowCreate(false);
      await refreshPolls();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ایجاد نشد');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthGate>
      <main
        className="theme-page-bg theme-text-primary mx-auto w-full max-w-md space-y-4 px-4 pb-16 pt-4 sm:pb-14"
        dir="rtl"
      >
        <div className="flex items-center gap-2">
          <Link
            href="/spaces/NEIGHBORHOOD"
            className="flex h-10 min-w-[2.5rem] items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--surface-soft)]"
            aria-label="بازگشت"
          >
            ←
          </Link>
          <div>
            <h1 className="text-lg font-black text-[var(--text-primary)]">نظرسنجی محلی</h1>
            <p className="text-[11px] text-[var(--text-secondary)]">رأی محله‌ای، شفاف و قابل اعتماد</p>
          </div>
        </div>

        {networks.length === 0 && !loading ? (
          <p className="text-sm text-[var(--text-secondary)]">
            برای نظرسنجی باید عضو حداقل یک شبکه محله‌ای باشید. از{' '}
            <Link href="/spaces/NEIGHBORHOOD" className="font-bold text-[var(--accent-hover)]">
              فضای محله
            </Link>{' '}
            به یک شبکه بپیوندید.
          </p>
        ) : (
          <div className={CARD + ' p-3'}>
            <label className="mb-1 block text-[10px] font-extrabold text-[var(--text-secondary)]">شبکه محله</label>
            <select
              value={networkId}
              onChange={(e) => setNetworkId(e.target.value)}
              className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            >
              {networks.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
            {activeNetwork ? (
              <div className="mt-3 space-y-2">
                <NeighborhoodNetworkContext networkName={activeNetwork.name} role={activeNetwork.myRole} />
                <NeighborhoodVisibilityNote networkName={activeNetwork.name} topic="polls" />
              </div>
            ) : null}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setShowCreate((s) => !s)} className={BTN_PRI} disabled={!networkId}>
            {showCreate ? 'بستن فرم' : 'نظرسنجی جدید'}
          </button>
          <button type="button" onClick={() => void refreshPolls()} className={BTN_SEC}>
            تازه‌سازی
          </button>
        </div>

        {showCreate && networkId ? (
          <form onSubmit={onCreate} className={CARD + ' space-y-3'}>
            <p className="text-xs font-extrabold text-[var(--text-primary)]">ایجاد نظرسنجی</p>
            <input
              required
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="سوال (مثلاً بهترین اینترنت محله؟)"
              className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
            />
            <div>
              <label className="mb-1 block text-[10px] font-bold text-[var(--text-secondary)]">گزینه‌ها — هر خط یک گزینه</label>
              <textarea
                value={opts}
                onChange={(e) => setOpts(e.target.value)}
                rows={4}
                className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold text-[var(--text-secondary)]">مهلت (اختیاری)</label>
              <input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
              />
            </div>
            <button type="submit" disabled={submitting} className={BTN_PRI}>
              {submitting ? '…' : 'انتشار نظرسنجی'}
            </button>
          </form>
        ) : null}

        {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}

        {loading ? <p className="text-sm text-[var(--text-secondary)]">در حال بارگذاری…</p> : null}

        {!loading && networkId && polls.length === 0 ? (
          <div className="rounded-2xl bg-[var(--surface-soft)] px-3 py-3 text-sm text-[var(--text-primary)] ring-1 ring-[var(--border-soft)]">
            <p>
              هنوز برای «{activeNetwork?.name ?? 'این شبکه'}» نظرسنجی‌ای ثبت نشده — با «نظرسنجی جدید» اولین را بسازید؛ بعد از
              ساخت همین‌جا در همین فهرست می‌ماند.
            </p>
          </div>
        ) : null}

        {polls.length > 0 ? (
          <p className="text-[10px] text-[var(--text-secondary)]">جدیدترین نظرسنجی‌ها بالای فهرست هستند.</p>
        ) : null}

        <ul className="space-y-4">
          {polls.map((p) => {
            const total = p.totalVotes || 1;
            const closed = p.effectiveClosed;
            return (
              <li key={p.id} className={CARD}>
                <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-black text-[var(--text-primary)]">{p.question}</p>
                    <p className="mt-1 text-[10px] text-[var(--text-secondary)]">
                      {closed ? (
                        <span className="rounded-full bg-[var(--surface-soft)] px-2 py-0.5 font-bold">پایان یافته</span>
                      ) : (
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-bold text-emerald-800 dark:text-emerald-300">
                          فعال
                        </span>
                      )}{' '}
                      · {p.totalVotes} رأی
                      {p.deadlineAt ? ` · مهلت: ${formatShortDate(p.deadlineAt)}` : ''}
                    </p>
                  </div>
                  {!closed ? (
                    <button type="button" onClick={() => void onClose(p.id)} className={BTN_SEC}>
                      بستن
                    </button>
                  ) : null}
                </div>
                <div className="space-y-2">
                  {p.options.map((label, i) => {
                    const c = p.counts[i] ?? 0;
                    const pct = Math.round((c / total) * 100);
                    return (
                      <div key={i}>
                        <div className="mb-0.5 flex items-center justify-between gap-2 text-[11px]">
                          <span className="font-bold text-[var(--text-primary)]">{label}</span>
                          <span className="tabular-nums text-[var(--text-secondary)]">{c}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-soft)]">
                          <div
                            className="h-full rounded-full bg-[var(--accent)] transition-[width]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        {!closed ? (
                          <button
                            type="button"
                            disabled={voting === p.id}
                            onClick={() => void onVote(p.id, i)}
                            className={'mt-1 ' + BTN_SEC}
                          >
                            {p.myVote === i ? 'رأی شما' : 'رأی بده'}
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                <p className="mt-3 text-[10px] text-[var(--text-secondary)]">
                  ساخته‌شده توسط {p.createdBy.name} · {formatShortDate(p.createdAt)}
                </p>
              </li>
            );
          })}
        </ul>
      </main>
    </AuthGate>
  );
}

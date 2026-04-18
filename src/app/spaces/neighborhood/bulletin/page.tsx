'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthGate } from '@/components/AuthGate';
import {
  BULLETIN_KIND_LABELS,
  createNeighborhoodBulletin,
  fetchMemberNeighborhoodNetworks,
  fetchNeighborhoodBulletins,
  type NeighborhoodBulletinRow,
  type NeighborhoodNetworkRow,
} from '@/lib/neighborhoodPack';

const CARD =
  'rounded-2xl border border-[var(--border-soft)] bg-[var(--card-bg)] p-4 shadow-sm ring-1 ring-[var(--border-soft)]';
const BTN_PRI =
  'rounded-full bg-[var(--accent)] px-4 py-2 text-[11px] font-extrabold text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)] disabled:opacity-50';

const KINDS = ['NOTICE', 'EVENT', 'LOST_FOUND', 'MAINTENANCE', 'OTHER'] as const;

function formatTime(iso: string) {
  try {
    return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function NeighborhoodBulletinPage() {
  const [networks, setNetworks] = useState<NeighborhoodNetworkRow[]>([]);
  const [networkId, setNetworkId] = useState('');
  const [rows, setRows] = useState<NeighborhoodBulletinRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [kind, setKind] = useState<string>('NOTICE');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    if (!networkId) {
      setRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await fetchNeighborhoodBulletins(networkId);
      setRows(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'بارگذاری ممکن نیست');
    } finally {
      setLoading(false);
    }
  }, [networkId]);

  useEffect(() => {
    void (async () => {
      try {
        const list = await fetchMemberNeighborhoodNetworks();
        setNetworks(list);
        if (list[0]) setNetworkId((prev) => prev || list[0].id);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'خطا');
      }
    })();
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activeNetwork = useMemo(() => networks.find((n) => n.id === networkId) ?? null, [networks, networkId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!networkId) return;
    setSubmitting(true);
    setError(null);
    try {
      await createNeighborhoodBulletin(networkId, { kind, title: title.trim(), body: body.trim() });
      setTitle('');
      setBody('');
      setShowCreate(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ثبت نشد');
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
            <h1 className="text-lg font-black text-[var(--text-primary)]">تابلو اعلانات محله</h1>
            <p className="text-[11px] text-[var(--text-secondary)]">خبر کوتاه، شفاف، به‌موقع</p>
          </div>
        </div>

        {networks.length === 0 && !loading ? (
          <p className="text-sm text-[var(--text-secondary)]">
            برای دیدن اعلانات باید عضو یک شبکه محله‌ای باشید.
          </p>
        ) : (
          <div className={CARD + ' p-3'}>
            <label className="mb-1 block text-[10px] font-extrabold text-[var(--text-secondary)]">شبکه</label>
            <select
              value={networkId}
              onChange={(e) => setNetworkId(e.target.value)}
              className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
            >
              {networks.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
            {activeNetwork ? <p className="mt-1 text-[10px] text-[var(--text-secondary)]">{activeNetwork.name}</p> : null}
          </div>
        )}

        <button type="button" onClick={() => setShowCreate((s) => !s)} className={BTN_PRI} disabled={!networkId}>
          {showCreate ? 'بستن' : 'اعلان جدید'}
        </button>

        {showCreate && networkId ? (
          <form onSubmit={onSubmit} className={CARD + ' space-y-3'}>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {BULLETIN_KIND_LABELS[k] ?? k}
                </option>
              ))}
            </select>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="عنوان کوتاه"
              className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
            />
            <textarea
              required
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              placeholder="متن اعلان…"
              className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
            />
            <button type="submit" disabled={submitting} className={BTN_PRI}>
              {submitting ? '…' : 'انتشار'}
            </button>
          </form>
        ) : null}

        {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
        {loading ? <p className="text-sm text-[var(--text-secondary)]">…</p> : null}

        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className={CARD}>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[var(--surface-soft)] px-2 py-0.5 text-[10px] font-extrabold text-[var(--text-secondary)]">
                  {BULLETIN_KIND_LABELS[r.kind] ?? r.kind}
                </span>
                <span className="text-[10px] text-[var(--text-secondary)]">{formatTime(r.createdAt)}</span>
              </div>
              <h2 className="text-sm font-black text-[var(--text-primary)]">{r.title}</h2>
              <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--text-primary)]">{r.body}</p>
              <p className="mt-2 text-[10px] text-[var(--text-secondary)]">از {r.createdBy.name}</p>
            </li>
          ))}
        </ul>

        {!loading && networkId && rows.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">هنوز اعلانی ثبت نشده.</p>
        ) : null}
      </main>
    </AuthGate>
  );
}

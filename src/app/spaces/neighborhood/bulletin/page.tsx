'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { AuthGate } from '@/components/AuthGate';
import { NeighborhoodNetworkContext, NeighborhoodVisibilityNote } from '@/components/neighborhood/NeighborhoodContextStrip';
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

function NeighborhoodBulletinPageContent() {
  const searchParams = useSearchParams();
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
        const q = searchParams.get('networkId');
        const pick = q && list.some((n) => n.id === q) ? q : list[0]?.id;
        if (pick) setNetworkId(pick);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'خطا');
      }
    })();
  }, [searchParams]);

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
          <p className="rounded-2xl bg-[var(--surface-soft)] px-3 py-3 text-sm text-[var(--text-primary)] ring-1 ring-[var(--border-soft)]">
            برای دیدن یا ثبت اعلان باید عضو حداقل یک شبکه محله باشید — از{' '}
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
              className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
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
                <NeighborhoodVisibilityNote networkName={activeNetwork.name} topic="bulletin" />
              </div>
            ) : null}
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

        {rows.length > 0 ? (
          <p className="text-[10px] text-[var(--text-secondary)]">تازه‌ترین اعلان‌ها بالای فهرست‌اند.</p>
        ) : null}

        {!loading && networkId && rows.length === 0 ? (
          <p className="rounded-2xl bg-[var(--surface-soft)] px-3 py-3 text-sm text-[var(--text-primary)] ring-1 ring-[var(--border-soft)]">
            هنوز برای «{activeNetwork?.name ?? 'این شبکه'}» اعلانی ثبت نشده — با «اعلان جدید» یکی اضافه کنید؛ فقط اعضای همین
            شبکه آن را اینجا می‌بینند.
          </p>
        ) : null}
      </main>
    </AuthGate>
  );
}

export default function NeighborhoodBulletinPage() {
  return (
    <Suspense
      fallback={
        <div className="theme-page-bg px-4 py-10 text-center text-sm text-[var(--text-secondary)]" dir="rtl">
          …
        </div>
      }
    >
      <NeighborhoodBulletinPageContent />
    </Suspense>
  );
}

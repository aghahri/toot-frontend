'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthGate } from '@/components/AuthGate';
import { NeighborhoodNetworkContext, NeighborhoodVisibilityNote } from '@/components/neighborhood/NeighborhoodContextStrip';
import {
  createNeighborhoodSpotlight,
  fetchMemberNeighborhoodNetworks,
  fetchNeighborhoodSpotlights,
  type NeighborhoodNetworkRow,
  type NeighborhoodSpotlightRow,
} from '@/lib/neighborhoodPack';

const CARD =
  'rounded-3xl border border-[var(--border-soft)] bg-[var(--card-bg)] p-4 shadow-sm ring-1 ring-[var(--border-soft)]';
const BTN_PRI =
  'rounded-full bg-[var(--accent)] px-4 py-2 text-[11px] font-extrabold text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)] disabled:opacity-50';

export default function NeighborhoodShowcasePage() {
  const [networks, setNetworks] = useState<NeighborhoodNetworkRow[]>([]);
  const [networkId, setNetworkId] = useState('');
  const [rows, setRows] = useState<NeighborhoodSpotlightRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('');
  const [intro, setIntro] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [contactHint, setContactHint] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    if (!networkId) {
      setRows([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await fetchNeighborhoodSpotlights(networkId);
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
      await createNeighborhoodSpotlight(networkId, {
        businessName: businessName.trim(),
        category: category.trim(),
        intro: intro.trim(),
        description: description.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
        contactHint: contactHint.trim() || undefined,
      });
      setBusinessName('');
      setCategory('');
      setIntro('');
      setDescription('');
      setImageUrl('');
      setContactHint('');
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
            <h1 className="text-lg font-black text-[var(--text-primary)]">کسب‌وکارهای محلی</h1>
            <p className="text-[11px] text-[var(--text-secondary)]">معرفی اعتمادمحور — نه بازار پرهیاهو</p>
          </div>
        </div>

        {networks.length === 0 && !loading ? (
          <p className="rounded-2xl bg-[var(--surface-soft)] px-3 py-3 text-sm text-[var(--text-primary)] ring-1 ring-[var(--border-soft)]">
            برای دیدن یا ثبت معرفی باید عضو یک شبکه محله باشید — از{' '}
            <Link href="/spaces/NEIGHBORHOOD" className="font-bold text-[var(--accent-hover)]">
              فضای محله
            </Link>{' '}
            یک شبکه انتخاب کنید.
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
                <NeighborhoodVisibilityNote networkName={activeNetwork.name} topic="showcase" />
              </div>
            ) : null}
          </div>
        )}

        <button type="button" onClick={() => setShowCreate((s) => !s)} className={BTN_PRI} disabled={!networkId}>
          {showCreate ? 'بستن' : 'معرفی کسب‌وکار'}
        </button>

        {showCreate && networkId ? (
          <form onSubmit={onSubmit} className={CARD + ' space-y-3'}>
            <input
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="نام کسب‌وکار"
              className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
            />
            <input
              required
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="دسته (نانوایی، ورزش، …)"
              className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
            />
            <textarea
              required
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              rows={3}
              placeholder="معرفی کوتاه (یک پاراگراف)"
              className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="توضیح بیشتر (اختیاری)"
              className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
            />
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="آدرس تصویر (اختیاری، https://…)"
              className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
            />
            <input
              value={contactHint}
              onChange={(e) => setContactHint(e.target.value)}
              placeholder="راه تماس (مثلاً اینستاگرام یا ساعت کاری)"
              className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
            />
            <button type="submit" disabled={submitting} className={BTN_PRI}>
              {submitting ? '…' : 'انتشار'}
            </button>
          </form>
        ) : null}

        {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
        {loading ? <p className="text-sm text-[var(--text-secondary)]">…</p> : null}

        {rows.length > 0 ? (
          <p className="text-[10px] text-[var(--text-secondary)]">جدیدترین معرفی‌ها بالای فهرست‌اند.</p>
        ) : null}

        <ul className="space-y-4">
          {rows.map((r) => (
            <li key={r.id} className={CARD + ' overflow-hidden'}>
              {r.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- user-supplied spotlight URLs
                <img
                  src={r.imageUrl}
                  alt=""
                  className="-mx-4 -mt-4 mb-3 aspect-[16/9] w-[calc(100%+2rem)] max-w-none bg-[var(--surface-soft)] object-cover"
                />
              ) : null}
              <p className="text-[10px] font-extrabold uppercase tracking-wide text-[var(--accent-hover)]">{r.category}</p>
              <h2 className="mt-1 text-base font-black text-[var(--text-primary)]">{r.businessName}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-primary)]">{r.intro}</p>
              {r.description ? (
                <p className="mt-2 whitespace-pre-wrap text-[13px] text-[var(--text-secondary)]">{r.description}</p>
              ) : null}
              {r.contactHint ? (
                <p className="mt-3 rounded-2xl bg-[var(--surface-soft)] px-3 py-2 text-[12px] font-semibold text-[var(--text-primary)]">
                  {r.contactHint}
                </p>
              ) : null}
              <p className="mt-3 text-[10px] text-[var(--text-secondary)]">معرفی توسط {r.createdBy.name}</p>
            </li>
          ))}
        </ul>

        {!loading && networkId && rows.length === 0 ? (
          <p className="rounded-2xl bg-[var(--surface-soft)] px-3 py-3 text-sm text-[var(--text-primary)] ring-1 ring-[var(--border-soft)]">
            هنوز برای «{activeNetwork?.name ?? 'این شبکه'}» معرفی ثبت نشده — با «معرفی کسب‌وکار» یکی اضافه کنید؛ فقط اعضای همین
            شبکه آن را در همین صفحه می‌بینند.
          </p>
        ) : null}
      </main>
    </AuthGate>
  );
}

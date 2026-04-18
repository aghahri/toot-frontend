'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthGate } from '@/components/AuthGate';
import { NeighborhoodNetworkContext, NeighborhoodVisibilityNote } from '@/components/neighborhood/NeighborhoodContextStrip';
import {
  createNeighborhoodSpotlight,
  deleteNeighborhoodSpotlight,
  fetchMemberNeighborhoodNetworks,
  fetchNeighborhoodSpotlights,
  LOCAL_BUSINESS_SHOWCASE_CATEGORIES,
  updateNeighborhoodSpotlight,
  uploadShowcaseImage,
  type NeighborhoodNetworkRow,
  type NeighborhoodSpotlightRow,
} from '@/lib/neighborhoodPack';
import { getCurrentUserIdFromAccessToken } from '@/lib/auth';

const CARD =
  'rounded-3xl border border-[var(--border-soft)] bg-[var(--card-bg)] p-4 shadow-sm ring-1 ring-[var(--border-soft)]';
const BTN_PRI =
  'rounded-full bg-[var(--accent)] px-4 py-2 text-[11px] font-extrabold text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)] disabled:opacity-50';
const BTN_GHOST =
  'rounded-full border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-1.5 text-[11px] font-bold text-[var(--text-primary)] hover:bg-[var(--surface-soft)]/80 disabled:opacity-50';
const BTN_DANGER =
  'rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-[11px] font-bold text-red-700 dark:text-red-300 disabled:opacity-50';

const emptyForm = () => ({
  businessName: '',
  category: '',
  intro: '',
  description: '',
  imageUrl: '',
  contactHint: '',
});

export default function NeighborhoodShowcasePage() {
  const [networks, setNetworks] = useState<NeighborhoodNetworkRow[]>([]);
  const [networkId, setNetworkId] = useState('');
  const [rows, setRows] = useState<NeighborhoodSpotlightRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('');
  const [intro, setIntro] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [contactHint, setContactHint] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showImageUrlField, setShowImageUrlField] = useState(false);
  const [myUserId, setMyUserId] = useState<string | null>(null);

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
    setMyUserId(getCurrentUserIdFromAccessToken());
  }, []);

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

  useEffect(() => {
    setEditingId(null);
    const e = emptyForm();
    setBusinessName(e.businessName);
    setCategory(e.category);
    setIntro(e.intro);
    setDescription(e.description);
    setImageUrl(e.imageUrl);
    setContactHint(e.contactHint);
    setShowCreate(false);
    setShowImageUrlField(false);
  }, [networkId]);

  const activeNetwork = useMemo(() => networks.find((n) => n.id === networkId) ?? null, [networks, networkId]);

  function resetForm() {
    const e = emptyForm();
    setBusinessName(e.businessName);
    setCategory(e.category);
    setIntro(e.intro);
    setDescription(e.description);
    setImageUrl(e.imageUrl);
    setContactHint(e.contactHint);
    setEditingId(null);
    setShowImageUrlField(false);
  }

  function startEdit(row: NeighborhoodSpotlightRow) {
    setEditingId(row.id);
    setBusinessName(row.businessName);
    setCategory(
      LOCAL_BUSINESS_SHOWCASE_CATEGORIES.includes(row.category as (typeof LOCAL_BUSINESS_SHOWCASE_CATEGORIES)[number])
        ? row.category
        : 'سایر',
    );
    setIntro(row.intro);
    setDescription(row.description ?? '');
    setImageUrl(row.imageUrl ?? '');
    setContactHint(row.contactHint ?? '');
    setShowCreate(true);
    setShowImageUrlField(!!row.imageUrl && !row.imageUrl.startsWith('blob:'));
  }

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingImage(true);
    setError(null);
    try {
      const url = await uploadShowcaseImage(file);
      setImageUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'آپلود نشد');
    } finally {
      setUploadingImage(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!networkId) return;
    if (!category) {
      setError('دسته را انتخاب کنید');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        businessName: businessName.trim(),
        category,
        intro: intro.trim(),
        description: description.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
        contactHint: contactHint.trim() || undefined,
      };
      if (editingId) {
        await updateNeighborhoodSpotlight(networkId, editingId, payload);
      } else {
        await createNeighborhoodSpotlight(networkId, payload);
      }
      resetForm();
      setShowCreate(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ثبت نشد');
    } finally {
      setSubmitting(false);
    }
  }

  async function onDeleteSpotlight(id: string) {
    if (!networkId) return;
    if (!window.confirm('این معرفی حذف شود؟')) return;
    setError(null);
    try {
      await deleteNeighborhoodSpotlight(networkId, id);
      if (editingId === id) resetForm();
      setShowCreate(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حذف نشد');
    }
  }

  const isOwner = (row: NeighborhoodSpotlightRow) =>
    myUserId != null && row.createdBy.id === myUserId;

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
            <p className="text-[11px] text-[var(--text-secondary)]">معرفی کوتاه و قابل اعتماد برای همسایه‌ها</p>
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

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              if (showCreate && !editingId) {
                setShowCreate(false);
                resetForm();
              } else if (showCreate && editingId) {
                setShowCreate(false);
                resetForm();
              } else {
                resetForm();
                setShowCreate(true);
              }
            }}
            className={BTN_PRI}
            disabled={!networkId}
          >
            {showCreate ? 'بستن فرم' : 'معرفی کسب‌وکار'}
          </button>
        </div>

        {showCreate && networkId ? (
          <form onSubmit={onSubmit} className={CARD + ' space-y-3'}>
            <p className="text-[11px] font-bold text-[var(--text-secondary)]">
              {editingId ? 'ویرایش معرفی' : 'معرفی جدید'}
            </p>

            <div>
              <label className="mb-1 block text-[10px] font-extrabold text-[var(--text-secondary)]">نام کسب‌وکار</label>
              <input
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="مثلاً نانوایی طلایی"
                className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-extrabold text-[var(--text-secondary)]">دسته</label>
              <select
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
              >
                <option value="">انتخاب کنید…</option>
                {LOCAL_BUSINESS_SHOWCASE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-extrabold text-[var(--text-secondary)]">معرفی کوتاه</label>
              <textarea
                required
                value={intro}
                onChange={(e) => setIntro(e.target.value)}
                rows={3}
                placeholder="در چند جمله بگویید چه می‌فروشید یا چه خدمتی می‌دهید"
                className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-extrabold text-[var(--text-secondary)]">توضیح بیشتر (اختیاری)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="ساعت کاری، آدرس تقریبی، ویژگی‌ها…"
                className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-extrabold text-[var(--text-secondary)]">تصویر</label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <label className="inline-flex cursor-pointer items-center justify-center rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-[12px] font-semibold text-[var(--text-primary)]">
                  {uploadingImage ? 'در حال آپلود…' : 'انتخاب فایل تصویر'}
                  <input type="file" accept="image/*" className="hidden" onChange={onPickImage} disabled={uploadingImage} />
                </label>
                {imageUrl ? (
                  <span className="truncate text-[11px] text-[var(--text-secondary)]" title={imageUrl}>
                    تصویر آماده است
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                className="mt-1 text-[11px] font-semibold text-[var(--accent-hover)]"
                onClick={() => setShowImageUrlField((s) => !s)}
              >
                {showImageUrlField ? 'پنهان کردن لینک تصویر' : 'یا وارد کردن آدرس تصویر'}
              </button>
              {showImageUrlField ? (
                <input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://…"
                  className="mt-2 w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
                />
              ) : null}
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-extrabold text-[var(--text-secondary)]">راه تماس / دکمه عمل</label>
              <input
                value={contactHint}
                onChange={(e) => setContactHint(e.target.value)}
                placeholder="مثلاً اینستاگرام، واتساپ، ساعت پاسخگویی"
                className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
              />
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button type="submit" disabled={submitting || uploadingImage} className={BTN_PRI}>
                {submitting ? '…' : editingId ? 'ذخیره تغییرات' : 'انتشار'}
              </button>
              {editingId ? (
                <button type="button" className={BTN_GHOST} onClick={() => { resetForm(); setShowCreate(false); }}>
                  انصراف
                </button>
              ) : null}
            </div>
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
                // eslint-disable-next-line @next/next/no-img-element -- user or uploaded spotlight URLs
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
              {isOwner(r) ? (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--border-soft)] pt-3">
                  <button type="button" className={BTN_GHOST} onClick={() => startEdit(r)}>
                    ویرایش
                  </button>
                  <button type="button" className={BTN_DANGER} onClick={() => void onDeleteSpotlight(r.id)}>
                    حذف
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>

        {!loading && networkId && rows.length === 0 ? (
          <p className="rounded-2xl bg-[var(--surface-soft)] px-3 py-3 text-sm text-[var(--text-primary)] ring-1 ring-[var(--border-soft)]">
            هنوز برای «{activeNetwork?.name ?? 'این شبکه'}» معرفی ثبت نشده — با «معرفی کسب‌وکار» یکی اضافه کنید؛ فقط اعضای همین شبکه آن را در همین صفحه می‌بینند.
          </p>
        ) : null}
      </main>
    </AuthGate>
  );
}

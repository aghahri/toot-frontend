'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';

type StickerPack = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  itemsCount?: number;
};

type StickerItem = {
  id: string;
  mediaId: string;
  label: string | null;
  isActive: boolean;
  sortOrder: number;
  media?: { url?: string | null; mimeType?: string | null } | null;
};

function parseMediaId(rawMediaId: string, rawMediaUrl: string): string {
  const direct = rawMediaId.trim();
  if (direct) return direct;
  const url = rawMediaUrl.trim();
  if (!url) return '';
  const queryMatch = url.match(/[?&]mediaId=([^&]+)/i);
  if (queryMatch?.[1]) return decodeURIComponent(queryMatch[1]).trim();
  const pathMatch = url.match(/\/([A-Za-z0-9_-]{8,})\/?$/);
  return pathMatch?.[1]?.trim() ?? '';
}

export default function AdminStickersPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [packs, setPacks] = useState<StickerPack[]>([]);
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const [items, setItems] = useState<StickerItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  const [newPack, setNewPack] = useState({
    title: '',
    slug: '',
    description: '',
    isActive: true,
    sortOrder: 0,
  });

  const [newItem, setNewItem] = useState({
    mediaId: '',
    mediaUrl: '',
    label: '',
    tags: '',
    sortOrder: 0,
    isActive: true,
  });

  const selectedPack = useMemo(
    () => packs.find((p) => p.id === selectedPackId) ?? null,
    [packs, selectedPackId],
  );

  const loadPacks = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ data: StickerPack[] }>('stickers/admin/packs', {
        method: 'GET',
        token,
      });
      const list = Array.isArray(res.data) ? res.data : [];
      setPacks(list);
      setSelectedPackId((prev) => prev ?? list[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در دریافت پکیج‌ها');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadItems = useCallback(async (packId: string) => {
    const token = getAccessToken();
    if (!token) return;
    setItemsLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ data: StickerItem[] }>(
        `stickers/admin/packs/${encodeURIComponent(packId)}/items`,
        {
          method: 'GET',
          token,
        },
      );
      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در دریافت آیتم‌ها');
    } finally {
      setItemsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPacks();
  }, [loadPacks]);

  useEffect(() => {
    if (!selectedPackId) {
      setItems([]);
      return;
    }
    void loadItems(selectedPackId);
  }, [loadItems, selectedPackId]);

  async function createPack(e: FormEvent) {
    e.preventDefault();
    const token = getAccessToken();
    if (!token) return;
    if (!newPack.title.trim() || !newPack.slug.trim()) {
      setError('نام و slug الزامی است');
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const created = await apiFetch<StickerPack>('stickers/admin/packs', {
        method: 'POST',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newPack.title.trim(),
          slug: newPack.slug.trim(),
          description: newPack.description.trim() || undefined,
        }),
      });
      await apiFetch(`stickers/admin/packs/${encodeURIComponent(created.id)}`, {
        method: 'PATCH',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isActive: newPack.isActive,
          sortOrder: Number(newPack.sortOrder) || 0,
        }),
      });
      setNewPack({ title: '', slug: '', description: '', isActive: true, sortOrder: 0 });
      setMessage('پکیج با موفقیت ساخته شد');
      await loadPacks();
      setSelectedPackId(created.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در ساخت پکیج');
    } finally {
      setSaving(false);
    }
  }

  async function updatePack(
    packId: string,
    patch: Partial<Pick<StickerPack, 'title' | 'slug' | 'description' | 'isActive' | 'sortOrder'>>,
  ) {
    const token = getAccessToken();
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`stickers/admin/packs/${encodeURIComponent(packId)}`, {
        method: 'PATCH',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      setMessage('پکیج بروزرسانی شد');
      await loadPacks();
      if (selectedPackId === packId) await loadItems(packId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در بروزرسانی پکیج');
    } finally {
      setSaving(false);
    }
  }

  async function createItem(e: FormEvent) {
    e.preventDefault();
    const token = getAccessToken();
    if (!token || !selectedPackId) return;
    const mediaId = parseMediaId(newItem.mediaId, newItem.mediaUrl);
    if (!mediaId) {
      setError('Media ID الزامی است');
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const created = await apiFetch<StickerItem>(
        `stickers/admin/packs/${encodeURIComponent(selectedPackId)}/items`,
        {
          method: 'POST',
          token,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mediaId,
            label: newItem.label.trim() || undefined,
          }),
        },
      );
      await apiFetch(`stickers/admin/items/${encodeURIComponent(created.id)}`, {
        method: 'PATCH',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isActive: newItem.isActive,
          sortOrder: Number(newItem.sortOrder) || 0,
        }),
      });
      setNewItem({ mediaId: '', mediaUrl: '', label: '', tags: '', sortOrder: 0, isActive: true });
      setMessage('استیکر اضافه شد');
      await loadItems(selectedPackId);
      await loadPacks();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در افزودن استیکر');
    } finally {
      setSaving(false);
    }
  }

  async function updateItem(
    itemId: string,
    patch: Partial<Pick<StickerItem, 'label' | 'isActive' | 'sortOrder'>>,
  ) {
    const token = getAccessToken();
    if (!token || !selectedPackId) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`stickers/admin/items/${encodeURIComponent(itemId)}`, {
        method: 'PATCH',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      setMessage('آیتم بروزرسانی شد');
      await loadItems(selectedPackId);
      await loadPacks();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در بروزرسانی آیتم');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div dir="rtl">
      <h1 className="text-xl font-bold text-white">مدیریت پکیج‌های استیکر</h1>
      <p className="mt-2 text-sm text-slate-400">
        این صفحه فقط برای ادمین‌هاست. برای MVP استیکر، Media ID تصویر WebP را دستی وارد کنید.
      </p>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-300">{error}</p>
      ) : null}
      {message ? (
        <p className="mt-4 rounded-lg border border-emerald-800/70 bg-emerald-950/20 px-3 py-2 text-sm text-emerald-300">{message}</p>
      ) : null}

      <section className="mt-6 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <h2 className="text-sm font-bold text-slate-200">ساخت پکیج جدید</h2>
        <form onSubmit={createPack} className="mt-3 grid gap-3 sm:grid-cols-2">
          <input
            className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            placeholder="نام فارسی پکیج"
            value={newPack.title}
            onChange={(e) => setNewPack((p) => ({ ...p, title: e.target.value }))}
          />
          <input
            className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            placeholder="slug (مثلا salam-pack)"
            value={newPack.slug}
            onChange={(e) => setNewPack((p) => ({ ...p, slug: e.target.value.toLowerCase() }))}
          />
          <input
            className="sm:col-span-2 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            placeholder="توضیح"
            value={newPack.description}
            onChange={(e) => setNewPack((p) => ({ ...p, description: e.target.value }))}
          />
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={newPack.isActive}
              onChange={(e) => setNewPack((p) => ({ ...p, isActive: e.target.checked }))}
            />
            فعال
          </label>
          <input
            type="number"
            min={0}
            className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
            placeholder="sort order"
            value={newPack.sortOrder}
            onChange={(e) => setNewPack((p) => ({ ...p, sortOrder: Number(e.target.value) || 0 }))}
          />
          <button
            type="submit"
            disabled={saving}
            className="sm:col-span-2 rounded bg-sky-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            ساخت پکیج
          </button>
        </form>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h2 className="text-sm font-bold text-slate-200">لیست پکیج‌ها</h2>
          {loading ? (
            <p className="mt-3 text-sm text-slate-500">در حال بارگذاری…</p>
          ) : packs.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">هنوز پکیج استیکر ساخته نشده</p>
          ) : (
            <div className="mt-3 space-y-2">
              {packs.map((pack) => (
                <div
                  key={pack.id}
                  className={`rounded-lg border p-3 ${selectedPackId === pack.id ? 'border-sky-500 bg-slate-950/60' : 'border-slate-800 bg-slate-950/30'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-white">{pack.title}</p>
                      <p className="text-[11px] text-slate-500">{pack.slug}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedPackId(pack.id)}
                      className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200"
                    >
                      ویرایش
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-400">
                    <span>وضعیت: {pack.isActive ? 'فعال' : 'غیرفعال'}</span>
                    <span>نوع: —</span>
                    <span>تعداد: {pack.itemsCount ?? 0}</span>
                    <span>sort: {pack.sortOrder}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h2 className="text-sm font-bold text-slate-200">جزئیات پکیج</h2>
          {!selectedPack ? (
            <p className="mt-3 text-sm text-slate-500">یک پکیج را انتخاب کنید.</p>
          ) : (
            <div className="mt-3 space-y-4">
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  defaultValue={selectedPack.title}
                  onBlur={(e) => {
                    const val = e.target.value.trim();
                    if (val && val !== selectedPack.title) void updatePack(selectedPack.id, { title: val });
                  }}
                  className="rounded border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-white"
                />
                <input
                  defaultValue={selectedPack.slug}
                  onBlur={(e) => {
                    const val = e.target.value.trim().toLowerCase();
                    if (val && val !== selectedPack.slug) void updatePack(selectedPack.id, { slug: val });
                  }}
                  className="rounded border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-white"
                />
                <input
                  type="number"
                  min={0}
                  defaultValue={selectedPack.sortOrder}
                  onBlur={(e) => void updatePack(selectedPack.id, { sortOrder: Number(e.target.value) || 0 })}
                  className="rounded border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-white"
                />
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={selectedPack.isActive}
                    onChange={(e) => void updatePack(selectedPack.id, { isActive: e.target.checked })}
                  />
                  فعال
                </label>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-3">
                <h3 className="text-xs font-bold text-slate-300">افزودن استیکر</h3>
                <form onSubmit={createItem} className="mt-2 grid gap-2">
                  <input
                    className="rounded border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-white"
                    placeholder="Media ID (WebP)"
                    value={newItem.mediaId}
                    onChange={(e) => setNewItem((v) => ({ ...v, mediaId: e.target.value }))}
                  />
                  <input
                    className="rounded border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-white"
                    placeholder="Media URL (اختیاری)"
                    value={newItem.mediaUrl}
                    onChange={(e) => setNewItem((v) => ({ ...v, mediaUrl: e.target.value }))}
                  />
                  <input
                    className="rounded border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-white"
                    placeholder="label"
                    value={newItem.label}
                    onChange={(e) => setNewItem((v) => ({ ...v, label: e.target.value }))}
                  />
                  <input
                    className="rounded border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-white"
                    placeholder="tags (comma-separated)"
                    value={newItem.tags}
                    onChange={(e) => setNewItem((v) => ({ ...v, tags: e.target.value }))}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min={0}
                      className="rounded border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-white"
                      placeholder="sort order"
                      value={newItem.sortOrder}
                      onChange={(e) => setNewItem((v) => ({ ...v, sortOrder: Number(e.target.value) || 0 }))}
                    />
                    <label className="flex items-center gap-2 rounded border border-slate-700 px-2 py-2 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        checked={newItem.isActive}
                        onChange={(e) => setNewItem((v) => ({ ...v, isActive: e.target.checked }))}
                      />
                      فعال
                    </label>
                  </div>
                  <p className="text-[11px] text-slate-500">Tags در MVP فقط ورودی UI است و روی سرور ذخیره نمی‌شود.</p>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    افزودن استیکر
                  </button>
                </form>
              </div>

              <div>
                <h3 className="text-xs font-bold text-slate-300">آیتم‌های پکیج</h3>
                {itemsLoading ? (
                  <p className="mt-2 text-xs text-slate-500">در حال بارگذاری آیتم‌ها…</p>
                ) : items.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-500">هنوز آیتمی اضافه نشده.</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {items.map((item) => (
                      <div key={item.id} className="rounded border border-slate-800 bg-slate-950/40 p-2">
                        <div className="flex items-start gap-2">
                          {item.media?.url ? (
                            <img
                              src={item.media.url}
                              alt={item.label ?? 'sticker'}
                              className="h-12 w-12 rounded object-contain"
                            />
                          ) : (
                            <div className="h-12 w-12 rounded bg-slate-800" />
                          )}
                          <div className="min-w-0 flex-1 space-y-1">
                            <input
                              defaultValue={item.label ?? ''}
                              onBlur={(e) => void updateItem(item.id, { label: e.target.value.trim() || null })}
                              className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="number"
                                min={0}
                                defaultValue={item.sortOrder}
                                onBlur={(e) => void updateItem(item.id, { sortOrder: Number(e.target.value) || 0 })}
                                className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
                              />
                              <label className="flex items-center gap-1 rounded border border-slate-700 px-2 py-1.5 text-xs text-slate-300">
                                <input
                                  type="checkbox"
                                  checked={item.isActive}
                                  onChange={(e) => void updateItem(item.id, { isActive: e.target.checked })}
                                />
                                فعال
                              </label>
                            </div>
                            <p className="truncate text-[11px] text-slate-500">mediaId: {item.mediaId}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

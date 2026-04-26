'use client';

import { useMemo } from 'react';
import {
  getSmartStickerSuggestions,
  type StickerItemLite,
  type StickerPackLite,
} from '@/lib/sticker-smart';

type StickerItemView = {
  id: string;
  packId: string;
  url: string;
  label: string | null;
};

type StickerPackView = {
  id: string;
  title: string;
  items: StickerItemView[];
};

export function StickerPickerSheet({
  open,
  loading,
  error,
  packs,
  recents,
  draftText,
  submitting,
  onDismiss,
  onPick,
}: {
  open: boolean;
  loading: boolean;
  error: string | null;
  packs: StickerPackView[];
  recents: StickerItemView[];
  draftText: string;
  submitting: boolean;
  onDismiss: () => void;
  onPick: (item: StickerItemView) => void;
}) {
  const allItems = packs.flatMap((p) => p.items);
  const smart = useMemo(
    () =>
      getSmartStickerSuggestions(
        draftText,
        packs as StickerPackLite[],
        12,
      ) as StickerItemView[],
    [draftText, packs],
  );
  const recentsDeduped = useMemo(() => {
    const seen = new Set<string>();
    const list: StickerItemLite[] = [];
    for (const item of recents) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      list.push(item);
      if (list.length >= 12) break;
    }
    return list as StickerItemView[];
  }, [recents]);

  const SmartSection = (
    <section className="mb-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold text-slate-700">پیشنهاد هوشمند</h3>
        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-600">
          AI
        </span>
      </div>
      {allItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">
          استیکرهای هوشمند بعد از افزودن پکیج فعال می‌شود
        </div>
      ) : smart.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">
          برای متن فعلی پیشنهادی پیدا نشد
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2 transition-opacity duration-200">
          {smart.map((item) => (
            <button
              key={`smart-${item.id}`}
              type="button"
              disabled={submitting}
              onClick={() => onPick(item)}
              className="aspect-square overflow-hidden rounded-xl border border-indigo-100 bg-indigo-50/30 p-1 transition hover:bg-indigo-50 disabled:opacity-40"
              title={item.label ?? 'استیکر هوشمند'}
            >
              <img
                src={item.url}
                alt={item.label ?? 'smart sticker'}
                className="h-full w-full object-contain"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}
    </section>
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[62] flex items-end justify-center bg-black/45 backdrop-blur-[1px] sm:items-center"
      role="presentation"
      onClick={onDismiss}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sticker-picker-title"
        className="w-full max-w-md overflow-hidden rounded-t-2xl border border-stone-200/90 bg-white shadow-2xl sm:rounded-2xl"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-200/80 px-4 py-3">
          <h2 id="sticker-picker-title" className="text-sm font-bold text-stone-900">
            استیکر
          </h2>
          <button
            type="button"
            onClick={onDismiss}
            disabled={submitting}
            className="rounded-full px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
          >
            بستن
          </button>
        </div>
        <div className="max-h-[min(26rem,75dvh)] overflow-y-auto px-3 py-3">
          {loading ? (
            <div className="py-10 text-center text-sm text-slate-500">در حال بارگذاری…</div>
          ) : error ? (
            <div className="py-10 text-center text-sm font-semibold text-red-600">{error}</div>
          ) : allItems.length === 0 ? (
            <>
              {SmartSection}
              <div className="py-8 text-center text-sm text-slate-500">هنوز استیکری اضافه نشده</div>
            </>
          ) : (
            <>
              {SmartSection}

              <section className="mb-4">
                <h3 className="mb-2 text-xs font-bold text-slate-700">اخیر</h3>
                {recentsDeduped.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">
                    هنوز استیکر اخیراً استفاده نشده
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {recentsDeduped.map((item) => (
                      <button
                        key={`recent-${item.id}`}
                        type="button"
                        disabled={submitting}
                        onClick={() => onPick(item)}
                        className="aspect-square overflow-hidden rounded-xl border border-emerald-100 bg-emerald-50/30 p-1 transition hover:bg-emerald-50 disabled:opacity-40"
                        title={item.label ?? 'استیکر اخیر'}
                      >
                        <img
                          src={item.url}
                          alt={item.label ?? 'recent sticker'}
                          className="h-full w-full object-contain"
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <h3 className="mb-2 text-xs font-bold text-slate-700">همه پکیج‌ها</h3>
                <div className="space-y-3">
                  {packs.map((pack) => (
                    <div key={pack.id}>
                      <div className="mb-1 text-[11px] font-semibold text-slate-500">{pack.title}</div>
                      <div className="grid grid-cols-4 gap-2">
                        {pack.items.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            disabled={submitting}
                            onClick={() => onPick(item)}
                            className="aspect-square overflow-hidden rounded-xl border border-slate-200 bg-white p-1 transition hover:bg-slate-50 disabled:opacity-40"
                            title={item.label ?? 'استیکر'}
                          >
                            <img
                              src={item.url}
                              alt={item.label ?? 'sticker'}
                              className="h-full w-full object-contain"
                              loading="lazy"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

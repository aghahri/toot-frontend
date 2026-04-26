'use client';

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
  submitting,
  onDismiss,
  onPick,
}: {
  open: boolean;
  loading: boolean;
  error: string | null;
  packs: StickerPackView[];
  submitting: boolean;
  onDismiss: () => void;
  onPick: (item: StickerItemView) => void;
}) {
  if (!open) return null;
  const allItems = packs.flatMap((p) => p.items);
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
            <div className="py-10 text-center text-sm text-slate-500">هنوز استیکری اضافه نشده</div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {allItems.map((item) => (
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
          )}
        </div>
      </div>
    </div>
  );
}

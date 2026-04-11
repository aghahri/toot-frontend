'use client';

import type { ForwardPickTarget } from '@/lib/chat-forward';

type ForwardPickerSheetProps = {
  open: boolean;
  loading: boolean;
  error: string | null;
  submitting: boolean;
  items: ForwardPickTarget[];
  onDismiss: () => void;
  onPick: (target: ForwardPickTarget) => void;
};

export function ForwardPickerSheet({
  open,
  loading,
  error,
  submitting,
  items,
  onDismiss,
  onPick,
}: ForwardPickerSheetProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 backdrop-blur-[1px] sm:items-center"
      role="presentation"
      onClick={() => onDismiss()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="forward-picker-title"
        className="max-h-[min(28rem,85dvh)] w-full max-w-md overflow-hidden rounded-t-2xl border border-stone-200/90 bg-[#fafafa] shadow-2xl sm:rounded-2xl"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-200/80 px-4 py-3">
          <h2 id="forward-picker-title" className="text-base font-bold text-stone-900">
            ارسال به
          </h2>
          <button
            type="button"
            onClick={() => onDismiss()}
            disabled={submitting}
            className="rounded-full px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            بستن
          </button>
        </div>
        <div className="max-h-[min(22rem,70dvh)] overflow-y-auto px-2 py-2">
          {submitting ? (
            <div className="flex flex-col items-center justify-center gap-3 py-14 text-sm font-semibold text-slate-700">
              <span
                className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-800"
                aria-hidden
              />
              در حال ارسال…
            </div>
          ) : loading ? (
            <div className="px-3 py-10 text-center text-sm text-slate-600">در حال بارگذاری…</div>
          ) : error ? (
            <div className="px-3 py-6 text-center text-sm font-semibold text-red-600">{error}</div>
          ) : items.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm leading-relaxed text-slate-600">
              مقصد دیگری برای ارسال نیست. از چت‌ها گفتگوی خصوصی یا گروه جدید بسازید.
            </div>
          ) : (
            items.map((t) => {
              if (t.kind === 'direct') {
                const label = t.peer.name;
                const sub =
                  t.peer.username != null && t.peer.username.trim()
                    ? `@${t.peer.username.trim()}`
                    : t.peer.phoneMasked || '';
                const initial = label.slice(0, 1) || '?';
                return (
                  <button
                    key={`d-${t.id}`}
                    type="button"
                    onClick={() => onPick(t)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right transition hover:bg-white active:bg-stone-100"
                  >
                    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-stone-200 ring-2 ring-white">
                      {t.peer.avatar ? (
                        <img src={t.peer.avatar} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-sm font-bold text-slate-600">
                          {initial}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-stone-900">{label}</div>
                      {sub ? (
                        <div className="mt-0.5 truncate text-[11px] text-slate-500">{sub}</div>
                      ) : (
                        <div className="mt-0.5 truncate text-[11px] text-slate-500">گفتگوی خصوصی</div>
                      )}
                    </div>
                    <span className="shrink-0 text-slate-400" aria-hidden>
                      ‹
                    </span>
                  </button>
                );
              }
              return (
                <button
                  key={`g-${t.id}`}
                  type="button"
                  onClick={() => onPick(t)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-right transition hover:bg-white active:bg-stone-100"
                >
                  <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sky-100 ring-2 ring-white">
                    <span className="text-lg font-bold text-sky-800" aria-hidden>
                      گ
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-stone-900">{t.name}</div>
                    <div className="mt-0.5 truncate text-[11px] text-slate-500">
                      گروه · {t.memberCount} عضو
                    </div>
                  </div>
                  <span className="shrink-0 text-slate-400" aria-hidden>
                    ‹
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import type { FeedTabId } from './feed-types';

const TABS: { id: FeedTabId; label: string }[] = [
  { id: 'for-you', label: 'برای شما' },
  { id: 'following', label: 'دنبال‌شده‌ها' },
  { id: 'local', label: 'محلهٔ من' },
  { id: 'networks', label: 'شبکه‌ها' },
];

type FeedTabsProps = {
  active: FeedTabId;
  onChange: (id: FeedTabId) => void;
};

export function FeedTabs({ active, onChange }: FeedTabsProps) {
  return (
    <div
      className="flex border-b border-slate-200/90 bg-white/90"
      role="tablist"
      aria-label="بخش‌های فید"
    >
      {TABS.map((t) => {
        const selected = active === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(t.id)}
            className={`relative min-w-0 flex-1 px-1 py-3 text-center text-[13px] font-bold transition ${
              selected ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <span className="line-clamp-1">{t.label}</span>
            {selected ? (
              <span
                className="absolute bottom-0 left-1/2 h-0.5 w-10 max-w-[70%] -translate-x-1/2 rounded-full bg-sky-600"
                aria-hidden
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

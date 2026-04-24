'use client';

import type { FeedTabId } from './feed-types';

const TABS: { id: FeedTabId; label: string }[] = [
  { id: 'for-you', label: 'برای شما' },
  { id: 'following', label: 'دنبال‌شده‌ها' },
  { id: 'local', label: 'محله من' },
  { id: 'networks', label: 'فضاهای من' },
];

type FeedTabsProps = {
  active: FeedTabId;
  onChange: (id: FeedTabId) => void;
};

export function FeedTabs({ active, onChange }: FeedTabsProps) {
  return (
    <div className="w-full min-w-0 bg-[var(--surface)]" dir="rtl">
      <div
        className="flex w-full min-w-0 touch-pan-x overflow-x-auto overflow-y-hidden overscroll-x-contain border-b border-[var(--line)]"
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
              className={`relative min-h-[52px] min-w-0 flex-1 px-1.5 py-3 text-center transition sm:px-1 ${
                selected
                  ? 'text-[var(--ink)]'
                  : 'text-[var(--ink-3)] hover:text-[var(--ink)]'
              }`}
            >
              <span
                className={`block truncate tracking-tight text-[13px] ${
                  selected ? 'font-bold' : 'font-semibold'
                }`}
              >
                {t.label}
              </span>
              {selected ? (
                <span
                  className="absolute bottom-0 left-1/2 h-[3px] w-12 max-w-[70%] -translate-x-1/2 rounded-full bg-[var(--accent)]"
                  aria-hidden
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

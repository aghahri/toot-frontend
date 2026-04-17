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
    <div className="theme-panel-bg w-full min-w-0" dir="rtl">
      <div
        className="theme-border-soft flex w-full min-w-0 touch-pan-x overflow-x-auto overflow-y-hidden overscroll-x-contain border-b"
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
              className={`relative min-h-[52px] min-w-0 flex-1 px-1.5 py-2.5 text-center transition sm:px-1 ${
                selected
                  ? 'bg-[var(--accent-soft)] text-[var(--accent-hover)]'
                  : 'theme-text-secondary hover:theme-text-primary'
              }`}
            >
              <span className="block truncate text-[13px] font-extrabold tracking-tight">{t.label}</span>
              {selected ? (
                <span
                  className="absolute bottom-0 left-1/2 h-[3px] w-14 max-w-[75%] -translate-x-1/2 rounded-full bg-[var(--accent)]"
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

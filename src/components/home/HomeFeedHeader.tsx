'use client';

import Link from 'next/link';

export function HomeFeedHeader() {
  return (
    <header className="theme-panel-bg theme-border-soft border-b" dir="rtl">
      <div className="flex w-full min-w-0 items-center gap-2 px-3 py-3">
        <div className="min-w-0 flex-1">
          <h1 className="theme-text-primary truncate text-[1.25rem] font-extrabold tracking-tight">خانه</h1>
          <p className="theme-text-secondary mt-0.5 truncate text-[11px] font-semibold">آخرین‌ها از محله و شبکه</p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Link
            href="/search"
            className="theme-text-secondary flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-[var(--surface-soft)] active:bg-[var(--surface-strong)]"
            aria-label="جستجو"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3-3" strokeLinecap="round" />
            </svg>
          </Link>
          <Link
            href="/notifications"
            className="theme-text-secondary flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-[var(--surface-soft)] active:bg-[var(--surface-strong)]"
            aria-label="اعلان‌ها"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path d="M12 22a2 2 0 002-2H10a2 2 0 002 2z" strokeLinejoin="round" />
              <path
                d="M18 8a6 6 0 10-12 0c0 7-2 7-2 14h16c0-7-2-7-2-14z"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <Link
            href="/direct"
            className="ms-1 rounded-full bg-[var(--accent)] px-3.5 py-2 text-[12px] font-extrabold text-[var(--accent-contrast)] shadow-sm transition hover:bg-[var(--accent-hover)] active:scale-[0.98]"
          >
            چت
          </Link>
        </div>
      </div>
    </header>
  );
}

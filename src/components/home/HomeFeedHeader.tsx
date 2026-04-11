'use client';

import Link from 'next/link';

export function HomeFeedHeader() {
  return (
    <header className="border-b border-slate-100/90 bg-white/90" dir="rtl">
      <div className="mx-auto flex max-w-lg items-center gap-2 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-extrabold tracking-tight text-slate-900">خانه</h1>
          <p className="truncate text-[11px] font-medium text-slate-500">فید توت · محله و شبکه</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Link
            href="/search"
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100"
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
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100"
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
            className="ms-0.5 rounded-full bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700"
          >
            چت
          </Link>
        </div>
      </div>
    </header>
  );
}

'use client';

import Link from 'next/link';

export function HomeFeedHeader() {
  return (
    <header className="border-b border-slate-200/80 bg-white" dir="rtl">
      <div className="mx-auto flex max-w-lg items-center gap-2 px-3 py-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[1.25rem] font-extrabold tracking-tight text-slate-950">خانه</h1>
          <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-500">آخرین‌ها از محله و شبکه</p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Link
            href="/search"
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 active:bg-slate-200"
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
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 active:bg-slate-200"
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
            className="ms-1 rounded-full bg-emerald-600 px-3.5 py-2 text-[12px] font-extrabold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.98]"
          >
            چت
          </Link>
        </div>
      </div>
    </header>
  );
}

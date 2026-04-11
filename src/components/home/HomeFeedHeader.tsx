'use client';

import Link from 'next/link';

type HomeFeedHeaderProps = {
  onSearchClick?: () => void;
};

export function HomeFeedHeader({ onSearchClick }: HomeFeedHeaderProps) {
  return (
    <header className="border-b border-slate-100/90 bg-white/90" dir="rtl">
      <div className="mx-auto flex max-w-lg items-center gap-2 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-extrabold tracking-tight text-slate-900">خانه</h1>
          <p className="truncate text-[11px] font-medium text-slate-500">فید توت · محله و شبکه</p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={onSearchClick}
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100"
            aria-label="جستجو"
          >
            <span className="text-lg" aria-hidden>
              🔍
            </span>
          </button>
          <button
            type="button"
            disabled
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 opacity-60"
            aria-label="اعلان‌ها (به‌زودی)"
          >
            <span className="text-lg" aria-hidden>
              🔔
            </span>
          </button>
          <Link
            href="/direct"
            className="ms-1 rounded-full bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700"
          >
            چت
          </Link>
        </div>
      </div>
    </header>
  );
}

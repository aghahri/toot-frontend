'use client';

import type { ReactNode } from 'react';

type FeedEmptyStateProps = {
  title: string;
  description: string;
  icon?: ReactNode;
};

export function FeedEmptyState({ title, description, icon }: FeedEmptyStateProps) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center rounded-3xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/60 px-6 py-14 text-center shadow-sm ring-1 ring-slate-200/50">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100/90 text-3xl text-slate-400 ring-1 ring-slate-200/60">
        {icon ?? '◇'}
      </div>
      <h2 className="text-[1.05rem] font-extrabold text-slate-900">{title}</h2>
      <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-slate-600">{description}</p>
    </div>
  );
}

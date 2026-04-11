'use client';

import type { ReactNode } from 'react';

type FeedEmptyStateProps = {
  title: string;
  description: string;
  icon?: ReactNode;
};

export function FeedEmptyState({ title, description, icon }: FeedEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-3xl text-slate-400">
        {icon ?? '◇'}
      </div>
      <h2 className="text-base font-bold text-slate-900">{title}</h2>
      <p className="mt-2 max-w-xs text-sm leading-relaxed text-slate-500">{description}</p>
    </div>
  );
}

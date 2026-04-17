'use client';

import Link from 'next/link';

export type TrendChip = {
  display: string;
  href: string;
  volume?: number;
};

type TrendingTopicsRowProps = {
  title: string;
  subtitle?: string;
  items: TrendChip[];
  searchMoreHref?: string;
  searchMoreLabel?: string;
};

export function TrendingTopicsRow({
  title,
  subtitle,
  items,
  searchMoreHref,
  searchMoreLabel = 'جستجو',
}: TrendingTopicsRowProps) {
  if (!items.length) return null;

  return (
    <section
      className="theme-card-bg theme-border-soft mx-2 mt-2 rounded-2xl border px-0 py-0 shadow-sm"
      dir="rtl"
      aria-label={title}
    >
      <div className="flex items-end justify-between gap-2 px-3 pt-2.5 pb-1">
        <div className="min-w-0">
          <p className="theme-text-primary text-[11px] font-extrabold tracking-tight">{title}</p>
          {subtitle ? (
            <p className="theme-text-secondary mt-0.5 text-[10px] font-medium leading-snug">{subtitle}</p>
          ) : null}
        </div>
        {searchMoreHref ? (
          <Link
            href={searchMoreHref}
            className="text-[var(--accent-hover)] shrink-0 text-[10px] font-bold hover:underline"
          >
            {searchMoreLabel}
          </Link>
        ) : null}
      </div>
      <div className="flex gap-2 overflow-x-auto overscroll-x-contain px-2.5 pb-2.5 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((it) => (
          <Link
            key={`${it.href}-${it.display}`}
            href={it.href}
            prefetch={false}
            className="theme-border-soft bg-[var(--surface-muted)] text-[var(--accent-hover)] hover:bg-[var(--accent-soft)] max-w-[min(46vw,11rem)] shrink-0 truncate rounded-full border px-3 py-1.5 text-center text-[12px] font-extrabold transition"
          >
            <span className="inline-flex max-w-full items-baseline justify-center gap-1">
              <span className="truncate">{it.display}</span>
              {it.volume != null && it.volume >= 3 ? (
                <span className="theme-text-secondary shrink-0 text-[9px] font-semibold opacity-80" aria-hidden>
                  ·{it.volume}
                </span>
              ) : null}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

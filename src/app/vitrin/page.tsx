'use client';

import Link from 'next/link';
import { AuthGate } from '@/components/AuthGate';
import { VITRIN_CATALOG } from '@/config/vitrinCatalog';

function VitrinGlyph({ id }: { id: string }) {
  const common = 'h-6 w-6 text-white';
  switch (id) {
    case 'bamakhabar':
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M4 6h16v12H4z" />
          <path d="M8 10h8M8 14h5" strokeLinecap="round" />
        </svg>
      );
    case 'iranregions':
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M4 10l4-4 4 3 4-5 4 6v9H4z" strokeLinejoin="round" />
          <circle cx="10" cy="13" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'bamatel':
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <rect x="7" y="3" width="10" height="18" rx="2" />
          <path d="M10 18h4" strokeLinecap="round" />
        </svg>
      );
    case 'bamabank':
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M3 10h18v10H3z" />
          <path d="M12 6v4M6 10l6-4 6 4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return null;
  }
}

export default function VitrinPage() {
  return (
    <AuthGate>
      <main className="mx-auto w-full max-w-md px-4 pb-6 pt-2" dir="rtl">
        <p className="mb-4 text-sm leading-relaxed text-slate-600">
          خدمات و محتوای منتخب مرتبط با محله؛ برای مشاهده هر مورد، روی کارت بزنید.
        </p>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {VITRIN_CATALOG.map((entry) => (
            <li key={entry.id}>
              <Link
                href={`/vitrin/web?entry=${encodeURIComponent(entry.id)}`}
                className={[
                  'group relative flex min-h-[8.5rem] flex-col overflow-hidden rounded-3xl bg-gradient-to-br p-4 text-white shadow-lg ring-2 ring-inset transition',
                  'hover:scale-[1.01] hover:shadow-xl active:scale-[0.99]',
                  entry.cardClass,
                ].join(' ')}
              >
                <span
                  className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm"
                  aria-hidden
                >
                  <VitrinGlyph id={entry.id} />
                </span>
                <span className="text-lg font-extrabold leading-snug tracking-tight">{entry.title}</span>
                <span className="mt-1 text-xs font-medium leading-relaxed text-white/90">{entry.subtitle}</span>
                <span className="mt-auto pt-3 text-[11px] font-bold text-white/80">مشاهده</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </AuthGate>
  );
}

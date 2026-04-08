'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/home', label: 'استوری', match: (p: string) => p === '/home' },
  { href: '/direct', label: 'گفتگو', match: (p: string) => p === '/direct' || p.startsWith('/direct/') },
  { href: '/vitrin', label: 'ویترین', match: (p: string) => p === '/vitrin' },
  { href: '/spaces', label: 'فضاها', match: (p: string) => p === '/spaces' },
] as const;

export function AppBottomNav() {
  const pathname = usePathname() ?? '';

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200 bg-white/95 shadow-[0_-4px_24px_-8px_rgba(15,23,42,0.12)] backdrop-blur-md"
      aria-label="ناوبری اصلی"
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around gap-1.5 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] pt-2.5">
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={[
                'flex min-h-[3.25rem] min-w-0 flex-1 flex-col items-center justify-center rounded-xl px-1.5 py-1.5 text-center text-xs font-semibold transition-colors',
                active
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              ].join(' ')}
              aria-current={active ? 'page' : undefined}
            >
              <span className="leading-tight">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

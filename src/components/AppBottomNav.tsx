'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  IconTabChats,
  IconTabSpaces,
  IconTabStory,
  IconTabVitrin,
} from '@/components/MessagingTabIcons';

const tabs = [
  {
    href: '/direct',
    label: 'چت‌ها',
    Icon: IconTabChats,
    primary: true,
    match: (p: string) =>
      p === '/direct' ||
      p.startsWith('/direct/') ||
      p === '/groups' ||
      p.startsWith('/groups/'),
  },
  {
    href: '/home',
    label: 'استوری',
    Icon: IconTabStory,
    primary: false,
    match: (p: string) => p === '/home' || p === '/search' || p === '/notifications',
  },
  {
    href: '/vitrin',
    label: 'ویترین',
    Icon: IconTabVitrin,
    primary: false,
    match: (p: string) => p === '/vitrin' || p.startsWith('/vitrin/'),
  },
  {
    href: '/spaces',
    label: 'فضاها',
    Icon: IconTabSpaces,
    primary: false,
    match: (p: string) => p === '/spaces' || p.startsWith('/spaces/'),
  },
] as const;

export function AppBottomNav() {
  const pathname = usePathname() ?? '';

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-20 border-t border-stone-200/90 bg-[#f6f6f6]/98 shadow-[0_-2px_16px_rgba(0,0,0,0.06)] backdrop-blur-md"
      aria-label="ناوبری اصلی"
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around gap-0.5 px-1 pb-[max(0.45rem,env(safe-area-inset-bottom,0px))] pt-1.5">
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          const isPrimary = tab.primary;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={[
                'flex min-h-[3.5rem] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1 text-center transition-colors',
                active && isPrimary
                  ? 'bg-emerald-500/15 text-emerald-700'
                  : active
                    ? 'bg-stone-200/80 text-stone-900'
                    : 'text-stone-500 hover:bg-stone-200/50 hover:text-stone-800',
              ].join(' ')}
              aria-current={active ? 'page' : undefined}
            >
              <tab.Icon
                className={[
                  'h-6 w-6 shrink-0',
                  active && isPrimary ? 'text-emerald-600' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              />
              <span className="max-w-full truncate text-[10px] font-bold leading-tight">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

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
    match: (p: string) =>
      p === '/spaces' || p.startsWith('/spaces/') || p.startsWith('/meetings'),
  },
] as const;

export function AppBottomNav({ hasUnreadDirect = false }: { hasUnreadDirect?: boolean } = {}) {
  const pathname = usePathname() ?? '';

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-20 border-t border-[var(--line)] bg-[var(--surface)]/95 shadow-[0_-4px_24px_-8px_rgba(17,21,26,0.12)] backdrop-blur-md"
      aria-label="ناوبری اصلی"
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around gap-1 px-1 pb-[max(0.45rem,env(safe-area-inset-bottom,0px))] pt-1.5">
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          const showUnreadDot = tab.href === '/direct' && hasUnreadDirect;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={[
                'relative flex min-h-[3.5rem] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1 text-center transition-colors',
                active
                  ? 'text-[var(--ink)]'
                  : 'text-[var(--ink-3)] hover:text-[var(--ink)]',
              ].join(' ')}
              aria-current={active ? 'page' : undefined}
            >
              <span className="relative flex items-center justify-center">
                <tab.Icon className="h-6 w-6 shrink-0" />
                {showUnreadDot ? (
                  <span
                    className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-[var(--accent)]"
                    aria-label="پیام خوانده‌نشده"
                  />
                ) : null}
              </span>
              <span
                className={[
                  'max-w-full truncate text-[11px] leading-tight',
                  active ? 'font-bold' : 'font-semibold',
                ].join(' ')}
              >
                {tab.label}
              </span>
              {active ? (
                <span
                  className="absolute bottom-0.5 h-1 w-1 rounded-full bg-[var(--accent)]"
                  aria-hidden
                />
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

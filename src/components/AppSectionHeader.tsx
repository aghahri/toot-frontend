'use client';

import { usePathname } from 'next/navigation';

/** Section titles for the four main tabs; other routes get no shell header. */
export function getAppSectionTitle(pathname: string): string | null {
  /** Home uses its own sticky feed header (`HomeFeedHeader`); avoid double title. */
  if (pathname === '/home') return null;
  if (pathname === '/direct' || pathname.startsWith('/direct/')) return 'چت‌ها';
  if (pathname === '/vitrin' || pathname.startsWith('/vitrin/')) return 'ویترین';
  if (pathname === '/spaces' || pathname.startsWith('/spaces/') || pathname.startsWith('/meetings')) {
    return 'فضاها';
  }
  return null;
}

export function AppSectionHeader() {
  const pathname = usePathname() ?? '';
  const title = getAppSectionTitle(pathname);
  if (!title) return null;

  const isChats = pathname === '/direct' || pathname.startsWith('/direct/');

  return (
    <header
      className={`theme-panel-bg border-b/90 backdrop-blur-sm ${
        isChats ? 'border-[var(--accent-ring)]' : 'theme-border-soft'
      }`}
      aria-label={title}
    >
      <div className="mx-auto max-w-md px-4 py-3">
        <h1
          className={`text-base font-bold leading-tight tracking-tight ${
            isChats ? 'text-[var(--accent-hover)]' : 'text-[var(--text-primary)]'
          }`}
        >
          {title}
        </h1>
      </div>
    </header>
  );
}

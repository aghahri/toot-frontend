'use client';

import { usePathname } from 'next/navigation';

/** Section titles for the four main tabs; other routes get no shell header. */
export function getAppSectionTitle(pathname: string): string | null {
  if (pathname === '/home') return 'استوری';
  if (pathname === '/direct' || pathname.startsWith('/direct/')) return 'چت';
  if (pathname === '/vitrin') return 'ویترین';
  if (pathname === '/spaces') return 'فضاها';
  return null;
}

export function AppSectionHeader() {
  const pathname = usePathname() ?? '';
  const title = getAppSectionTitle(pathname);
  if (!title) return null;

  return (
    <header
      className="border-b border-slate-200 bg-white/95 backdrop-blur-sm"
      aria-label={title}
    >
      <div className="mx-auto max-w-md px-4 py-3.5">
        <h1 className="text-lg font-extrabold leading-tight text-slate-900">{title}</h1>
      </div>
    </header>
  );
}

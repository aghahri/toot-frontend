'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';

export type AdminSession = {
  globalRole: string;
  name: string;
  email: string;
};

const nav = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/networks', label: 'Networks' },
  { href: '/admin/groups', label: 'Groups' },
  { href: '/admin/channels', label: 'Channels' },
  { href: '/admin/showcase', label: 'Showcase' },
  { href: '/admin/story', label: 'Story queue' },
  { href: '/admin/story/sources', label: 'Story sources' },
  { href: '/admin/moderation', label: 'Moderation' },
  { href: '/admin/geography', label: 'Geography' },
  { href: '/admin/stickers', label: 'پکیج‌های استیکر' },
  { href: '/admin/staff', label: 'Staff roles' },
  { href: '/admin/integrations/sms', label: 'پنل پیامک' },
  { href: '/admin/system', label: 'سلامت سیستم' },
  { href: '/admin/system/analytics', label: 'تحلیل‌های سیستم' },
] as const;

/** Pick the most specific nav.href that matches the pathname. Exact match wins;
 *  otherwise the longest prefix match (with a trailing /) wins, so /admin/system
 *  is not highlighted when /admin/system/analytics is active. */
function bestNavMatch(pathname: string | null): string | null {
  if (!pathname) return null;
  let best: string | null = null;
  for (const item of nav) {
    if (item.href === pathname) return item.href;
    if (item.href !== '/admin' && pathname.startsWith(item.href + '/')) {
      if (!best || item.href.length > best.length) best = item.href;
    }
  }
  return best;
}

export function AdminAppChrome({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<AdminSession | null>(null);
  const [phase, setPhase] = useState<'loading' | 'ok' | 'denied'>('loading');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = getAccessToken();
      if (!token) {
        router.replace('/login');
        return;
      }
      try {
        const s = await apiFetch<AdminSession>('admin/session', { method: 'GET', token });
        if (cancelled) return;
        setSession(s);
        setPhase('ok');
      } catch {
        if (cancelled) return;
        setPhase('denied');
        router.replace('/home');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (phase === 'loading') {
    return (
      <div className="flex min-h-[40vh] items-center justify-center bg-slate-950 text-slate-300" dir="ltr">
        Loading admin…
      </div>
    );
  }

  if (phase === 'denied' || !session) {
    return null;
  }

  const isSuper = session.globalRole === 'SUPER_ADMIN';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100" dir="ltr">
      <div className="flex">
        <aside className="hidden w-52 shrink-0 border-r border-slate-800 bg-slate-900/80 md:block">
          <div className="px-3 py-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Toot Admin</p>
            <p className="mt-1 truncate text-sm text-slate-200">{session.name}</p>
            <p className="truncate text-[11px] text-slate-500">{session.email}</p>
            <p className="mt-2 rounded bg-slate-800 px-2 py-1 text-[10px] font-mono text-amber-200">{session.globalRole}</p>
          </div>
          <nav className="flex flex-col gap-0.5 px-2 pb-6">
            {nav.map((item) => {
              if (item.href === '/admin/staff' && !isSuper) return null;
              const active = item.href === bestNavMatch(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-3 py-2 text-sm font-medium ${
                    active ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <div className="min-w-0 flex-1">
          <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900/50 px-4 py-3 md:hidden">
            <span className="text-sm font-bold text-slate-200">Admin</span>
            <Link href="/home" className="text-xs text-sky-400">
              Exit
            </Link>
          </header>
          <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
        </div>
      </div>
    </div>
  );
}

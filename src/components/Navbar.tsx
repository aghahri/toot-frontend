'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { getAccessToken, performServerLogout } from '@/lib/auth';
import { NotificationsNavLink } from '@/components/NotificationsNavLink';

type MeBrief = { id: string; name: string; avatar: string | null };

export function Navbar() {
  const pathname = usePathname() ?? '';
  const [tokenPresent, setTokenPresent] = useState(false);
  const [me, setMe] = useState<MeBrief | null>(null);

  const onHome = pathname === '/home';

  useEffect(() => {
    const sync = () => setTokenPresent(!!getAccessToken());
    sync();
    if (typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'toot_access_token' || e.key === 'toot_refresh_token') sync();
    };
    const onAuth = () => sync();
    window.addEventListener('storage', onStorage);
    window.addEventListener('toot-auth-token-changed', onAuth);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('toot-auth-token-changed', onAuth);
    };
  }, []);

  useEffect(() => {
    const t = getAccessToken();
    if (!t) {
      setMe(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<MeBrief>('users/me', { method: 'GET', token: t });
        if (!cancelled) setMe(data);
      } catch {
        if (!cancelled) setMe(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tokenPresent]);

  async function onLogout() {
    await performServerLogout();
    window.location.assign('/login');
  }

  const initial = (me?.name ?? '؟').trim().slice(0, 1) || '؟';

  return (
    <header className="theme-panel-bg theme-border-soft sticky top-0 z-10 w-full border-b/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-2 px-3 py-2 sm:px-4">
        <Link
          href={tokenPresent ? '/home' : '/'}
          className="theme-text-primary shrink-0 text-sm font-extrabold tracking-tight"
        >
          توت
        </Link>

        {tokenPresent ? (
          <div className="flex min-w-0 items-center gap-1 sm:gap-1.5">
            {!onHome ? (
              <>
                <Link
                  href="/search"
                  className="theme-text-secondary flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition hover:bg-[var(--surface-soft)]"
                  aria-label="جستجو"
                >
                  <svg
                    className="h-[18px] w-[18px]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path d="M20 20l-3-3" strokeLinecap="round" />
                  </svg>
                </Link>
                <NotificationsNavLink
                  label="اعلان‌ها"
                  buttonClassName="theme-text-secondary flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition hover:bg-[var(--surface-soft)]"
                  iconClassName="h-[18px] w-[18px]"
                />
              </>
            ) : null}

            <Link
              href="/profile"
              className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--accent)] text-xs font-bold text-[var(--accent-contrast)] ring-2 ring-white/80 transition hover:bg-[var(--accent-hover)]"
              aria-label="پروفایل من"
              title="پروفایل من"
            >
              {me?.avatar ? (
                <img src={me.avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                initial
              )}
            </Link>

            <button
              type="button"
              onClick={() => void onLogout()}
              className="theme-card-bg theme-border-soft theme-text-secondary flex h-9 shrink-0 items-center justify-center rounded-full border px-2.5 text-[11px] font-bold transition hover:bg-[var(--surface-soft)] sm:px-3"
              aria-label="خروج از حساب"
            >
              خروج
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}

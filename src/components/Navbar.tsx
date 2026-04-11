'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { clearAccessToken, getAccessToken } from '@/lib/auth';

type MeBrief = { id: string; name: string; avatar: string | null };

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const [tokenPresent, setTokenPresent] = useState(false);
  const [me, setMe] = useState<MeBrief | null>(null);

  const onHome = pathname === '/home';

  useEffect(() => {
    setTokenPresent(!!getAccessToken());
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

  function onLogout() {
    clearAccessToken();
    router.replace('/login');
  }

  const initial = (me?.name ?? '؟').trim().slice(0, 1) || '؟';

  return (
    <header className="sticky top-0 z-10 w-full border-b border-stone-200/90 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-2 px-3 py-2 sm:px-4">
        <Link
          href={tokenPresent ? '/home' : '/'}
          className="shrink-0 text-sm font-extrabold tracking-tight text-stone-900"
        >
          توت
        </Link>

        {tokenPresent ? (
          <div className="flex min-w-0 items-center gap-1 sm:gap-1.5">
            {!onHome ? (
              <>
                <Link
                  href="/search"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-stone-600 transition hover:bg-stone-100"
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
                <Link
                  href="/notifications"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-stone-600 transition hover:bg-stone-100"
                  aria-label="اعلان‌ها"
                >
                  <svg
                    className="h-[18px] w-[18px]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden
                  >
                    <path d="M12 22a2 2 0 002-2H10a2 2 0 002 2z" strokeLinejoin="round" />
                    <path
                      d="M18 8a6 6 0 10-12 0c0 7-2 7-2 14h16c0-7-2-7-2-14z"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Link>
              </>
            ) : null}

            <Link
              href="/profile"
              className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-sky-500 to-slate-600 text-xs font-bold text-white ring-2 ring-white transition hover:opacity-95"
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
              onClick={onLogout}
              className="flex h-9 shrink-0 items-center justify-center rounded-full border border-stone-200/90 bg-white px-2.5 text-[11px] font-bold text-stone-700 transition hover:bg-stone-50 sm:px-3"
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

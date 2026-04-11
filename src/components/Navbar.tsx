'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clearAccessToken, getAccessToken } from '@/lib/auth';

export function Navbar() {
  const router = useRouter();
  const [tokenPresent, setTokenPresent] = useState(false);

  useEffect(() => {
    setTokenPresent(!!getAccessToken());
  }, []);

  function onLogout() {
    clearAccessToken();
    router.replace('/login');
  }

  return (
    <header className="sticky top-0 z-10 w-full border-b border-stone-200/90 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-2 px-3 py-2.5 sm:px-4">
        <Link href={tokenPresent ? '/home' : '/'} className="text-sm font-extrabold tracking-tight text-stone-900">
          توت
        </Link>
        {tokenPresent ? (
          <nav className="flex items-center gap-1 sm:gap-2" aria-label="میان‌برها">
            <Link
              href="/search"
              className="rounded-full px-2.5 py-2 text-xs font-bold text-stone-600 transition hover:bg-stone-100 sm:px-3"
            >
              جستجو
            </Link>
            <Link
              href="/notifications"
              className="rounded-full px-2.5 py-2 text-xs font-bold text-stone-600 transition hover:bg-stone-100 sm:px-3"
            >
              اعلان‌ها
            </Link>
            <Link
              href="/home"
              className="rounded-full px-2.5 py-2 text-xs font-bold text-stone-600 transition hover:bg-stone-100 sm:px-3"
            >
              خانه
            </Link>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-xl border border-stone-200 bg-white px-2.5 py-2 text-xs font-semibold text-stone-800 transition hover:bg-stone-50 sm:px-3"
            >
              خروج
            </button>
          </nav>
        ) : null}
      </div>
    </header>
  );
}

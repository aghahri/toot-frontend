'use client';

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
    <header className="sticky top-0 z-10 w-full border-b border-stone-200/90 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-4 py-2.5">
        <div className="text-sm font-bold tracking-tight text-stone-900">توت</div>
        {tokenPresent ? (
          <button
            type="button"
            onClick={onLogout}
            className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-800 transition hover:bg-stone-50"
          >
            خروج
          </button>
        ) : null}
      </div>
    </header>
  );
}

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
    <header className="sticky top-0 z-10 w-full border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center justify-between gap-3 px-4 py-3">
        <div className="text-sm font-extrabold text-slate-900">توت</div>

        <nav className="flex items-center gap-3">
          {tokenPresent ? (
            <>
              <Link
                href="/home"
                className="text-sm font-semibold text-slate-900 underline-offset-4 hover:underline"
              >
                Home
              </Link>
              <Link
                href="/profile"
                className="text-sm font-semibold text-slate-900 underline-offset-4 hover:underline"
              >
                Profile
              </Link>
              <Link
                href="/upload-test"
                className="text-sm font-semibold text-slate-900 underline-offset-4 hover:underline"
              >
                Upload
              </Link>
            </>
          ) : null}

          <button
            type="button"
            onClick={onLogout}
            className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
            disabled={!tokenPresent}
            aria-disabled={!tokenPresent}
          >
            Logout
          </button>
        </nav>
      </div>
    </header>
  );
}


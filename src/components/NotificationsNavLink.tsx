'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

type UnreadResponse = { count: number };

function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M12 22a2 2 0 002-2H10a2 2 0 002 2z" strokeLinejoin="round" />
      <path d="M18 8a6 6 0 10-12 0c0 7-2 7-2 14h16c0-7-2-7-2-14z" strokeLinejoin="round" />
    </svg>
  );
}

type NotificationsNavLinkProps = {
  /** e.g. h-5 w-5 for home header, h-[18px] for navbar */
  iconClassName?: string;
  buttonClassName: string;
  label: string;
};

export function NotificationsNavLink({
  iconClassName = 'h-5 w-5',
  buttonClassName,
  label,
}: NotificationsNavLinkProps) {
  const pathname = usePathname() ?? '';
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    const t = getAccessToken();
    if (!t) {
      setCount(0);
      return;
    }
    try {
      const res = await apiFetch<UnreadResponse>('notifications/unread-count', {
        method: 'GET',
        token: t,
      });
      setCount(typeof res.count === 'number' ? res.count : 0);
    } catch {
      setCount(0);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, pathname]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onChange = () => void refresh();
    window.addEventListener('toot-notifications-unread-changed', onChange);
    return () => window.removeEventListener('toot-notifications-unread-changed', onChange);
  }, [refresh]);

  return (
    <Link
      href="/notifications"
      className={`relative ${buttonClassName}`}
      aria-label={label}
    >
      <BellIcon className={iconClassName} />
      {count > 0 ? (
        <span
          className="absolute -start-0.5 -top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[9px] font-extrabold leading-none text-[var(--accent-contrast)] shadow-sm ring-2 ring-[var(--panel-bg)]"
          aria-hidden
        >
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </Link>
  );
}

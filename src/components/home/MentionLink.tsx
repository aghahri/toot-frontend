'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

type CacheEntry = { id: string } | 'miss';

const cache = new Map<string, CacheEntry>();

type MentionLinkProps = {
  /** Without leading @ */
  username: string;
  className?: string;
};

export function MentionLink({ username, className }: MentionLinkProps) {
  const key = username.toLowerCase();
  const [href, setHref] = useState<string | null>(() => {
    const c = cache.get(key);
    return c && c !== 'miss' ? `/profile/${c.id}` : null;
  });

  useEffect(() => {
    let cancelled = false;
    const c = cache.get(key);
    if (c === 'miss') {
      setHref(null);
      return;
    }
    if (c) {
      setHref(`/profile/${c.id}`);
      return;
    }

    const t = getAccessToken();
    if (!t) {
      if (!cancelled) setHref(null);
      return;
    }

    void (async () => {
      try {
        const row = await apiFetch<{ id: string }>(
          `users/by-username/${encodeURIComponent(key)}`,
          { method: 'GET', token: t },
        );
        if (cancelled) return;
        cache.set(key, { id: row.id });
        setHref(`/profile/${row.id}`);
      } catch {
        if (!cancelled) {
          cache.set(key, 'miss');
          setHref(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [key]);

  const label = `@${username}`;
  const cls =
    className ??
    'font-semibold text-[var(--accent-hover)] underline-offset-2 hover:underline';

  if (href) {
    return (
      <Link href={href} className={cls} prefetch={false}>
        {label}
      </Link>
    );
  }

  return <span className="font-semibold text-[var(--text-primary)]">{label}</span>;
}

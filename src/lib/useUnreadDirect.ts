'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

const REFRESH_MS = 30_000;

type ConversationRow = { unreadCount?: number };

/**
 * Lightweight unread-direct indicator for the bottom nav.
 *
 * Polls `direct/conversations` every 30 s while authenticated, plus an
 * immediate refetch on auth changes and tab focus. Returns `true` when at
 * least one conversation has unreadCount > 0. The hook is intentionally
 * minimal — no Redux, no socket subscription — so wiring it into the global
 * shell costs almost nothing and never blocks render.
 */
export function useUnreadDirect(): boolean {
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    let timer: number | null = null;

    async function fetchOnce() {
      if (!getAccessToken()) {
        if (!cancelled) setHasUnread(false);
        return;
      }
      try {
        const rows = await apiFetch<ConversationRow[]>('direct/conversations', {
          method: 'GET',
        });
        if (cancelled) return;
        setHasUnread(rows.some((r) => (r.unreadCount ?? 0) > 0));
      } catch {
        /* keep last known state on transient errors */
      }
    }

    function schedule() {
      if (timer != null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void fetchOnce().finally(schedule);
      }, REFRESH_MS);
    }

    function onAuth() {
      void fetchOnce();
    }

    function onVisible() {
      if (document.visibilityState === 'visible') void fetchOnce();
    }

    void fetchOnce();
    schedule();
    window.addEventListener('toot-auth-token-changed', onAuth);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
      window.removeEventListener('toot-auth-token-changed', onAuth);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return hasUnread;
}

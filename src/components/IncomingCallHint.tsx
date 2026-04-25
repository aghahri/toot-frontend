'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useVoiceCall } from '@/context/VoiceCallContext';

/**
 * Tiny hint banner shown when the user lands on /direct/[id] from a tapped
 * INCOMING_CALL push (router carries `?incomingCall=1&sessionId=...`).
 *
 * Lifecycle
 *   - On mount: if `incomingCall=1` is in the URL, show the banner and strip
 *     the query params silently so a page refresh doesn't reactivate.
 *   - Hides as soon as the existing in-app call UI takes over (phase leaves
 *     'idle') — that means the socket reconnected and `call_invite` arrived.
 *   - Auto-hides after 30 s in any case (matches the FCM ttl), so a missed/
 *     timed-out call doesn't leave a banner stranded on screen.
 *
 * No auto-accept. No phantom call state. We only inform the user that we're
 * waiting for the in-app ring to land.
 */
export function IncomingCallHint() {
  const search = useSearchParams();
  const { phase } = useVoiceCall();
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const flag = search?.get('incomingCall');
    if (flag !== '1') return;
    setVisible(true);

    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('incomingCall');
      url.searchParams.delete('sessionId');
      const nextSearch = url.searchParams.toString();
      window.history.replaceState(
        null,
        '',
        url.pathname + (nextSearch ? `?${nextSearch}` : '') + url.hash,
      );
    } catch {
      /* refresh-protection is best-effort */
    }

    timerRef.current = window.setTimeout(() => setVisible(false), 30_000);
    return () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [search]);

  useEffect(() => {
    if (phase !== 'idle') setVisible(false);
  }, [phase]);

  if (!visible) return null;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-[60px] z-40 flex justify-center px-3"
      dir="rtl"
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-auto rounded-full border border-[var(--line)] bg-[var(--accent-soft)] px-4 py-1.5 text-xs font-bold text-[var(--accent-hover)] shadow-sm">
        در حال اتصال به تماس…
      </div>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useVoiceCall } from '@/context/VoiceCallContext';

/**
 * Recovery bridge for INCOMING_CALL push taps.
 *
 * When the user cold-starts /direct/[id] from a notification with the
 * synthetic `?incomingCall=1&sessionId=...` query, the WebView never received
 * the original socket call_invite event. This component:
 *
 *   1. Snapshots the params, then strips them from the URL silently.
 *   2. Fetches GET /calls/sessions/:sessionId (auth-scoped to participants).
 *   3. If status===RINGING and the JWT-resolved viewerRole==='callee', calls
 *      VoiceCallContext.recoverIncomingFromPush — which mounts the existing
 *      answer/reject sheet exactly as the socket path would have.
 *   4. Otherwise shows a one-shot "تماس از دست رفت" chip for a few seconds.
 *
 * No auto-accept. We never invent state — we only restore what the server
 * confirms still exists.
 */

type FetchedSession = {
  id: string;
  conversationId: string;
  callType: string;
  status: 'INITIATED' | 'RINGING' | 'ACCEPTED' | 'REJECTED' | 'ENDED' | 'MISSED' | 'FAILED' | 'BUSY';
  initiatorUserId: string;
  calleeUserId: string | null;
  caller: { id: string; name: string; avatar: string | null; username: string } | null;
  callee: { id: string; name: string; avatar: string | null; username: string } | null;
  viewerRole: 'caller' | 'callee' | 'participant';
};

type HintState = 'hidden' | 'connecting' | 'missed';

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const MISSED_DISPLAY_MS = 4_000;
const MAX_CONNECTING_MS = 30_000;

export function IncomingCallHint() {
  const search = useSearchParams();
  const { phase, recoverIncomingFromPush } = useVoiceCall();
  const [state, setState] = useState<HintState>('hidden');
  const timerRef = useRef<number | null>(null);
  /** Guards strict-mode double-effect runs and rapid re-renders. */
  const consumedRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (consumedRef.current) return;

    const flag = search?.get('incomingCall');
    if (flag !== '1') return;
    consumedRef.current = true;

    const sessionIdRaw = search?.get('sessionId') ?? null;
    const sessionId = sessionIdRaw && ID_PATTERN.test(sessionIdRaw) ? sessionIdRaw : null;

    // Strip params silently so a refresh doesn't reactivate this flow.
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

    setState('connecting');

    // Hard ceiling so a network blackhole can't leave the chip stranded.
    timerRef.current = window.setTimeout(() => {
      setState((prev) => (prev === 'connecting' ? 'hidden' : prev));
    }, MAX_CONNECTING_MS);

    if (!sessionId) {
      // No session id in payload — best we can do is wait for socket
      // call_invite, which the existing in-app path handles.
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const session = await apiFetch<FetchedSession>(
          `calls/sessions/${encodeURIComponent(sessionId)}`,
          { method: 'GET' },
        );
        if (cancelled) return;

        const stillRinging = session.status === 'RINGING' || session.status === 'INITIATED';
        const userIsCallee = session.viewerRole === 'callee';

        if (stillRinging && userIsCallee && session.caller) {
          recoverIncomingFromPush({
            sessionId: session.id,
            callType: session.callType,
            conversationId: session.conversationId,
            caller: session.caller,
          });
          // The existing in-app sheet now owns the surface; hide ourselves.
          setState('hidden');
          return;
        }

        // Anything else (ENDED, REJECTED, MISSED, FAILED, BUSY, ACCEPTED-by-
        // someone-else, or viewer is the caller) → brief "missed" pill, then
        // disappear. We never show stale "ringing" affordances.
        setState('missed');
        if (timerRef.current != null) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => setState('hidden'), MISSED_DISPLAY_MS);
      } catch {
        if (cancelled) return;
        // 404 from the server (not a participant, or session pruned) → fall
        // back to missed-call chip so the user gets some closure.
        setState('missed');
        if (timerRef.current != null) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => setState('hidden'), MISSED_DISPLAY_MS);
      }
    })();

    return () => {
      cancelled = true;
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [search, recoverIncomingFromPush]);

  // The actual ring sheet has taken over (socket invite arrived too, or
  // recoverIncomingFromPush succeeded) — vacate the chip.
  useEffect(() => {
    if (phase !== 'idle' && state !== 'hidden') setState('hidden');
  }, [phase, state]);

  if (state === 'hidden') return null;

  const label = state === 'missed' ? 'تماس از دست رفت' : 'در حال اتصال به تماس…';

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-[60px] z-40 flex justify-center px-3"
      dir="rtl"
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-auto rounded-full border border-[var(--line)] bg-[var(--accent-soft)] px-4 py-1.5 text-xs font-bold text-[var(--accent-hover)] shadow-sm">
        {label}
      </div>
    </div>
  );
}

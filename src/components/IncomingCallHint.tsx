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
 *   1. Snapshots the params on the first render that has them.
 *   2. Fetches GET /calls/sessions/:sessionId (auth-scoped to participants).
 *   3. If status===RINGING and the JWT-resolved viewerRole==='callee', calls
 *      VoiceCallContext.recoverIncomingFromPush — which mounts the existing
 *      answer/reject sheet exactly as the socket path would have.
 *   4. Otherwise shows a one-shot "تماس از دست رفت" chip for a few seconds.
 *
 * No auto-accept. We never invent state — we only restore what the server
 * confirms still exists.
 *
 * Lifecycle note (next/navigation 14.2.x): we deliberately do NOT call
 * window.history.replaceState while the recovery is in flight. Next 14.1+
 * integrates replaceState with the router state, which causes
 * useSearchParams to re-resolve and the consume-effect to cleanup-cancel
 * its own fetch. URL clean-up (so a manual refresh doesn't replay) happens
 * at the very end of the recovery, after the decision is already made.
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

function stripIncomingCallParams() {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('incomingCall') && !url.searchParams.has('sessionId')) return;
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
}

export function IncomingCallHint() {
  const search = useSearchParams();
  const { phase, recoverIncomingFromPush } = useVoiceCall();
  const [state, setState] = useState<HintState>('hidden');
  const timerRef = useRef<number | null>(null);
  /** Guards strict-mode double-effect runs and prevents duplicate fetches when
   *  this component re-renders for any unrelated reason. */
  const consumedRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (consumedRef.current) return;

    const flag = search?.get('incomingCall');
    if (flag !== '1') return;

    const sessionIdRaw = search?.get('sessionId') ?? null;
    const sessionId = sessionIdRaw && ID_PATTERN.test(sessionIdRaw) ? sessionIdRaw : null;

    consumedRef.current = true;
    setState('connecting');

    timerRef.current = window.setTimeout(() => {
      setState((prev) => (prev === 'connecting' ? 'hidden' : prev));
      stripIncomingCallParams();
    }, MAX_CONNECTING_MS);

    if (!sessionId) {
      // No session id in payload — nothing to fetch. The 30 s timeout above
      // will hide the chip; the existing socket call_invite path handles the
      // ring if it eventually arrives.
      return;
    }

    void (async () => {
      try {
        const session = await apiFetch<FetchedSession>(
          `calls/sessions/${encodeURIComponent(sessionId)}`,
          { method: 'GET' },
        );

        const stillRinging = session.status === 'RINGING' || session.status === 'INITIATED';
        const userIsCallee = session.viewerRole === 'callee';

        if (stillRinging && userIsCallee && session.caller) {
          recoverIncomingFromPush({
            sessionId: session.id,
            callType: session.callType,
            conversationId: session.conversationId,
            caller: session.caller,
          });
          // Existing in-app sheet now owns the surface. The phase-watcher
          // effect below also handles this, but be explicit.
          setState('hidden');
          if (timerRef.current != null) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
          }
          stripIncomingCallParams();
          return;
        }

        // Anything else (ENDED, REJECTED, MISSED, FAILED, BUSY, ACCEPTED-by-
        // someone-else, or viewer is the caller) → brief "missed" pill, then
        // disappear. We never show stale "ringing" affordances.
        setState('missed');
        if (timerRef.current != null) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => {
          setState('hidden');
          stripIncomingCallParams();
        }, MISSED_DISPLAY_MS);
      } catch {
        // 404 from the server (not a participant, or session pruned) → fall
        // back to missed-call chip so the user gets some closure.
        setState('missed');
        if (timerRef.current != null) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => {
          setState('hidden');
          stripIncomingCallParams();
        }, MISSED_DISPLAY_MS);
      }
    })();

    // No cleanup that cancels the in-flight fetch. The consume-once semantic
    // means re-renders MUST NOT abort a recovery that already started.
  }, [search, recoverIncomingFromPush]);

  // The actual ring sheet has taken over (recoverIncomingFromPush succeeded
  // or a parallel socket invite arrived) — vacate the chip.
  useEffect(() => {
    if (phase !== 'idle' && state !== 'hidden') {
      setState('hidden');
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      stripIncomingCallParams();
    }
  }, [phase, state]);

  // Final cleanup only on real unmount — clears the timeout but never
  // cancels the in-flight fetch (it has no DOM dependency once started).
  useEffect(() => {
    return () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

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

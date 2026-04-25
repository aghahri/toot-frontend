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
 *   3. Branches on the response:
 *        RINGING/INITIATED + viewerRole='callee' → recoverIncomingFromPush
 *          and hide the chip; the existing answer/reject sheet mounts.
 *        ACCEPTED + viewerRole='callee' (likely picked up on another device)
 *          → silent hide, no missed-call chip.
 *        viewerRole='caller' (user tapped their own outgoing ring)
 *          → silent hide.
 *        ENDED / REJECTED / MISSED / FAILED / BUSY (definitively over)
 *          → 'تماس از دست رفت' chip for ~4 s.
 *        Network / 404 → same missed-call chip (best closure we can offer).
 *
 * No auto-accept. We never invent state — we only restore what the server
 * confirms still exists.
 *
 * Lifecycle note (next/navigation 14.2.x): we deliberately do NOT call
 * window.history.replaceState while the recovery is in flight. Next 14.1+
 * integrates replaceState with the router state, which causes
 * useSearchParams to re-resolve and the consume-effect to cleanup-cancel
 * its own fetch. URL clean-up happens at the very end of the recovery,
 * after the decision is already made.
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

/** Diagnostic logger — visible in `chrome://inspect` while we're stabilising
 *  the push-recovery path. Cheap and confined to this module. */
function diag(...parts: unknown[]) {
  // eslint-disable-next-line no-console
  console.info('[push-recovery]', ...parts);
}

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
    diag('consume', { sessionId, phase });
    setState('connecting');

    timerRef.current = window.setTimeout(() => {
      diag('ceiling-timeout-30s', { phase });
      setState((prev) => (prev === 'connecting' ? 'hidden' : prev));
      stripIncomingCallParams();
    }, MAX_CONNECTING_MS);

    if (!sessionId) {
      diag('no-sessionId — waiting for socket call_invite');
      return;
    }

    void (async () => {
      try {
        const session = await apiFetch<FetchedSession>(
          `calls/sessions/${encodeURIComponent(sessionId)}`,
          { method: 'GET' },
        );
        diag('fetch ok', {
          sessionId: session.id,
          status: session.status,
          viewerRole: session.viewerRole,
          conversationId: session.conversationId,
          phase,
        });

        const isRinging = session.status === 'RINGING' || session.status === 'INITIATED';
        const isCallee = session.viewerRole === 'callee';
        const isCaller = session.viewerRole === 'caller';

        // Happy path: caller is still ringing and we're the callee. Mount the
        // ring sheet (no-ops if VoiceCallContext already has it from socket
        // call_invite — that's fine, the sheet is already up).
        if (isRinging && isCallee && session.caller) {
          diag('recover → mounting ring sheet', { sessionId, phaseBefore: phase });
          recoverIncomingFromPush({
            sessionId: session.id,
            callType: session.callType,
            conversationId: session.conversationId,
            caller: session.caller,
          });
          setState('hidden');
          if (timerRef.current != null) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
          }
          stripIncomingCallParams();
          return;
        }

        // Already accepted somewhere else (multi-device user) → no useful
        // affordance to surface; just clean up silently. Showing 'missed'
        // here would be misleading.
        if (session.status === 'ACCEPTED' && isCallee) {
          diag('already accepted on another device — silent hide');
          setState('hidden');
          if (timerRef.current != null) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
          }
          stripIncomingCallParams();
          return;
        }

        // The viewer is the caller (e.g. tapped a stale FCM for an outgoing
        // ring) — nothing to mount. Silent hide; existing outgoing UI on the
        // caller's side is the source of truth.
        if (isCaller) {
          diag('viewer is caller — silent hide');
          setState('hidden');
          if (timerRef.current != null) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
          }
          stripIncomingCallParams();
          return;
        }

        // Definitively over (ENDED / REJECTED / MISSED / FAILED / BUSY) —
        // brief 'تماس از دست رفت' so the user gets closure.
        diag('terminal status — show missed', { status: session.status });
        setState('missed');
        if (timerRef.current != null) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => {
          setState('hidden');
          stripIncomingCallParams();
        }, MISSED_DISPLAY_MS);
      } catch (err) {
        // 404 from the server (not a participant, or session pruned) → fall
        // back to missed-call chip so the user gets some closure.
        diag('fetch failed → missed', err instanceof Error ? err.message : err);
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
  }, [search, recoverIncomingFromPush, phase]);

  // The actual ring sheet has taken over (recoverIncomingFromPush succeeded
  // or a parallel socket invite arrived) — vacate the chip.
  useEffect(() => {
    if (phase !== 'idle' && state !== 'hidden') {
      diag('phase-watcher: phase=', phase, '→ hide chip');
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

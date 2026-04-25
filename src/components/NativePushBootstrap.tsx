'use client';

import { useEffect, useRef } from 'react';
import { getAccessToken } from '@/lib/auth';
import {
  attachActionListenerOnce,
  disposeNativePushOnLogout,
  initNativePushOnLogin,
} from '@/lib/native-push';

/**
 * Mounts once per app session. Listens for `toot-auth-token-changed` —
 * dispatched by `setSessionTokens`/`clearSession` — and drives the FCM
 * registration handshake on transitions:
 *
 *   logged out → logged in : initNativePushOnLogin()  (lazy, native-only)
 *   logged in  → logged out: disposeNativePushOnLogout()
 *
 * Has no rendered output and no dependency on platform — on plain web it's
 * effectively a no-op because `initNativePushOnLogin` early-returns when
 * Capacitor reports a non-native platform.
 */
export function NativePushBootstrap() {
  // Track previous auth state so we only fire on transitions, not on every
  // unrelated dispatch of the event.
  const wasAuthenticatedRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Attach the actionPerformed listener immediately, regardless of auth
    // state. Cold-start taps deliver the event very early — sometimes before
    // auth state is even known — and the listener has to be in place by then.
    void attachActionListenerOnce();

    const evaluate = () => {
      const isAuthed = !!getAccessToken();
      const prev = wasAuthenticatedRef.current;
      wasAuthenticatedRef.current = isAuthed;

      if (prev === null) {
        // First evaluation after mount. If already authed (e.g. app reopened
        // with a stored token) run init once so a token-rotation since last
        // session is reflected on the server.
        if (isAuthed) void initNativePushOnLogin();
        return;
      }
      if (!prev && isAuthed) {
        void initNativePushOnLogin();
      } else if (prev && !isAuthed) {
        void disposeNativePushOnLogout();
      }
    };

    evaluate();
    window.addEventListener('toot-auth-token-changed', evaluate);
    return () => {
      window.removeEventListener('toot-auth-token-changed', evaluate);
    };
  }, []);

  return null;
}

/**
 * Gating for the voice/WebRTC full-screen debug overlay (ICE, getStats, SDP hints, etc.).
 *
 * `NEXT_PUBLIC_*` is inlined at **build time** by Next.js — changing the value requires a rebuild.
 *
 * Rules:
 * - **Production** or **non-development** (`NODE_ENV !== 'development'`): enabled **only** when
 *   the flag is exactly `'1'` after trim. Any other value → **off** (avoids leaking debug when
 *   `NODE_ENV` is missing, `test`, or mis-set).
 * - **`next dev`** (`NODE_ENV === 'development'`): enabled unless the flag is exactly `'0'` after
 *   trim (set `NEXT_PUBLIC_VOICE_CALL_DEBUG=0` to hide).
 */
function normalizedVoiceDebugFlag(): string {
  const raw = process.env.NEXT_PUBLIC_VOICE_CALL_DEBUG;
  if (raw == null || typeof raw !== 'string') return '';
  return raw.trim();
}

/** Single source of truth for voice/WebRTC debug UI (overlay + getStats polling). */
export const isVoiceDebugEnabled: boolean = (() => {
  const flag = normalizedVoiceDebugFlag();
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv === 'production' || nodeEnv !== 'development') {
    return flag === '1';
  }
  return flag !== '0';
})();

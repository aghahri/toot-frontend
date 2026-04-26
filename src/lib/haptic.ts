/**
 * Tiny haptic tap (10ms) for tactile button feedback on mobile browsers
 * that support the Vibration API. Fails silently otherwise.
 *
 * Self-rate-limits to one tick per 80ms so a quick double-tap or rapid
 * onClick→onSubmit chain doesn't fire two vibrations back-to-back.
 */
let lastTickAt = 0;

export function tinyHaptic(): void {
  if (typeof navigator === 'undefined') return;
  const v = (navigator as Navigator & {
    vibrate?: (pattern: number | number[]) => boolean;
  }).vibrate;
  if (typeof v !== 'function') return;
  const now = Date.now();
  if (now - lastTickAt < 80) return;
  lastTickAt = now;
  try {
    v.call(navigator, [10]);
  } catch {
    /* unsupported / permission denied — ignore */
  }
}

import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor shells the deployed Toot web app in a WebView (same experience as the browser).
 *
 * Required for real devices: set CAPACITOR_WEB_ORIGIN to the HTTPS origin users open in the
 * browser (no trailing slash), e.g. https://app.example.com — then run `npm run android:sync`.
 *
 * Dev (http) is allowed with cleartext only when the origin uses http://.
 */
function resolveCapacitorWebOrigin(): string | null {
  const raw = process.env.CAPACITOR_WEB_ORIGIN?.trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    // Capacitor server URL must be a valid origin for Android Bridge startup.
    return parsed.origin;
  } catch {
    return null;
  }
}

const origin = resolveCapacitorWebOrigin();

const config: CapacitorConfig = {
  appId: 'net.tootapp.mobile',
  appName: 'Toot',
  webDir: 'capacitor-www',
  ...(origin
    ? {
        server: {
          url: origin,
          androidScheme: 'https',
          cleartext: origin.startsWith('http://'),
        },
      }
    : {}),
};

export default config;

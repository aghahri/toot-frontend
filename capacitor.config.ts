import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor shells the deployed Toot web app in a WebView (same experience as the browser).
 *
 * Required for real devices: set CAPACITOR_WEB_ORIGIN to the HTTPS origin users open in the
 * browser (no trailing slash), e.g. https://app.example.com — then run `npm run android:sync`.
 *
 * Dev (http) is allowed with cleartext only when the origin uses http://.
 */
const DEFAULT_ANDROID_WEB_ORIGIN = 'https://app.tootapp.net';

function resolveCapacitorWebOrigin(): string {
  const raw = process.env.CAPACITOR_WEB_ORIGIN?.trim();
  if (!raw) return DEFAULT_ANDROID_WEB_ORIGIN;
  // Historical misconfiguration used during troubleshooting. Keep startup safe and explicit.
  if (raw === 'capacitor://localhost' || raw === 'capacitor://localhost/') {
    return DEFAULT_ANDROID_WEB_ORIGIN;
  }
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(
        `CAPACITOR_WEB_ORIGIN must start with http:// or https:// (received: ${raw})`,
      );
    }
    // Capacitor server URL must be a valid origin for Android Bridge startup.
    return parsed.origin;
  } catch {
    throw new Error(
      `Invalid CAPACITOR_WEB_ORIGIN: "${raw}". Use an absolute web origin such as https://app.tootapp.net`,
    );
  }
}

const origin = resolveCapacitorWebOrigin();

const config: CapacitorConfig = {
  appId: 'net.tootapp.mobile',
  appName: 'Toot',
  webDir: 'capacitor-www',
  server: {
    url: origin,
    androidScheme: 'https',
    cleartext: origin.startsWith('http://'),
  },
};

export default config;

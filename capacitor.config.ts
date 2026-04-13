import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor shells the deployed Toot web app in a WebView (same experience as the browser).
 *
 * Required for real devices: set CAPACITOR_WEB_ORIGIN to the HTTPS origin users open in the
 * browser (no trailing slash), e.g. https://app.example.com — then run `npm run android:sync`.
 *
 * Dev (http) is allowed with cleartext only when the origin uses http://.
 */
const origin = process.env.CAPACITOR_WEB_ORIGIN?.trim();

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

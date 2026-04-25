/**
 * Native (Capacitor) push bootstrap (Phase N1.5).
 *
 * Lifecycle:
 *   1. After login, the app calls `initNativePushOnLogin()`.
 *   2. The helper guards on `Capacitor.isNativePlatform()` — on the plain web
 *      build this is a no-op, so the same web bundle is safe to deploy
 *      everywhere.
 *   3. It checks (and if needed requests) the push permission. If the user
 *      denies, the helper exits quietly — no UI surface in N1.5.
 *   4. It calls `register()` and waits for the one-shot `registration` event
 *      to receive the FCM token, then forwards it to the backend via
 *      `registerDevice`. The returned device id is stashed in localStorage so
 *      logout can call `unregisterDevice` cleanly.
 *
 * Resilience: every step is best-effort and try/catch'd. A failure to
 * register a token must never block sign-in or any other flow.
 */

import type { PluginListenerHandle } from '@capacitor/core';
import type { Token } from '@capacitor/push-notifications';
import { registerDevice, unregisterDevice } from './devices';

const DEVICE_ID_STORAGE_KEY = 'toot:push-device-id';

let initInFlight: Promise<void> | null = null;
let activeListeners: PluginListenerHandle[] = [];

interface CapacitorRuntime {
  isNativePlatform: () => boolean;
  getPlatform: () => string;
}

async function loadCapacitor(): Promise<CapacitorRuntime | null> {
  try {
    const mod = (await import('@capacitor/core')) as unknown as {
      Capacitor?: CapacitorRuntime;
    };
    return mod.Capacitor ?? null;
  } catch {
    return null;
  }
}

function isAndroidNative(cap: CapacitorRuntime | null): boolean {
  if (!cap) return false;
  try {
    return cap.isNativePlatform() && cap.getPlatform() === 'android';
  } catch {
    return false;
  }
}

function readStoredDeviceId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredDeviceId(id: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (id) window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, id);
    else window.localStorage.removeItem(DEVICE_ID_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

async function detachListeners(): Promise<void> {
  const handles = activeListeners;
  activeListeners = [];
  await Promise.all(
    handles.map(async (h) => {
      try {
        await h.remove();
      } catch {
        /* ignore */
      }
    }),
  );
}

/**
 * Run the FCM registration handshake. Idempotent — concurrent calls share the
 * same in-flight promise; calls after a successful registration will re-emit
 * the token (FCM keeps it stable so the backend upsert is a no-op).
 */
export function initNativePushOnLogin(): Promise<void> {
  if (initInFlight) return initInFlight;
  initInFlight = (async () => {
    try {
      const cap = await loadCapacitor();
      if (!isAndroidNative(cap)) return;

      const plugin = (await import('@capacitor/push-notifications')).PushNotifications;

      const initial = await plugin.checkPermissions();
      let granted = initial.receive === 'granted';
      if (!granted && initial.receive !== 'denied') {
        const requested = await plugin.requestPermissions();
        granted = requested.receive === 'granted';
      }
      if (!granted) {
        // User declined the system prompt. We don't fall back to a custom UI
        // in N1.5; if/when settings get a "notifications" toggle the user can
        // re-enable from there.
        return;
      }

      await detachListeners();

      const tokenPromise = new Promise<string>((resolve, reject) => {
        let resolved = false;
        plugin
          .addListener('registration', (t: Token) => {
            if (resolved) return;
            resolved = true;
            resolve(t.value);
          })
          .then((h) => activeListeners.push(h))
          .catch(() => {
            /* listener attach failure swallowed; reject below on timeout */
          });

        plugin
          .addListener('registrationError', (e) => {
            if (resolved) return;
            resolved = true;
            reject(new Error(e.error || 'registration error'));
          })
          .then((h) => activeListeners.push(h))
          .catch(() => {
            /* ignore */
          });

        // Hard ceiling so a permanently-broken FCM environment can't leak the
        // promise. Real registrations resolve in <2 s on Android.
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            reject(new Error('FCM registration timed out'));
          }
        }, 15_000);
      });

      await plugin.register();
      const token = await tokenPromise;

      const device = await registerDevice({
        token,
        platform: 'ANDROID',
      });
      writeStoredDeviceId(device.id);
    } catch {
      /* never propagate — push is non-essential to login */
    } finally {
      initInFlight = null;
    }
  })();
  return initInFlight;
}

/**
 * Best-effort cleanup on logout. Removes the local device row on the server
 * (so the soon-to-be-invalidated FCM token isn't dispatched against) and
 * detaches the plugin so an account switch starts from a clean slate.
 */
export async function disposeNativePushOnLogout(): Promise<void> {
  const id = readStoredDeviceId();
  writeStoredDeviceId(null);
  await detachListeners();

  if (id) {
    try {
      await unregisterDevice(id);
    } catch {
      /* ignore — server-side row will be inert until the row is reattached. */
    }
  }

  try {
    const cap = await loadCapacitor();
    if (!isAndroidNative(cap)) return;
    const plugin = (await import('@capacitor/push-notifications')).PushNotifications;
    await plugin.unregister();
  } catch {
    /* ignore */
  }
}

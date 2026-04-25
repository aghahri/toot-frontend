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
/** Action listener handle is tracked separately so logout's detachListeners()
 *  doesn't take it down — we want incoming-call taps routable across logins. */
let actionListenerHandle: PluginListenerHandle | null = null;
let actionListenerAttachInFlight: Promise<void> | null = null;

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
 * Attach the `pushNotificationActionPerformed` listener immediately at app
 * boot, decoupled from the auth-gated registration handshake.
 *
 * Why this matters: when the user cold-starts the app by tapping an FCM
 * notification, Capacitor emits the action event very early — usually before
 * the registration `register()` Promise resolves and certainly before any
 * `await registerDevice(...)` round-trip. The previous design attached this
 * listener at the tail of `initNativePushOnLogin`, racing with the action
 * event and frequently losing it on cold start. This boot-time hook removes
 * the race entirely.
 *
 * Idempotent — calling twice is a no-op so it can be invoked from any
 * mount-time effect without coordination.
 */
export function attachActionListenerOnce(): Promise<void> {
  if (actionListenerHandle) return Promise.resolve();
  if (actionListenerAttachInFlight) return actionListenerAttachInFlight;
  actionListenerAttachInFlight = (async () => {
    try {
      const cap = await loadCapacitor();
      if (!isAndroidNative(cap)) return;
      const plugin = (await import('@capacitor/push-notifications')).PushNotifications;
      const handle = await plugin.addListener(
        'pushNotificationActionPerformed',
        (action) => {
          handlePushAction(action.notification?.data);
        },
      );
      actionListenerHandle = handle;
    } catch {
      /* listener attach failure non-fatal */
    } finally {
      actionListenerAttachInFlight = null;
    }
  })();
  return actionListenerAttachInFlight;
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

      // The pushNotificationActionPerformed listener is attached separately
      // at app boot (see attachActionListenerOnce). Doing it here would race
      // with cold-start tap events.
    } catch {
      /* never propagate — push is non-essential to login */
    } finally {
      initInFlight = null;
    }
  })();
  return initInFlight;
}

/**
 * Tap router. Called from inside the actionPerformed listener with the
 * `notification.data` blob exactly as the backend sent it. Today only
 * INCOMING_CALL is wired — anything else is a no-op so unrelated push types
 * (direct, mention, reply) keep their default "open last route" behavior.
 *
 * Navigation uses window.location.assign because the Capacitor app loads from
 * a remote origin and Next.js client routing isn't reliably reachable from
 * outside React (this fires before/around React mount on cold start).
 */
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

function handlePushAction(data: unknown): void {
  if (!data || typeof data !== 'object') return;
  const d = data as Record<string, unknown>;
  const type = typeof d.type === 'string' ? d.type : null;
  if (type !== 'INCOMING_CALL') return;

  const conversationId = typeof d.conversationId === 'string' ? d.conversationId : null;
  if (!conversationId || !ID_PATTERN.test(conversationId)) return;

  // sessionId is optional — only forwarded when it passes the same id-shape
  // sanitizer. Anything sketchier is dropped silently rather than coerced.
  const sessionId =
    typeof d.sessionId === 'string' && ID_PATTERN.test(d.sessionId) ? d.sessionId : null;

  const params = new URLSearchParams({ incomingCall: '1' });
  if (sessionId) params.set('sessionId', sessionId);

  try {
    if (typeof window !== 'undefined') {
      window.location.assign(`/direct/${conversationId}?${params.toString()}`);
    }
  } catch {
    /* nothing more we can do */
  }
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

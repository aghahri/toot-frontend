# Android Push Notifications (FCM) — Phase N1.5

The Toot Android app uses **Firebase Cloud Messaging** via the
`@capacitor/push-notifications` plugin. The plugin auto-configures itself
when `google-services.json` is present at `android/app/google-services.json`.

## What's already wired

- `@capacitor/push-notifications@^6.0.5` declared in `package.json`.
- `android/app/build.gradle` already conditionally applies the
  `com.google.gms.google-services` plugin when `google-services.json`
  exists in the same directory (no edits needed for new projects).
- `android/build.gradle` already has the
  `com.google.gms:google-services:4.4.0` classpath.
- `AndroidManifest.xml` declares `POST_NOTIFICATIONS` (required at install
  on API ≤ 32; runtime-prompted on API 33+ via the plugin).
- `src/lib/native-push.ts` requests permission, registers, awaits the FCM
  token, and forwards it to the backend `/devices` endpoint after sign-in.
- `src/components/NativePushBootstrap.tsx` listens for the
  `toot-auth-token-changed` event and runs the helper on login / logout.
- The plain web build is unaffected — both Capacitor modules are loaded
  via dynamic `import()` and the bootstrap short-circuits on
  `Capacitor.isNativePlatform() === false`.

## What you must add per environment (NOT committed)

`google-services.json` is environment-specific (different Firebase project
per stage) and contains your project's API key + sender id. **Never commit
it** — `android/.gitignore` blocks it.

### Steps

1. In the [Firebase Console](https://console.firebase.google.com/), open
   (or create) a project for the desired environment.
2. Add an Android app with package name **`net.tootapp.mobile`** (matches
   `appId` in `capacitor.config.ts`). The SHA-1 is optional for FCM.
3. Download the generated `google-services.json`.
4. Place it at:

   ```
   toot-frontend/android/app/google-services.json
   ```

   (Same directory as `build.gradle`.)
5. Run `npm run android:sync` once to regenerate the Capacitor merge.
6. Build and install:

   ```bash
   cd android
   ./gradlew assembleDebug
   ```

If `google-services.json` is absent at build time, Gradle prints
`google-services.json not found, google-services plugin not applied. Push
Notifications won't work` and the APK still builds — you simply won't
receive any push.

## Backend service-account key

The **server side** of FCM uses a separate file (a service-account JSON
key). That belongs only on the API host, never in this repo and never in
the APK. See the backend `.env.example` keys `PUSH_FCM_*` for details.

## Verification checklist on a real device

1. Install the APK and complete sign-in.
2. Accept the runtime "send notifications" permission prompt (API 33+).
3. Confirm the device row appears at `GET /devices` for the signed-in
   user.
4. Send a direct message from another account — the recipient device
   should buzz with `<sender name>` / `<message body>` in the system tray
   within ~1 s.
5. Sign out — the row should disappear from `/devices` and the FCM token
   should no longer receive deliveries (server-side soft-disable handles
   stragglers).

## Common pitfalls

- **`MissingFirebaseAppException` on startup** — `google-services.json` is
  not in `android/app/`, or its package name doesn't match
  `net.tootapp.mobile`.
- **`SENDER_ID_MISMATCH` in backend logs** — backend service account is
  for a different Firebase project than the one that generated the APK's
  `google-services.json`. Both sides must point at the **same Firebase
  project**.
- **No prompt on Android 13+** — the user previously chose "Don't ask
  again". They have to enable notifications manually in system Settings →
  Apps → Toot → Notifications.
- **Token never arrives** — confirm Google Play Services is up to date on
  the device; FCM registration silently fails on stale Play Services.

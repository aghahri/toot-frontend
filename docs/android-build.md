# Android APK (Capacitor) — Toot web shell

The native app is a **minimal Capacitor 6** wrapper around the **same deployed Next.js site** users open in the browser. The WebView loads your production web origin (`CAPACITOR_WEB_ORIGIN`); it is not a separate React bundle.

Voice calls use **WebRTC inside the system WebView** (same as Chrome). Microphone permission is required on Android.

## Prerequisites

- Node.js 18+ and npm
- JDK 17+
- Android Studio (Android SDK, build-tools, platform)

## One-time setup (after `npm install`)

From the `toot-frontend` repo root:

```bash
npm install
```

The `android/` directory is checked in (Capacitor scaffold). If you ever remove it, recreate with:

```bash
npx cap add android
```

## Point the app at your deployed web app

Set the **exact HTTPS origin** of the frontend (no path, no trailing slash), e.g. `https://app.tootapp.net`:

```bash
export CAPACITOR_WEB_ORIGIN="https://YOUR-FRONTEND-ORIGIN"
npm run android:sync
```

`android:sync` copies `capacitor-www/` into the Android project and bakes `capacitor.config` (including `server.url`) into the native build.

- Use **https** in production.
- For local dev over HTTP, `cleartext` is enabled automatically when `CAPACITOR_WEB_ORIGIN` starts with `http://`.

## Voice / microphone (required for calls)

`android/app/src/main/AndroidManifest.xml` already declares `RECORD_AUDIO` and `MODIFY_AUDIO_SETTINGS` alongside `INTERNET`.

## Open in Android Studio

```bash
npm run android:open
```

Run on a device/emulator from the IDE, or build from CLI (below).

## Build a release APK (unsigned debug-style / local)

```bash
cd android
./gradlew assembleRelease
```

Typical output:

`android/app/build/outputs/apk/release/app-release.apk`

For **Play Store–style signing**, use Android Studio **Build → Generate Signed App Bundle / APK** or configure `signingConfigs` in Gradle (out of scope here).

## Hosting the APK for the landing page CTA

1. Produce a **signed** APK (recommended for real users).
2. Place the file in the Next app as:

   `public/downloads/toot-android-beta.apk`

3. Build the site with:

   `NEXT_PUBLIC_ANDROID_APK_URL=/downloads/toot-android-beta.apk`

   Or use a full CDN URL instead of a path.

**Do not commit** large `.apk` binaries unless your team explicitly wants them in git; `.gitignore` ignores `*.apk` under `public/downloads/`. Copy the file on the build server before `next build`, or upload to CDN and set the full URL env.

## CI / Cursor note

Regenerate embedded `android/app/src/main/assets/capacitor.config.json` whenever you change `capacitor.config.ts` or the web origin, by running `npm run android:sync` with `CAPACITOR_WEB_ORIGIN` set as above.

/**
 * Landing page: optional Android APK (beta) download link.
 *
 * Configure at build time:
 * - Absolute URL: https://…/toot-android-beta.apk (CDN or any host)
 * - Same-origin path: /downloads/toot-android-beta.apk (file must exist under `public/downloads/`
 *   after you copy the signed APK there before `next build`)
 *
 * When unset or invalid, the landing CTA block is not rendered (no fake download).
 */
export function getAndroidApkDownloadUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_ANDROID_APK_URL?.trim();
  if (!raw) return null;
  if (raw.startsWith('/')) {
    if (raw.length < 2 || raw.includes('//') || raw.includes('..')) return null;
    return raw;
  }
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return u.href;
  } catch {
    return null;
  }
}

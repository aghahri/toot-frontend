/**
 * Landing page: optional Android APK (beta) download link.
 * Set NEXT_PUBLIC_ANDROID_APK_URL at build time (HTTPS recommended).
 * When unset or invalid, the landing CTA block is not rendered.
 */
export function getAndroidApkDownloadUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_ANDROID_APK_URL?.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return u.href;
  } catch {
    return null;
  }
}

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://api.tootapp.net';

/** Builds absolute URL for the Toot API (shared by `apiFetch` and auth refresh without import cycles). */
export function buildApiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const trimmedBase = API_BASE_URL.replace(/\/+$/, '');
  const trimmedPath = path.replace(/^\/+/, '');
  return `${trimmedBase}/${trimmedPath}`;
}

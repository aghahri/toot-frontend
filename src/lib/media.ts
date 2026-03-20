const MEDIA_BASE_URL =
  process.env.NEXT_PUBLIC_MEDIA_BASE_URL ?? 'http://media.tootapp.net';

const MEDIA_BUCKET = 'toot-media';

export function buildMediaUrl(key: string): string {
  const normalized = MEDIA_BASE_URL.replace(/\/+$/, '');
  return `${normalized}/${MEDIA_BUCKET}/${key}`;
}


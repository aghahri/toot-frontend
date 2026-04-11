import { getApiBaseUrl, getErrorMessageFromResponse } from '@/lib/api';

/** Upload an image to the existing media endpoint; returns the public URL for profile.avatar. */
export async function uploadImageFile(token: string, file: File): Promise<string> {
  const uploadUrl = `${getApiBaseUrl().replace(/\/+$/, '')}/media/upload`;
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    throw new Error(await getErrorMessageFromResponse(res));
  }
  const data = (await res.json()) as { url?: string; media?: { url?: string } };
  const url = data.media?.url ?? data.url;
  if (!url || typeof url !== 'string') {
    throw new Error('آدرس تصویر دریافت نشد');
  }
  return url;
}

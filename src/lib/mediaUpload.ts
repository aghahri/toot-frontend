import { getApiBaseUrl, getErrorMessageFromResponse } from '@/lib/api';

export async function uploadFileToMediaId(token: string, file: File): Promise<string> {
  const uploadUrl = `${getApiBaseUrl().replace(/\/+$/, '')}/media/upload`;
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error(await getErrorMessageFromResponse(res));
  const data = (await res.json()) as { media?: { id: string } };
  if (!data.media?.id) throw new Error('آپلود ناقص بود');
  return data.media.id;
}

export function uploadVoiceBlobWithXhr(
  token: string,
  blob: Blob,
  mime: string,
  durationMs: number,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const ext = mime.includes('webm') ? 'webm' : mime.includes('mp4') ? 'm4a' : 'webm';
  const form = new FormData();
  form.append('file', blob, `voice.${ext}`);
  form.append('durationMs', String(Math.round(durationMs)));
  const uploadUrl = `${getApiBaseUrl().replace(/\/+$/, '')}/media/upload`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', uploadUrl);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !onProgress) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      try {
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new Error('خطا در آپلود صدا'));
          return;
        }
        const data = JSON.parse(xhr.responseText) as { media?: { id: string } };
        const id = data.media?.id;
        if (!id) reject(new Error('پاسخ آپلود معتبر نیست'));
        else resolve(id);
      } catch {
        reject(new Error('پاسخ آپلود معتبر نیست'));
      }
    };
    xhr.onerror = () => reject(new Error('خطا در ارتباط هنگام آپلود'));
    xhr.onabort = () => reject(new Error('آپلود لغو شد'));
    xhr.send(form);
  });
}

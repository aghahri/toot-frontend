'use client';

import { useMemo, useState } from 'react';
import { AuthGate } from '@/components/AuthGate';
import { getAccessToken } from '@/lib/auth';
import { getApiBaseUrl, getErrorMessageFromResponse } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { buildMediaUrl } from '@/lib/media';

export default function UploadTestPage() {
  const token = useMemo(() => getAccessToken(), []);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultMime, setResultMime] = useState<string | null>(null);

  async function onUpload() {
    if (!file) return;
    setUploading(true);
    setError(null);
    setSuccess(null);
    setResultUrl(null);
    setResultMime(null);

    try {
      const maxBytes = 20 * 1024 * 1024;
      if (file.size > maxBytes) {
        throw new Error('حجم فایل از 20MB بیشتر است');
      }

      // Basic client-side hint; backend also validates.
      const mime = file.type || '';
      const allowed =
        mime.startsWith('image/') ||
        mime.startsWith('video/') ||
        mime.startsWith('audio/') ||
        mime === 'application/pdf' ||
        mime === 'application/zip' ||
        mime === 'application/x-zip-compressed';
      if (!allowed) throw new Error('نوع فایل مجاز نیست');

      const form = new FormData();
      form.append('file', file);

      const uploadUrl = `${getApiBaseUrl().replace(/\/+$/, '')}/media/upload`;
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
      });

      if (!res.ok) {
        const message = await getErrorMessageFromResponse(res);
        throw new Error(message);
      }

      const data = (await res.json()) as {
        url: string;
        // backend returns key and mimeType; key is useful if url is missing
        key?: string;
        mimeType: string;
      };

      const resolvedUrl = data.url ?? (data.key ? buildMediaUrl(data.key) : null);
      if (!resolvedUrl) throw new Error('Media URL missing from API response');

      setResultUrl(resolvedUrl);
      setResultMime(data.mimeType);
      setSuccess('آپلود با موفقیت انجام شد');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در آپلود');
    } finally {
      setUploading(false);
    }
  }

  const canPreviewImage = (resultMime ?? '').startsWith('image/');

  return (
    <AuthGate>
      <main className="mx-auto w-full max-w-md p-4">
        <div className="mb-4">
          <h1 className="text-2xl font-extrabold">تست آپلود</h1>
          <p className="mt-1 text-sm text-slate-700">یک تصویر انتخاب کنید و نتیجه را ببینید.</p>
        </div>

        <Card>
          <div className="space-y-4">
            {success ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                {success}
              </div>
            ) : null}
            <label className="block">
              <div className="mb-2 text-sm font-semibold text-slate-700">فایل</div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const chosen = e.target.files?.[0] ?? null;
                  setFile(chosen);
                  setResultUrl(null);
                  setResultMime(null);
                  setError(null);
                }}
                disabled={uploading}
                className="w-full rounded-xl border border-slate-200 bg-white p-2 text-sm"
              />
            </label>

            {file ? (
              <div className="text-sm text-slate-600">
                انتخاب شده: <span className="font-semibold">{file.name}</span>
              </div>
            ) : null}

            {error ? <div className="text-sm font-semibold text-red-600">{error}</div> : null}

            <Button type="button" onClick={onUpload} loading={uploading} disabled={!file}>
              {uploading ? 'در حال آپلود...' : 'آپلود'}
            </Button>

            {resultUrl ? (
              <div className="space-y-3">
                <div className="text-sm font-semibold">URL برگشتی</div>
                <a className="break-all text-xs text-slate-700 underline" href={resultUrl} target="_blank" rel="noreferrer">
                  {resultUrl}
                </a>

                {canPreviewImage ? (
                  <img
                    src={resultUrl}
                    alt="preview"
                    className="max-h-72 w-full rounded-2xl border border-slate-200 bg-white object-contain"
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        </Card>
      </main>
    </AuthGate>
  );
}


'use client';

import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import { apiFetch, getApiBaseUrl, getErrorMessageFromResponse } from '@/lib/api';
import { buildMediaUrl } from '@/lib/media';
import type { FeedPost } from './feed-types';

type SelectedPreview = { id: string; file: File; previewUrl: string };

type HomeComposeSheetProps = {
  open: boolean;
  onClose: () => void;
  onPostCreated: (post: FeedPost) => void;
};

async function uploadSelectedMedia(
  t: string,
  files: File[],
): Promise<Array<{ id: string; url: string; type: string; mimeType: string }>> {
  if (files.length === 0) return [];

  const uploadUrl = `${getApiBaseUrl().replace(/\/+$/, '')}/media/upload`;
  const uploaded: Array<{ id: string; url: string; type: string; mimeType: string }> = [];

  for (const file of files) {
    const isVideo = file.type.startsWith('video/');
    const maxBytes = isVideo ? 100 * 1024 * 1024 : 20 * 1024 * 1024;

    if (file.size > maxBytes) {
      throw new Error(
        isVideo
          ? `حجم ویدیو ${file.name} از 100MB بیشتر است`
          : `حجم فایل ${file.name} از 20MB بیشتر است`,
      );
    }

    const mime = file.type || '';
    const allowed = mime.startsWith('image/') || mime.startsWith('video/');
    if (!allowed) {
      throw new Error(`فرمت فایل ${file.name} مجاز نیست`);
    }

    const form = new FormData();
    form.append('file', file);

    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${t}` },
      body: form,
    });

    if (!res.ok) {
      const message = await getErrorMessageFromResponse(res);
      throw new Error(message);
    }

    const data = (await res.json()) as {
      url?: string;
      key?: string;
      media?: { id: string; url: string; type: string; mimeType: string };
    };

    const resolvedUrl = data.key ? buildMediaUrl(data.key) : data.url ?? null;
    const mediaId = data.media?.id;
    const mediaType = data.media?.type ?? 'FILE';
    const mimeType = data.media?.mimeType ?? '';

    if (!resolvedUrl || !mediaId) {
      throw new Error('Media upload response is incomplete');
    }

    uploaded.push({
      id: mediaId,
      url: resolvedUrl,
      type: mediaType,
      mimeType,
    });
  }

  return uploaded;
}

export function HomeComposeSheet({ open, onClose, onPostCreated }: HomeComposeSheetProps) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<SelectedPreview[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const nextPreviews = files.map((file, index) => ({
      id: `${file.name}-${file.size}-${index}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setPreviews(nextPreviews);
    return () => {
      nextPreviews.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, [files, open]);

  useEffect(() => {
    if (!open) {
      setText('');
      setFiles([]);
      setError(null);
    }
  }, [open]);

  function removeSelectedFile(indexToRemove: number) {
    setFiles((prev) => prev.filter((_, index) => index !== indexToRemove));
  }

  async function onCreatePost(e: FormEvent) {
    e.preventDefault();
    const t = getAccessToken();
    if (!t) return;

    setSubmitting(true);
    setError(null);
    try {
      const uploadedMedia = await uploadSelectedMedia(t, files);
      const mediaIds = uploadedMedia.map((m) => m.id);
      const fallbackMediaUrl = uploadedMedia[0]?.url ?? null;

      const created = await apiFetch<FeedPost>('posts', {
        method: 'POST',
        token: t,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          mediaUrl: fallbackMediaUrl,
          mediaIds,
        }),
      });

      setText('');
      setFiles([]);
      onPostCreated(created);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ایجاد پست');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
        aria-label="بستن"
        onClick={() => !submitting && onClose()}
      />
      <div
        className="relative max-h-[min(92dvh,640px)] w-full overflow-y-auto rounded-t-3xl border border-slate-200/90 bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="compose-sheet-title"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-4 py-3 backdrop-blur-sm">
          <h2 id="compose-sheet-title" className="text-base font-bold text-slate-900">
            پست جدید
          </h2>
          <button
            type="button"
            onClick={() => !submitting && onClose()}
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100"
            aria-label="بستن"
          >
            ×
          </button>
        </div>
        <form onSubmit={onCreatePost} className="space-y-4 p-4 pb-8">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="چه خبر از محله و شبکهٔ توت؟"
            disabled={submitting}
            rows={4}
            className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-[15px] leading-relaxed text-slate-900 outline-none ring-0 transition focus:border-sky-400/50 focus:bg-white"
          />

          <label className="block">
            <div className="mb-2 text-xs font-semibold text-slate-600">عکس یا ویدیو (اختیاری)</div>
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              disabled={submitting}
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              className="w-full rounded-xl border border-dashed border-slate-200 bg-white p-3 text-sm file:me-2 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
            />
          </label>

          {previews.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {previews.map((item, index) => {
                const isVideo = item.file.type.startsWith('video/');
                return (
                  <div
                    key={item.id}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-2"
                  >
                    <div className="mb-2 truncate text-[11px] text-slate-600">{item.file.name}</div>
                    {isVideo ? (
                      <video
                        src={item.previewUrl}
                        controls
                        className="h-36 w-full rounded-xl bg-black object-cover"
                      />
                    ) : (
                      <img
                        src={item.previewUrl}
                        alt=""
                        className="h-36 w-full rounded-xl object-cover"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => removeSelectedFile(index)}
                      className="mt-2 w-full rounded-xl border border-red-100 bg-red-50/80 px-3 py-2 text-xs font-semibold text-red-700"
                    >
                      حذف
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}

          {error ? <div className="text-sm font-semibold text-red-600">{error}</div> : null}

          <div className="flex gap-2 pt-2">
            <Button type="submit" loading={submitting} className="flex-1">
              {submitting ? 'در حال ارسال…' : 'انتشار'}
            </Button>
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              انصراف
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

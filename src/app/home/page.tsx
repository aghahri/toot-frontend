'use client';

import type { FormEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AuthGate } from '@/components/AuthGate';
import { getAccessToken } from '@/lib/auth';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { apiFetch, getApiBaseUrl, getErrorMessageFromResponse } from '@/lib/api';
import { buildMediaUrl } from '@/lib/media';
import Link from 'next/link';

type FeedMedia = {
  id: string;
  url: string;
  type: string;
  mimeType?: string;
  originalName?: string | null;
  size?: number;
  createdAt?: string;
};

type FeedPost = {
  id: string;
  userId: string;
  text: string;
  mediaUrl: string | null;
  createdAt: string;
  user: { id: string; name: string; avatar: string | null };
  media: FeedMedia[];
};
type SelectedPreview = {
  id: string;
  file: File;
  previewUrl: string;
};
export default function HomePage() {
  const token = useMemo(() => getAccessToken(), []);

  const [text, setText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<SelectedPreview[]>([]);  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

useEffect(() => {
  const nextPreviews = files.map((file, index) => ({
    id: `${file.name}-${file.size}-${index}`,
    file,
    previewUrl: URL.createObjectURL(file),
  }));

  setPreviews(nextPreviews);

  return () => {
    nextPreviews.forEach((item) => URL.revokeObjectURL(item.previewUrl));
  };
}, [files]);  
async function loadFeed() {
    const t = getAccessToken();
    if (!t) return;
    setLoadingFeed(true);
    setError(null);
    try {
      const data = await apiFetch<FeedPost[]>('posts/feed', {
        method: 'GET',
        token: t,
      });
      setPosts(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در دریافت فید');
    } finally {
      setLoadingFeed(false);
    }
  }

  useEffect(() => {
    loadFeed();
    return () => {
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function uploadSelectedMedia(
    t: string,
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
        media?: {
          id: string;
          url: string;
          type: string;
          mimeType: string;
        };
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
      const uploadedMedia = await uploadSelectedMedia(t);
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
      setPosts((prev) => [created, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ایجاد پست');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthGate>
      <main className="mx-auto w-full max-w-md p-4">
        <div className="mb-5 flex items-end justify-between gap-3 border-b border-stone-200/80 pb-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-stone-900">استوری</h1>
            <p className="mt-0.5 text-xs text-stone-500">فید و پست‌های شما</p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/direct"
              className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100"
            >
              چت‌ها
            </Link>
          </div>
        </div>
        <div className="space-y-4">
          <Card>
            <form onSubmit={onCreatePost} className="space-y-3">
              <div className="text-sm font-semibold text-slate-800">ایجاد پست</div>

              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="چی می‌خوای بنویسی؟"
                disabled={submitting}
                rows={3}
                className="w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-slate-400"
              />

              <label className="block">
                <div className="mb-2 text-xs font-semibold text-slate-700">
                  عکس / ویدیو (اختیاری)
                </div>
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  disabled={submitting}
                  onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2 text-sm"
                />
              </label>

{previews.length > 0 ? (
  <div className="space-y-3">
    <div className="text-xs font-semibold text-slate-700">پیش‌نمایش فایل‌ها</div>

    <div className="grid grid-cols-2 gap-3">
      {previews.map((item, index) => {
        const isVideo = item.file.type.startsWith('video/');

        return (
          <div
            key={item.id}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-2"
          >
            <div className="mb-2 text-[11px] text-slate-600 break-all">
              {item.file.name}
            </div>

            {isVideo ? (
              <video
                src={item.previewUrl}
                controls
                className="h-40 w-full rounded-xl bg-black object-cover"
              />
            ) : (
              <img
                src={item.previewUrl}
                alt={item.file.name}
                className="h-40 w-full rounded-xl object-cover"
              />
            )}

            <button
              type="button"
              onClick={() => removeSelectedFile(index)}
              className="mt-2 w-full rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600"
            >
              حذف این فایل
            </button>
          </div>
        );
      })}
    </div>
  </div>
) : null}
              {error ? <div className="text-sm font-semibold text-red-600">{error}</div> : null}

              <Button type="submit" loading={submitting}>
                {submitting ? 'در حال ارسال...' : 'ارسال پست'}
              </Button>

              <div className="break-all text-[11px] text-slate-400">
                توکن: {token ? `${token.slice(0, 16)}...` : '-'}
              </div>
            </form>
          </Card>

          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">فید</div>
            <button
              type="button"
              onClick={loadFeed}
              disabled={loadingFeed || submitting}
              className="text-xs font-semibold text-slate-700 underline disabled:opacity-50"
            >
              {loadingFeed ? 'در حال بارگذاری...' : 'رفرش'}
            </button>
          </div>

          {loadingFeed ? (
            <Card>
              <div className="text-sm text-slate-700">در حال دریافت پست‌ها...</div>
            </Card>
          ) : posts.length === 0 ? (
            <Card>
              <div className="text-sm text-slate-700">هنوز پستی وجود ندارد.</div>
            </Card>
          ) : (
            <div className="space-y-3">
              {posts.map((p) => (
                <Card key={p.id}>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-extrabold text-slate-900">
                          {p.user?.name ?? 'کاربر'}
                        </div>
                        <div className="text-xs text-slate-500">
                          {new Date(p.createdAt).toLocaleString('fa-IR')}
                        </div>
                      </div>
                    </div>

                    {p.text ? (
                      <div className="whitespace-pre-wrap text-sm text-slate-800">{p.text}</div>
                    ) : null}

                    {p.media && p.media.length > 0 ? (
                      <div className="grid grid-cols-1 gap-3">
                        {p.media.map((m) =>
                          m.type === 'VIDEO' || m.mimeType?.startsWith('video/') ? (
                            <video
                              key={m.id}
                              src={m.url}
                              controls
                              className="max-h-96 w-full rounded-2xl border border-slate-200 bg-black"
                            />
                          ) : (
                            <img
                              key={m.id}
                              src={m.url}
                              alt={m.originalName || 'post media'}
                              className="max-h-80 w-full rounded-2xl border border-slate-200 bg-white object-contain"
                            />
                          ),
                        )}
                      </div>
                    ) : p.mediaUrl ? (
                      <img
                        src={p.mediaUrl}
                        alt="post media"
                        className="max-h-80 w-full rounded-2xl border border-slate-200 bg-white object-contain"
                      />
                    ) : null}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </AuthGate>
  );
}

'use client';

import type { FormEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AuthGate } from '@/components/AuthGate';
import { getAccessToken } from '@/lib/auth';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { apiFetch, getApiBaseUrl, getErrorMessageFromResponse } from '@/lib/api';
import { buildMediaUrl } from '@/lib/media';

export default function HomePage() {
  const token = useMemo(() => getAccessToken(), []);

  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [posts, setPosts] = useState<
    Array<{
      id: string;
      userId: string;
      text: string;
      mediaUrl: string | null;
      createdAt: string;
      user: { id: string; name: string; avatar: string | null };
    }>
  >([]);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  async function loadFeed() {
    const t = getAccessToken();
    if (!t) return;
    setLoadingFeed(true);
    setError(null);
    try {
      const data = await apiFetch<
        Array<{
          id: string;
          userId: string;
          text: string;
          mediaUrl: string | null;
          createdAt: string;
          user: { id: string; name: string; avatar: string | null };
        }>
      >('posts/feed', { method: 'GET', token: t });
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

  async function uploadOptionalImage(t: string): Promise<string | null> {
    if (!file) return null;

    const maxBytes = 20 * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new Error('حجم فایل از 20MB بیشتر است');
    }

    const mime = file.type || '';
    if (!mime.startsWith('image/')) {
      throw new Error('فقط تصویر مجاز است');
    }

    const form = new FormData();
    form.append('file', file);

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const uploadUrl = `${getApiBaseUrl().replace(/\/+$/, '')}/media/upload`;
    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${t}` },
      body: form,
      signal: abortRef.current.signal,
    });

    if (!res.ok) {
      const message = await getErrorMessageFromResponse(res);
      throw new Error(message);
    }

    const data = (await res.json()) as { url?: string; key?: string; mimeType?: string };
    const resolvedUrl = data.url ?? (data.key ? buildMediaUrl(data.key) : null);
    if (!resolvedUrl) throw new Error('Media URL missing from API response');
    return resolvedUrl;
  }

  async function onCreatePost(e: FormEvent) {
    e.preventDefault();
    const t = getAccessToken();
    if (!t) return;

    setSubmitting(true);
    setError(null);
    try {
      const mediaUrl = await uploadOptionalImage(t);
      const created = await apiFetch<{
        id: string;
        userId: string;
        text: string;
        mediaUrl: string | null;
        createdAt: string;
        user: { id: string; name: string; avatar: string | null };
      }>('posts', {
        method: 'POST',
        token: t,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, mediaUrl }),
      });

      setText('');
      setFile(null);
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
        <div className="mb-4">
          <h1 className="text-2xl font-extrabold">خانه</h1>
          <p className="mt-1 text-sm text-slate-700">به پنل اصلی خوش آمدید.</p>
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
                <div className="mb-2 text-xs font-semibold text-slate-700">تصویر (اختیاری)</div>
                <input
                  type="file"
                  accept="image/*"
                  disabled={submitting}
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2 text-sm"
                />
              </label>

              {file ? (
                <div className="text-xs text-slate-600">
                  فایل انتخاب شده: <span className="font-semibold">{file.name}</span>
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

                    {p.mediaUrl ? (
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


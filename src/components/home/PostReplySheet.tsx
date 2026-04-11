'use client';

import type { FormEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import type { FeedPost, PostReplyItem } from './feed-types';

function formatReplyTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('fa-IR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function initials(name: string): string {
  const t = name.trim();
  if (!t) return '?';
  return t.slice(0, 1);
}

type PostReplySheetProps = {
  post: FeedPost | null;
  open: boolean;
  onClose: () => void;
  onReplied: (postId: string, replyCount: number) => void;
};

export function PostReplySheet({ post, open, onClose, onReplied }: PostReplySheetProps) {
  const [replies, setReplies] = useState<PostReplyItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const loadReplies = useCallback(async () => {
    if (!post) return;
    const t = getAccessToken();
    if (!t) return;
    setLoadingList(true);
    setListError(null);
    try {
      const data = await apiFetch<PostReplyItem[]>(`posts/${encodeURIComponent(post.id)}/replies`, {
        method: 'GET',
        token: t,
      });
      setReplies(data);
    } catch (e) {
      setListError(e instanceof Error ? e.message : 'خطا در بارگذاری پاسخ‌ها');
    } finally {
      setLoadingList(false);
    }
  }, [post]);

  useEffect(() => {
    if (!open || !post) return;
    void loadReplies();
  }, [open, post, loadReplies]);

  useEffect(() => {
    if (!open) {
      setText('');
      setSubmitError(null);
      setListError(null);
      setReplies([]);
    }
  }, [open]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!post) return;
    const t = getAccessToken();
    if (!t) return;
    const trimmed = text.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await apiFetch<{
        replyCount: number;
        reply: PostReplyItem;
      }>(`posts/${encodeURIComponent(post.id)}/replies`, {
        method: 'POST',
        token: t,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
      });
      setReplies((prev) => [...prev, res.reply]);
      setText('');
      onReplied(post.id, res.replyCount);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'ارسال پاسخ ناموفق بود');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open || !post) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
        aria-label="بستن"
        onClick={() => !submitting && onClose()}
      />
      <div
        className="relative flex max-h-[min(88dvh,560px)] w-full flex-col overflow-hidden rounded-t-3xl border border-slate-200/90 bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reply-sheet-title"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-white/95 px-4 py-3 backdrop-blur-sm">
          <h2 id="reply-sheet-title" className="text-base font-bold text-slate-900">
            پاسخ به پست
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

        <div className="shrink-0 border-b border-slate-50 px-4 py-3 text-sm text-slate-600">
          <p className="line-clamp-3 whitespace-pre-wrap">{post.text || '(بدون متن)'}</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {loadingList ? (
            <div className="space-y-3 px-2 py-4">
              {[0, 1].map((i) => (
                <div key={i} className="flex gap-2">
                  <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-slate-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
                    <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : listError ? (
            <p className="px-3 py-6 text-center text-sm font-semibold text-red-600">{listError}</p>
          ) : replies.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-slate-500">هنوز پاسخی ثبت نشده.</p>
          ) : (
            <ul className="space-y-3 px-2 pb-2">
              {replies.map((r) => {
                const name = r.user?.name?.trim() || 'کاربر';
                const handle = r.user?.username?.trim() || `@user_${r.user.id.slice(0, 6)}`;
                return (
                  <li key={r.id} className="flex gap-2 rounded-2xl border border-slate-100 bg-slate-50/80 p-3">
                    <div className="shrink-0">
                      {r.user?.avatar ? (
                        <img
                          src={r.user.avatar}
                          alt=""
                          className="h-9 w-9 rounded-full object-cover ring-1 ring-slate-200/80"
                        />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-300 text-xs font-bold text-white">
                          {initials(name)}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0 text-xs">
                        <span className="font-bold text-slate-900">{name}</span>
                        <span className="text-slate-500" dir="ltr">
                          {handle}
                        </span>
                        <span className="text-slate-400">{formatReplyTime(r.createdAt)}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                        {r.text}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <form
          onSubmit={onSubmit}
          className="shrink-0 border-t border-slate-100 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="پاسخ خود را بنویسید…"
            disabled={submitting}
            rows={3}
            className="mb-3 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50/80 p-3 text-sm leading-relaxed text-slate-900 outline-none focus:border-sky-400/50 focus:bg-white"
          />
          {submitError ? (
            <div className="mb-2 text-xs font-semibold text-red-600">{submitError}</div>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" loading={submitting} className="flex-1" disabled={!text.trim()}>
              ارسال پاسخ
            </Button>
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              انصراف
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

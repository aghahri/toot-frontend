'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import type { FeedPost, PostEngagementSnapshot } from './feed-types';

function formatFeedTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = Date.now();
  const diff = Math.max(0, now - d.getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'همین الان';
  if (min < 60) return `${min} دقیقه`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ساعت`;
  return d.toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' });
}

function initials(name: string): string {
  const t = name.trim();
  if (!t) return '?';
  return t.slice(0, 1);
}

function formatCount(n: number): string {
  const v = Math.max(0, n);
  if (v < 1000) return String(v);
  if (v < 1_000_000) {
    const k = v / 1000;
    return `${k >= 10 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, '')}k`;
  }
  const m = v / 1_000_000;
  return `${m >= 10 ? Math.round(m) : m.toFixed(1).replace(/\.0$/, '')}M`;
}

type FeedPostCardProps = {
  post: FeedPost;
  onPatch: (postId: string, patch: Partial<FeedPost>) => void;
  onOpenReply: (post: FeedPost) => void;
  /** After repost toggle succeeds, refresh feed (e.g. silent) so repost strip/order matches server. */
  onRepostChanged?: () => void;
  /** Link avatar/name to `/profile/[userId]` (disable on a profile-only timeline if desired). */
  linkAuthorProfile?: boolean;
  /** Brief visual emphasis (e.g. deep-link from search). */
  emphasize?: boolean;
};

export function FeedPostCard({
  post,
  onPatch,
  onOpenReply,
  onRepostChanged,
  linkAuthorProfile = true,
  emphasize = false,
}: FeedPostCardProps) {
  const p = post;
  const handle = p.user?.username?.trim() || `@user_${p.userId.slice(0, 6)}`;
  const name = p.user?.name?.trim() || 'کاربر';

  const likeCount = p.likeCount ?? 0;
  const repostCount = p.repostCount ?? 0;
  const replyCount = p.replyCount ?? 0;
  const liked = p.liked ?? false;
  const reposted = p.reposted ?? false;
  const bookmarked = p.bookmarked ?? false;

  const [likeBusy, setLikeBusy] = useState(false);
  const [repostBusy, setRepostBusy] = useState(false);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);

  const likeLock = useRef(false);
  const repostLock = useRef(false);
  const bookmarkLock = useRef(false);
  const repostFeedbackTimerRef = useRef<number | null>(null);
  const [repostFeedback, setRepostFeedback] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (repostFeedbackTimerRef.current != null) {
        window.clearTimeout(repostFeedbackTimerRef.current);
      }
    };
  }, []);

  const applySnapshot = useCallback(
    (snap: PostEngagementSnapshot) => {
      onPatch(p.id, {
        likeCount: snap.likeCount,
        repostCount: snap.repostCount,
        replyCount: snap.replyCount,
        liked: snap.liked,
        reposted: snap.reposted,
        bookmarked: snap.bookmarked,
      });
    },
    [onPatch, p.id],
  );

  const toggleLike = useCallback(async () => {
    if (likeLock.current) return;
    const t = getAccessToken();
    if (!t) return;
    likeLock.current = true;
    setLikeBusy(true);
    const prev: PostEngagementSnapshot = {
      likeCount,
      repostCount,
      replyCount,
      liked,
      reposted,
      bookmarked,
    };
    onPatch(p.id, {
      liked: !liked,
      likeCount: liked ? likeCount - 1 : likeCount + 1,
    });
    try {
      const snap = await apiFetch<PostEngagementSnapshot>(
        `posts/${encodeURIComponent(p.id)}/like`,
        { method: 'POST', token: t },
      );
      applySnapshot(snap);
    } catch {
      applySnapshot(prev);
    } finally {
      setLikeBusy(false);
      likeLock.current = false;
    }
  }, [
    applySnapshot,
    bookmarked,
    likeCount,
    liked,
    onPatch,
    p.id,
    repostCount,
    reposted,
    replyCount,
  ]);

  const toggleRepost = useCallback(async () => {
    if (repostLock.current) return;
    const t = getAccessToken();
    if (!t) return;
    repostLock.current = true;
    setRepostBusy(true);
    const prev: PostEngagementSnapshot = {
      likeCount,
      repostCount,
      replyCount,
      liked,
      reposted,
      bookmarked,
    };
    onPatch(p.id, {
      reposted: !reposted,
      repostCount: reposted ? repostCount - 1 : repostCount + 1,
    });
    try {
      const snap = await apiFetch<PostEngagementSnapshot>(
        `posts/${encodeURIComponent(p.id)}/repost`,
        { method: 'POST', token: t },
      );
      applySnapshot(snap);
      if (repostFeedbackTimerRef.current != null) {
        window.clearTimeout(repostFeedbackTimerRef.current);
      }
      setRepostFeedback(snap.reposted ? 'بازنشر شد' : 'بازنشر برداشته شد');
      repostFeedbackTimerRef.current = window.setTimeout(() => {
        setRepostFeedback(null);
        repostFeedbackTimerRef.current = null;
      }, 2800);
      onRepostChanged?.();
    } catch {
      applySnapshot(prev);
    } finally {
      setRepostBusy(false);
      repostLock.current = false;
    }
  }, [
    applySnapshot,
    bookmarked,
    likeCount,
    liked,
    onPatch,
    p.id,
    repostCount,
    reposted,
    replyCount,
    onRepostChanged,
  ]);

  const toggleBookmark = useCallback(async () => {
    if (bookmarkLock.current) return;
    const t = getAccessToken();
    if (!t) return;
    bookmarkLock.current = true;
    setBookmarkBusy(true);
    const prev: PostEngagementSnapshot = {
      likeCount,
      repostCount,
      replyCount,
      liked,
      reposted,
      bookmarked,
    };
    onPatch(p.id, { bookmarked: !bookmarked });
    try {
      const snap = await apiFetch<PostEngagementSnapshot>(
        `posts/${encodeURIComponent(p.id)}/bookmark`,
        { method: 'POST', token: t },
      );
      applySnapshot(snap);
    } catch {
      applySnapshot(prev);
    } finally {
      setBookmarkBusy(false);
      bookmarkLock.current = false;
    }
  }, [
    applySnapshot,
    bookmarked,
    likeCount,
    liked,
    onPatch,
    p.id,
    repostCount,
    reposted,
    replyCount,
  ]);

  const isViewerRepostRow = p.feedEntry === 'viewer_repost';
  const authorProfileHref =
    linkAuthorProfile && p.user?.id ? `/profile/${p.user.id}` : null;
  const anchorId = isViewerRepostRow ? `feed-post-${p.id}-vrepost` : `feed-post-${p.id}`;

  return (
    <article
      id={anchorId}
      className={`border-b border-slate-100/90 bg-white px-4 py-4 transition hover:bg-slate-50/80 ${
        isViewerRepostRow ? 'bg-emerald-50/40 ring-1 ring-inset ring-emerald-200/55' : ''
      } ${emphasize ? 'bg-sky-50/90 ring-2 ring-inset ring-sky-400/70' : ''}`}
      dir="rtl"
    >
      {isViewerRepostRow ? (
        <div
          className="mb-3 flex items-center gap-2 rounded-xl border border-emerald-200/90 bg-emerald-100/80 px-3 py-2 text-xs font-extrabold text-emerald-900"
          role="status"
        >
          <span className="text-base" aria-hidden>
            ↻
          </span>
          <span>شما این پست را بازنشر کردید</span>
          {p.viewerRepostedAt ? (
            <time
              className="ms-auto font-mono text-[10px] font-semibold text-emerald-800/80"
              dateTime={p.viewerRepostedAt}
            >
              {formatFeedTime(p.viewerRepostedAt)}
            </time>
          ) : null}
        </div>
      ) : null}
      <div className="flex gap-3">
        {authorProfileHref ? (
          <Link
            href={authorProfileHref}
            className="shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
            aria-label={`پروفایل ${name}`}
          >
            {p.user?.avatar ? (
              <img
                src={p.user.avatar}
                alt=""
                className="h-11 w-11 rounded-full object-cover ring-1 ring-slate-200/80"
              />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-slate-600 text-sm font-bold text-white ring-1 ring-slate-200/60">
                {initials(name)}
              </div>
            )}
          </Link>
        ) : (
          <div className="shrink-0">
            {p.user?.avatar ? (
              <img
                src={p.user.avatar}
                alt=""
                className="h-11 w-11 rounded-full object-cover ring-1 ring-slate-200/80"
              />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-slate-600 text-sm font-bold text-white ring-1 ring-slate-200/60">
                {initials(name)}
              </div>
            )}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2 border-b border-slate-100/80 pb-2.5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                {authorProfileHref ? (
                  <Link
                    href={authorProfileHref}
                    className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 hover:opacity-90"
                  >
                    <span className="truncate text-[15px] font-extrabold text-slate-900">{name}</span>
                    <span className="truncate text-[13px] font-semibold text-slate-500" dir="ltr">
                      {handle}
                    </span>
                  </Link>
                ) : (
                  <>
                    <span className="truncate text-[15px] font-extrabold text-slate-900">{name}</span>
                    <span className="truncate text-[13px] font-semibold text-slate-500" dir="ltr">
                      {handle}
                    </span>
                  </>
                )}
                <span className="text-slate-300">·</span>
                <time
                  className="shrink-0 text-xs font-semibold tabular-nums text-slate-400"
                  dateTime={p.createdAt}
                  title={new Date(p.createdAt).toLocaleString('fa-IR')}
                >
                  {formatFeedTime(p.createdAt)}
                </time>
              </div>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label="گزینه‌های بیشتر (به‌زودی)"
              disabled
            >
              <span className="text-lg leading-none">⋯</span>
            </button>
          </div>

          {p.text ? (
            <div className="mt-2.5 whitespace-pre-wrap text-[15px] leading-[1.58] text-slate-800">
              {p.text}
            </div>
          ) : null}

          {p.media && p.media.length > 0 ? (
            <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50 shadow-sm">
              {p.media.map((m) =>
                m.type === 'VIDEO' || m.mimeType?.startsWith('video/') ? (
                  <video
                    key={m.id}
                    src={m.url}
                    controls
                    className="max-h-[min(24rem,70vh)] w-full bg-black object-contain"
                  />
                ) : (
                  <img
                    key={m.id}
                    src={m.url}
                    alt={m.originalName || ''}
                    className="max-h-[min(24rem,70vh)] w-full object-contain"
                  />
                ),
              )}
            </div>
          ) : p.mediaUrl ? (
            <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200/80 shadow-sm">
              <img
                src={p.mediaUrl}
                alt=""
                className="max-h-[min(24rem,70vh)] w-full object-contain"
              />
            </div>
          ) : null}

          <div
            className="mt-4 flex max-w-md min-h-[44px] items-stretch justify-between gap-1.5 text-slate-500 sm:gap-2"
            dir="ltr"
          >
            <button
              type="button"
              onClick={() => onOpenReply(p)}
              className="flex min-h-[44px] min-w-0 flex-1 items-center justify-center gap-1 rounded-xl text-sm font-semibold transition hover:bg-sky-50 hover:text-sky-700"
              aria-label="پاسخ"
            >
              <span className="text-base" aria-hidden>
                💬
              </span>
              {replyCount > 0 ? (
                <span className="text-xs font-semibold tabular-nums">{formatCount(replyCount)}</span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => void toggleRepost()}
              disabled={repostBusy}
              className={`flex min-h-[44px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-1 text-sm font-semibold transition disabled:opacity-60 ${
                reposted
                  ? 'bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500/45 hover:bg-emerald-100'
                  : 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-700'
              }`}
              aria-label={reposted ? 'حذف بازنشر' : 'بازنشر داخلی'}
              aria-pressed={reposted}
            >
              <span className="flex items-center gap-1">
                <span className="text-base" aria-hidden>
                  ↻
                </span>
                <span
                  className={`text-[10px] font-bold leading-none ${reposted ? 'text-emerald-800' : 'text-slate-500'}`}
                >
                  بازنشر
                </span>
              </span>
              <span
                className={`text-[11px] font-semibold tabular-nums leading-none ${reposted ? 'text-emerald-900' : 'text-slate-400'}`}
              >
                {formatCount(repostCount)}
              </span>
            </button>
            <button
              type="button"
              onClick={() => void toggleLike()}
              disabled={likeBusy}
              className={`flex min-h-[44px] min-w-0 flex-1 items-center justify-center gap-1 rounded-xl text-sm font-semibold transition disabled:opacity-60 ${
                liked ? 'text-rose-600 hover:bg-rose-50' : 'hover:bg-rose-50 hover:text-rose-600'
              }`}
              aria-label={liked ? 'لغو پسند' : 'پسند'}
            >
              <span className="text-base" aria-hidden>
                {liked ? '♥' : '♡'}
              </span>
              {likeCount > 0 ? (
                <span className="text-xs font-semibold tabular-nums">{formatCount(likeCount)}</span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => void toggleBookmark()}
              disabled={bookmarkBusy}
              className={`flex min-h-[44px] min-w-0 flex-1 items-center justify-center rounded-xl text-sm font-semibold transition disabled:opacity-60 ${
                bookmarked
                  ? 'text-amber-700 hover:bg-amber-50'
                  : 'hover:bg-amber-50 hover:text-amber-700'
              }`}
              aria-label={bookmarked ? 'حذف نشان' : 'نشان‌گذاری'}
            >
              <span className="text-base" aria-hidden>
                {bookmarked ? '🔖' : '📑'}
              </span>
            </button>
          </div>
          {repostFeedback ? (
            <p className="mt-2 text-center text-xs font-bold text-emerald-700" role="status">
              {repostFeedback}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { formatCount, toFaDigits } from '@/lib/format';
import type { FeedPost, PostEngagementSnapshot } from './feed-types';
import { MentionComposerField } from './MentionComposerField';
import { renderPostTextWithLinks } from './render-post-text';

function formatFeedTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = Date.now();
  const diff = Math.max(0, now - d.getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'همین الان';
  if (min < 60) return `${toFaDigits(min)} دقیقه`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${toFaDigits(hr)} ساعت`;
  return d.toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' });
}

function initials(name: string): string {
  const t = name.trim();
  if (!t) return '?';
  return t.slice(0, 1);
}

// Persian-numeral counts for the X-style action row come from the shared
// formatCount() in src/lib/format.ts (imported above) — yields '۱٫۲ هزار' /
// '۳٫۴ میلیون' for the >1k / >1M cases.

type FeedPostCardProps = {
  post: FeedPost;
  onPatch: (postId: string, patch: Partial<FeedPost>) => void;
  onDelete?: (postId: string) => void;
  onOpenReply: (post: FeedPost) => void;
  /** After repost toggle succeeds, refresh feed (e.g. silent) so repost strip/order matches server. */
  onRepostChanged?: () => void;
  /** Link avatar/name to `/profile/[userId]` (disable on a profile-only timeline if desired). */
  linkAuthorProfile?: boolean;
  /** Brief visual emphasis (e.g. deep-link from search). */
  emphasize?: boolean;
  viewerUserId?: string | null;
  scope?: 'for-you' | 'following' | 'local' | 'networks';
};

export function FeedPostCard({
  post,
  onPatch,
  onDelete,
  onOpenReply,
  onRepostChanged,
  linkAuthorProfile = true,
  emphasize = false,
  viewerUserId = null,
  scope = 'for-you',
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
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editText, setEditText] = useState(post.text ?? '');
  const [editBusy, setEditBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [ownerActionError, setOwnerActionError] = useState<string | null>(null);

  const likeLock = useRef(false);
  const repostLock = useRef(false);
  const bookmarkLock = useRef(false);
  const repostFeedbackTimerRef = useRef<number | null>(null);
  const [repostFeedback, setRepostFeedback] = useState<string | null>(null);

  useEffect(() => {
    setEditText(post.text ?? '');
  }, [post.id, post.text]);

  useEffect(() => {
    return () => {
      if (repostFeedbackTimerRef.current != null) {
        window.clearTimeout(repostFeedbackTimerRef.current);
      }
    };
  }, []);

  const isOwner = !!viewerUserId && viewerUserId === p.userId;

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

  const createQuoteRepost = useCallback(async () => {
    if (quoteBusy) return;
    const t = getAccessToken();
    if (!t) return;
    const text = window.prompt('متن نقل‌قول را بنویسید (اختیاری):', '') ?? '';
    setQuoteBusy(true);
    try {
      await apiFetch<FeedPost>(`posts/${encodeURIComponent(p.id)}/quote`, {
        method: 'POST',
        token: t,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      setRepostFeedback('نقل‌قول منتشر شد');
      if (repostFeedbackTimerRef.current != null) {
        window.clearTimeout(repostFeedbackTimerRef.current);
      }
      repostFeedbackTimerRef.current = window.setTimeout(() => {
        setRepostFeedback(null);
        repostFeedbackTimerRef.current = null;
      }, 2800);
      onRepostChanged?.();
    } catch {
      setRepostFeedback('انتشار نقل‌قول ناموفق بود');
    } finally {
      setQuoteBusy(false);
    }
  }, [onRepostChanged, p.id, quoteBusy]);

  const isViewerRepostRow = p.feedEntry === 'viewer_repost';
  const authorProfileHref =
    linkAuthorProfile && p.user?.id ? `/profile/${p.user.id}` : null;
  const anchorId = isViewerRepostRow ? `feed-post-${p.id}-vrepost` : `feed-post-${p.id}`;

  const saveEdit = useCallback(async () => {
    if (!isOwner || editBusy) return;
    const t = getAccessToken();
    if (!t) return;
    setEditBusy(true);
    setOwnerActionError(null);
    try {
      const updated = await apiFetch<FeedPost>(`posts/${encodeURIComponent(p.id)}`, {
        method: 'PATCH',
        token: t,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: editText }),
      });
      onPatch(p.id, {
        text: updated.text,
        media: updated.media,
        mediaUrl: updated.mediaUrl,
      });
      setEditOpen(false);
      setMenuOpen(false);
    } catch (e) {
      setOwnerActionError(e instanceof Error ? e.message : 'ویرایش انجام نشد');
    } finally {
      setEditBusy(false);
    }
  }, [editBusy, editText, isOwner, onPatch, p.id]);

  const removePost = useCallback(async () => {
    if (!isOwner || deleteBusy) return;
    const t = getAccessToken();
    if (!t) return;
    const ok = window.confirm('این پست حذف شود؟ این عمل قابل بازگشت نیست.');
    if (!ok) return;
    setDeleteBusy(true);
    setOwnerActionError(null);
    try {
      await apiFetch<{ success: true; id: string }>(`posts/${encodeURIComponent(p.id)}`, {
        method: 'DELETE',
        token: t,
      });
      onDelete?.(p.id);
    } catch (e) {
      setOwnerActionError(e instanceof Error ? e.message : 'حذف انجام نشد');
    } finally {
      setDeleteBusy(false);
      setMenuOpen(false);
    }
  }, [deleteBusy, isOwner, onDelete, p.id]);

  return (
    <article
      id={anchorId}
      className={`bg-[var(--surface)] border-b border-[var(--line)] px-4 py-3.5 transition hover:bg-[var(--surface-2)]/70 ${
        isViewerRepostRow ? 'bg-[var(--accent-soft)]/30' : ''
      } ${emphasize ? 'bg-[var(--accent-soft)]/60 ring-2 ring-inset ring-[var(--accent)]' : ''}`}
      dir="rtl"
    >
      {isViewerRepostRow ? (
        <div
          className="mb-3 flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-xs font-extrabold text-[var(--ink-2)]"
          role="status"
        >
          <span className="text-base text-[var(--accent)]" aria-hidden>
            ↻
          </span>
          <span>شما این پست را بازنشر کردید</span>
          {p.viewerRepostedAt ? (
            <time
              className="ms-auto font-mono text-[10px] font-semibold text-[var(--ink-3)]"
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
            className="shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
            aria-label={`پروفایل ${name}`}
          >
            {p.user?.avatar ? (
              <img
                src={p.user.avatar}
                alt=""
                className="h-11 w-11 rounded-full object-cover ring-1 ring-[var(--line)]"
              />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface-2)] text-sm font-bold text-[var(--ink-2)] ring-1 ring-[var(--line)]">
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
                className="h-11 w-11 rounded-full object-cover ring-1 ring-[var(--line)]"
              />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface-2)] text-sm font-bold text-[var(--ink-2)] ring-1 ring-[var(--line)]">
                {initials(name)}
              </div>
            )}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2 pb-1.5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                {authorProfileHref ? (
                  <Link
                    href={authorProfileHref}
                    className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 hover:opacity-90"
                  >
                    <span className="truncate text-[15px] font-extrabold text-[var(--ink)]">{name}</span>
                    <span className="truncate text-[13px] font-semibold text-[var(--ink-3)]" dir="ltr">
                      {handle}
                    </span>
                  </Link>
                ) : (
                  <>
                    <span className="truncate text-[15px] font-extrabold text-[var(--ink)]">{name}</span>
                    <span className="truncate text-[13px] font-semibold text-[var(--ink-3)]" dir="ltr">
                      {handle}
                    </span>
                  </>
                )}
                <span className="text-[var(--ink-4)]">·</span>
                <time
                  className="shrink-0 text-xs font-semibold tabular-nums text-[var(--ink-3)]"
                  dateTime={p.createdAt}
                  title={new Date(p.createdAt).toLocaleString('fa-IR')}
                >
                  {formatFeedTime(p.createdAt)}
                </time>
              </div>
            </div>
            <div className="relative shrink-0">
              {isOwner ? (
                <>
                  <button
                    type="button"
                    className="rounded-full p-1.5 text-[var(--ink-3)] transition hover:bg-[var(--surface-2)] hover:text-[var(--ink-2)]"
                    aria-label="گزینه‌های پست"
                    onClick={() => setMenuOpen((v) => !v)}
                  >
                    <span className="text-lg leading-none">⋯</span>
                  </button>
                  {menuOpen ? (
                    <div className="absolute left-0 top-9 z-10 min-w-[9rem] overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] shadow-lg">
                      <button
                        type="button"
                        onClick={() => {
                          setEditOpen(true);
                          setMenuOpen(false);
                          setOwnerActionError(null);
                        }}
                        className="block w-full px-3 py-2 text-right text-xs font-bold text-[var(--ink)] transition hover:bg-[var(--surface-2)]"
                      >
                        ویرایش پست
                      </button>
                      <button
                        type="button"
                        disabled={deleteBusy}
                        onClick={() => void removePost()}
                        className="block w-full px-3 py-2 text-right text-xs font-bold text-[var(--accent-hover)] transition hover:bg-[var(--surface-2)] disabled:opacity-60"
                      >
                        حذف پست
                      </button>
                    </div>
                  ) : null}
                </>
              ) : (
                <button
                  type="button"
                  className="rounded-full p-1.5 text-[var(--ink-4)]"
                  aria-label="گزینه‌های بیشتر"
                  disabled
                >
                  <span className="text-lg leading-none">⋯</span>
                </button>
              )}
            </div>
          </div>

          {editOpen ? (
            <div className="mt-2.5 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-2.5">
              <MentionComposerField
                value={editText}
                onChange={setEditText}
                className="min-h-[5.5rem] w-full resize-y rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent-ring)] focus:ring-2 focus:ring-[var(--accent-soft)]"
                placeholder="متن پست"
                rows={5}
              />
              <div className="mt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditOpen(false);
                    setEditText(post.text ?? '');
                    setOwnerActionError(null);
                  }}
                  className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-bold text-[var(--ink-2)] transition hover:bg-[var(--surface)]"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  disabled={editBusy}
                  onClick={() => void saveEdit()}
                  className="rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-bold text-[var(--accent-contrast)] transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
                >
                  {editBusy ? '...' : 'ذخیره'}
                </button>
              </div>
            </div>
          ) : null}

          {ownerActionError ? (
            <p className="mt-2 text-xs font-semibold text-[var(--accent-hover)]">{ownerActionError}</p>
          ) : null}

          {p.text ? (
            <div className="mt-1.5 whitespace-pre-wrap text-[15px] leading-[1.58] text-[var(--ink)]">
              {renderPostTextWithLinks(p.text)}
            </div>
          ) : null}

          {p.quotedPost ? (
            <Link
              href={`/home?postId=${encodeURIComponent(p.quotedPost.id)}`}
              className="mt-2 block rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 transition hover:bg-[var(--surface-strong)]"
            >
              <p className="text-[11px] font-bold text-[var(--ink-3)]" dir="ltr">
                @{p.quotedPost.user?.username ?? 'user'}
              </p>
              <p className="mt-1 line-clamp-3 text-[13px] text-[var(--ink-2)]">
                {p.quotedPost.text || 'بدون متن'}
              </p>
            </Link>
          ) : null}

          {p.educationCourse ? (
            <div className="mt-2 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2">
              <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                {scope === 'networks' ? (
                  <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 font-extrabold text-[var(--accent-hover)]">
                    دوره جدید
                  </span>
                ) : (
                  <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 font-extrabold text-[var(--accent-hover)]">
                    دوره آموزشی
                  </span>
                )}
                <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 font-extrabold text-[var(--success)]">
                  مدرس معتبر
                </span>
                {p.educationCourse.nextMeeting?.status === 'LIVE' ? (
                  <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 font-extrabold text-[var(--accent)]">
                    کلاس زنده
                  </span>
                ) : null}
                {scope === 'networks' && !p.educationCourse.isEnrolled ? (
                  <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 font-extrabold text-[var(--warning)]">
                    ثبت‌نام باز
                  </span>
                ) : null}
                {scope === 'local' ? (
                  <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 font-extrabold text-[var(--info)]">
                    نزدیک شما
                  </span>
                ) : null}
              </div>
              <p className="mt-1 line-clamp-2 text-[14px] font-extrabold text-[var(--ink)]">
                {p.educationCourse.title}
              </p>
              <p className="mt-1 text-[11px] text-[var(--ink-2)]">
                مدرس: {p.educationCourse.owner.name}
                {p.educationCourse.owner.username ? ` · @${p.educationCourse.owner.username}` : ''}
              </p>
              <p className="mt-1 text-[11px] text-[var(--ink-2)]">
                {toFaDigits(p.educationCourse.enrollmentsCount)} دانشجو
                {p.educationCourse.nextMeeting
                  ? ` · جلسه بعدی: ${formatFeedTime(p.educationCourse.nextMeeting.startsAt)}`
                  : ''}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link
                  href={`/education/${p.educationCourse.id}`}
                  className="rounded-lg bg-[var(--accent)] px-2.5 py-1 text-[11px] font-extrabold text-[var(--accent-contrast)]"
                >
                  مشاهده دوره
                </Link>
                {!p.educationCourse.isEnrolled && viewerUserId !== p.educationCourse.ownerId ? (
                  <Link
                    href={`/education/${p.educationCourse.id}`}
                    className="rounded-lg border border-[var(--line)] px-2.5 py-1 text-[11px] font-bold text-[var(--ink-2)]"
                  >
                    ثبت‌نام
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}

          {p.media && p.media.length > 0 ? (
            <div className="mt-3 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface-2)]">
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
            <div className="mt-3 overflow-hidden rounded-2xl border border-[var(--line)]">
              <img
                src={p.mediaUrl}
                alt=""
                className="max-h-[min(24rem,70vh)] w-full object-contain"
              />
            </div>
          ) : null}

          <div
            className="mt-3.5 flex max-w-md min-h-[44px] items-stretch justify-between gap-1.5 border-t border-[var(--line)] pt-2 text-[var(--ink-3)] sm:gap-2"
            dir="ltr"
          >
            <button
              type="button"
              onClick={() => onOpenReply(p)}
              className="flex min-h-[44px] min-w-0 flex-1 items-center justify-center gap-1 rounded-xl text-sm font-semibold transition hover:bg-[var(--surface-2)] hover:text-[var(--accent-hover)]"
              aria-label="پاسخ"
            >
              <span className="text-base" aria-hidden>
                💬
              </span>
              <span className="text-[11px] font-bold leading-none">پاسخ</span>
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
                  ? 'bg-[var(--surface-2)] text-[var(--success)] ring-2 ring-[color:var(--success)]/45'
                  : 'text-[var(--ink-3)] hover:bg-[var(--surface-2)] hover:text-[var(--success)]'
              }`}
              aria-label={reposted ? 'حذف بازنشر' : 'بازنشر داخلی'}
              aria-pressed={reposted}
            >
              <span className="flex items-center gap-1">
                <span className="text-base" aria-hidden>
                  ↻
                </span>
                <span
                  className={`text-[10px] font-bold leading-none ${reposted ? 'text-[var(--success)]' : 'text-[var(--ink-3)]'}`}
                >
                  بازنشر
                </span>
              </span>
              <span
                className={`text-[11px] font-semibold tabular-nums leading-none ${reposted ? 'text-[var(--success)]' : 'text-[var(--ink-4)]'}`}
              >
                {formatCount(repostCount)}
              </span>
            </button>
            <button
              type="button"
              onClick={() => void createQuoteRepost()}
              disabled={quoteBusy}
              className="flex min-h-[44px] min-w-0 flex-1 items-center justify-center gap-1 rounded-xl text-sm font-semibold text-[var(--ink-3)] transition hover:bg-[var(--surface-2)] hover:text-[var(--accent-hover)] disabled:opacity-60"
              aria-label="نقل‌قول"
            >
              <span className="text-base" aria-hidden>
                ❝
              </span>
              <span className="text-[11px] font-bold leading-none">نقل‌قول</span>
            </button>
            <button
              type="button"
              onClick={() => void toggleLike()}
              disabled={likeBusy}
              className={`flex min-h-[44px] min-w-0 flex-1 items-center justify-center gap-1 rounded-xl text-sm font-semibold transition disabled:opacity-60 ${
                liked
                  ? 'text-[var(--accent)] hover:bg-[var(--accent-soft)]'
                  : 'hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]'
              }`}
              aria-label={liked ? 'لغو پسند' : 'پسند'}
            >
              <span className="text-base" aria-hidden>
                {liked ? '♥' : '♡'}
              </span>
              <span className="text-[11px] font-bold leading-none">پسند</span>
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
                  ? 'text-[var(--warning)] hover:bg-[var(--surface-2)]'
                  : 'hover:bg-[var(--surface-2)] hover:text-[var(--warning)]'
              }`}
              aria-label={bookmarked ? 'حذف نشان' : 'نشان‌گذاری'}
            >
              <span className="text-base" aria-hidden>
                {bookmarked ? '🔖' : '📑'}
              </span>
              <span className="text-[11px] font-bold leading-none">نشان</span>
            </button>
          </div>
          {repostFeedback ? (
            <p className="mt-2 text-center text-xs font-bold text-[var(--success)]" role="status">
              {repostFeedback}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

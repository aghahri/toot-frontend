'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthGate } from '@/components/AuthGate';
import { apiFetch } from '@/lib/api';
import { getAccessToken, getCurrentUserIdFromAccessToken } from '@/lib/auth';
import { FeedPostCard } from '@/components/home/FeedPostCard';
import { FeedEmptyState } from '@/components/home/FeedEmptyState';
import { PostReplySheet } from '@/components/home/PostReplySheet';
import type { FeedPost } from '@/components/home/feed-types';
import { normalizeFeedPost } from '@/lib/feed-normalize';

function SavedSkeleton() {
  return (
    <div className="theme-border-soft divide-y divide-[var(--border-soft)] px-2" dir="rtl">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-3 py-3">
          <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-[var(--surface-strong)]" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-32 animate-pulse rounded bg-[var(--surface-strong)]" />
            <div className="h-3 w-full max-w-md animate-pulse rounded bg-[var(--surface-muted)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ProfileSavedPostsPage() {
  const router = useRouter();
  const viewerUserId = getCurrentUserIdFromAccessToken();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyPost, setReplyPost] = useState<FeedPost | null>(null);

  const loadBookmarks = useCallback(async (opts?: { silent?: boolean }) => {
    const t = getAccessToken();
    if (!t) return;
    if (!opts?.silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const data = await apiFetch<FeedPost[]>('posts/bookmarks', { method: 'GET', token: t });
      setPosts(data.map(normalizeFeedPost));
    } catch (e) {
      if (!opts?.silent) {
        setError(e instanceof Error ? e.message : 'خطا در بارگذاری نشان‌ها');
      }
    } finally {
      if (!opts?.silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadBookmarks();
  }, [loadBookmarks]);

  const patchPost = useCallback((postId: string, patch: Partial<FeedPost>) => {
    setPosts((prev) => {
      if (patch.bookmarked === false) {
        return prev.filter((p) => p.id !== postId);
      }
      return prev.map((p) => (p.id === postId ? { ...p, ...patch } : p));
    });
  }, []);

  const removePost = useCallback((postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }, []);

  const onReplied = useCallback(
    (postId: string, replyCount: number) => {
      patchPost(postId, { replyCount });
    },
    [patchPost],
  );

  return (
    <AuthGate>
      <div className="theme-page-bg theme-text-primary min-h-[60dvh] pb-28" dir="rtl">
        <header className="theme-panel-bg theme-border-soft sticky top-14 z-[16] w-full min-w-0 max-w-[100vw] overflow-x-hidden border-b shadow-[0_1px_0_rgba(15,23,42,0.06)] backdrop-blur-md">
          <div className="mx-auto flex min-h-[48px] max-w-lg items-center gap-2 px-3 py-2.5">
            <button
              type="button"
              onClick={() => router.back()}
              className="theme-text-primary flex h-10 min-w-[2.5rem] items-center justify-center rounded-full text-sm font-bold transition hover:bg-[var(--surface-muted)] active:bg-[var(--surface-strong)]"
              aria-label="بازگشت"
            >
              <span className="text-lg leading-none" aria-hidden>
                ‹
              </span>
            </button>
            <div className="min-w-0 flex-1 text-right">
              <h1 className="truncate text-[15px] font-extrabold leading-tight">نشان‌شده‌ها</h1>
              <p className="theme-text-secondary truncate text-[11px] font-medium">
                پست‌هایی که با «نشان» ذخیره کرده‌اید
              </p>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-lg px-3 pt-4">
          {loading ? (
            <SavedSkeleton />
          ) : error ? (
            <div className="theme-card-bg theme-border-soft rounded-2xl border px-4 py-6 text-center">
              <p className="text-sm font-semibold text-red-600">{error}</p>
              <button
                type="button"
                onClick={() => void loadBookmarks()}
                className="mt-4 rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-bold text-[var(--accent-contrast)]"
              >
                تلاش دوباره
              </button>
            </div>
          ) : posts.length === 0 ? (
            <FeedEmptyState
              title="هنوز نشانی ندارید"
              description="روی «نشان» زیر هر پست بزنید تا اینجا برای بعد ذخیره شود."
              icon="📑"
            />
          ) : (
            <>
              <p className="theme-text-secondary mb-2 px-1 text-[11px] font-medium">
                آخرین نشان‌ها بالاتر هستند.
              </p>
              <div className="theme-card-bg theme-border-soft overflow-hidden rounded-2xl border shadow-sm">
                {posts.map((p) => (
                  <FeedPostCard
                    key={p.id}
                    post={p}
                    onPatch={patchPost}
                    onDelete={removePost}
                    onOpenReply={setReplyPost}
                    onRepostChanged={() => void loadBookmarks({ silent: true })}
                    viewerUserId={viewerUserId}
                  />
                ))}
              </div>
              <div className="mt-4 text-center">
                <Link
                  href="/home"
                  className="text-sm font-semibold text-[var(--accent-hover)] hover:underline"
                >
                  بازگشت به خانه
                </Link>
              </div>
            </>
          )}
        </main>

        <PostReplySheet
          post={replyPost}
          open={replyPost !== null}
          onClose={() => setReplyPost(null)}
          onReplied={onReplied}
        />
      </div>
    </AuthGate>
  );
}

'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthGate } from '@/components/AuthGate';
import { getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { FeedTabs } from '@/components/home/FeedTabs';
import { FeedPostCard } from '@/components/home/FeedPostCard';
import { FeedEmptyState } from '@/components/home/FeedEmptyState';
import { HomeFeedHeader } from '@/components/home/HomeFeedHeader';
import { HomeComposeSheet } from '@/components/home/HomeComposeSheet';
import { PostReplySheet } from '@/components/home/PostReplySheet';
import type { FeedPost, FeedTabId } from '@/components/home/feed-types';
import { normalizeFeedPost } from '@/lib/feed-normalize';

function FeedSkeleton() {
  return (
    <div className="divide-y divide-slate-100" dir="rtl">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-3 px-4 py-3">
          <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-slate-200" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
            <div className="h-3 w-full max-w-md animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

function HomePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [followingPosts, setFollowingPosts] = useState<FeedPost[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [loadingFollowingFeed, setLoadingFollowingFeed] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [followingFeedError, setFollowingFeedError] = useState<string | null>(null);
  const [tab, setTab] = useState<FeedTabId>('for-you');
  const [composeOpen, setComposeOpen] = useState(false);
  const [replyPost, setReplyPost] = useState<FeedPost | null>(null);
  const [emphasizePostId, setEmphasizePostId] = useState<string | null>(null);
  const [postTargetMissed, setPostTargetMissed] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const deepLinkFetchAttempted = useRef<Set<string>>(new Set());
  const deepLinkScrollDone = useRef<string | null>(null);

  const loadFeed = useCallback(async (opts?: { silent?: boolean }) => {
    const t = getAccessToken();
    if (!t) return;
    if (!opts?.silent) {
      setLoadingFeed(true);
      setFeedError(null);
    }
    try {
      const data = await apiFetch<FeedPost[]>('posts/feed', {
        method: 'GET',
        token: t,
      });
      setPosts(data.map(normalizeFeedPost));
    } catch (e) {
      if (!opts?.silent) {
        setFeedError(e instanceof Error ? e.message : 'خطا در دریافت فید');
      }
    } finally {
      if (!opts?.silent) {
        setLoadingFeed(false);
      }
    }
  }, []);

  const loadFollowingFeed = useCallback(async (opts?: { silent?: boolean }) => {
    const t = getAccessToken();
    if (!t) return;
    if (!opts?.silent) {
      setLoadingFollowingFeed(true);
      setFollowingFeedError(null);
    }
    try {
      const data = await apiFetch<FeedPost[]>('posts/feed?scope=following', {
        method: 'GET',
        token: t,
      });
      setFollowingPosts(data.map(normalizeFeedPost));
    } catch (e) {
      if (!opts?.silent) {
        setFollowingFeedError(e instanceof Error ? e.message : 'خطا در دریافت فید دنبال‌شده‌ها');
      }
    } finally {
      if (!opts?.silent) {
        setLoadingFollowingFeed(false);
      }
    }
  }, []);

  useEffect(() => {
    if (tab !== 'for-you') return;
    loadFeed();
    return () => {
      abortRef.current?.abort();
    };
  }, [tab, loadFeed]);

  useEffect(() => {
    if (tab !== 'following') return;
    void loadFollowingFeed();
  }, [tab, loadFollowingFeed]);

  const targetPostId = searchParams.get('postId');

  useEffect(() => {
    if (targetPostId) {
      setTab('for-you');
    }
  }, [targetPostId]);

  useEffect(() => {
    if (!targetPostId || tab !== 'for-you' || loadingFeed) return;

    const clearQuery = () => {
      router.replace('/home', { scroll: false });
    };

    const scrollToTarget = (pid: string) => {
      const el =
        document.getElementById(`feed-post-${pid}`) ||
        document.getElementById(`feed-post-${pid}-vrepost`);
      if (!el) return false;
      if (deepLinkScrollDone.current === pid) return true;
      deepLinkScrollDone.current = pid;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setEmphasizePostId(pid);
      window.setTimeout(() => {
        setEmphasizePostId(null);
        clearQuery();
        deepLinkScrollDone.current = null;
      }, 2600);
      return true;
    };

    const inForYou = posts.some((p) => p.id === targetPostId);
    if (inForYou) {
      const run = () => {
        if (!scrollToTarget(targetPostId)) {
          window.requestAnimationFrame(() => scrollToTarget(targetPostId));
        }
      };
      window.requestAnimationFrame(run);
      return;
    }

    if (deepLinkFetchAttempted.current.has(targetPostId)) return;
    deepLinkFetchAttempted.current.add(targetPostId);

    const t = getAccessToken();
    if (!t) return;

    void (async () => {
      try {
        const one = await apiFetch<FeedPost>(`posts/${encodeURIComponent(targetPostId)}`, {
          method: 'GET',
          token: t,
        });
        setPosts((prev) =>
          prev.some((x) => x.id === one.id) ? prev : [normalizeFeedPost(one), ...prev],
        );
      } catch {
        deepLinkFetchAttempted.current.delete(targetPostId);
        setPostTargetMissed(true);
        clearQuery();
      }
    })();
  }, [targetPostId, posts, loadingFeed, tab, router]);

  const onPostCreated = useCallback((created: FeedPost) => {
    setPosts((prev) => [normalizeFeedPost(created), ...prev]);
  }, []);

  const patchPost = useCallback((postId: string, patch: Partial<FeedPost>) => {
    setPosts((prev) => prev.map((x) => (x.id === postId ? { ...x, ...patch } : x)));
    setFollowingPosts((prev) => prev.map((x) => (x.id === postId ? { ...x, ...patch } : x)));
  }, []);

  const onReplied = useCallback((postId: string, replyCount: number) => {
    patchPost(postId, { replyCount });
  }, [patchPost]);

  return (
    <AuthGate>
      <div className="relative min-h-[60dvh] bg-[#f7f9f9]" dir="rtl">
        <div className="sticky top-14 z-[15] w-full min-w-0 max-w-[100vw] overflow-x-hidden border-b border-slate-200/60 bg-white/95 shadow-[0_1px_0_rgba(15,23,42,0.06)] backdrop-blur-md">
          <div className="mx-auto w-full min-w-0 max-w-lg">
            <HomeFeedHeader />
            <FeedTabs active={tab} onChange={setTab} />
          </div>
        </div>

        <main className="mx-auto min-h-[40dvh] w-full max-w-lg pb-28">
          {postTargetMissed ? (
            <div className="mx-3 mb-3 rounded-2xl border border-amber-200/90 bg-amber-50/95 px-4 py-3 text-sm text-amber-950">
              <p className="font-bold">پست پیدا نشد یا دیگر در دسترس نیست.</p>
              <button
                type="button"
                onClick={() => setPostTargetMissed(false)}
                className="mt-2 text-xs font-bold text-amber-900 underline"
              >
                بستن
              </button>
            </div>
          ) : null}
          {tab === 'for-you' ? (
            <>
              {loadingFeed ? (
                <FeedSkeleton />
              ) : feedError ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm font-semibold text-red-600">{feedError}</p>
                  <button
                    type="button"
                    onClick={() => void loadFeed()}
                    className="mt-4 rounded-full bg-slate-900 px-5 py-2 text-sm font-bold text-white"
                  >
                    تلاش دوباره
                  </button>
                </div>
              ) : posts.length === 0 ? (
                <FeedEmptyState
                  title="هنوز پستی نیست"
                  description="اولین پست محله یا شبکهٔ خود را بنویسید، یا فید را بعداً دوباره بررسی کنید."
                  icon="✦"
                />
              ) : (
                <div className="overflow-hidden rounded-b-2xl bg-white shadow-sm ring-1 ring-slate-100/80">
                  {posts.map((p) => (
                    <FeedPostCard
                      key={
                        p.feedEntry === 'viewer_repost'
                          ? `vrepost-${p.id}-${p.viewerRepostedAt ?? '0'}`
                          : p.id
                      }
                      post={p}
                      onPatch={patchPost}
                      onOpenReply={setReplyPost}
                      onRepostChanged={() => void loadFeed({ silent: true })}
                      emphasize={emphasizePostId === p.id}
                    />
                  ))}
                </div>
              )}

              {!loadingFeed && !feedError ? (
                <div className="px-4 py-4 text-center">
                  <button
                    type="button"
                    onClick={() => void loadFeed()}
                    className="text-sm font-semibold text-sky-700 hover:underline"
                  >
                    به‌روزرسانی فید
                  </button>
                </div>
              ) : null}
            </>
          ) : tab === 'following' ? (
            <>
              {loadingFollowingFeed ? (
                <FeedSkeleton />
              ) : followingFeedError ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm font-semibold text-red-600">{followingFeedError}</p>
                  <button
                    type="button"
                    onClick={() => void loadFollowingFeed()}
                    className="mt-4 rounded-full bg-slate-900 px-5 py-2 text-sm font-bold text-white"
                  >
                    تلاش دوباره
                  </button>
                </div>
              ) : followingPosts.length === 0 ? (
                <FeedEmptyState
                  title="دنبال‌شده‌ها"
                  description="هنوز پستی از کسانی که دنبال می‌کنید اینجا نیست. کاربران بیشتری را دنبال کنید یا بعداً دوباره بررسی کنید."
                  icon="◎"
                />
              ) : (
                <div className="overflow-hidden rounded-b-2xl bg-white shadow-sm ring-1 ring-slate-100/80">
                  {followingPosts.map((p) => (
                    <FeedPostCard
                      key={p.id}
                      post={p}
                      onPatch={patchPost}
                      onOpenReply={setReplyPost}
                      onRepostChanged={() => void loadFollowingFeed({ silent: true })}
                      emphasize={emphasizePostId === p.id}
                    />
                  ))}
                </div>
              )}

              {!loadingFollowingFeed && !followingFeedError ? (
                <div className="px-4 py-4 text-center">
                  <button
                    type="button"
                    onClick={() => void loadFollowingFeed()}
                    className="text-sm font-semibold text-sky-700 hover:underline"
                  >
                    به‌روزرسانی فید
                  </button>
                </div>
              ) : null}
            </>
          ) : tab === 'local' ? (
            <FeedEmptyState
              title="محلهٔ من"
              description="اخبار، رویدادها و کسب‌وکارهای نزدیک شما اینجا جمع می‌شود. این بخش پایهٔ کشف محلی توت است."
              icon="⌂"
            />
          ) : (
            <FeedEmptyState
              title="شبکه‌ها"
              description="داستان شبکه‌های محلی و جامعه‌های توت اینجا نمایش داده می‌شود. هنوز در حال آماده‌سازی است."
              icon="⬡"
            />
          )}
        </main>

        <button
          type="button"
          onClick={() => setComposeOpen(true)}
          className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] start-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-sky-600 text-2xl font-light text-white shadow-lg shadow-sky-600/30 transition hover:bg-sky-700 hover:shadow-xl active:scale-95"
          aria-label="پست جدید"
        >
          +
        </button>

        <HomeComposeSheet
          open={composeOpen}
          onClose={() => setComposeOpen(false)}
          onPostCreated={onPostCreated}
        />

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

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40dvh] items-center justify-center bg-[#f7f9f9] px-4 text-sm text-slate-600">
          در حال بارگذاری…
        </div>
      }
    >
      <HomePageInner />
    </Suspense>
  );
}

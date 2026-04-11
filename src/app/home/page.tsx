'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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

export default function HomePage() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [tab, setTab] = useState<FeedTabId>('for-you');
  const [composeOpen, setComposeOpen] = useState(false);
  const [replyPost, setReplyPost] = useState<FeedPost | null>(null);
  const [searchHint, setSearchHint] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

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

  useEffect(() => {
    if (tab !== 'for-you') return;
    loadFeed();
    return () => {
      abortRef.current?.abort();
    };
  }, [tab, loadFeed]);

  const onPostCreated = useCallback((created: FeedPost) => {
    setPosts((prev) => [normalizeFeedPost(created), ...prev]);
  }, []);

  const patchPost = useCallback((postId: string, patch: Partial<FeedPost>) => {
    setPosts((prev) =>
      prev.map((x) => (x.id === postId ? { ...x, ...patch } : x)),
    );
  }, []);

  const onReplied = useCallback((postId: string, replyCount: number) => {
    patchPost(postId, { replyCount });
  }, [patchPost]);

  return (
    <AuthGate>
      <div className="relative min-h-[60dvh] bg-[#f7f9f9]" dir="rtl">
        <div className="sticky top-14 z-[15] bg-white/90 shadow-[0_1px_0_rgba(0,0,0,0.04)] backdrop-blur-md">
          <HomeFeedHeader
            onSearchClick={() => {
              setSearchHint(true);
              window.setTimeout(() => setSearchHint(false), 2500);
            }}
          />
          <FeedTabs active={tab} onChange={setTab} />
        </div>

        {searchHint ? (
          <div className="border-b border-sky-100 bg-sky-50/95 px-4 py-2 text-center text-xs font-semibold text-sky-800">
            جستجوی سراسری به‌زودی فعال می‌شود.
          </div>
        ) : null}

        <main className="mx-auto min-h-[40dvh] w-full max-w-lg pb-28">
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
            <FeedEmptyState
              title="دنبال‌شده‌ها"
              description="به‌زودی اینجا فقط پست‌های کسانی را می‌بینید که دنبال می‌کنید — شبیه فید شخصی در شبکه‌های اجتماعی مدرن، با تمرکز بر محله و شبکهٔ توت."
              icon="◎"
            />
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

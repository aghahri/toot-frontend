'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthGate } from '@/components/AuthGate';
import { getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { FeedPostCard } from '@/components/home/FeedPostCard';
import { FeedEmptyState } from '@/components/home/FeedEmptyState';
import { PostReplySheet } from '@/components/home/PostReplySheet';
import type { FeedPost } from '@/components/home/feed-types';
import { normalizeFeedPost } from '@/lib/feed-normalize';

export type PublicUserProfile = {
  id: string;
  username: string;
  name: string;
  avatar: string | null;
  bio: string | null;
  createdAt: string;
  followerCount: number;
  followingCount: number;
  postCount: number;
  isSelf: boolean;
  isFollowing: boolean;
};

type FollowMutationResult = {
  isFollowing: boolean;
  followerCount: number;
  followingCount: number;
  postCount: number;
};

function ProfilePostsSkeleton() {
  return (
    <div className="divide-y divide-slate-100 px-2" dir="rtl">
      {[0, 1].map((i) => (
        <div key={i} className="flex gap-3 py-3">
          <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-slate-200" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-32 animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

type ProfileUserClientProps = {
  userId: string;
};

export function ProfileUserClient({ userId }: ProfileUserClientProps) {
  const router = useRouter();
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  const [dmBusy, setDmBusy] = useState(false);
  const [dmError, setDmError] = useState<string | null>(null);
  const [replyPost, setReplyPost] = useState<FeedPost | null>(null);

  const loadProfile = useCallback(async () => {
    const t = getAccessToken();
    if (!t) return;
    setProfileError(null);
    try {
      const p = await apiFetch<PublicUserProfile>(
        `users/${encodeURIComponent(userId)}/profile`,
        { method: 'GET', token: t },
      );
      setProfile(p);
    } catch (e) {
      setProfile(null);
      setProfileError(e instanceof Error ? e.message : 'خطا در بارگذاری پروفایل');
    }
  }, [userId]);

  const loadPosts = useCallback(
    async (opts?: { silent?: boolean }) => {
      const t = getAccessToken();
      if (!t) return;
      if (!opts?.silent) {
        setPostsLoading(true);
        setPostsError(null);
      }
      try {
        const data = await apiFetch<FeedPost[]>(`posts/user/${encodeURIComponent(userId)}`, {
          method: 'GET',
          token: t,
        });
        setPosts(data.map(normalizeFeedPost));
      } catch (e) {
        if (!opts?.silent) {
          setPostsError(e instanceof Error ? e.message : 'خطا در بارگذاری پست‌ها');
        }
      } finally {
        if (!opts?.silent) {
          setPostsLoading(false);
        }
      }
    },
    [userId],
  );

  useEffect(() => {
    void loadProfile();
    void loadPosts();
  }, [loadProfile, loadPosts]);

  const patchPost = useCallback((postId: string, patch: Partial<FeedPost>) => {
    setPosts((prev) => prev.map((x) => (x.id === postId ? { ...x, ...patch } : x)));
  }, []);

  const onReplied = useCallback(
    (postId: string, replyCount: number) => {
      patchPost(postId, { replyCount });
    },
    [patchPost],
  );

  async function onToggleFollow() {
    if (!profile || profile.isSelf) return;
    const t = getAccessToken();
    if (!t) return;
    setFollowBusy(true);
    try {
      const path = `users/${encodeURIComponent(userId)}/follow`;
      const res = await apiFetch<FollowMutationResult>(path, {
        method: profile.isFollowing ? 'DELETE' : 'POST',
        token: t,
      });
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              isFollowing: res.isFollowing,
              followerCount: res.followerCount,
              followingCount: res.followingCount,
              postCount: res.postCount,
            }
          : null,
      );
    } catch {
      /* keep UI; user can retry */
    } finally {
      setFollowBusy(false);
    }
  }

  async function onOpenDirectMessage() {
    const t = getAccessToken();
    if (!t) return;
    setDmBusy(true);
    setDmError(null);
    try {
      const conv = await apiFetch<{ id: string }>('direct/conversations', {
        method: 'POST',
        token: t,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otherUserId: userId }),
      });
      const id = conv?.id?.trim();
      if (!id) throw new Error('شناسهٔ گفتگو دریافت نشد');
      router.push(`/direct/${encodeURIComponent(id)}`);
    } catch (e) {
      setDmError(e instanceof Error ? e.message : 'باز کردن گفتگو ناموفق بود');
    } finally {
      setDmBusy(false);
    }
  }

  const handle = profile ? `@${profile.username}` : '';

  return (
    <AuthGate>
      <div className="min-h-[60dvh] bg-[#f7f9f9] pb-28" dir="rtl">
        <header className="sticky top-14 z-[16] w-full min-w-0 max-w-[100vw] overflow-x-hidden border-b border-slate-200/70 bg-white/95 shadow-[0_1px_0_rgba(0,0,0,0.04)] backdrop-blur-md">
          <div className="mx-auto flex min-h-[48px] max-w-lg items-center gap-2 px-3 py-2.5">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex h-10 min-w-[2.5rem] items-center justify-center rounded-full text-sm font-bold text-slate-700 transition hover:bg-slate-100 active:bg-slate-200"
              aria-label="بازگشت"
            >
              <span className="text-lg leading-none" aria-hidden>
                ‹
              </span>
            </button>
            <div className="min-w-0 flex-1 text-right">
              <div className="truncate text-[15px] font-extrabold leading-tight text-slate-900">
                {profile?.name ?? 'پروفایل'}
              </div>
              {profile ? (
                <div className="truncate text-[12px] font-medium text-slate-500" dir="ltr">
                  @{profile.username}
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-lg px-3 pt-5">
          {profileError ? (
            <div className="rounded-2xl border border-red-100 bg-red-50/90 px-4 py-6 text-center">
              <p className="text-sm font-semibold text-red-700">{profileError}</p>
              <button
                type="button"
                onClick={() => void loadProfile()}
                className="mt-4 rounded-full bg-slate-900 px-5 py-2 text-sm font-bold text-white"
              >
                تلاش دوباره
              </button>
            </div>
          ) : !profile ? (
            <div className="py-12 text-center text-sm text-slate-500">در حال بارگذاری…</div>
          ) : (
            <>
              <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm ring-1 ring-slate-100/80">
                <div className="flex flex-col items-center gap-4 px-4 pb-2 pt-6 text-center sm:flex-row sm:items-start sm:text-right">
                  <div className="shrink-0">
                    {profile.avatar ? (
                      <img
                        src={profile.avatar}
                        alt=""
                        className="h-[5.5rem] w-[5.5rem] rounded-full object-cover ring-4 ring-slate-100 shadow-sm"
                      />
                    ) : (
                      <div className="flex h-[5.5rem] w-[5.5rem] items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-slate-700 text-3xl font-extrabold text-white ring-4 ring-slate-100 shadow-sm">
                        {profile.name.trim().slice(0, 1) || '?'}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 sm:pt-1">
                    <h1 className="text-[1.35rem] font-extrabold leading-tight tracking-tight text-slate-900">
                      {profile.name}
                    </h1>
                    <p className="mt-1 text-[14px] font-medium text-slate-500" dir="ltr">
                      {handle}
                    </p>
                    {profile.bio ? (
                      <p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed text-slate-700">
                        {profile.bio}
                      </p>
                    ) : (
                      <p className="mt-3 text-[12px] text-slate-400">بیوگرافی ثبت نشده.</p>
                    )}
                  </div>
                </div>

                <div className="mx-4 my-4 flex items-stretch justify-around rounded-xl bg-slate-50/90 py-3 ring-1 ring-slate-100">
                  <div className="flex min-w-0 flex-1 flex-col items-center justify-center text-center">
                    <div className="text-[1.125rem] font-extrabold tabular-nums text-slate-900">
                      {profile.postCount}
                    </div>
                    <div className="mt-0.5 text-[11px] font-bold text-slate-500">پست</div>
                  </div>
                  <div className="w-px shrink-0 bg-slate-200" aria-hidden />
                  <div className="flex min-w-0 flex-1 flex-col items-center justify-center text-center">
                    <div className="text-[1.125rem] font-extrabold tabular-nums text-slate-900">
                      {profile.followerCount}
                    </div>
                    <div className="mt-0.5 text-[11px] font-bold text-slate-500">دنبال‌کننده</div>
                  </div>
                  <div className="w-px shrink-0 bg-slate-200" aria-hidden />
                  <div className="flex min-w-0 flex-1 flex-col items-center justify-center text-center">
                    <div className="text-[1.125rem] font-extrabold tabular-nums text-slate-900">
                      {profile.followingCount}
                    </div>
                    <div className="mt-0.5 text-[11px] font-bold text-slate-500">دنبال‌شده</div>
                  </div>
                </div>

                <div className="space-y-2 border-t border-slate-100 px-4 pb-4 pt-3">
                  {profile.isSelf ? (
                    <Link
                      href="/profile/edit"
                      className="flex min-h-[46px] w-full items-center justify-center rounded-full bg-slate-900 text-sm font-extrabold text-white transition hover:bg-slate-800"
                    >
                      ویرایش پروفایل
                    </Link>
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={followBusy}
                          onClick={() => void onToggleFollow()}
                          className={`flex min-h-[46px] min-w-0 flex-1 items-center justify-center rounded-full text-sm font-extrabold transition disabled:opacity-60 ${
                            profile.isFollowing
                              ? 'border-2 border-slate-300 bg-white text-slate-900 hover:bg-slate-50'
                              : 'bg-sky-600 text-white hover:bg-sky-700'
                          }`}
                        >
                          {followBusy
                            ? '…'
                            : profile.isFollowing
                              ? 'دنبال می‌کنید'
                              : 'دنبال کردن'}
                        </button>
                        <button
                          type="button"
                          disabled={dmBusy || followBusy}
                          onClick={() => void onOpenDirectMessage()}
                          className="flex min-h-[46px] min-w-0 flex-1 items-center justify-center rounded-full border-2 border-emerald-600 bg-white text-sm font-extrabold text-emerald-700 shadow-sm transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-55"
                          aria-label={`پیام خصوصی به ${profile.name}`}
                        >
                          {dmBusy ? '…' : 'پیام'}
                        </button>
                      </div>
                      {dmError ? (
                        <p className="text-center text-[11px] font-semibold text-red-600">{dmError}</p>
                      ) : null}
                    </>
                  )}
                </div>
              </section>

              <div className="mb-2 mt-10 border-b border-slate-200/90 px-1 pb-2">
                <div className="flex items-end justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-base font-extrabold text-slate-900">پست‌ها</h2>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                      نوشته‌های منتشرشدهٔ این کاربر در فید
                    </p>
                  </div>
                  <span className="shrink-0 text-[12px] font-semibold tabular-nums text-slate-500">
                    {profile.postCount}
                  </span>
                </div>
              </div>

              {postsLoading ? (
                <ProfilePostsSkeleton />
              ) : postsError ? (
                <div className="rounded-xl border border-red-100 bg-red-50/80 px-4 py-4 text-center text-sm font-semibold text-red-700">
                  {postsError}
                  <button
                    type="button"
                    onClick={() => void loadPosts()}
                    className="mt-3 block w-full rounded-full bg-slate-900 py-2 text-xs font-bold text-white"
                  >
                    تلاش دوباره
                  </button>
                </div>
              ) : posts.length === 0 ? (
                <FeedEmptyState
                  title="هنوز پستی نیست"
                  description="وقتی این کاربر پست بگذارد، اینجا نمایش داده می‌شود."
                  icon="✦"
                />
              ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                  {posts.map((p) => (
                    <FeedPostCard
                      key={p.id}
                      post={p}
                      onPatch={patchPost}
                      onOpenReply={setReplyPost}
                      onRepostChanged={() => void loadPosts({ silent: true })}
                      linkAuthorProfile={false}
                    />
                  ))}
                </div>
              )}
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

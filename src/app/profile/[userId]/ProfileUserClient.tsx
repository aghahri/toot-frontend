'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthGate } from '@/components/AuthGate';
import { getAccessToken, getCurrentUserIdFromAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { FeedPostCard } from '@/components/home/FeedPostCard';
import { FeedEmptyState } from '@/components/home/FeedEmptyState';
import { PostReplySheet } from '@/components/home/PostReplySheet';
import type { FeedPost, ProfileReplyFeedRow } from '@/components/home/feed-types';
import { ProfileReplyRow } from '@/components/home/ProfileReplyRow';
import { normalizeFeedPost } from '@/lib/feed-normalize';
import { useVoiceCall } from '@/context/VoiceCallContext';

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
  /** Present when API supports it (non-USER global role). */
  isStaff?: boolean;
};

type FollowMutationResult = {
  isFollowing: boolean;
  followerCount: number;
  followingCount: number;
  postCount: number;
};

function ProfilePostsSkeleton() {
  return (
    <div className="divide-y divide-[var(--border-soft)] px-0" dir="rtl">
      {[0, 1].map((i) => (
        <div key={i} className="flex gap-3 py-3">
          <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-[var(--surface-strong)]" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-32 animate-pulse rounded bg-[var(--surface-strong)]" />
            <div className="h-3 w-full animate-pulse rounded bg-[var(--surface-soft)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

type ProfileUserClientProps = {
  userId: string;
};

type ProfileContentTab = 'posts' | 'replies' | 'media';

function formatJoinedDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fa-IR', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function ProfileUserClient({ userId }: ProfileUserClientProps) {
  const router = useRouter();
  const { startCall: startVoiceCall, canStartCall: canStartVoiceCall } = useVoiceCall();
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  const [dmBusy, setDmBusy] = useState(false);
  const [dmError, setDmError] = useState<string | null>(null);
  const [replyPost, setReplyPost] = useState<FeedPost | null>(null);
  const [postTab, setPostTab] = useState<ProfileContentTab>('posts');
  const [profileReplies, setProfileReplies] = useState<ProfileReplyFeedRow[]>([]);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [repliesError, setRepliesError] = useState<string | null>(null);
  const [repliesLoaded, setRepliesLoaded] = useState(false);
  const viewerUserId = getCurrentUserIdFromAccessToken();

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

  const loadProfileReplies = useCallback(async () => {
    const t = getAccessToken();
    if (!t) return;
    setRepliesLoading(true);
    setRepliesError(null);
    try {
      const data = await apiFetch<ProfileReplyFeedRow[]>(
        `posts/user/${encodeURIComponent(userId)}/replies`,
        { method: 'GET', token: t },
      );
      setProfileReplies(data);
    } catch (e) {
      setRepliesError(e instanceof Error ? e.message : 'خطا در بارگذاری پاسخ‌ها');
    } finally {
      setRepliesLoading(false);
      setRepliesLoaded(true);
    }
  }, [userId]);

  useEffect(() => {
    void loadProfile();
    void loadPosts();
  }, [loadProfile, loadPosts]);

  useEffect(() => {
    setRepliesLoaded(false);
    setProfileReplies([]);
    setRepliesError(null);
    setPostTab('posts');
  }, [userId]);

  useEffect(() => {
    if (postTab !== 'replies' || repliesLoaded || repliesLoading) return;
    void loadProfileReplies();
  }, [postTab, repliesLoaded, repliesLoading, loadProfileReplies]);

  const patchPost = useCallback((postId: string, patch: Partial<FeedPost>) => {
    setPosts((prev) => prev.map((x) => (x.id === postId ? { ...x, ...patch } : x)));
  }, []);

  const onReplied = useCallback(
    (postId: string, replyCount: number) => {
      patchPost(postId, { replyCount });
      if (repliesLoaded) void loadProfileReplies();
    },
    [patchPost, repliesLoaded, loadProfileReplies],
  );

  const openThreadFromReply = useCallback(async (parentPostId: string) => {
    const t = getAccessToken();
    if (!t) return;
    try {
      const raw = await apiFetch<FeedPost>(`posts/${encodeURIComponent(parentPostId)}`, {
        method: 'GET',
        token: t,
      });
      setReplyPost(normalizeFeedPost(raw));
    } catch {
      /* sheet stays closed */
    }
  }, []);

  const removePost = useCallback((postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }, []);

  const mediaPosts = useMemo(
    () =>
      posts.filter((p) => {
        if (p.mediaUrl) return true;
        return p.media.some((m) => {
          if (m.type === 'IMAGE' || m.type === 'VIDEO') return true;
          const mt = typeof m.mimeType === 'string' ? m.mimeType : '';
          return mt.startsWith('image/') || mt.startsWith('video/');
        });
      }),
    [posts],
  );

  const visiblePosts = postTab === 'media' ? mediaPosts : posts;

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
      <div className="theme-page-bg min-h-[60dvh] pb-28" dir="rtl">
        <header className="sticky top-14 z-[16] w-full min-w-0 max-w-[100vw] overflow-x-hidden border-b border-[var(--border-soft)] bg-[var(--card-bg)]/95 shadow-[0_1px_0_rgba(0,0,0,0.04)] backdrop-blur-md">
          <div className="mx-auto flex min-h-[48px] max-w-lg items-center gap-2 px-3 py-2.5">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex h-10 min-w-[2.5rem] items-center justify-center rounded-full text-sm font-bold text-[var(--text-secondary)] transition hover:bg-[var(--surface-soft)] active:bg-[var(--surface-strong)]"
              aria-label="بازگشت"
            >
              <span className="text-lg leading-none" aria-hidden>
                ‹
              </span>
            </button>
            <div className="min-w-0 flex-1 text-right">
              <div className="truncate text-[15px] font-extrabold leading-tight text-[var(--text-primary)]">
                {profile?.name ?? 'پروفایل'}
              </div>
              {profile ? (
                <div className="truncate text-[12px] font-medium text-[var(--text-secondary)]" dir="ltr">
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
            <div className="py-12 text-center text-sm text-[var(--text-secondary)]">در حال بارگذاری…</div>
          ) : (
            <>
              <section className="theme-border-soft overflow-hidden rounded-2xl border bg-[var(--card-bg)] shadow-sm ring-1 ring-[var(--border-soft)]">
                <div className="flex flex-row items-start gap-4 px-4 pb-1 pt-6 text-right">
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="line-clamp-2 min-w-0 text-[1.4rem] font-extrabold leading-snug tracking-tight text-[var(--text-primary)]">
                        {profile.name}
                      </h1>
                      {profile.isStaff ? (
                        <span
                          className="shrink-0 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-extrabold text-[var(--accent-hover)] ring-1 ring-[var(--accent-ring)]"
                          title="عضو تیم یا مدیر"
                        >
                          تیم
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-[14px] font-semibold text-[var(--text-secondary)]" dir="ltr">
                      {handle}
                    </p>
                    {profile.bio ? (
                      <p className="mt-3 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-[var(--text-primary)]">
                        {profile.bio}
                      </p>
                    ) : (
                      <p className="mt-3 text-[13px] text-[var(--text-secondary)]">بیوگرافی ثبت نشده است.</p>
                    )}
                    <p className="mt-3 flex flex-wrap items-center justify-start gap-x-2 gap-y-1 text-[13px] text-[var(--text-secondary)]">
                      <span>
                        <strong className="tabular-nums text-[var(--text-primary)]">{profile.followerCount}</strong>{' '}
                        دنبال‌کننده
                      </span>
                      <span className="text-[var(--text-secondary)]" aria-hidden>
                        ·
                      </span>
                      <span>
                        <strong className="tabular-nums text-[var(--text-primary)]">{profile.followingCount}</strong>{' '}
                        دنبال‌شده
                      </span>
                      <span className="text-[var(--text-secondary)]" aria-hidden>
                        ·
                      </span>
                      <span className="min-w-0">
                        عضویت از <time dateTime={profile.createdAt}>{formatJoinedDate(profile.createdAt)}</time>
                      </span>
                    </p>
                    <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
                      <strong className="tabular-nums text-[var(--text-primary)]">{profile.postCount}</strong> پست منتشر
                      شده
                    </p>
                  </div>
                  <div className="shrink-0">
                    {profile.avatar ? (
                      <img
                        src={profile.avatar}
                        alt=""
                        className="h-24 w-24 rounded-full object-cover shadow-md ring-4 ring-[var(--accent-ring)] sm:h-28 sm:w-28"
                      />
                    ) : (
                      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-[var(--accent)] to-slate-700 text-3xl font-extrabold text-white shadow-md ring-4 ring-[var(--accent-ring)] sm:h-28 sm:w-28">
                        {profile.name.trim().slice(0, 1) || '?'}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2 border-t border-[var(--border-soft)] px-4 pb-4 pt-3">
                  {profile.isSelf ? (
                    <>
                      <Link
                        href="/profile/edit"
                        className="flex min-h-[48px] w-full items-center justify-center rounded-full bg-[var(--accent)] text-sm font-extrabold text-[var(--accent-contrast)] transition hover:bg-[var(--accent-hover)]"
                      >
                        ویرایش پروفایل
                      </Link>
                      <Link
                        href="/profile/saved"
                        className="theme-border-soft flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full border bg-[var(--card-bg)] text-sm font-extrabold text-[var(--text-primary)] shadow-sm transition hover:bg-[var(--surface-soft)]"
                      >
                        <span aria-hidden>📑</span>
                        نشان‌شده‌ها
                      </Link>
                    </>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={followBusy}
                          onClick={() => void onToggleFollow()}
                          className={`flex min-h-[48px] min-w-0 w-full shrink-0 items-center justify-center rounded-full text-sm font-extrabold transition disabled:opacity-60 sm:flex-1 ${
                            profile.isFollowing
                              ? 'theme-border-soft border-2 bg-[var(--card-bg)] text-[var(--text-primary)] hover:bg-[var(--surface-soft)]'
                              : 'bg-[var(--accent)] text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)]'
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
                          className="flex min-h-[48px] min-w-0 flex-1 basis-[calc(50%-0.25rem)] items-center justify-center rounded-full border-2 border-emerald-600 bg-[var(--card-bg)] text-sm font-extrabold text-emerald-700 shadow-sm transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-55"
                          aria-label={`پیام خصوصی به ${profile.name}`}
                        >
                          {dmBusy ? '…' : 'پیام'}
                        </button>
                        <button
                          type="button"
                          disabled={dmBusy || followBusy || !canStartVoiceCall}
                          title={
                            !canStartVoiceCall
                              ? 'تماس در جریان است؛ ابتدا تماس جاری را تمام کنید.'
                              : undefined
                          }
                          onClick={() => startVoiceCall({ targetUserId: profile.id })}
                          className="flex min-h-[48px] min-w-0 flex-1 basis-[calc(50%-0.25rem)] items-center justify-center rounded-full border-2 border-[var(--accent)] bg-[var(--card-bg)] text-sm font-extrabold text-[var(--accent-hover)] shadow-sm transition hover:bg-[var(--accent-soft)] disabled:cursor-not-allowed disabled:opacity-55"
                          aria-label={`تماس صوتی با ${profile.name}`}
                        >
                          تماس
                        </button>
                      </div>
                      {dmError ? (
                        <p className="text-center text-[11px] font-semibold text-red-600">{dmError}</p>
                      ) : null}
                    </>
                  )}
                </div>
              </section>

              <div className="mt-6 border-b border-[var(--border-soft)] px-1 pb-2 pt-1">
                <div className="grid grid-cols-3 gap-1 rounded-xl bg-[var(--surface-soft)] p-1 ring-1 ring-[var(--border-soft)]">
                  {(
                    [
                      { id: 'posts' as const, label: 'پست‌ها', count: posts.length },
                      {
                        id: 'replies' as const,
                        label: 'پاسخ‌ها',
                        count: repliesLoaded ? profileReplies.length : repliesLoading ? '…' : 0,
                      },
                      { id: 'media' as const, label: 'رسانه', count: mediaPosts.length },
                    ] as const
                  ).map((tabItem) => (
                    <button
                      key={tabItem.id}
                      type="button"
                      onClick={() => setPostTab(tabItem.id)}
                      className={`rounded-lg px-2 py-2.5 text-xs font-extrabold transition ${
                        postTab === tabItem.id
                          ? 'bg-[var(--card-bg)] text-[var(--accent-hover)] shadow-sm ring-1 ring-[var(--accent-ring)]'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--card-bg)]/80'
                      }`}
                    >
                      {tabItem.label}
                      <span className="ms-1 text-[10px] tabular-nums opacity-80">{tabItem.count}</span>
                    </button>
                  ))}
                </div>
              </div>

              {postTab === 'replies' ? (
                repliesLoading && profileReplies.length === 0 && !repliesError ? (
                  <ProfilePostsSkeleton />
                ) : repliesError ? (
                  <div className="mt-3 rounded-xl border border-red-100 bg-red-50/80 px-4 py-4 text-center text-sm font-semibold text-red-700">
                    {repliesError}
                    <button
                      type="button"
                      onClick={() => void loadProfileReplies()}
                      className="mt-3 block w-full rounded-full bg-slate-900 py-2 text-xs font-bold text-white"
                    >
                      تلاش دوباره
                    </button>
                  </div>
                ) : profileReplies.length === 0 ? (
                  <div className="mt-4">
                    <FeedEmptyState
                      title="پاسخی در فید نیست"
                      description="پاسخ‌های این کاربر به پست‌های دیگر اینجا دیده می‌شود. وقتی در گفتگوهای پست شرکت کند، این بخش پر می‌شود."
                      icon="💬"
                    />
                  </div>
                ) : (
                  <div className="theme-border-soft mt-3 overflow-hidden rounded-xl border bg-[var(--card-bg)]">
                    {profileReplies.map((row) => (
                      <ProfileReplyRow key={row.reply.id} row={row} onOpenThread={openThreadFromReply} />
                    ))}
                  </div>
                )
              ) : postsLoading ? (
                <ProfilePostsSkeleton />
              ) : postsError ? (
                <div className="mt-3 rounded-xl border border-red-100 bg-red-50/80 px-4 py-4 text-center text-sm font-semibold text-red-700">
                  {postsError}
                  <button
                    type="button"
                    onClick={() => void loadPosts()}
                    className="mt-3 block w-full rounded-full bg-slate-900 py-2 text-xs font-bold text-white"
                  >
                    تلاش دوباره
                  </button>
                </div>
              ) : visiblePosts.length === 0 ? (
                <div className="mt-4">
                  <FeedEmptyState
                    title={
                      postTab === 'posts' ? 'هنوز پستی نیست' : 'رسانه‌ای برای نمایش نیست'
                    }
                    description={
                      postTab === 'posts'
                        ? 'وقتی این کاربر پست بگذارد، اینجا مثل فید خانه نمایش داده می‌شود.'
                        : 'پست‌های دارای تصویر یا ویدیو در این تب جمع می‌شوند.'
                    }
                    icon={postTab === 'posts' ? '✦' : '🖼'}
                  />
                </div>
              ) : (
                <div className="theme-card-bg theme-border-soft mt-3 overflow-hidden rounded-xl border">
                  {visiblePosts.map((p) => (
                    <FeedPostCard
                      key={p.id}
                      post={p}
                      onPatch={patchPost}
                      onDelete={removePost}
                      onOpenReply={setReplyPost}
                      onRepostChanged={() => void loadPosts({ silent: true })}
                      linkAuthorProfile={false}
                      viewerUserId={viewerUserId}
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

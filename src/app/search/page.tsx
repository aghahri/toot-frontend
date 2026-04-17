'use client';

import type { FormEvent } from 'react';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthGate } from '@/components/AuthGate';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

const SEARCH_DEBOUNCE_MS = 320;

type SearchUser = { id: string; name: string; username: string; avatar: string | null };
type SearchPost = {
  id: string;
  text: string;
  createdAt: string;
  userId: string;
  mediaUrl: string | null;
  media: Array<{ id: string; type: string; url: string; mimeType: string }>;
  _count: { likes: number; reposts: number; replies: number };
  user: { id: string; name: string; username: string; avatar: string | null };
};
type SearchGroup = { id: string; name: string; description: string | null; networkId: string | null };
type SearchNetwork = { id: string; name: string; description: string | null; slug: string | null };
type SearchChannel = { id: string; name: string; description: string | null; networkId: string | null };

type SearchAllResponse = {
  users: SearchUser[];
  posts: SearchPost[];
  networks: SearchNetwork[];
  groups: SearchGroup[];
  channels: SearchChannel[];
};

type SearchMode = 'top' | 'latest' | 'people' | 'videos' | 'photos';

const SEARCH_TABS: Array<{ id: SearchMode; label: string }> = [
  { id: 'top', label: 'برترین' },
  { id: 'latest', label: 'جدیدترین' },
  { id: 'people', label: 'افراد' },
  { id: 'videos', label: 'ویدیوها' },
  { id: 'photos', label: 'تصاویر' },
];

function excerpt(text: string, max = 120): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function normalizeQuery(q: string) {
  return q
    .trim()
    .replace(/[ي]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/\u200c/g, ' ')
    .replace(/\s+/g, ' ');
}

function isVideoPost(post: SearchPost) {
  return post.media.some((m) => m.type === 'VIDEO' || m.mimeType.startsWith('video/'));
}

function isPhotoPost(post: SearchPost) {
  if (post.media.some((m) => m.type === 'IMAGE' || m.mimeType.startsWith('image/'))) return true;
  return !!post.mediaUrl && /\.(png|jpe?g|webp|gif)$/i.test(post.mediaUrl);
}

function engagement(post: SearchPost) {
  return post._count.likes + post._count.reposts * 2 + post._count.replies * 2;
}

function renderQueryAwareText(text: string) {
  const lines = text.split('\n');
  return lines.map((line, lineIndex) => {
    const parts = line.split(/(#[\p{L}\p{N}_]+)/gu);
    return (
      <span key={`line-${lineIndex}`}>
        {parts.map((part, idx) => {
          if (/^#[\p{L}\p{N}_]+$/u.test(part)) {
            return (
              <Link
                key={`tag-${lineIndex}-${idx}`}
                href={`/search?q=${encodeURIComponent(part)}&mode=top`}
                className="font-semibold text-[var(--accent-hover)] hover:underline"
              >
                {part}
              </Link>
            );
          }
          return <span key={`txt-${lineIndex}-${idx}`}>{part}</span>;
        })}
        {lineIndex < lines.length - 1 ? '\n' : null}
      </span>
    );
  });
}

function SearchPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQ = searchParams.get('q') ?? '';
  const urlMode = (searchParams.get('mode') ?? 'top') as SearchMode;
  const safeMode: SearchMode = SEARCH_TABS.some((t) => t.id === urlMode) ? urlMode : 'top';
  const [q, setQ] = useState(urlQ);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SearchAllResponse | null>(null);
  const requestSeqRef = useRef(0);
  const tabSwitchOnlyRef = useRef(false);

  useEffect(() => {
    setQ(urlQ);
  }, [urlQ]);

  useEffect(() => {
    const term = normalizeQuery(urlQ);

    if (term.length < 2) {
      setResult(null);
      setError(null);
      setLoading(false);
      return;
    }

    const seq = ++requestSeqRef.current;
    if (!tabSwitchOnlyRef.current) {
      setLoading(true);
    }
    tabSwitchOnlyRef.current = false;
    setError(null);

    const t = getAccessToken();
    if (!t) {
      if (seq === requestSeqRef.current) setLoading(false);
      return;
    }

    void (async () => {
      try {
        const data = await apiFetch<SearchAllResponse>(
          `search/all?q=${encodeURIComponent(term)}&limit=30`,
          { method: 'GET', token: t },
        );
        if (seq !== requestSeqRef.current) return;
        setResult(data);
      } catch (e) {
        if (seq !== requestSeqRef.current) return;
        setResult(null);
        setError(e instanceof Error ? e.message : 'خطا در جستجو');
      } finally {
        if (seq === requestSeqRef.current) setLoading(false);
      }
    })();
  }, [urlQ]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const term = normalizeQuery(q);
      const params = new URLSearchParams(searchParams.toString());
      if (term.length === 0) {
        params.delete('q');
      } else {
        params.set('q', term);
      }
      params.set('mode', safeMode);
      router.replace(`/search?${params.toString()}`, { scroll: false });
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [q, router, safeMode, searchParams]);

  const topPosts = useMemo(() => {
    if (!result) return [];
    return [...result.posts].sort((a, b) => {
      const aScore = engagement(a);
      const bScore = engagement(b);
      if (aScore !== bScore) return bScore - aScore;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [result]);

  const latestPosts = useMemo(() => {
    if (!result) return [];
    return [...result.posts].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [result]);

  const videoPosts = useMemo(() => latestPosts.filter(isVideoPost), [latestPosts]);
  const photoPosts = useMemo(() => latestPosts.filter(isPhotoPost), [latestPosts]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const term = normalizeQuery(q);
    if (term.length < 2) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('q', term);
    params.set('mode', safeMode);
    router.replace(`/search?${params.toString()}`, { scroll: false });
  }

  const empty =
    result &&
    result.users.length === 0 &&
    result.posts.length === 0 &&
    result.networks.length === 0 &&
    result.groups.length === 0 &&
    result.channels.length === 0;

  const queryActive = normalizeQuery(urlQ).length >= 2;
  const hashtagFirst = normalizeQuery(urlQ).startsWith('#');

  const renderPostList = (posts: SearchPost[]) => (
    <ul className="space-y-2">
      {posts.map((p) => (
        <li key={p.id}>
          <Link
            href={`/home?postId=${encodeURIComponent(p.id)}`}
            className="block rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:border-slate-300"
          >
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-bold text-slate-800">{p.user.name}</span>
              <span dir="ltr">@{p.user.username}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
              {renderQueryAwareText(excerpt(p.text))}
            </p>
            {p.media.length > 0 || p.mediaUrl ? (
              <p className="mt-2 text-[11px] font-semibold text-slate-500">
                {isVideoPost(p) ? 'دارای ویدیو' : isPhotoPost(p) ? 'دارای تصویر' : 'دارای رسانه'}
              </p>
            ) : null}
            <p className="mt-2 text-[11px] font-semibold text-sky-700">مشاهده در فید خانه ←</p>
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <AuthGate>
      <div className="theme-page-bg theme-text-primary min-h-[50dvh] pb-28" dir="rtl">
        <header className="theme-panel-bg theme-border-soft sticky top-14 z-[12] border-b px-3 py-3 backdrop-blur-md sm:px-4">
          <div className="mx-auto flex max-w-lg flex-col gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => router.back()}
                className="shrink-0 rounded-full px-2 py-1 text-sm font-bold text-slate-600 hover:bg-slate-100"
              >
                ← بازگشت
              </button>
              <h1 className="text-lg font-extrabold text-slate-900">جستجو</h1>
            </div>
            <form onSubmit={onSubmit} className="flex min-w-0 gap-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="نام کاربر، متن پست، یا #هشتگ"
                className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-400/50"
                dir="rtl"
                autoComplete="off"
                enterKeyHint="search"
              />
            </form>
            <div className="no-scrollbar overflow-x-auto">
              <div className="flex min-w-max gap-1 rounded-full bg-slate-100 p-1">
                {SEARCH_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      tabSwitchOnlyRef.current = true;
                      const params = new URLSearchParams(searchParams.toString());
                      params.set('mode', tab.id);
                      if (normalizeQuery(q).length > 0) {
                        params.set('q', normalizeQuery(q));
                      }
                      router.replace(`/search?${params.toString()}`, { scroll: false });
                    }}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                      safeMode === tab.id
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-lg px-3 pt-4 sm:px-4">
          {error && !loading ? (
            <p className="mb-4 text-center text-sm font-semibold text-red-700">{error}</p>
          ) : null}

          {loading ? (
            <div className="space-y-3" aria-busy="true" aria-label="در حال جستجو">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-2xl bg-slate-200/50" />
              ))}
            </div>
          ) : null}

          {!loading && queryActive && result && empty ? (
            <div className="theme-card-bg theme-border-soft rounded-2xl border px-6 py-10 text-center shadow-sm">
              <p className="text-sm font-bold text-slate-700">نتیجه‌ای پیدا نشد</p>
              <p className="mt-2 text-xs text-slate-500">
                عبارت دیگری امتحان کنید؛ برای هشتگ حتماً با # شروع کنید (مثلاً #تهران).
              </p>
            </div>
          ) : null}

          {!loading && !queryActive ? (
            <div className="theme-card-bg theme-border-soft rounded-2xl border px-6 py-10 text-center shadow-sm">
              <p className="text-sm font-bold text-slate-700">جستجو را شروع کنید</p>
              <p className="mt-2 text-xs text-slate-500">نام، هشتگ یا موضوع مورد نظر را وارد کنید.</p>
            </div>
          ) : null}

          {!loading && result && !empty && queryActive ? (
            <div className="space-y-8 pb-6">
              {safeMode === 'top' ? (
                <>
                  {topPosts.length > 0 ? (
                    <section aria-labelledby="sec-top-posts">
                      <h2 id="sec-top-posts" className="mb-3 text-xs font-extrabold text-slate-500">
                        پست‌های برتر
                      </h2>
                      {renderPostList(topPosts.slice(0, 15))}
                    </section>
                  ) : null}
                  {!hashtagFirst && result.users.length > 0 ? (
                    <section aria-labelledby="sec-users">
                      <h2 id="sec-users" className="mb-3 text-xs font-extrabold text-slate-500">
                        افراد
                      </h2>
                      <ul className="space-y-2 rounded-2xl border border-slate-200/80 bg-white p-2 shadow-sm">
                        {result.users.slice(0, 10).map((u) => (
                          <li key={u.id}>
                            <Link
                              href={`/profile/${u.id}`}
                              className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-slate-50"
                            >
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-sm font-bold text-slate-600">
                                {u.avatar ? (
                                  <img src={u.avatar} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  u.name.slice(0, 1)
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="truncate font-bold text-slate-900">{u.name}</div>
                                <div className="truncate text-xs text-slate-500" dir="ltr">
                                  @{u.username}
                                </div>
                              </div>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}
                </>
              ) : null}

              {safeMode === 'latest' ? (
                <section aria-labelledby="sec-latest-posts">
                  <h2 id="sec-latest-posts" className="mb-3 text-xs font-extrabold text-slate-500">
                    جدیدترین پست‌ها
                  </h2>
                  {latestPosts.length > 0 ? (
                    renderPostList(latestPosts)
                  ) : (
                    <p className="text-center text-xs text-slate-500">پست جدیدی برای این جستجو پیدا نشد.</p>
                  )}
                </section>
              ) : null}

              {safeMode === 'people' ? (
                <section aria-labelledby="sec-users">
                  <h2 id="sec-users" className="mb-3 text-xs font-extrabold text-slate-500">
                    کاربران
                  </h2>
                  {result.users.length > 0 ? (
                    <ul className="space-y-2 rounded-2xl border border-slate-200/80 bg-white p-2 shadow-sm">
                      {result.users.map((u) => (
                        <li key={u.id}>
                          <Link
                            href={`/profile/${u.id}`}
                            className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-slate-50"
                          >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-sm font-bold text-slate-600">
                              {u.avatar ? (
                                <img src={u.avatar} alt="" className="h-full w-full object-cover" />
                              ) : (
                                u.name.slice(0, 1)
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate font-bold text-slate-900">{u.name}</div>
                              <div className="truncate text-xs text-slate-500" dir="ltr">
                                @{u.username}
                              </div>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-center text-xs text-slate-500">کاربری با این عبارت پیدا نشد.</p>
                  )}
                </section>
              ) : null}

              {safeMode === 'videos' ? (
                <section aria-labelledby="sec-videos">
                  <h2 id="sec-videos" className="mb-3 text-xs font-extrabold text-slate-500">
                    ویدیوها
                  </h2>
                  {videoPosts.length > 0 ? (
                    renderPostList(videoPosts)
                  ) : (
                    <p className="text-center text-xs text-slate-500">نتیجه ویدیویی برای این عبارت یافت نشد.</p>
                  )}
                </section>
              ) : null}

              {safeMode === 'photos' ? (
                <section aria-labelledby="sec-photos">
                  <h2 id="sec-photos" className="mb-3 text-xs font-extrabold text-slate-500">
                    تصاویر
                  </h2>
                  {photoPosts.length > 0 ? (
                    renderPostList(photoPosts)
                  ) : (
                    <p className="text-center text-xs text-slate-500">نتیجه تصویری برای این عبارت یافت نشد.</p>
                  )}
                </section>
              ) : null}

              {safeMode === 'top' && !hashtagFirst && result.groups.length > 0 ? (
                <section aria-labelledby="sec-groups">
                  <h2 id="sec-groups" className="mb-3 text-xs font-extrabold text-slate-500">گروه‌ها</h2>
                  <ul className="space-y-2">
                    {result.groups.slice(0, 8).map((g) => (
                      <li key={g.id}>
                        <Link
                          href={`/groups/${g.id}`}
                          className="block rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:border-slate-300"
                        >
                          <div className="font-bold text-slate-900">{g.name}</div>
                          {g.description ? <p className="mt-1 text-xs text-slate-600">{excerpt(g.description, 100)}</p> : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          ) : null}
        </main>
      </div>
    </AuthGate>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="theme-page-bg theme-text-secondary flex min-h-[40dvh] items-center justify-center px-4 text-sm">
          در حال بارگذاری جستجو…
        </div>
      }
    >
      <SearchPageInner />
    </Suspense>
  );
}

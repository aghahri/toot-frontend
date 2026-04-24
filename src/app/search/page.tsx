'use client';

import type { FormEvent, ReactNode } from 'react';
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

function excerpt(text: string, max = 140): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

/** UI + URL: Persian normalization, ZWNJ, collapse spaces */
function normalizeSearchQuery(q: string) {
  return q
    .trim()
    .replace(/[ي]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/\u200c/g, ' ')
    .replace(/\s+/g, ' ');
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Needles for highlight / match strength: plain token + hashtag form when single-token */
function highlightNeedles(normQ: string): string[] {
  const base = normalizeSearchQuery(normQ);
  if (base.length < 2) return [];
  const out = new Set<string>();
  out.add(base);
  const noHash = base.replace(/^#+/, '');
  if (noHash.length >= 2) out.add(noHash);
  if (!base.startsWith('#') && noHash.length >= 2 && !/\s/.test(noHash) && noHash.length <= 48) {
    out.add(`#${noHash}`);
  }
  return [...out].sort((a, b) => b.length - a.length);
}

function engagement(post: SearchPost) {
  return post._count.likes + post._count.reposts * 2 + post._count.replies * 2;
}

function hoursSince(iso: string) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 999;
  return Math.max(0, (Date.now() - t) / 3600000);
}

function freshnessBoost(iso: string) {
  const h = hoursSince(iso);
  if (h <= 6) return 22;
  if (h <= 24) return 16;
  if (h <= 72) return 10;
  if (h <= 168) return 5;
  return 0;
}

function textMatchStrength(text: string, normQ: string): number {
  const lower = text.toLowerCase();
  const needles = highlightNeedles(normQ);
  let score = 0;
  for (const n of needles) {
    const idx = lower.indexOf(n.toLowerCase());
    if (idx === -1) continue;
    score += 8 + Math.max(0, 14 - Math.min(idx / 4, 14));
  }
  return Math.min(score, 40);
}

function topCompositeScore(post: SearchPost, normQ: string): number {
  const e = engagement(post);
  const f = freshnessBoost(post.createdAt);
  const m = textMatchStrength(post.text, normQ);
  const mediaBonus = post.media.length > 0 || post.mediaUrl ? 5 : 0;
  return e * 0.45 + f + m + mediaBonus;
}

function isVideoPost(post: SearchPost) {
  return post.media.some((m) => m.type === 'VIDEO' || m.mimeType.startsWith('video/'));
}

function isPhotoPost(post: SearchPost) {
  if (post.media.some((m) => m.type === 'IMAGE' || m.mimeType.startsWith('image/'))) return true;
  return !!post.mediaUrl && /\.(png|jpe?g|webp|gif)$/i.test(post.mediaUrl);
}

function firstVideo(post: SearchPost) {
  return post.media.find((m) => m.type === 'VIDEO' || m.mimeType.startsWith('video/')) ?? null;
}

function firstImage(post: SearchPost) {
  const fromMedia = post.media.find((m) => m.type === 'IMAGE' || m.mimeType.startsWith('image/'));
  if (fromMedia) return fromMedia.url;
  if (post.mediaUrl && /\.(png|jpe?g|webp|gif)$/i.test(post.mediaUrl)) return post.mediaUrl;
  return null;
}

function formatResultTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const h = hoursSince(iso);
  if (h < 1) return 'همین الان';
  if (h < 24) return `${Math.floor(h)} ساعت پیش`;
  if (h < 48) return 'دیروز';
  return d.toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' });
}

function renderSnippetWithHashtagsAndHighlight(text: string, queryNorm: string): ReactNode {
  const snip = excerpt(text, 140);
  const needles = highlightNeedles(queryNorm).map(escapeRegExp);
  const hashtagRe = '#[\\p{L}\\p{N}_]+';
  const combined =
    needles.length > 0
      ? new RegExp(`(${needles.join('|')}|${hashtagRe})`, 'giu')
      : new RegExp(`(${hashtagRe})`, 'giu');
  const parts = snip.split(combined);
  const needleLower = highlightNeedles(queryNorm).map((n) => n.toLowerCase());

  return parts.map((part, idx) => {
    if (!part) return null;
    if (/^#[\p{L}\p{N}_]+$/u.test(part)) {
      return (
        <Link
          key={`h-${idx}`}
          href={`/search?q=${encodeURIComponent(part)}&mode=top`}
          className="font-semibold text-[var(--accent-hover)] hover:underline"
        >
          {part}
        </Link>
      );
    }
    if (needleLower.some((n) => part.toLowerCase() === n)) {
      return (
        <mark
          key={`m-${idx}`}
          className="rounded bg-[var(--accent-soft)] px-0.5 font-medium text-[var(--accent-hover)]"
        >
          {part}
        </mark>
      );
    }
    return <span key={`t-${idx}`}>{part}</span>;
  });
}

function highlightUserField(value: string, queryNorm: string): ReactNode {
  const needles = highlightNeedles(queryNorm).filter((n) => n.length >= 2);
  if (needles.length === 0) return value;
  const pattern = new RegExp(`(${needles.map(escapeRegExp).join('|')})`, 'giu');
  const parts = value.split(pattern);
  const lowerNeedles = needles.map((n) => n.toLowerCase());
  return parts.map((part, idx) => {
    if (!part) return null;
    if (lowerNeedles.includes(part.toLowerCase())) {
      return (
        <mark
          key={idx}
          className="rounded bg-[var(--accent-soft)] px-0.5 font-medium text-[var(--accent-hover)]"
        >
          {part}
        </mark>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="theme-card-bg theme-border-soft rounded-2xl border px-5 py-10 text-center shadow-sm">
      <p className="text-sm font-extrabold text-[var(--text-primary)]">{title}</p>
      <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">{body}</p>
    </div>
  );
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

  const queryNorm = useMemo(() => normalizeSearchQuery(urlQ), [urlQ]);

  useEffect(() => {
    setQ(urlQ);
  }, [urlQ]);

  useEffect(() => {
    const term = queryNorm;

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
  }, [queryNorm]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const term = normalizeSearchQuery(q);
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
      const diff = topCompositeScore(b, queryNorm) - topCompositeScore(a, queryNorm);
      if (diff !== 0) return diff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [result, queryNorm]);

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
    const term = normalizeSearchQuery(q);
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

  const queryActive = queryNorm.length >= 2;
  const hashtagFirst = queryNorm.startsWith('#');

  const postRowClass =
    'theme-card-bg theme-border-soft block border-b border-[var(--border-soft)] px-3 py-3 transition last:border-b-0 hover:bg-[var(--surface-soft)] sm:px-4';

  const renderPostRows = (posts: SearchPost[]) => (
    <ul className="theme-card-bg theme-border-soft overflow-hidden rounded-2xl border shadow-sm">
      {posts.map((p) => (
        <li key={p.id} className="border-b border-[var(--border-soft)] last:border-b-0">
          <Link href={`/home?postId=${encodeURIComponent(p.id)}`} className={postRowClass}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-200/90 text-xs font-bold text-slate-600 ring-1 ring-slate-200/80">
                  {p.user.avatar ? (
                    <img src={p.user.avatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    p.user.name.slice(0, 1)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
                    <span className="truncate text-sm font-extrabold text-[var(--text-primary)]">
                      {p.user.name}
                    </span>
                    <span className="truncate text-xs font-semibold text-[var(--text-secondary)]" dir="ltr">
                      @{p.user.username}
                    </span>
                  </div>
                  <div className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--text-primary)]">
                    {renderSnippetWithHashtagsAndHighlight(p.text, queryNorm)}
                  </div>
                </div>
              </div>
              <time
                className="shrink-0 text-[10px] font-semibold tabular-nums text-[var(--text-secondary)]"
                dateTime={p.createdAt}
              >
                {formatResultTime(p.createdAt)}
              </time>
            </div>
            <p className="mt-2 text-end text-[10px] font-semibold text-[var(--accent-hover)]">
              باز کردن در فید خانه
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );

  const renderVideoGrid = () => (
    <ul className="space-y-3">
      {videoPosts.map((p) => {
        const v = firstVideo(p);
        return (
          <li key={p.id}>
            <Link
              href={`/home?postId=${encodeURIComponent(p.id)}`}
              className="theme-card-bg theme-border-soft flex overflow-hidden rounded-2xl border shadow-sm transition hover:border-[var(--accent-ring)]"
            >
              <div className="relative aspect-video w-[38%] max-w-[9.5rem] shrink-0 bg-black/90 sm:w-[34%]">
                {v ? (
                  <video src={v.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl text-white/80">▶</div>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-center px-3 py-2.5">
                <div className="truncate text-xs font-extrabold text-[var(--text-primary)]">{p.user.name}</div>
                <div className="mt-1 line-clamp-2 text-[12px] leading-snug text-[var(--text-secondary)]">
                  {renderSnippetWithHashtagsAndHighlight(p.text, queryNorm)}
                </div>
                <span className="mt-auto pt-1 text-[10px] font-semibold text-[var(--accent-hover)]">
                  تماشا در فید خانه
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );

  const renderPhotoGrid = () => (
    <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 sm:gap-2">
      {photoPosts.map((p) => {
        const src = firstImage(p);
        return (
          <li key={p.id} className="aspect-square overflow-hidden rounded-xl ring-1 ring-[var(--border-soft)]">
            <Link href={`/home?postId=${encodeURIComponent(p.id)}`} className="relative block h-full w-full bg-black/5">
              {src ? (
                <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <div className="flex h-full items-center justify-center text-[10px] text-[var(--text-secondary)]">
                  تصویر
                </div>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  const peopleListClass =
    'theme-card-bg theme-border-soft divide-y divide-[var(--border-soft)] overflow-hidden rounded-2xl border shadow-sm';

  return (
    <AuthGate>
      <div className="theme-page-bg theme-text-primary min-h-[50dvh] pb-28" dir="rtl">
        <header className="theme-panel-bg theme-border-soft sticky top-14 z-[12] border-b px-3 py-2.5 backdrop-blur-md sm:px-4">
          <div className="mx-auto flex max-w-lg flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => router.back()}
                className="shrink-0 rounded-full px-2 py-1 text-sm font-bold text-[var(--text-secondary)] transition hover:bg-[var(--surface-soft)]"
              >
                ← بازگشت
              </button>
              <h1 className="text-base font-extrabold text-[var(--text-primary)]">جستجو</h1>
            </div>
            <form onSubmit={onSubmit} className="flex min-w-0 gap-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="نام، هشتگ یا موضوع…"
                className="theme-card-bg theme-border-soft min-w-0 flex-1 rounded-2xl border px-3.5 py-2.5 text-sm text-[var(--text-primary)] outline-none ring-0 transition focus:border-[var(--accent-ring)] focus:ring-2 focus:ring-[var(--accent-soft)]"
                dir="rtl"
                autoComplete="off"
                enterKeyHint="search"
              />
            </form>
            <div className="no-scrollbar -mx-0.5 overflow-x-auto px-0.5">
              <div className="flex min-w-max gap-0.5 rounded-full bg-[var(--surface-soft)] p-0.5 ring-1 ring-[var(--border-soft)]">
                {SEARCH_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      tabSwitchOnlyRef.current = true;
                      const params = new URLSearchParams(searchParams.toString());
                      params.set('mode', tab.id);
                      if (normalizeSearchQuery(q).length > 0) {
                        params.set('q', normalizeSearchQuery(q));
                      }
                      router.replace(`/search?${params.toString()}`, { scroll: false });
                    }}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-extrabold transition ${
                      safeMode === tab.id
                        ? 'bg-[var(--accent-soft)] text-[var(--accent-hover)] ring-2 ring-[var(--accent)]/25'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-lg px-3 pt-3 sm:px-4">
          {error && !loading ? (
            <p className="mb-3 text-center text-sm font-semibold text-red-700">{error}</p>
          ) : null}

          {loading ? (
            <div className="space-y-2.5" aria-busy="true" aria-label="در حال جستجو">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-2xl bg-[var(--surface-strong)]/60" />
              ))}
            </div>
          ) : null}

          {!loading && queryActive && result && empty ? (
            <EmptyState
              title="نتیجه‌ای پیدا نشد"
              body="عبارت دیگری امتحان کنید."
            />
          ) : null}

          {!loading && !queryActive ? (
            <EmptyState
              title="جستجو را شروع کنید"
              body="نام کاربر، هشتگ یا موضوع را بنویسید."
            />
          ) : null}

          {!loading && result && !empty && queryActive ? (
            <div className="space-y-6 pb-8">
              {safeMode === 'top' ? (
                <>
                  {topPosts.length > 0 ? (
                    <section aria-labelledby="sec-top-posts">
                      <h2 id="sec-top-posts" className="mb-2 px-0.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--text-secondary)]">
                        پست‌ها
                      </h2>
                      {renderPostRows(topPosts.slice(0, 15))}
                    </section>
                  ) : (
                    <EmptyState
                      title="پست برتری نیست"
                      body="تب «جدیدترین» را هم ببینید."
                    />
                  )}
                  {!hashtagFirst && result.users.length > 0 ? (
                    <section aria-labelledby="sec-users-top">
                      <h2
                        id="sec-users-top"
                        className="mb-2 px-0.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--text-secondary)]"
                      >
                        افراد
                      </h2>
                      <ul className={peopleListClass}>
                        {result.users.slice(0, 10).map((u) => (
                          <li key={u.id}>
                            <Link
                              href={`/profile/${u.id}`}
                              className="flex items-center gap-3 px-3 py-3 transition hover:bg-[var(--surface-soft)]"
                            >
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-200/90 text-sm font-bold text-slate-600 ring-1 ring-slate-200/80">
                                {u.avatar ? (
                                  <img src={u.avatar} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  u.name.slice(0, 1)
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-extrabold text-[var(--text-primary)]">
                                  {highlightUserField(u.name, queryNorm)}
                                </div>
                                <div className="truncate text-xs font-semibold text-[var(--text-secondary)]" dir="ltr">
                                  @{highlightUserField(u.username, queryNorm)}
                                </div>
                              </div>
                              <span className="shrink-0 text-[10px] font-bold text-[var(--accent-hover)]">پروفایل</span>
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
                  <h2
                    id="sec-latest-posts"
                    className="mb-2 px-0.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--text-secondary)]"
                  >
                    جدیدترین
                  </h2>
                  {latestPosts.length > 0 ? (
                    renderPostRows(latestPosts)
                  ) : (
                    <EmptyState title="پست جدیدی نیست" body="با این عبارت هنوز پستی ثبت نشده یا در دسترس نیست." />
                  )}
                </section>
              ) : null}

              {safeMode === 'people' ? (
                <section aria-labelledby="sec-users">
                  <h2
                    id="sec-users"
                    className="mb-2 px-0.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--text-secondary)]"
                  >
                    افراد
                  </h2>
                  {result.users.length > 0 ? (
                    <ul className={peopleListClass}>
                      {result.users.map((u) => (
                        <li key={u.id}>
                          <Link
                            href={`/profile/${u.id}`}
                            className="flex items-center gap-3 px-3 py-3 transition hover:bg-[var(--surface-soft)]"
                          >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-200/90 text-sm font-bold text-slate-600 ring-1 ring-slate-200/80">
                              {u.avatar ? (
                                <img src={u.avatar} alt="" className="h-full w-full object-cover" />
                              ) : (
                                u.name.slice(0, 1)
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-extrabold text-[var(--text-primary)]">
                                {highlightUserField(u.name, queryNorm)}
                              </div>
                              <div className="truncate text-xs font-semibold text-[var(--text-secondary)]" dir="ltr">
                                @{highlightUserField(u.username, queryNorm)}
                              </div>
                            </div>
                            <span className="shrink-0 text-[10px] font-bold text-[var(--accent-hover)]">پروفایل</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyState title="کاربری نیست" body="نام یا نام کاربری دیگری را امتحان کنید." />
                  )}
                </section>
              ) : null}

              {safeMode === 'videos' ? (
                <section aria-labelledby="sec-videos">
                  <h2
                    id="sec-videos"
                    className="mb-2 px-0.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--text-secondary)]"
                  >
                    ویدیوها
                  </h2>
                  {videoPosts.length > 0 ? (
                    renderVideoGrid()
                  ) : (
                    <EmptyState
                      title="ویدیویی نیست"
                      body="برای این عبارت ویدیویی پیدا نشد."
                    />
                  )}
                </section>
              ) : null}

              {safeMode === 'photos' ? (
                <section aria-labelledby="sec-photos">
                  <h2
                    id="sec-photos"
                    className="mb-2 px-0.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--text-secondary)]"
                  >
                    تصاویر
                  </h2>
                  {photoPosts.length > 0 ? (
                    renderPhotoGrid()
                  ) : (
                    <EmptyState
                      title="تصویری نیست"
                      body="پست‌های دارای تصویر برای این عبارت پیدا نشد."
                    />
                  )}
                </section>
              ) : null}

              {safeMode === 'top' && !hashtagFirst && result.groups.length > 0 ? (
                <section aria-labelledby="sec-groups">
                  <h2
                    id="sec-groups"
                    className="mb-2 px-0.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--text-secondary)]"
                  >
                    گروه‌ها
                  </h2>
                  <ul className="theme-card-bg theme-border-soft divide-y divide-[var(--border-soft)] overflow-hidden rounded-2xl border shadow-sm">
                    {result.groups.slice(0, 8).map((g) => (
                      <li key={g.id}>
                        <Link
                          href={`/groups/${g.id}`}
                          className="block px-3 py-3 transition hover:bg-[var(--surface-soft)]"
                        >
                          <div className="font-bold text-[var(--text-primary)]">{g.name}</div>
                          {g.description ? (
                            <p className="mt-1 line-clamp-2 text-xs text-[var(--text-secondary)]">
                              {excerpt(g.description, 100)}
                            </p>
                          ) : null}
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

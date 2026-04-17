'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthGate } from '@/components/AuthGate';
import { getAccessToken, getCurrentUserIdFromAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { FeedTabs } from '@/components/home/FeedTabs';
import { FeedPostCard } from '@/components/home/FeedPostCard';
import { FeedEmptyState } from '@/components/home/FeedEmptyState';
import { HomeFeedHeader } from '@/components/home/HomeFeedHeader';
import { HomeComposeSheet } from '@/components/home/HomeComposeSheet';
import { PostReplySheet } from '@/components/home/PostReplySheet';
import { TrendingTopicsRow, type TrendChip } from '@/components/home/TrendingTopicsRow';
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

type TabFrame = {
  title: string;
};

type StoryItem = {
  id: string;
  title: string;
  summary: string | null;
  category: string | null;
  url: string | null;
  imageUrl?: string | null;
  publishedAt: string | null;
  locationText?: string | null;
  quality?: { qualityScore?: number; duplicateRiskScore?: number };
  storyKind?: 'TODAY' | 'LOCAL' | 'NETWORK';
  trustLabel?: string;
  trustScore?: number;
  freshnessScore?: number;
  relevanceScore?: number;
  source: { name: string };
};

type NetworkMembership = {
  id: string;
  name: string;
  description?: string | null;
  slug?: string | null;
  isMember?: boolean;
  spaceCategory?: string | null;
  networkType?: string | null;
  alignedSpaceCategory?: string | null;
};

type ApiTrendItem = {
  tag: string;
  display: string;
  volume: number;
  authorCount: number;
};

type TrendsBundleResponse = {
  general: { items: ApiTrendItem[] };
  local: { items: ApiTrendItem[] };
  networks: { items: ApiTrendItem[] };
};

function mapTrendItemsToChips(items: ApiTrendItem[], max = 6): TrendChip[] {
  return items.slice(0, max).map((it) => ({
    display: it.display,
    href: `/search?q=${encodeURIComponent(it.display)}&mode=top`,
    volume: it.volume,
  }));
}

const LOCAL_TOKENS = [
  'محله',
  'همسایه',
  'کوچه',
  'خیابان',
  'منطقه',
  'نزدیک',
  'local',
  'neighborhood',
  'district',
  'nearby',
];

const NETWORK_TOKENS = [
  'شبکه',
  'community',
  'network',
  'education',
  'business',
  'sports',
  'gaming',
  'education',
  'startup',
  'teacher',
  'coach',
  'clan',
  'squad',
  'study',
  'class',
];

const NEIGHBORHOOD_HINT_TOKENS = ['محله', 'منطقه', 'ناحیه', 'district', 'neighborhood', 'local'];
const NETWORK_KIND_HINTS = {
  EDUCATION: ['education', 'teacher', 'study', 'class', 'exam', 'course', 'آموزش', 'درس', 'کلاس', 'استاد'],
  BUSINESS: ['business', 'startup', 'hiring', 'job', 'career', 'freelance', 'کسب', 'استارتاپ', 'استخدام', 'شغل'],
  SPORTS: ['sports', 'team', 'club', 'match', 'coach', 'football', 'ورزش', 'تیم', 'باشگاه', 'مربی'],
  GAMING: ['gaming', 'game', 'clan', 'squad', 'stream', 'esports', 'گیم', 'بازی', 'کلن', 'اسکاد'],
};

const LOCAL_EXPLICIT_TOKENS = [
  'ونک',
  'نارمک',
  'محله',
  'همسایه',
  'ترافیک',
  'رویداد محلی',
  'خدمات محلی',
  'شهرداری',
  'neighborhood',
  'district',
  'local event',
];

function normalizeText(input: string) {
  return input
    .toLowerCase()
    .replace(/[‌‍]/g, ' ')
    .replace(/[#@]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenScore(input: string, tokens: string[]) {
  const normalized = normalizeText(input);
  return tokens.reduce((acc, token) => (normalized.includes(token) ? acc + 1 : acc), 0);
}

function extractSearchTokens(input: string) {
  return normalizeText(input)
    .split(/[\s\-_/|,.()[\]{}:;!?]+/)
    .filter((t) => t.length >= 2)
    .slice(0, 20);
}

function extractHashtagTokens(input: string) {
  const raw = input.match(/#[^\s#]+/g) ?? [];
  return raw.map((tag) => normalizeText(tag.replace(/^#+/, ''))).filter((tag) => tag.length >= 2);
}

function freshnessScore(createdAt: string) {
  const ageHours = Math.max(0, (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60));
  if (ageHours <= 6) return 4;
  if (ageHours <= 24) return 3;
  if (ageHours <= 72) return 2;
  return 1;
}

function engagementScore(post: FeedPost) {
  const base = post.likeCount * 0.7 + post.replyCount * 0.9 + post.repostCount * 1.1;
  if (base >= 20) return 4;
  if (base >= 10) return 3;
  if (base >= 4) return 2;
  return 1;
}

function applyAuthorDiversity<T extends { post: FeedPost; score: number }>(rows: T[], maxPerAuthor: number) {
  const perAuthor = new Map<string, number>();
  const out: T[] = [];
  for (const row of rows) {
    const count = perAuthor.get(row.post.userId) ?? 0;
    if (count >= maxPerAuthor) continue;
    perAuthor.set(row.post.userId, count + 1);
    out.push(row);
  }
  return out;
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
  const [storyItems, setStoryItems] = useState<StoryItem[]>([]);
  const [joinedNetworks, setJoinedNetworks] = useState<NetworkMembership[]>([]);
  const [trendsBundle, setTrendsBundle] = useState<TrendsBundleResponse | null>(null);
  const viewerUserId = getCurrentUserIdFromAccessToken();
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

  useEffect(() => {
    if (tab !== 'local' && tab !== 'networks') return;
    if (posts.length > 0 || followingPosts.length > 0) return;
    void loadFeed({ silent: true });
  }, [tab, posts.length, followingPosts.length, loadFeed]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    if (tab !== 'local' && tab !== 'networks') {
      setStoryItems([]);
      return;
    }
    const scope = tab === 'local' ? 'local' : 'networks';
    void apiFetch<StoryItem[]>(`story/published?scope=${scope}&limit=6`, {
      method: 'GET',
      token,
    })
      .then((data) => setStoryItems(data))
      .catch(() => setStoryItems([]));
  }, [tab]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    void apiFetch<NetworkMembership[]>('networks', { method: 'GET', token })
      .then((rows) => {
        setJoinedNetworks((rows || []).filter((n) => n.isMember));
      })
      .catch(() => setJoinedNetworks([]));
  }, []);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    let cancelled = false;
    void apiFetch<TrendsBundleResponse>('search/trends', { method: 'GET', token })
      .then((data) => {
        if (!cancelled) setTrendsBundle(data);
      })
      .catch(() => {
        if (!cancelled) setTrendsBundle(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const removePost = useCallback((postId: string) => {
    setPosts((prev) => prev.filter((x) => x.id !== postId));
    setFollowingPosts((prev) => prev.filter((x) => x.id !== postId));
  }, []);

  const allKnownPosts = [...posts, ...followingPosts].reduce<FeedPost[]>((acc, post) => {
    if (acc.some((x) => x.id === post.id)) return acc;
    acc.push(post);
    return acc;
  }, []);

  const joinedNeighborhoodNetworks = joinedNetworks.filter((n) => {
    const bucket = `${n.spaceCategory ?? ''} ${n.networkType ?? ''} ${n.alignedSpaceCategory ?? ''}`.toUpperCase();
    if (bucket.includes('NEIGHBORHOOD')) return true;
    const text = `${n.name} ${n.description ?? ''}`;
    return tokenScore(text, NEIGHBORHOOD_HINT_TOKENS) > 0;
  });
  const joinedCommunityNetworks = joinedNetworks.filter((n) => !joinedNeighborhoodNetworks.some((h) => h.id === n.id));

  const scoreMembershipMatch = useCallback(
    (text: string, memberships: NetworkMembership[], mode: 'local' | 'networks') => {
      const normalizedText = normalizeText(text);
      let best = 0;
      for (const membership of memberships) {
        const bag = `${membership.name} ${membership.slug ?? ''} ${membership.description ?? ''}`;
        const tokens = extractSearchTokens(bag);
        const directHits = tokens.reduce((acc, token) => (normalizedText.includes(token) ? acc + 1 : acc), 0);
        let kindBonus = 0;
        const hintBag = `${membership.spaceCategory ?? ''} ${membership.networkType ?? ''} ${membership.alignedSpaceCategory ?? ''}`.toUpperCase();
        if (mode === 'local' && hintBag.includes('NEIGHBORHOOD')) kindBonus += 2;
        if (mode === 'networks') {
          if (hintBag.includes('EDUCATION')) kindBonus += tokenScore(normalizedText, NETWORK_KIND_HINTS.EDUCATION);
          if (hintBag.includes('BUSINESS') || hintBag.includes('GENERAL')) kindBonus += tokenScore(normalizedText, NETWORK_KIND_HINTS.BUSINESS);
          if (hintBag.includes('SPORT')) kindBonus += tokenScore(normalizedText, NETWORK_KIND_HINTS.SPORTS);
          if (hintBag.includes('GAMING') || hintBag.includes('TECH')) kindBonus += tokenScore(normalizedText, NETWORK_KIND_HINTS.GAMING);
        }
        best = Math.max(best, directHits * 2 + kindBonus);
      }
      return best;
    },
    [],
  );

  const hasExplicitMembershipSignal = useCallback(
    (text: string, memberships: NetworkMembership[]) => {
      const normalizedText = normalizeText(text);
      const hashtagTokens = new Set(extractHashtagTokens(text));
      for (const membership of memberships) {
        const membershipTokens = extractSearchTokens(
          `${membership.name} ${membership.slug ?? ''} ${membership.description ?? ''}`,
        ).filter((t) => t.length >= 3);
        for (const token of membershipTokens) {
          if (hashtagTokens.has(token)) return true;
          // Strong literal mention in content is also explicit enough.
          if (normalizedText.includes(token)) return true;
        }
      }
      return false;
    },
    [],
  );

  const rankedLocalRows = applyAuthorDiversity(
    [...allKnownPosts]
    .map((post) => {
      const text = `${post.text} ${post.user?.name ?? ''} ${post.user?.username ?? ''}`;
      const membershipScore = scoreMembershipMatch(text, joinedNeighborhoodNetworks, 'local');
      const generalLocalScore = tokenScore(text, LOCAL_TOKENS);
      const explicitLocalSignal = tokenScore(text, LOCAL_EXPLICIT_TOKENS);
      const score =
        membershipScore * 3 +
        explicitLocalSignal * 5 +
        generalLocalScore * 2 +
        freshnessScore(post.createdAt) +
        engagementScore(post);
      return { post, score, membershipScore, explicitLocalSignal, generalLocalScore };
    })
    .filter(({ membershipScore, explicitLocalSignal, generalLocalScore }) => {
      const hasMembershipEligibility = membershipScore >= 2;
      const hasLocalSignal = explicitLocalSignal >= 1 || generalLocalScore >= 2;
      return hasMembershipEligibility || hasLocalSignal;
    })
      .sort((a, b) => {
        if (a.score !== b.score) return b.score - a.score;
        if (a.explicitLocalSignal !== b.explicitLocalSignal) return b.explicitLocalSignal - a.explicitLocalSignal;
        return new Date(b.post.createdAt).getTime() - new Date(a.post.createdAt).getTime();
      }),
    3,
  );

  const localPosts = rankedLocalRows.slice(0, 80).map((x) => x.post);

  const strictRankedNetworkRows = applyAuthorDiversity(
    [...allKnownPosts]
      .map((post) => {
        const text = `${post.text} ${post.user?.name ?? ''} ${post.user?.username ?? ''}`;
        const membershipScore = scoreMembershipMatch(text, joinedCommunityNetworks, 'networks');
        const generalNetworkScore = tokenScore(text, NETWORK_TOKENS);
        const explicitMembershipSignal = hasExplicitMembershipSignal(text, joinedCommunityNetworks);
        const score = membershipScore * 5 + generalNetworkScore * 2 + freshnessScore(post.createdAt) + engagementScore(post);
        return { post, score, membershipScore, generalNetworkScore, explicitMembershipSignal };
      })
      .filter(({ membershipScore, generalNetworkScore, explicitMembershipSignal }) => {
        // Networks is strict: membership-only is not enough.
        if (explicitMembershipSignal && membershipScore >= 2) return true;
        return membershipScore >= 3 && generalNetworkScore >= 1;
      })
      .sort((a, b) => {
        if (a.explicitMembershipSignal !== b.explicitMembershipSignal) {
          return Number(b.explicitMembershipSignal) - Number(a.explicitMembershipSignal);
        }
        if (a.score !== b.score) return b.score - a.score;
        return new Date(b.post.createdAt).getTime() - new Date(a.post.createdAt).getTime();
      }),
    2,
  );

  const networkPosts = strictRankedNetworkRows
    .slice(0, 60)
    .map((x) => x.post);

  const scoreStoryRelevance = useCallback(
    (story: StoryItem, opts: { mode: 'local' | 'networks' }) => {
      const storyText = `${story.title} ${story.summary ?? ''} ${story.category ?? ''} ${story.source?.name ?? ''} ${story.locationText ?? ''}`;
      const memberships = opts.mode === 'local' ? joinedNeighborhoodNetworks : joinedCommunityNetworks;
      if (!memberships.length) return 0;
      const membershipMatch = scoreMembershipMatch(storyText, memberships, opts.mode);
      const kindBonus =
        opts.mode === 'local'
          ? story.storyKind === 'LOCAL'
            ? 2
            : 0
          : story.storyKind === 'NETWORK'
            ? 2
            : 0;
      const trust = story.trustScore ?? 0;
      const freshness = story.freshnessScore ?? 0;
      const quality = story.quality?.qualityScore ?? 0;
      const duplicateRisk = story.quality?.duplicateRiskScore ?? 0;
      const base = membershipMatch * 10 + kindBonus * 10 + trust * 0.12 + freshness * 0.12 + quality * 0.1 - duplicateRisk * 0.12;
      return Math.max(0, base);
    },
    [joinedCommunityNetworks, joinedNeighborhoodNetworks, scoreMembershipMatch],
  );

  const eligibleLocalStories = storyItems
    .map((story) => ({ story, score: scoreStoryRelevance(story, { mode: 'local' }) }))
    .filter((x) => x.score >= 22)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.story);

  const eligibleNetworkStories = storyItems
    .map((story) => ({ story, score: scoreStoryRelevance(story, { mode: 'networks' }) }))
    .filter((x) => x.score >= 22)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.story);

  function injectStoriesIntoFeed(basePosts: FeedPost[], stories: StoryItem[]) {
    if (!stories.length) {
      return basePosts.map((post) => ({ kind: 'post' as const, post }));
    }
    const maxStories = basePosts.length < 6 ? 1 : Math.max(1, Math.min(2, Math.floor(basePosts.length / 7)));
    const selectedStories: StoryItem[] = [];
    const seenSource = new Set<string>();
    const seenTitle = new Set<string>();
    for (const s of stories) {
      const source = (s.source?.name ?? '').trim().toLowerCase();
      const title = s.title.trim().toLowerCase();
      if (seenSource.has(source) || seenTitle.has(title)) continue;
      selectedStories.push(s);
      seenSource.add(source);
      seenTitle.add(title);
      if (selectedStories.length >= maxStories) break;
    }
    if (!selectedStories.length) {
      return basePosts.map((post) => ({ kind: 'post' as const, post }));
    }
    const result: Array<{ kind: 'post'; post: FeedPost } | { kind: 'story'; story: StoryItem }> = [];
    if (basePosts.length < 6) {
      result.push({ kind: 'story', story: selectedStories[0] });
    }
    let storyIdx = 0;
    if (basePosts.length < 6) storyIdx = 1;
    for (let i = 0; i < basePosts.length; i += 1) {
      result.push({ kind: 'post', post: basePosts[i] });
      const interval = i < 7 ? 6 : 8;
      const shouldInject = (i + 1) % interval === 0 && storyIdx < selectedStories.length;
      if (shouldInject) {
        result.push({ kind: 'story', story: selectedStories[storyIdx] });
        storyIdx += 1;
      }
    }
    return result;
  }

  const localStream = injectStoriesIntoFeed(localPosts, eligibleLocalStories);
  const networkStream = injectStoriesIntoFeed(networkPosts, eligibleNetworkStories);

  const tabFrame: TabFrame =
    tab === 'for-you'
      ? {
          title: 'برای شما',
        }
      : tab === 'following'
        ? {
            title: 'دنبال‌شده‌ها',
          }
        : tab === 'local'
          ? {
              title: 'محلهٔ من',
            }
          : {
              title: 'شبکه‌ها',
            };

  return (
    <AuthGate>
      <div className="theme-page-bg theme-text-primary relative min-h-[60dvh] w-full min-w-0 max-w-[100vw]" dir="rtl">
        <div className="theme-panel-bg theme-border-soft sticky top-14 z-[15] w-full min-w-0 max-w-[100vw] overflow-x-hidden border-b shadow-[0_1px_0_rgba(15,23,42,0.06)] backdrop-blur-md">
          <div className="mx-auto w-full min-w-0 max-w-lg">
            <HomeFeedHeader />
            <FeedTabs active={tab} onChange={setTab} />
          </div>
        </div>

        <main className="theme-surface-soft mx-auto min-h-[40dvh] w-full max-w-lg pb-28">
          <section className="theme-card-bg theme-border-soft mx-2 mt-2.5 rounded-2xl border px-3.5 py-3 shadow-sm">
            <div className="flex items-start justify-between gap-2" dir="rtl">
              <div className="min-w-0">
                <p className="theme-text-primary truncate text-sm font-extrabold">{tabFrame.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setComposeOpen(true)}
                className="shrink-0 rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-[11px] font-bold text-[var(--accent-hover)] transition hover:bg-[var(--surface-strong)]"
              >
                پست جدید
              </button>
            </div>
          </section>
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
              {trendsBundle?.general.items.length ? (
                <TrendingTopicsRow
                  title="ترندها"
                  subtitle="هم‌زمان با جامعه"
                  items={mapTrendItemsToChips(trendsBundle.general.items)}
                  searchMoreHref="/search?mode=top"
                />
              ) : null}
              {loadingFeed ? (
                <FeedSkeleton />
              ) : feedError ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm font-semibold text-red-600">{feedError}</p>
                  <button
                    type="button"
                    onClick={() => void loadFeed()}
                    className="mt-4 rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-bold text-[var(--accent-contrast)]"
                  >
                    تلاش دوباره
                  </button>
                </div>
              ) : posts.length === 0 ? (
                <FeedEmptyState
                  title="هنوز پستی در «برای شما» نیست"
                  description="با انتشار اولین پست یا تعامل بیشتر، پیشنهادهای این بخش سریع‌تر شخصی می‌شود."
                  icon="✦"
                />
              ) : (
                <div className="theme-card-bg mx-2 mt-2 overflow-hidden rounded-xl">
                  {posts.map((p) => (
                    <FeedPostCard
                      key={
                        p.feedEntry === 'viewer_repost'
                          ? `vrepost-${p.id}-${p.viewerRepostedAt ?? '0'}`
                          : p.id
                      }
                      post={p}
                      onPatch={patchPost}
                      onDelete={removePost}
                      onOpenReply={setReplyPost}
                      onRepostChanged={() => void loadFeed({ silent: true })}
                      emphasize={emphasizePostId === p.id}
                      viewerUserId={viewerUserId}
                    />
                  ))}
                </div>
              )}

              {!loadingFeed && !feedError ? (
                <div className="px-4 py-4 text-center">
                  <button
                    type="button"
                    onClick={() => void loadFeed()}
                    className="text-sm font-semibold text-[var(--accent-hover)] hover:underline"
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
                    className="mt-4 rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-bold text-[var(--accent-contrast)]"
                  >
                    تلاش دوباره
                  </button>
                </div>
              ) : followingPosts.length === 0 ? (
                <FeedEmptyState
                  title="دنبال‌شده‌ها"
                  description="هنوز پستی از دنبال‌شده‌ها ندارید. افراد بیشتری را دنبال کنید تا این فید فعال‌تر شود."
                  icon="◎"
                />
              ) : (
                <div className="theme-card-bg mx-2 mt-2 overflow-hidden rounded-xl">
                  {followingPosts.map((p) => (
                    <FeedPostCard
                      key={p.id}
                      post={p}
                      onPatch={patchPost}
                      onDelete={removePost}
                      onOpenReply={setReplyPost}
                      onRepostChanged={() => void loadFollowingFeed({ silent: true })}
                      emphasize={emphasizePostId === p.id}
                      viewerUserId={viewerUserId}
                    />
                  ))}
                </div>
              )}

              {!loadingFollowingFeed && !followingFeedError ? (
                <div className="px-4 py-4 text-center">
                  <button
                    type="button"
                    onClick={() => void loadFollowingFeed()}
                    className="text-sm font-semibold text-[var(--accent-hover)] hover:underline"
                  >
                    به‌روزرسانی فید
                  </button>
                </div>
              ) : null}
            </>
          ) : tab === 'local' ? (
            <>
              {trendsBundle?.local.items.length ? (
                <TrendingTopicsRow
                  title="ترند محله"
                  subtitle="میان همسایه‌ها و محله‌های شما"
                  items={mapTrendItemsToChips(trendsBundle.local.items)}
                  searchMoreHref="/search?mode=top"
                />
              ) : null}
              {localStream.length > 0 ? (
                <div className="theme-card-bg mx-2 mt-2 overflow-hidden rounded-xl">
                  {localStream.map((item, idx) => {
                    if (item.kind === 'post') {
                      return (
                        <FeedPostCard
                          key={`local-${item.post.id}`}
                          post={item.post}
                          onPatch={patchPost}
                          onDelete={removePost}
                          onOpenReply={setReplyPost}
                          onRepostChanged={() => void loadFeed({ silent: true })}
                          emphasize={emphasizePostId === item.post.id}
                          viewerUserId={viewerUserId}
                        />
                      );
                    }
                    return <InlineCuratedStoryCard key={`local-story-${item.story.id}-${idx}`} item={item.story} />;
                  })}
                </div>
              ) : (
                <FeedEmptyState
                  title="محلهٔ من"
                  description="آپدیت‌های اطراف شما، صداهای همسایگی و جریان محلی اینجا ظاهر می‌شوند."
                  icon="⌂"
                />
              )}
            </>
          ) : (
            <>
              {trendsBundle?.networks.items.length ? (
                <TrendingTopicsRow
                  title="ترند شبکه‌های شما"
                  subtitle="میان اعضای شبکه‌هایی که عضو هستید"
                  items={mapTrendItemsToChips(trendsBundle.networks.items)}
                  searchMoreHref="/search?mode=top"
                />
              ) : null}
              {networkStream.length > 0 ? (
                <div className="theme-card-bg mx-2 mt-2 overflow-hidden rounded-xl">
                  {networkStream.map((item, idx) => {
                    if (item.kind === 'post') {
                      return (
                        <FeedPostCard
                          key={`net-${item.post.id}`}
                          post={item.post}
                          onPatch={patchPost}
                          onDelete={removePost}
                          onOpenReply={setReplyPost}
                          onRepostChanged={() => void loadFeed({ silent: true })}
                          emphasize={emphasizePostId === item.post.id}
                          viewerUserId={viewerUserId}
                        />
                      );
                    }
                    return <InlineCuratedStoryCard key={`net-story-${item.story.id}-${idx}`} item={item.story} />;
                  })}
                </div>
              ) : (
                <FeedEmptyState
                  title="شبکه‌ها"
                  description="پست‌های شبکه‌های Education / Business / Sports / Gaming / Neighborhood اینجا می‌آیند."
                  icon="⬡"
                />
              )}
            </>
          )}
        </main>

        <button
          type="button"
          onClick={() => setComposeOpen(true)}
          className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] start-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)] text-2xl font-light text-[var(--accent-contrast)] shadow-lg transition hover:bg-[var(--accent-hover)] hover:shadow-xl active:scale-95"
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

function InlineCuratedStoryCard({ item }: { item: StoryItem }) {
  const href = item.url?.trim() || null;
  const kindLabel = item.storyKind === 'LOCAL' ? 'Local' : item.storyKind === 'NETWORK' ? 'Network' : 'Curated';
  const kindCls =
    item.storyKind === 'LOCAL'
      ? 'bg-emerald-500/15 text-emerald-700'
      : item.storyKind === 'NETWORK'
        ? 'bg-violet-500/15 text-violet-700'
        : 'bg-sky-500/15 text-sky-700';
  const Root = href ? 'a' : 'div';
  return (
    <Root
      {...(href ? { href, target: '_blank', rel: 'noreferrer noopener' } : {})}
      className="theme-surface-soft theme-border-soft mx-2 my-2.5 block rounded-2xl border p-3 shadow-[0_4px_14px_rgba(15,23,42,0.06)] transition hover:border-[var(--accent-ring)]"
    >
      <div className="flex items-center gap-1.5">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${kindCls}`}>{kindLabel}</span>
        <span className="rounded-full border border-[var(--border-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">
          Story Curated
        </span>
        {item.trustLabel ? (
          <span className="rounded-full border border-[var(--border-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">
            {item.trustLabel}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-[13px] font-extrabold text-[var(--text-primary)]">{item.title}</p>
      <p className="mt-1 line-clamp-2 text-[12px] text-[var(--text-secondary)]">
        {item.summary || 'گزیده کوتاه در دسترس نیست.'}
      </p>
      <p className="mt-2 text-[11px] font-semibold text-[var(--accent-hover)]">{item.source.name}</p>
    </Root>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="theme-page-bg theme-text-secondary flex min-h-[40dvh] items-center justify-center px-4 text-sm">
          در حال بارگذاری…
        </div>
      }
    >
      <HomePageInner />
    </Suspense>
  );
}

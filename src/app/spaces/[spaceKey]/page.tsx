'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { notFound, useParams, useRouter } from 'next/navigation';
import { AuthGate } from '@/components/AuthGate';
import { getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import {
  BULLETIN_KIND_LABELS,
  fetchNeighborhoodVisibility,
  NEIGHBORHOOD_CAPABILITY_CARDS,
  neighborhoodPageHref,
  type NeighborhoodVisibilitySnapshot,
} from '@/lib/neighborhoodPack';
import { isSpaceKey, SPACE_CARD_META, type SpaceKey } from '@/lib/spacesCatalog';

type GroupRow = {
  id: string;
  name: string;
  description: string | null;
  networkId: string | null;
  joinable: boolean;
};

type NetworkRow = {
  id: string;
  name: string;
  description: string | null;
  slug: string | null;
  networkType?: string;
  alignedSpaceCategory?: SpaceKey | null;
  isMember?: boolean;
};

type ChannelRow = {
  id: string;
  name: string;
  description: string | null;
  networkId: string;
  network: { id: string; name: string };
};

type DetailResponse = {
  category: SpaceKey;
  groups: GroupRow[];
  networks: NetworkRow[];
  channels: ChannelRow[];
};

type SearchNetworksResponse = {
  data: Array<{
    id: string;
    name: string;
    description: string | null;
    slug: string | null;
    spaceCategory?: string;
    createdAt: string;
  }>;
  meta: { total: number; limit: number; offset: number; hasMore: boolean };
};

/** Matches discover/spaces/detail network filter so merged rows stay space-accurate */
type UserNetworkListItem = {
  id: string;
  name: string;
  description?: string | null;
  slug?: string | null;
  networkType?: string;
  spaceCategory?: string;
  alignedSpaceCategory?: string | null;
  isMember?: boolean;
};

function networkMatchesDiscoverSpace(n: UserNetworkListItem, spaceKey: SpaceKey): boolean {
  if (spaceKey === 'EDUCATION') return n.networkType === 'EDUCATION';
  if (spaceKey === 'PUBLIC_GENERAL') return n.networkType === 'BUSINESS';
  return n.spaceCategory === spaceKey || n.alignedSpaceCategory === spaceKey;
}

const SECTION =
  'rounded-3xl border border-[var(--border-soft)] bg-[var(--card-bg)] p-4 shadow-sm ring-1 ring-[var(--border-soft)] sm:p-5';
const BTN_PRI =
  'shrink-0 rounded-full bg-[var(--accent)] px-3 py-2 text-[11px] font-extrabold text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)] disabled:opacity-50';
const BTN_SEC =
  'shrink-0 rounded-full border border-[var(--border-soft)] bg-[var(--card-bg)] px-3 py-2 text-[11px] font-extrabold text-[var(--text-primary)] hover:bg-[var(--surface-soft)]';
const TEASER =
  'rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3 text-right ring-1 ring-[var(--border-soft)]';
const TEASER_LINK = 'mt-2 inline-flex text-[10px] font-extrabold text-[var(--accent-hover)] hover:underline';

function fa(n: number) {
  return n.toLocaleString('fa-IR');
}

function hoodCapabilityStatusLine(
  v: NeighborhoodVisibilitySnapshot | null,
  loading: boolean,
  href: string,
): string {
  if (loading) return '…';
  if (!v) return '';
  if (href.includes('/polls')) {
    return v.counts.openPolls > 0 ? `${fa(v.counts.openPolls)} نظرسنجی فعال` : 'بدون نظرسنجی فعال';
  }
  if (href.includes('/forms')) {
    return v.counts.publishedForms > 0 ? `${fa(v.counts.publishedForms)} فرم منتشرشده` : 'فرم منتشرشده‌ای نیست';
  }
  if (href.includes('/showcase')) {
    return v.counts.spotlights > 0 ? `${fa(v.counts.spotlights)} کسب‌وکار محلی` : 'هنوز معرفی ثبت نشده';
  }
  if (href.includes('/bulletin')) {
    return v.counts.bulletins > 0 ? `${fa(v.counts.bulletins)} اطلاعیه` : 'اطلاعیه‌ای نیست';
  }
  return '';
}

function isSameLocalDay(iso: string) {
  try {
    const d = new Date(iso);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
    );
  } catch {
    return false;
  }
}

function capabilityLinks(sk: SpaceKey, mid: string | null): { label: string; href: string }[] {
  const nid = mid ? `&networkId=${encodeURIComponent(mid)}` : '';
  switch (sk) {
    case 'NEIGHBORHOOD':
      /* Rendered as NEIGHBORHOOD_CAPABILITY_CARDS in the detail UI */
      return [];
    case 'EDUCATION':
      return [
        { label: 'کلاس زنده', href: `/groups/new?kind=community&spaceKey=EDUCATION${nid}&returnTo=spaces&preset=class` },
        { label: 'کانال آموزشی', href: `/channels/new?preset=teacher&spaceKey=EDUCATION${nid}` },
        { label: 'گروه مطالعه', href: `/groups/new?kind=community&spaceKey=EDUCATION${nid}&returnTo=spaces&preset=study` },
        { label: 'مدرس‌ها', href: `/channels/new?preset=teacher&spaceKey=EDUCATION${nid}` },
      ];
    case 'SPORT':
      return [
        { label: 'مدیریت تیم', href: `/groups/new?kind=community&spaceKey=SPORT${nid}&returnTo=spaces&preset=team` },
        { label: 'گروه هواداری', href: `/groups/new?kind=community&spaceKey=SPORT${nid}&returnTo=spaces&preset=fan` },
        { label: 'برنامه تمرین', href: `/groups/new?kind=community&spaceKey=SPORT${nid}&returnTo=spaces&preset=fitness` },
        { label: 'Matchday Hub', href: '/spaces/SPORT' },
      ];
    case 'TECH':
      return [
        { label: 'فروم بازی', href: '/spaces/TECH' },
        { label: 'کلن', href: `/groups/new?kind=community&spaceKey=TECH${nid}&returnTo=spaces&preset=clan` },
        { label: 'Squad Finder', href: `/groups/new?kind=community&spaceKey=TECH${nid}&returnTo=spaces&preset=squad` },
        { label: 'استریم کانال', href: `/channels/new?preset=stream&spaceKey=TECH${nid}` },
      ];
    case 'PUBLIC_GENERAL':
      return [
        { label: 'پروژه کوچک', href: `/groups/new?kind=community&spaceKey=PUBLIC_GENERAL${nid}&returnTo=spaces&preset=startup` },
        { label: 'استخدام', href: `/groups/new?kind=community&spaceKey=PUBLIC_GENERAL${nid}&returnTo=spaces&preset=hiring` },
        { label: 'شبکه حرفه‌ای', href: '/search' },
        { label: 'کانال شرکتی', href: `/channels/new?preset=professional&spaceKey=PUBLIC_GENERAL${nid}` },
      ];
    default:
      return [];
  }
}

function SpaceDetailInner() {
  const params = useParams();
  const router = useRouter();
  const raw = typeof params?.spaceKey === 'string' ? params.spaceKey : '';

  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [joiningGroup, setJoiningGroup] = useState<string | null>(null);
  const [joiningNet, setJoiningNet] = useState<string | null>(null);
  const [joiningCh, setJoiningCh] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isNeighborhood = raw === 'NEIGHBORHOOD';
  const [memberNetworkIds, setMemberNetworkIds] = useState<Set<string>>(() => new Set());
  /** Full list from GET /networks — used to show every joined network not in discover's capped page */
  const [userNetworksList, setUserNetworksList] = useState<UserNetworkListItem[] | null>(null);
  const [hoodQuery, setHoodQuery] = useState('');
  const [hoodSearchActive, setHoodSearchActive] = useState(false);
  const [hoodHits, setHoodHits] = useState<SearchNetworksResponse['data']>([]);
  const [hoodSearchLoading, setHoodSearchLoading] = useState(false);
  const [hoodSearchMeta, setHoodSearchMeta] = useState<SearchNetworksResponse['meta'] | null>(null);
  /** Neighborhood: show discover/join list only after explicit expand or while search is active */
  const [hoodBrowseAllNetworksOpen, setHoodBrowseAllNetworksOpen] = useState(false);
  const hoodDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoodSearchMetaRef = useRef<SearchNetworksResponse['meta'] | null>(null);
  hoodSearchMetaRef.current = hoodSearchMeta;

  /** Reset neighborhood browse/search when switching spaces so list/flags cannot leak across [spaceKey]. */
  useEffect(() => {
    if (hoodDebounceRef.current) {
      clearTimeout(hoodDebounceRef.current);
      hoodDebounceRef.current = null;
    }
    setHoodBrowseAllNetworksOpen(false);
    setHoodQuery('');
    setHoodSearchActive(false);
    setHoodHits([]);
    setHoodSearchMeta(null);
  }, [raw]);

  const refreshDetail = useCallback(async () => {
    if (!isSpaceKey(raw)) return;
    const token = getAccessToken();
    const lim = raw === 'NEIGHBORHOOD' ? 200 : 50;
    const networkTypeParam =
      raw === 'EDUCATION'
        ? '&networkType=EDUCATION'
        : raw === 'PUBLIC_GENERAL'
          ? '&networkType=BUSINESS'
          : '';
    const path = token
      ? `discover/spaces/detail/${encodeURIComponent(raw)}/with-membership?limit=${lim}${networkTypeParam}`
      : `discover/spaces/detail/${encodeURIComponent(raw)}?limit=${lim}${networkTypeParam}`;
    const res = await apiFetch<DetailResponse>(path, {
      method: 'GET',
      ...(token ? { token } : {}),
    });
    setData(res);
    if (res.networks?.length) {
      setMemberNetworkIds((prev) => {
        const next = new Set(prev);
        for (const n of res.networks) {
          if (n.isMember) next.add(n.id);
        }
        return next;
      });
    }
  }, [raw]);

  useEffect(() => {
    if (!isSpaceKey(raw)) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        await refreshDetail();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'خطا');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [raw, refreshDetail]);

  useEffect(() => {
    if (!isSpaceKey(raw)) return;
    let cancelled = false;
    void (async () => {
      const token = getAccessToken();
      if (!token) {
        setUserNetworksList(null);
        return;
      }
      try {
        const list = await apiFetch<UserNetworkListItem[]>('networks', {
          method: 'GET',
          token,
        });
        if (cancelled || !Array.isArray(list)) return;
        setMemberNetworkIds(new Set(list.filter((n) => n.isMember).map((n) => n.id)));
        setUserNetworksList(list);
      } catch {
        if (!cancelled) setUserNetworksList(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [raw]);

  const fetchNeighborhoodSearchPage = useCallback(
    async (opts: { reset: boolean; q: string }) => {
      if (!isNeighborhood) return;
      const token = getAccessToken();
      if (!token) return;
      const q = opts.q.trim();
      setHoodSearchLoading(true);
      setError(null);
      const prevMeta = hoodSearchMetaRef.current;
      const offset = opts.reset ? 0 : prevMeta ? prevMeta.offset + prevMeta.limit : 0;
      try {
        const params = new URLSearchParams();
        params.set('spaceCategory', 'NEIGHBORHOOD');
        if (q) params.set('q', q);
        params.set('limit', '30');
        params.set('offset', String(offset));
        const res = await apiFetch<SearchNetworksResponse>(`search/networks?${params.toString()}`, {
          method: 'GET',
          token,
        });
        setHoodSearchMeta(res.meta);
        if (opts.reset) setHoodHits(res.data);
        else setHoodHits((prev) => [...prev, ...res.data]);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'جستجو ممکن نیست');
      } finally {
        setHoodSearchLoading(false);
      }
    },
    [isNeighborhood],
  );

  useEffect(() => {
    if (!isNeighborhood) return;
    const q = hoodQuery.trim();
    if (hoodDebounceRef.current) clearTimeout(hoodDebounceRef.current);
    if (!q) {
      setHoodSearchActive(false);
      setHoodHits([]);
      setHoodSearchMeta(null);
      return;
    }
    setHoodSearchActive(true);
    hoodDebounceRef.current = setTimeout(() => {
      void fetchNeighborhoodSearchPage({ reset: true, q });
    }, 320);
    return () => {
      if (hoodDebounceRef.current) clearTimeout(hoodDebounceRef.current);
    };
  }, [hoodQuery, isNeighborhood, fetchNeighborhoodSearchPage]);

  const mergedMember = useCallback(
    (id: string, row?: NetworkRow) => {
      if (row?.isMember) return true;
      return memberNetworkIds.has(id);
    },
    [memberNetworkIds],
  );

  const displayNetworks = useMemo(() => {
    if (!data || !isSpaceKey(raw)) return [];
    if (isNeighborhood && hoodSearchActive) {
      return hoodHits.map((h) => ({
        id: h.id,
        name: h.name,
        description: h.description,
        slug: h.slug,
        isMember: mergedMember(h.id),
      }));
    }

    const byId = new Map<string, NetworkRow>();
    for (const n of data.networks) {
      byId.set(n.id, {
        ...n,
        isMember: mergedMember(n.id, n),
      });
    }

    if (userNetworksList) {
      for (const un of userNetworksList) {
        if (!un.isMember || !networkMatchesDiscoverSpace(un, raw)) continue;
        if (byId.has(un.id)) continue;
        byId.set(un.id, {
          id: un.id,
          name: un.name,
          description: un.description ?? null,
          slug: un.slug ?? null,
          networkType: un.networkType,
          alignedSpaceCategory: (un.alignedSpaceCategory as NetworkRow['alignedSpaceCategory']) ?? null,
          isMember: true,
        });
      }
    }

    const ordered: NetworkRow[] = [];
    const seen = new Set<string>();
    for (const n of data.networks) {
      const row = byId.get(n.id);
      if (row) {
        ordered.push(row);
        seen.add(n.id);
      }
    }
    for (const row of byId.values()) {
      if (!seen.has(row.id)) ordered.push(row);
    }
    return ordered;
  }, [data, hoodHits, hoodSearchActive, isNeighborhood, mergedMember, userNetworksList, raw]);

  /** Joined first; remainder kept in API order for stable UX */
  const { joinedNetworks, otherNetworks } = useMemo(() => {
    const joined: NetworkRow[] = [];
    const other: NetworkRow[] = [];
    for (const n of displayNetworks) {
      if (n.isMember) joined.push(n);
      else other.push(n);
    }
    return { joinedNetworks: joined, otherNetworks: other };
  }, [displayNetworks]);

  const showHoodPublicNetworksList = useMemo(
    () => !isNeighborhood || hoodSearchActive || hoodBrowseAllNetworksOpen,
    [isNeighborhood, hoodSearchActive, hoodBrowseAllNetworksOpen],
  );

  const memberNetworkId = useMemo(() => joinedNetworks[0]?.id ?? null, [joinedNetworks]);

  const [hoodVisibility, setHoodVisibility] = useState<NeighborhoodVisibilitySnapshot | null>(null);
  const [hoodVisibilityLoading, setHoodVisibilityLoading] = useState(false);

  useEffect(() => {
    if (!isNeighborhood || !memberNetworkId) {
      setHoodVisibility(null);
      setHoodVisibilityLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const token = getAccessToken();
      if (!token) return;
      setHoodVisibilityLoading(true);
      try {
        const snap = await fetchNeighborhoodVisibility(memberNetworkId);
        if (!cancelled) setHoodVisibility(snap);
      } catch {
        if (!cancelled) setHoodVisibility(null);
      } finally {
        if (!cancelled) setHoodVisibilityLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isNeighborhood, memberNetworkId]);

  const caps = useMemo(() => {
    if (!isSpaceKey(raw)) return [];
    return capabilityLinks(raw, memberNetworkId);
  }, [raw, memberNetworkId]);

  async function joinGroup(groupId: string) {
    const token = getAccessToken();
    if (!token) return;
    setJoiningGroup(groupId);
    setError(null);
    try {
      await apiFetch(`groups/${groupId}/join`, { method: 'POST', token });
      window.location.href = `/groups/${groupId}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'پیوستن به گروه ممکن نیست');
    } finally {
      setJoiningGroup(null);
    }
  }

  async function joinNetwork(networkId: string) {
    const token = getAccessToken();
    if (!token) return;
    setJoiningNet(networkId);
    setError(null);
    try {
      await apiFetch(`networks/${networkId}/join`, { method: 'POST', token });
      setMemberNetworkIds((prev) => new Set(prev).add(networkId));
      await refreshDetail();
      router.push(`/networks/${networkId}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('already a member') || msg.includes('Conflict') || msg.includes('409')) {
        setMemberNetworkIds((prev) => new Set(prev).add(networkId));
        setError(null);
        await refreshDetail();
        return;
      }
      setError(msg || 'پیوستن به شبکه ممکن نیست');
    } finally {
      setJoiningNet(null);
    }
  }

  async function joinChannel(channelId: string, networkId: string) {
    const token = getAccessToken();
    if (!token) return;
    setJoiningCh(channelId);
    setError(null);
    try {
      await apiFetch(`channels/${channelId}/join`, { method: 'POST', token });
      router.push(`/channels/${channelId}?network=${encodeURIComponent(networkId)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'پیوستن به کانال ممکن نیست');
    } finally {
      setJoiningCh(null);
    }
  }

  if (!isSpaceKey(raw)) {
    notFound();
  }
  const spaceKey = raw;
  const meta = SPACE_CARD_META[spaceKey];

  return (
    <AuthGate>
      <main className="theme-page-bg theme-text-primary mx-auto w-full max-w-md space-y-5 px-4 pb-16 pt-4 sm:pb-14" dir="rtl">
        <div className="flex items-center gap-3">
          <Link
            href="/spaces"
            className="flex h-10 min-w-[2.5rem] items-center justify-center rounded-full text-[var(--text-secondary)] transition hover:bg-[var(--surface-soft)]"
            aria-label="بازگشت"
          >
            ←
          </Link>
          <div
            className={`flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--card-bg)] px-3 py-2 ring-1 ring-[var(--border-soft)]`}
          >
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-lg text-white ${meta.gradient}`}
              aria-hidden
            >
              {spaceKey === 'NEIGHBORHOOD'
                ? '🏘'
                : spaceKey === 'EDUCATION'
                  ? '🎓'
                  : spaceKey === 'SPORT'
                    ? '⚽'
                    : spaceKey === 'TECH'
                      ? '🎮'
                      : '💼'}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-black text-[var(--text-primary)]">{meta.title}</h1>
              <p className="truncate text-[11px] text-[var(--text-secondary)]">{meta.subtitle}</p>
            </div>
          </div>
        </div>

        {spaceKey === 'PUBLIC_GENERAL' ? (
          <Link
            href="/spaces/business"
            className="block rounded-2xl border border-slate-400/40 bg-gradient-to-r from-slate-800 to-zinc-900 px-4 py-3 text-center text-[12px] font-extrabold text-white shadow-md ring-1 ring-white/10 transition hover:brightness-110"
          >
            ورود به فضای کسب‌وکار (استخدام، پروژه، فهرست)
          </Link>
        ) : null}

        {loading ? (
          <p className="text-sm text-[var(--text-secondary)]">در حال بارگذاری…</p>
        ) : error ? (
          <p className="text-sm font-semibold text-red-600">{error}</p>
        ) : data ? (
          <>
            {/* 1 — شبکه‌ها و اجتماع‌ها */}
            <section className={SECTION} aria-labelledby="sec-net">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 id="sec-net" className="text-sm font-black text-[var(--text-primary)]">
                  شبکه‌ها و اجتماع‌ها
                </h2>
                <Link
                  href={`/groups/new?kind=community&spaceKey=${encodeURIComponent(spaceKey)}&returnTo=spaces`}
                  className={BTN_SEC}
                >
                  ساخت گروه
                </Link>
              </div>

              {isNeighborhood ? (
                <input
                  type="search"
                  dir="rtl"
                  value={hoodQuery}
                  onChange={(e) => setHoodQuery(e.target.value)}
                  placeholder="جستجوی شبکه محله…"
                  className="mb-3 w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-ring)]"
                />
              ) : null}

              <h3 className="mb-2 text-[11px] font-extrabold text-[var(--text-secondary)]">شبکه‌ها</h3>

              {displayNetworks.length === 0 ? (
                <p className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] py-6 text-center text-xs text-[var(--text-secondary)]">
                  {hoodSearchLoading ? '…' : 'شبکه‌ای نیست'}
                </p>
              ) : (
                <>
                  {joinedNetworks.length > 0 ? (
                    <div className="mb-3 rounded-2xl border border-emerald-600/25 bg-emerald-500/[0.06] p-2 ring-1 ring-emerald-600/15 dark:bg-emerald-400/[0.07] dark:ring-emerald-400/20">
                      <p className="mb-2 px-1 text-[10px] font-extrabold text-emerald-800 dark:text-emerald-300">شبکه‌های شما</p>
                      <div
                        className={
                          joinedNetworks.length > 5
                            ? 'max-h-[min(42vh,18rem)] overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]'
                            : undefined
                        }
                        role={joinedNetworks.length > 5 ? 'region' : undefined}
                        aria-label={joinedNetworks.length > 5 ? 'همه شبکه‌های عضو شده در این فضا' : undefined}
                      >
                        <ul className="divide-y divide-emerald-600/15">
                          {joinedNetworks.map((n) => (
                            <li key={n.id} className="flex items-start justify-between gap-2 py-2 first:pt-1 last:pb-1">
                              <div className="min-w-0 flex-1">
                                <Link
                                  href={`/networks/${n.id}`}
                                  className="text-sm font-extrabold text-[var(--accent-hover)] hover:underline"
                                >
                                  {n.name}
                                </Link>
                                {n.description ? (
                                  <p className="mt-0.5 line-clamp-1 text-[11px] text-[var(--text-secondary)]">{n.description}</p>
                                ) : null}
                                <p className="mt-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">عضو هستید</p>
                              </div>
                              <Link href={`/networks/${n.id}`} className={BTN_SEC}>
                                ورود
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ) : null}

                  {isNeighborhood && otherNetworks.length > 0 && !showHoodPublicNetworksList ? (
                    <button
                      type="button"
                      onClick={() => setHoodBrowseAllNetworksOpen(true)}
                      className={'mt-2 w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--card-bg)] px-3 py-2.5 text-center text-[11px] font-extrabold text-[var(--text-primary)] ring-1 ring-[var(--border-soft)] transition hover:bg-[var(--surface-soft)]'}
                    >
                      مشاهده همه شبکه‌های محله
                      <span className="mr-1 tabular-nums text-[10px] font-bold text-[var(--text-secondary)]">
                        ({otherNetworks.length})
                      </span>
                    </button>
                  ) : null}

                  {otherNetworks.length > 0 && showHoodPublicNetworksList ? (
                    <div>
                      {joinedNetworks.length > 0 ? (
                        <p className="mb-2 text-[10px] font-extrabold text-[var(--text-secondary)]">سایر شبکه‌ها</p>
                      ) : null}
                      <div
                        className="max-h-[min(55vh,22rem)] overflow-y-auto overscroll-contain rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] [-webkit-overflow-scrolling:touch]"
                        role="region"
                        aria-label="فهرست شبکه‌ها برای پیوستن"
                      >
                        <ul className="divide-y divide-[var(--border-soft)]">
                          {otherNetworks.map((n) => (
                            <li key={n.id} className="flex items-start justify-between gap-2 px-2 py-3 sm:px-3">
                              <div className="min-w-0 flex-1">
                                <Link
                                  href={`/networks/${n.id}`}
                                  className="text-sm font-extrabold text-[var(--accent-hover)] hover:underline"
                                >
                                  {n.name}
                                </Link>
                                {n.description ? (
                                  <p className="mt-0.5 line-clamp-2 text-[11px] text-[var(--text-secondary)]">{n.description}</p>
                                ) : null}
                              </div>
                              <button
                                type="button"
                                disabled={joiningNet === n.id}
                                onClick={() => void joinNetwork(n.id)}
                                className={BTN_PRI}
                              >
                                {joiningNet === n.id ? '…' : 'پیوستن'}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                      {isNeighborhood && hoodBrowseAllNetworksOpen && !hoodSearchActive ? (
                        <button
                          type="button"
                          onClick={() => setHoodBrowseAllNetworksOpen(false)}
                          className="mt-2 w-full text-center text-[10px] font-extrabold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        >
                          جمع کردن فهرست
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}

              {isNeighborhood && hoodSearchActive && hoodSearchMeta?.hasMore ? (
                <button
                  type="button"
                  disabled={hoodSearchLoading}
                  onClick={() => void fetchNeighborhoodSearchPage({ reset: false, q: hoodQuery.trim() })}
                  className={'mt-2 w-full ' + BTN_SEC}
                >
                  {hoodSearchLoading ? '…' : 'بیشتر'}
                </button>
              ) : null}

              <h3 className="mb-2 mt-5 text-[11px] font-extrabold text-[var(--text-secondary)]">گروه‌ها</h3>
              <ul className="divide-y divide-[var(--border-soft)]">
                {data.groups.length === 0 ? (
                  <li className="py-4 text-center text-xs text-[var(--text-secondary)]">—</li>
                ) : (
                  data.groups.map((g) => (
                    <li key={g.id} className="flex items-start justify-between gap-2 py-3">
                      <div className="min-w-0 flex-1">
                        <Link href={`/groups/${g.id}`} className="text-sm font-extrabold text-[var(--accent-hover)] hover:underline">
                          {g.name}
                        </Link>
                        {g.description ? (
                          <p className="mt-0.5 line-clamp-1 text-[11px] text-[var(--text-secondary)]">{g.description}</p>
                        ) : null}
                      </div>
                      {g.joinable ? (
                        <button type="button" disabled={joiningGroup === g.id} onClick={() => void joinGroup(g.id)} className={BTN_PRI}>
                          {joiningGroup === g.id ? '…' : 'پیوستن'}
                        </button>
                      ) : (
                        <Link href={`/groups/${g.id}`} className={BTN_SEC}>
                          باز
                        </Link>
                      )}
                    </li>
                  ))
                )}
              </ul>

              <h3 className="mb-2 mt-5 text-[11px] font-extrabold text-[var(--text-secondary)]">کانال‌ها</h3>
              <ul className="divide-y divide-[var(--border-soft)]">
                {data.channels.length === 0 ? (
                  <li className="py-4 text-center text-xs text-[var(--text-secondary)]">—</li>
                ) : (
                  data.channels.map((c) => (
                    <li key={c.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <Link
                          href={`/channels/${c.id}?network=${encodeURIComponent(c.networkId)}`}
                          className="text-sm font-extrabold text-[var(--accent-hover)] hover:underline"
                        >
                          {c.name}
                        </Link>
                        <p className="text-[10px] text-[var(--text-secondary)]">{c.network.name}</p>
                      </div>
                      <div className="flex gap-2">
                        <Link href={`/networks/${c.networkId}`} className={BTN_SEC}>
                          شبکه
                        </Link>
                        <button type="button" disabled={joiningCh === c.id} onClick={() => void joinChannel(c.id, c.networkId)} className={BTN_PRI}>
                          {joiningCh === c.id ? '…' : 'پیوستن'}
                        </button>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </section>

            {/* 2 — ابزارها */}
            <section className={SECTION} aria-labelledby="sec-cap">
              <h2 id="sec-cap" className="mb-3 text-sm font-black text-[var(--text-primary)]">
                ابزارهای محله
              </h2>
              {spaceKey === 'NEIGHBORHOOD' ? (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {NEIGHBORHOOD_CAPABILITY_CARDS.map((c) => {
                      const href = neighborhoodPageHref(c.href, memberNetworkId);
                      const status = hoodCapabilityStatusLine(hoodVisibility, hoodVisibilityLoading, c.href);
                      return (
                        <Link
                          key={c.href}
                          href={href}
                          className="group flex flex-col gap-1.5 rounded-3xl border border-[var(--border-soft)] bg-gradient-to-br from-[var(--surface-soft)] to-[var(--card-bg)] p-4 text-right shadow-sm ring-1 ring-emerald-600/10 transition hover:ring-emerald-500/25 dark:ring-emerald-400/15"
                        >
                          <span className="text-2xl leading-none" aria-hidden>
                            {c.emoji}
                          </span>
                          <span className="text-sm font-black text-[var(--text-primary)]">{c.label}</span>
                          <span className="text-[11px] leading-snug text-[var(--text-secondary)]">{c.sub}</span>
                          {status ? (
                            <span className="text-[10px] font-bold text-emerald-800/90 dark:text-emerald-300/90">{status}</span>
                          ) : null}
                          <span className="mt-1 text-[10px] font-extrabold text-[var(--accent-hover)]">شروع ←</span>
                        </Link>
                      );
                    })}
                  </div>

                  {memberNetworkId ? (
                    <div className="mt-4 space-y-3">
                      <p className="text-[11px] font-extrabold text-[var(--text-secondary)]">
                        تازه‌ها در شبکهٔ اول شما
                        {hoodVisibilityLoading ? <span className="mr-1 text-[10px] font-normal">…</span> : null}
                      </p>
                      {hoodVisibilityLoading && !hoodVisibility ? (
                        <div className="space-y-2">
                          <div className="h-16 animate-pulse rounded-2xl bg-[var(--surface-soft)]" />
                          <div className="h-16 animate-pulse rounded-2xl bg-[var(--surface-soft)]" />
                        </div>
                      ) : (
                        <>
                          <div className={TEASER}>
                            <p className="text-[10px] font-extrabold text-[var(--accent-hover)]">آخرین نظرسنجی محلی</p>
                            {hoodVisibility?.poll ? (
                              <>
                                <p className="mt-1 line-clamp-2 text-xs font-bold text-[var(--text-primary)]">
                                  {hoodVisibility.poll.question}
                                </p>
                                <p className="mt-1 text-[10px] text-[var(--text-secondary)]">
                                  {hoodVisibility.poll.effectiveClosed ? 'بسته‌شده' : 'در حال برگزاری'} · شرکت‌کننده:{' '}
                                  {fa(hoodVisibility.poll.totalVotes)}
                                </p>
                              </>
                            ) : (
                              <p className="mt-1 text-[11px] text-[var(--text-secondary)]">هنوز نظرسنجی ثبت نشده.</p>
                            )}
                            <Link
                              href={neighborhoodPageHref('/spaces/neighborhood/polls', memberNetworkId)}
                              className={TEASER_LINK}
                            >
                              مشاهده همه نظرسنجی‌ها
                            </Link>
                          </div>

                          <div className={TEASER}>
                            <p className="text-[10px] font-extrabold text-[var(--accent-hover)]">آخرین اطلاعیه محلی</p>
                            {hoodVisibility?.bulletin ? (
                              <>
                                <p className="mt-1 text-[10px] font-bold text-[var(--text-secondary)]">
                                  {BULLETIN_KIND_LABELS[hoodVisibility.bulletin.kind] ?? hoodVisibility.bulletin.kind}
                                </p>
                                <p className="line-clamp-2 text-xs font-bold text-[var(--text-primary)]">
                                  {hoodVisibility.bulletin.title}
                                </p>
                                <p className="mt-1 text-[10px] text-[var(--text-secondary)]">
                                  {new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(
                                    new Date(hoodVisibility.bulletin.createdAt),
                                  )}
                                  {isSameLocalDay(hoodVisibility.bulletin.createdAt) ? ' · امروز' : ''}
                                </p>
                              </>
                            ) : (
                              <p className="mt-1 text-[11px] text-[var(--text-secondary)]">اطلاعیه‌ای ثبت نشده.</p>
                            )}
                            <Link
                              href={neighborhoodPageHref('/spaces/neighborhood/bulletin', memberNetworkId)}
                              className={TEASER_LINK}
                            >
                              مشاهده همه اعلانات
                            </Link>
                          </div>

                          <div className={TEASER}>
                            <p className="text-[10px] font-extrabold text-[var(--accent-hover)]">کسب‌وکار محلی</p>
                            {hoodVisibility?.spotlight ? (
                              <div className="mt-2 flex gap-2">
                                {hoodVisibility.spotlight.imageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={hoodVisibility.spotlight.imageUrl}
                                    alt=""
                                    className="h-14 w-14 shrink-0 rounded-xl object-cover ring-1 ring-[var(--border-soft)]"
                                  />
                                ) : null}
                                <div className="min-w-0 flex-1">
                                  <p className="text-[10px] font-extrabold text-[var(--accent-hover)]">
                                    {hoodVisibility.spotlight.category}
                                  </p>
                                  <p className="text-xs font-black text-[var(--text-primary)]">
                                    {hoodVisibility.spotlight.businessName}
                                  </p>
                                  <p className="mt-0.5 line-clamp-2 text-[11px] text-[var(--text-secondary)]">
                                    {hoodVisibility.spotlight.intro}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <p className="mt-1 text-[11px] text-[var(--text-secondary)]">هنوز معرفی کسب‌وکاری نیست.</p>
                            )}
                            <Link
                              href={neighborhoodPageHref('/spaces/neighborhood/showcase', memberNetworkId)}
                              className={TEASER_LINK}
                            >
                              همه کسب‌وکارهای محلی
                            </Link>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <p className="mt-3 rounded-2xl bg-[var(--surface-soft)] px-3 py-2 text-[11px] text-[var(--text-secondary)] ring-1 ring-[var(--border-soft)]">
                      با پیوستن به یک شبکه محله، تازه‌های نظرسنجی، اعلان و کسب‌وکار اینجا دیده می‌شود.
                    </p>
                  )}
                </>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {caps.map((c) => (
                    <Link
                      key={c.label}
                      href={c.href}
                      className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-3 text-center text-[11px] font-extrabold text-[var(--text-primary)] transition hover:border-[var(--accent-ring)] hover:text-[var(--accent-hover)]"
                    >
                      {c.label}
                    </Link>
                  ))}
                </div>
              )}
              {spaceKey === 'NEIGHBORHOOD' ? (
                <>
                  <p className="mt-3 text-center text-[10px] leading-relaxed text-[var(--text-secondary)]">
                    محتوا به <strong className="text-[var(--text-primary)]">شبکه محله انتخاب‌شده در هر بخش</strong> وصل است و فقط
                    برای اعضای همان شبکه در همان صفحه دیده می‌شود؛ در فید خانه پخش خودکار ندارد.
                  </p>
                  <p className="mt-2 text-center">
                    <Link
                      href={neighborhoodPageHref('/spaces/neighborhood/forms/manage', memberNetworkId)}
                      className="text-[11px] font-extrabold text-[var(--accent-hover)] underline-offset-2 hover:underline"
                    >
                      مدیریت فرم‌ها (فقط ادمین شبکه)
                    </Link>
                  </p>
                </>
              ) : null}
            </section>

            {/* 3 — آمار */}
            <section className={SECTION} aria-label="آمار فضا">
              <div className="flex items-stretch justify-around gap-2 text-center">
                <div>
                  <p className="text-xl font-black tabular-nums text-[var(--text-primary)]">{data.networks.length}</p>
                  <p className="mt-0.5 text-[10px] font-bold text-[var(--text-secondary)]">شبکه</p>
                </div>
                <div className="w-px bg-[var(--border-soft)]" aria-hidden />
                <div>
                  <p className="text-xl font-black tabular-nums text-[var(--text-primary)]">{data.groups.length}</p>
                  <p className="mt-0.5 text-[10px] font-bold text-[var(--text-secondary)]">گروه</p>
                </div>
                <div className="w-px bg-[var(--border-soft)]" aria-hidden />
                <div>
                  <p className="text-xl font-black tabular-nums text-[var(--text-primary)]">{data.channels.length}</p>
                  <p className="mt-0.5 text-[10px] font-bold text-[var(--text-secondary)]">کانال</p>
                </div>
              </div>
            </section>
          </>
        ) : null}
      </main>
    </AuthGate>
  );
}

export default function SpaceDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="theme-page-bg px-4 py-10 text-center text-sm text-[var(--text-secondary)]" dir="rtl">
          …
        </div>
      }
    >
      <SpaceDetailInner />
    </Suspense>
  );
}

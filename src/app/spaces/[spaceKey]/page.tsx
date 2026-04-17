'use client';

import { memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { notFound, useParams, useRouter } from 'next/navigation';
import { AuthGate } from '@/components/AuthGate';
import { getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { isSpaceKey, SPACE_CARD_META, type SpaceKey } from '@/lib/spacesCatalog';
import { SPACE_BLUEPRINTS, capabilityStageLabel } from '@/lib/spacesBlueprint';

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
  networkType?: 'GENERAL' | 'NEIGHBORHOOD' | 'EDUCATION' | 'BUSINESS' | 'SPORTS' | 'GAMING';
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

type SpaceJourneyConfig = {
  heroTitle: string;
  heroSubtitle: string;
  actions: Array<{ label: string; href: string; tone?: 'primary' | 'secondary' }>;
  networkTitle: string;
  networkEmpty: string;
  discoveryTitle: string;
  discoveryGroupsTitle: string;
  discoveryChannelsTitle: string;
  discoveryEmpty: string;
  signals: string[];
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

const SECTION_CARD =
  'rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-[0_10px_24px_rgba(15,23,42,0.06)]';
const SUB_CARD = 'rounded-2xl border border-slate-200 bg-slate-50 p-3.5';
const PRIMARY_CTA =
  'rounded-2xl bg-slate-900 px-4 py-2.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.99]';
const SECONDARY_CTA =
  'rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-extrabold text-slate-700 transition hover:bg-slate-50 active:scale-[0.99]';

const UTILITY_THEME: Record<
  NonNullable<ReturnType<typeof SPACE_BLUEPRINTS.find>>['id'],
  { badge: string; cardRing: string; primaryCta: string; jumpCta: string }
> = {
  neighborhood: {
    badge: 'bg-emerald-50 text-emerald-800 ring-emerald-200/80',
    cardRing: 'ring-emerald-100/80',
    primaryCta: '!bg-emerald-700 hover:!bg-emerald-600',
    jumpCta: '!bg-emerald-600 hover:!bg-emerald-500',
  },
  education: {
    badge: 'bg-indigo-50 text-indigo-800 ring-indigo-200/80',
    cardRing: 'ring-indigo-100/80',
    primaryCta: '!bg-indigo-700 hover:!bg-indigo-600',
    jumpCta: '!bg-indigo-700 hover:!bg-indigo-600',
  },
  sports: {
    badge: 'bg-orange-50 text-orange-800 ring-orange-200/80',
    cardRing: 'ring-orange-100/80',
    primaryCta: '!bg-orange-700 hover:!bg-orange-600',
    jumpCta: '!bg-orange-700 hover:!bg-orange-600',
  },
  gaming: {
    badge: 'bg-violet-50 text-violet-800 ring-violet-200/80',
    cardRing: 'ring-violet-100/80',
    primaryCta: '!bg-violet-700 hover:!bg-violet-600',
    jumpCta: '!bg-violet-700 hover:!bg-violet-600',
  },
  business: {
    badge: 'bg-amber-50 text-amber-800 ring-amber-200/80',
    cardRing: 'ring-amber-100/80',
    primaryCta: '!bg-amber-700 hover:!bg-amber-600',
    jumpCta: '!bg-amber-700 hover:!bg-amber-600',
  },
};

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
  const [hoodQuery, setHoodQuery] = useState('');
  const [hoodSearchActive, setHoodSearchActive] = useState(false);
  const [hoodHits, setHoodHits] = useState<SearchNetworksResponse['data']>([]);
  const [hoodSearchLoading, setHoodSearchLoading] = useState(false);
  const [hoodSearchMeta, setHoodSearchMeta] = useState<SearchNetworksResponse['meta'] | null>(null);
  const hoodDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoodSearchMetaRef = useRef<SearchNetworksResponse['meta'] | null>(null);
  hoodSearchMetaRef.current = hoodSearchMeta;

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
    if (!isNeighborhood) return;
    let cancelled = false;
    void (async () => {
      const token = getAccessToken();
      if (!token) return;
      try {
        const list = await apiFetch<Array<{ id: string; isMember?: boolean }>>('networks', {
          method: 'GET',
          token,
        });
        if (cancelled || !Array.isArray(list)) return;
        setMemberNetworkIds(new Set(list.filter((n) => n.isMember).map((n) => n.id)));
      } catch {
        /* optional enrichment */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isNeighborhood, raw]);

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
        const res = await apiFetch<SearchNetworksResponse>(
          `search/networks?${params.toString()}`,
          { method: 'GET', token },
        );
        setHoodSearchMeta(res.meta);
        if (opts.reset) {
          setHoodHits(res.data);
        } else {
          setHoodHits((prev) => [...prev, ...res.data]);
        }
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
    if (!data) return [];
    if (isNeighborhood && hoodSearchActive) {
      return hoodHits.map((h) => ({
        id: h.id,
        name: h.name,
        description: h.description,
        slug: h.slug,
        isMember: mergedMember(h.id),
      }));
    }
    return data.networks.map((n) => ({
      ...n,
      isMember: mergedMember(n.id, n),
    }));
  }, [data, hoodHits, hoodSearchActive, isNeighborhood, mergedMember]);

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
      if (
        msg.includes('already a member') ||
        msg.includes('Conflict') ||
        msg.includes('409')
      ) {
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
  const blueprint =
    SPACE_BLUEPRINTS.find((x) => x.mappedCategory === spaceKey) ??
    null;

  const memberNetworkId = displayNetworks.find((n) => n.isMember)?.id ?? null;
  const journeyConfig: SpaceJourneyConfig | null = useMemo(() => {
    if (spaceKey === 'NEIGHBORHOOD') {
      return {
        heroTitle: 'Your Local Digital Ecosystem',
        heroSubtitle: 'فضای محله برای زندگی محلی، گروه‌های همسایگی و ابزارهای مدنی.',
        actions: [
          { label: 'Join Local Network', href: '#district-networks' },
          { label: 'Local Groups', href: `/groups/new?kind=community&spaceKey=NEIGHBORHOOD&returnTo=spaces`, tone: 'secondary' },
          { label: 'Neighborhood Forms', href: '/spaces/neighborhood/forms' },
          { label: 'Discover Nearby Communities', href: '#discovery' , tone: 'secondary' },
        ],
        networkTitle: 'Active Neighborhood Networks',
        networkEmpty: 'شبکه محله‌ای فعالی برای نمایش موجود نیست.',
        discoveryTitle: 'Local Discovery',
        discoveryGroupsTitle: 'Local Groups',
        discoveryChannelsTitle: 'City Communities',
        discoveryEmpty: 'فعلاً مورد مرتبطی برای نمایش پیدا نشد.',
        signals: ['Trusted local', 'Civic tools', 'Services soon'],
      };
    }
    if (spaceKey === 'EDUCATION') {
      return {
        heroTitle: 'Where Learning Communities Live',
        heroSubtitle: 'اکوسیستم یادگیری برای گروه‌های درسی، کلاس‌ها و کانال‌های آموزشی.',
        actions: [
          {
            label: 'Create Study Group',
            href: `/groups/new?kind=community&spaceKey=EDUCATION${memberNetworkId ? `&networkId=${encodeURIComponent(memberNetworkId)}` : ''}&returnTo=spaces&preset=study`,
          },
          {
            label: 'Create Class Community',
            href: `/groups/new?kind=community&spaceKey=EDUCATION${memberNetworkId ? `&networkId=${encodeURIComponent(memberNetworkId)}` : ''}&returnTo=spaces&preset=class`,
          },
          {
            label: 'Create Teacher Channel',
            href: `/channels/new?preset=teacher&spaceKey=EDUCATION${memberNetworkId ? `&networkId=${encodeURIComponent(memberNetworkId)}` : ''}`,
            tone: 'secondary',
          },
        ],
        networkTitle: 'Education Networks',
        networkEmpty: 'شبکه آموزشی فعالی برای نمایش موجود نیست.',
        discoveryTitle: 'Education Discovery',
        discoveryGroupsTitle: 'Exam Prep Communities',
        discoveryChannelsTitle: 'Active Teacher Channels',
        discoveryEmpty: 'فعلاً اجتماع آموزشی شاخصی برای نمایش نیست.',
        signals: ['Course-ready', 'Teacher-led', 'Assignments soon'],
      };
    }
    if (spaceKey === 'PUBLIC_GENERAL') {
      return {
        heroTitle: 'Build Work, Hiring, and Growth Networks',
        heroSubtitle: 'اکوسیستم حرفه‌ای برای استخدام، همکاری و رشد شبکه‌های کاری.',
        actions: [
          {
            label: 'Hiring Group',
            href: `/groups/new?kind=community&spaceKey=PUBLIC_GENERAL${memberNetworkId ? `&networkId=${encodeURIComponent(memberNetworkId)}` : ''}&returnTo=spaces&preset=hiring`,
          },
          {
            label: 'Startup Community',
            href: `/groups/new?kind=community&spaceKey=PUBLIC_GENERAL${memberNetworkId ? `&networkId=${encodeURIComponent(memberNetworkId)}` : ''}&returnTo=spaces&preset=startup`,
          },
          {
            label: 'Professional Channel',
            href: `/channels/new?preset=professional&spaceKey=PUBLIC_GENERAL${memberNetworkId ? `&networkId=${encodeURIComponent(memberNetworkId)}` : ''}`,
            tone: 'secondary',
          },
          {
            label: 'Freelance Group',
            href: `/groups/new?kind=community&spaceKey=PUBLIC_GENERAL${memberNetworkId ? `&networkId=${encodeURIComponent(memberNetworkId)}` : ''}&returnTo=spaces&preset=freelance`,
            tone: 'secondary',
          },
        ],
        networkTitle: 'Business Networks',
        networkEmpty: 'شبکه کسب‌وکاری فعالی برای نمایش موجود نیست.',
        discoveryTitle: 'Work Discovery',
        discoveryGroupsTitle: 'Startup & Hiring Communities',
        discoveryChannelsTitle: 'Pro Channels & Remote Circles',
        discoveryEmpty: 'فعلاً شبکه کاری شاخصی برای نمایش نیست.',
        signals: ['Hiring-ready', 'Founder-led', 'Marketplace next'],
      };
    }
    if (spaceKey === 'SPORT') {
      return {
        heroTitle: 'Communities for Teams, Fitness, and Fans',
        heroSubtitle: 'فضای ورزشی برای تیم‌ها، هواداران، مربی‌ها و اجتماع‌های تمرینی.',
        actions: [
          { label: 'Fan Group', href: `/groups/new?kind=community&spaceKey=SPORT&returnTo=spaces` },
          { label: 'Team Community', href: `/groups/new?kind=community&spaceKey=SPORT&returnTo=spaces`, tone: 'secondary' },
          { label: 'Fitness Circle', href: '#discovery' },
          { label: 'Coach Channel', href: '/channels/new?spaceKey=SPORT', tone: 'secondary' },
        ],
        networkTitle: 'Sports Networks',
        networkEmpty: 'شبکه ورزشی فعالی برای نمایش موجود نیست.',
        discoveryTitle: 'Sports Discovery',
        discoveryGroupsTitle: 'Active Fan Groups',
        discoveryChannelsTitle: 'Workout Communities',
        discoveryEmpty: 'فعلاً اجتماع ورزشی شاخصی برای نمایش نیست.',
        signals: ['Matchday-ready', 'Team-led', 'Events soon'],
      };
    }
    if (spaceKey === 'TECH') {
      return {
        heroTitle: 'Where Clans, Squads, and Stream Communities Gather',
        heroSubtitle: 'اکوسیستم گیمینگ برای کلن‌ها، اسکادها، استریمرها و تیم‌آپ‌های سریع.',
        actions: [
          {
            label: 'Create Clan Group',
            href: `/groups/new?kind=community&spaceKey=TECH${memberNetworkId ? `&networkId=${encodeURIComponent(memberNetworkId)}` : ''}&returnTo=spaces&preset=clan`,
          },
          {
            label: 'Create Squad Community',
            href: `/groups/new?kind=community&spaceKey=TECH${memberNetworkId ? `&networkId=${encodeURIComponent(memberNetworkId)}` : ''}&returnTo=spaces&preset=squad`,
          },
          {
            label: 'Create Stream Channel',
            href: `/channels/new?preset=stream&spaceKey=TECH${memberNetworkId ? `&networkId=${encodeURIComponent(memberNetworkId)}` : ''}`,
            tone: 'secondary',
          },
          {
            label: 'Create LFG Group',
            href: `/groups/new?kind=community&spaceKey=TECH${memberNetworkId ? `&networkId=${encodeURIComponent(memberNetworkId)}` : ''}&returnTo=spaces&preset=lfg`,
            tone: 'secondary',
          },
        ],
        networkTitle: 'Gaming Networks',
        networkEmpty: 'شبکه گیمینگ فعالی برای نمایش موجود نیست.',
        discoveryTitle: 'Gaming Discovery',
        discoveryGroupsTitle: 'Active Clans',
        discoveryChannelsTitle: 'Stream Channels',
        discoveryEmpty: 'فعلاً اجتماع گیمینگ شاخصی برای نمایش نیست.',
        signals: ['Clan-ready', 'Squad voice', 'Tournaments soon'],
      };
    }
    return null;
  }, [spaceKey, memberNetworkId]);

  const networksSection = (
    <section id="district-networks" className={SECTION_CARD}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-extrabold text-slate-900">
            {isNeighborhood ? 'شبکه‌های محله' : 'شبکه‌ها'}
          </h2>
          <p className="mt-1 text-[11px] text-slate-500">
            {isNeighborhood
              ? 'شبکه‌های واقعی محله (ایمپورت شده) — عضو شوید و گروه اجتماعی بسازید یا به گروه‌ها بپیوندید.'
              : 'فقط شبکه‌های عمومی با همین برچسب فضا.'}
          </p>
        </div>
        {isNeighborhood ? (
          <span className="shrink-0 self-start rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-800 ring-1 ring-emerald-200/80">
            داده محله‌ای
          </span>
        ) : null}
      </div>

      {isNeighborhood ? (
        <div className="mt-3">
          <label className="sr-only" htmlFor="hood-search">
            جستجوی شبکه محله
          </label>
          <input
            id="hood-search"
            type="search"
            dir="rtl"
            value={hoodQuery}
            onChange={(e) => setHoodQuery(e.target.value)}
            placeholder="نام محله، منطقه یا شبکه را جستجو کنید…"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none ring-sky-300/0 transition focus:border-sky-300 focus:bg-white focus:ring-2"
          />
          {hoodSearchActive && hoodSearchLoading ? (
            <p className="mt-2 text-[11px] text-slate-500">در حال جستجو…</p>
          ) : null}
        </div>
      ) : null}

      <ul className="mt-3 divide-y divide-slate-100">
        {displayNetworks.length === 0 ? (
          <li className="py-6 text-center text-xs text-slate-400">
            {isNeighborhood && hoodSearchActive && hoodSearchLoading
              ? 'در حال جستجو…'
              : isNeighborhood && hoodSearchActive && hoodQuery.trim()
                ? 'نتیجه‌ای نیست'
                : 'شبکه‌ای نیست'}
          </li>
        ) : (
          displayNetworks.map((n) => (
            <li key={n.id} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/networks/${n.id}`}
                    className="text-sm font-bold text-sky-800 underline-offset-2 hover:underline"
                  >
                    {n.name}
                  </Link>
                  {isNeighborhood ? (
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600">
                      شبکه محله
                    </span>
                  ) : null}
                </div>
                {n.description ? (
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">{n.description}</p>
                ) : null}
                {n.isMember ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="text-[10px] font-bold text-emerald-700">شما عضو این شبکه‌اید</span>
                    <Link
                      href={`/groups/new?kind=community&spaceKey=${encodeURIComponent(spaceKey)}&networkId=${encodeURIComponent(n.id)}&returnTo=spaces`}
                    className={PRIMARY_CTA + ' !px-2.5 !py-1.5 !text-[10px] !bg-sky-600 hover:!bg-sky-500'}
                    >
                      ساخت گروه اجتماعی
                    </Link>
                    <Link
                      href={`/networks/${n.id}`}
                    className={SECONDARY_CTA + ' !px-2.5 !py-1.5 !text-[10px]'}
                    >
                      ورود به شبکه
                    </Link>
                  </div>
                ) : null}
              </div>
              {!n.isMember ? (
                <button
                  type="button"
                  disabled={joiningNet === n.id}
                  onClick={() => void joinNetwork(n.id)}
                  className={PRIMARY_CTA + ' disabled:opacity-50'}
                >
                  {joiningNet === n.id ? '…' : 'پیوستن'}
                </button>
              ) : null}
            </li>
          ))
        )}
      </ul>

      {isNeighborhood && hoodSearchActive && hoodSearchMeta?.hasMore ? (
        <button
          type="button"
          disabled={hoodSearchLoading}
          onClick={() => void fetchNeighborhoodSearchPage({ reset: false, q: hoodQuery.trim() })}
          className={SECONDARY_CTA + ' mt-2 w-full disabled:opacity-50'}
        >
          {hoodSearchLoading ? '…' : 'بارگذاری بیشتر'}
        </button>
      ) : null}
    </section>
  );

  const groupsSection = (
    <section className={SECTION_CARD}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-extrabold text-slate-900">گروه‌های اجتماعی</h2>
        <Link
          href={`/groups/new?kind=community&spaceKey=${encodeURIComponent(spaceKey)}&returnTo=spaces`}
          className={SECONDARY_CTA + ' !rounded-full !border-sky-200 !bg-sky-50 !text-sky-800'}
        >
          ساخت گروه اجتماعی
        </Link>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
        {isNeighborhood
          ? 'بعد از پیوستن به یک شبکه محله، گروه اجتماعی همان محله را بسازید یا به گروه‌های موجود بپیوندید.'
          : 'فقط گروه‌های اجتماعی این فضا؛ گروه‌های چت خصوصی در این بخش نمایش داده نمی‌شوند.'}
      </p>
      <ul className="mt-3 divide-y divide-slate-100">
        {data && data.groups.length === 0 ? (
          <li className="py-6 text-center text-xs text-slate-400">گروهی نیست</li>
        ) : null}
        {data && data.groups.length > 0
          ? data.groups.map((g) => (
              <li key={g.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/groups/${g.id}`}
                    className="text-sm font-bold text-sky-800 underline-offset-2 hover:underline"
                  >
                    {g.name}
                  </Link>
                  {g.description ? (
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">{g.description}</p>
                  ) : null}
                  {!g.joinable ? (
                    <p className="mt-1 text-[10px] text-slate-400">گروه بدون شبکه — عضویت با دعوت</p>
                  ) : null}
                </div>
                {g.joinable ? (
                  <button
                    type="button"
                    disabled={joiningGroup === g.id}
                    onClick={() => void joinGroup(g.id)}
                  className={PRIMARY_CTA + ' !bg-emerald-600 hover:!bg-emerald-500 disabled:opacity-50'}
                  >
                    {joiningGroup === g.id ? '…' : 'پیوستن'}
                  </button>
                ) : null}
              </li>
            ))
          : null}
      </ul>
    </section>
  );

  const channelsSection = (
    <section className={SECTION_CARD}>
      <h2 className="text-sm font-extrabold text-slate-900">کانال‌ها</h2>
      <p className="mt-1 text-[11px] text-slate-500">
        کانال با همان فضا؛ باز کردن کانال نیازمند عضویت در شبکه و سپس کانال است.
      </p>
      <ul className="mt-3 divide-y divide-slate-100">
        {data && data.channels.length === 0 ? (
          <li className="py-6 text-center text-xs text-slate-400">کانالی نیست</li>
        ) : null}
        {data && data.channels.length > 0
          ? data.channels.map((c) => (
              <li key={c.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/channels/${c.id}?network=${encodeURIComponent(c.networkId)}`}
                    className="text-sm font-bold text-sky-800 underline-offset-2 hover:underline"
                  >
                    {c.name}
                  </Link>
                  <p className="text-[10px] text-slate-400">شبکه: {c.network.name}</p>
                  {c.description ? (
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">{c.description}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Link
                    href={`/networks/${c.networkId}`}
                    className={SECONDARY_CTA}
                  >
                    شبکه
                  </Link>
                  <button
                    type="button"
                    disabled={joiningCh === c.id}
                    onClick={() => void joinChannel(c.id, c.networkId)}
                    className={PRIMARY_CTA + ' !bg-violet-700 hover:!bg-violet-600 disabled:opacity-50'}
                  >
                    {joiningCh === c.id ? '…' : 'پیوستن به کانال'}
                  </button>
                </div>
              </li>
            ))
          : null}
      </ul>
    </section>
  );

  return (
    <AuthGate>
      <main className="theme-page-bg theme-text-primary mx-auto w-full max-w-md px-4 pb-12 pt-3 sm:pb-14" dir="rtl">
        <div className="mb-4 flex items-center gap-2">
          <Link
            href="/spaces"
            className="flex h-10 min-w-[2.5rem] items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100"
            aria-label="بازگشت به فضاها"
          >
            ←
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-extrabold text-slate-900">{meta.title}</h1>
            <p className="text-xs text-slate-500">{meta.subtitle}</p>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">در حال بارگذاری…</p>
        ) : error ? (
          <p className="text-sm font-semibold text-red-700">{error}</p>
        ) : data ? (
          <div className="space-y-5 sm:space-y-6">
            {journeyConfig ? (
              <SpaceJourneySection
                config={journeyConfig}
                networks={displayNetworks}
                groups={data.groups}
                channels={data.channels}
              />
            ) : blueprint ? (
              <BlueprintIntroSection blueprint={blueprint} />
            ) : null}
            {!journeyConfig && blueprint?.utilities?.length ? (
              <SpaceUtilitiesSection spaceId={blueprint.id} utilities={blueprint.utilities} />
            ) : null}
            {spaceKey === 'EDUCATION' ? (
              <EducationCapabilitySection
                groups={data.groups}
                channels={data.channels}
                networks={displayNetworks}
                memberNetworkId={memberNetworkId}
              />
            ) : null}
            {spaceKey === 'PUBLIC_GENERAL' ? (
              <BusinessCapabilitySection
                groups={data.groups}
                channels={data.channels}
                networks={displayNetworks}
                memberNetworkId={memberNetworkId}
              />
            ) : null}
            {spaceKey === 'SPORT' ? (
              <SportsCapabilitySection
                groups={data.groups}
                channels={data.channels}
                networks={displayNetworks}
                memberNetworkId={memberNetworkId}
              />
            ) : null}
            {spaceKey === 'TECH' ? (
              <GamingCapabilitySection
                groups={data.groups}
                channels={data.channels}
                networks={displayNetworks}
                memberNetworkId={memberNetworkId}
              />
            ) : null}
            {spaceKey === 'NEIGHBORHOOD' ? <NeighborhoodFormsCapabilitySection /> : null}

            {journeyConfig ? null : isNeighborhood ? (
              <>
                {networksSection}
                {groupsSection}
                {channelsSection}
              </>
            ) : (
              <>
                {groupsSection}
                {networksSection}
                {channelsSection}
              </>
            )}
          </div>
        ) : null}
      </main>
    </AuthGate>
  );
}

const SpaceJourneySection = memo(function SpaceJourneySection({
  config,
  networks,
  groups,
  channels,
}: {
  config: SpaceJourneyConfig;
  networks: Array<NetworkRow & { isMember?: boolean }>;
  groups: GroupRow[];
  channels: ChannelRow[];
}) {
  return (
    <section className={SECTION_CARD}>
      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
        <h2 className="text-lg font-black tracking-tight text-slate-900">{config.heroTitle}</h2>
        <p className="mt-1 text-sm text-slate-600">{config.heroSubtitle}</p>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {config.actions.map((a) => (
          <Link
            key={a.label}
            href={a.href}
            className={(a.tone === 'secondary' ? SECONDARY_CTA : PRIMARY_CTA) + ' text-center'}
          >
            {a.label}
          </Link>
        ))}
      </div>

      <div id="district-networks" className="mt-4">
        <h3 className="text-sm font-extrabold text-slate-900">{config.networkTitle}</h3>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {networks.length === 0 ? (
            <li className={SUB_CARD + ' text-xs text-slate-500'}>{config.networkEmpty}</li>
          ) : (
            networks.slice(0, 6).map((n) => (
              <li key={n.id} className={SUB_CARD + ' bg-white'}>
                <Link href={`/networks/${n.id}`} className="text-sm font-bold text-sky-700 hover:underline">
                  {n.name}
                </Link>
                {n.description ? <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">{n.description}</p> : null}
              </li>
            ))
          )}
        </ul>
      </div>

      <div id="discovery" className="mt-4">
        <h3 className="text-sm font-extrabold text-slate-900">{config.discoveryTitle}</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div className={SUB_CARD + ' bg-white'}>
            <p className="text-xs font-bold text-slate-700">{config.discoveryGroupsTitle}</p>
            <ul className="mt-1.5 space-y-1.5">
              {groups.length === 0 ? (
                <li className="text-[11px] text-slate-500">{config.discoveryEmpty}</li>
              ) : (
                groups.slice(0, 4).map((g) => (
                  <li key={g.id}>
                    <Link href={`/groups/${g.id}`} className="text-[11px] font-semibold text-sky-700 hover:underline">
                      {g.name}
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </div>
          <div className={SUB_CARD + ' bg-white'}>
            <p className="text-xs font-bold text-slate-700">{config.discoveryChannelsTitle}</p>
            <ul className="mt-1.5 space-y-1.5">
              {channels.length === 0 ? (
                <li className="text-[11px] text-slate-500">{config.discoveryEmpty}</li>
              ) : (
                channels.slice(0, 4).map((c) => (
                  <li key={c.id}>
                    <Link href={`/channels/${c.id}?network=${encodeURIComponent(c.networkId)}`} className="text-[11px] font-semibold text-sky-700 hover:underline">
                      {c.name}
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {config.signals.map((chip) => (
          <span key={chip} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-700">
            {chip}
          </span>
        ))}
      </div>
    </section>
  );
});

const BlueprintIntroSection = memo(function BlueprintIntroSection({
  blueprint,
}: {
  blueprint: NonNullable<ReturnType<typeof SPACE_BLUEPRINTS.find>>;
}) {
  return (
    <section className={SECTION_CARD}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-extrabold text-slate-900">{blueprint.titleFa}</h2>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-extrabold text-slate-700">
          {blueprint.badge}
        </span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">{blueprint.summaryFa}</p>
      <p className="mt-1 text-[11px] font-bold text-slate-700">{blueprint.valueFa}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <div className={SUB_CARD}>
          <p className="text-[10px] font-bold text-slate-500">گام 1</p>
          <p className="mt-1 text-xs font-semibold text-slate-800">شبکه مرتبط را انتخاب/عضو شوید</p>
        </div>
        <div className={SUB_CARD}>
          <p className="text-[10px] font-bold text-slate-500">گام 2</p>
          <p className="mt-1 text-xs font-semibold text-slate-800">گروه اجتماعی مناسب را بسازید/بپیوندید</p>
        </div>
        <div className={SUB_CARD}>
          <p className="text-[10px] font-bold text-slate-500">گام 3</p>
          <p className="mt-1 text-xs font-semibold text-slate-800">در کانال‌ها ابزار/گفتگو تخصصی را ادامه دهید</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {blueprint.capabilities.map((cap) => (
          <span
            key={cap.id}
            className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] text-slate-700"
          >
            {cap.title} · {capabilityStageLabel(cap.stage)}
          </span>
        ))}
      </div>
    </section>
  );
});

const SpaceUtilitiesSection = memo(function SpaceUtilitiesSection({
  spaceId,
  utilities,
}: {
  spaceId: NonNullable<ReturnType<typeof SPACE_BLUEPRINTS.find>>['id'];
  utilities: NonNullable<ReturnType<typeof SPACE_BLUEPRINTS.find>>['utilities'];
}) {
  const isNeighborhood = spaceId === 'neighborhood';
  const isEducation = spaceId === 'education';
  const theme = UTILITY_THEME[spaceId];
  const title = isEducation
    ? 'Education Utility / Capability'
    : isNeighborhood
      ? 'Neighborhood Utility Blocks'
      : 'Space Utility Blocks';

  return (
    <section className={SECTION_CARD}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-extrabold text-slate-900">{title}</h2>
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ring-1 ${theme.badge}`}
        >
          UI v1
        </span>
      </div>
      <p className="text-[11px] text-slate-500">
        این بلوک‌ها نسخه‌ی اولیه رابط کاربری هستند و برای فاز بعدی به سرویس‌های عملیاتی متصل می‌شوند.
      </p>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {(utilities ?? []).map((item) => (
          <li key={item.id} className={`${SUB_CARD} min-h-[10.25rem] bg-slate-50/70 ring-1 ${theme.cardRing}`}>
            <p className="text-xs font-extrabold text-slate-900">{item.title}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{item.description}</p>
            {isNeighborhood && item.id === 'local-survey-forms' ? (
              <Link
                href="/spaces/neighborhood/forms"
                className={`${PRIMARY_CTA} mt-2 inline-flex !px-3 !py-1.5 !text-[11px] ${theme.primaryCta}`}
              >
                {item.cta}
              </Link>
            ) : isNeighborhood && item.id === 'join-district-networks' ? (
              <a
                href="#district-networks"
                className={`${PRIMARY_CTA} mt-2 inline-flex !px-3 !py-1.5 !text-[11px] ${theme.jumpCta}`}
              >
                {item.cta}
              </a>
            ) : (
              <button
                type="button"
                className={`${SECONDARY_CTA} mt-2 inline-flex cursor-not-allowed !px-3 !py-1.5 !text-[11px] ${theme.primaryCta} !text-white opacity-80`}
                aria-disabled
              >
                {item.cta} (coming soon)
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
});

const NeighborhoodFormsCapabilitySection = memo(function NeighborhoodFormsCapabilitySection() {
  return (
    <section className={SECTION_CARD}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-extrabold text-slate-900">Neighborhood Forms / Local Forms</h2>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold text-emerald-800 ring-1 ring-emerald-200/80">
          v1 Live
        </span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">
        فرم‌های محله‌ای برای نظرسنجی، درخواست‌های خدماتی و جمع‌آوری داده‌های محلی در سطح شبکه.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href="/spaces/neighborhood/forms" className={PRIMARY_CTA + ' !bg-emerald-700 hover:!bg-emerald-600'}>
          مشاهده فرم‌ها
        </Link>
        <Link href="/spaces/neighborhood/forms/manage" className={SECONDARY_CTA}>
          مدیریت فرم‌ها
        </Link>
      </div>
    </section>
  );
});

const EducationCapabilitySection = memo(function EducationCapabilitySection({
  groups,
  channels,
  networks,
  memberNetworkId,
}: {
  groups: GroupRow[];
  channels: ChannelRow[];
  networks: Array<NetworkRow & { isMember?: boolean }>;
  memberNetworkId: string | null;
}) {
  const learningTokens = [
    'study',
    'class',
    'teacher',
    'course',
    'lesson',
    'exam',
    'دانش',
    'درس',
    'آموزش',
    'کلاس',
    'استاد',
    'معلم',
    'آزمون',
    'پروژه',
  ];
  const teacherTokens = ['teacher', 'professor', 'lesson', 'course', 'استاد', 'معلم', 'آموزش', 'درس'];

  function tokenScore(text: string, tokens: string[]) {
    const norm = text.toLowerCase();
    return tokens.reduce((acc, t) => (norm.includes(t) ? acc + 1 : acc), 0);
  }

  const curatedStudyGroups = [...groups]
    .sort((a, b) => {
      const aScore = tokenScore(`${a.name} ${a.description ?? ''}`, learningTokens) + (a.joinable ? 1 : 0);
      const bScore = tokenScore(`${b.name} ${b.description ?? ''}`, learningTokens) + (b.joinable ? 1 : 0);
      return bScore - aScore;
    })
    .slice(0, 4);

  const curatedTeacherChannels = [...channels]
    .sort((a, b) => {
      const aScore = tokenScore(`${a.name} ${a.description ?? ''}`, teacherTokens);
      const bScore = tokenScore(`${b.name} ${b.description ?? ''}`, teacherTokens);
      return bScore - aScore;
    })
    .slice(0, 4);

  const curatedGrowingCommunities = [...networks]
    .sort((a, b) => {
      const aScore = tokenScore(`${a.name} ${a.description ?? ''}`, learningTokens) + (a.isMember ? 2 : 0);
      const bScore = tokenScore(`${b.name} ${b.description ?? ''}`, learningTokens) + (b.isMember ? 2 : 0);
      return bScore - aScore;
    })
    .slice(0, 4);
  const studyGroupHref = `/groups/new?kind=community&spaceKey=EDUCATION${memberNetworkId ? `&networkId=${encodeURIComponent(memberNetworkId)}` : ''}&returnTo=spaces&preset=study`;
  const classCommunityHref = `/groups/new?kind=community&spaceKey=EDUCATION${memberNetworkId ? `&networkId=${encodeURIComponent(memberNetworkId)}` : ''}&returnTo=spaces&preset=class`;
  const teacherChannelHref = `/channels/new?preset=teacher&spaceKey=EDUCATION${memberNetworkId ? `&networkId=${encodeURIComponent(memberNetworkId)}` : ''}`;

  return (
    <section className={SECTION_CARD}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-black tracking-tight text-slate-900">Education Capability v1</h2>
        <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-indigo-800 ring-1 ring-indigo-200/80">
          Learning Communities
        </span>
      </div>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">
        این بخش برای ساخت جامعه‌های آموزشی فعال است: گروه مطالعه، کامیونیتی کلاسی، و کانال مدرس.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <article className={SUB_CARD + ' min-h-[11.25rem] bg-indigo-50/50 ring-1 ring-indigo-100'}>
          <p className="text-sm font-extrabold text-slate-900">Create Study Group</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-600">برای یادگیری همتا، پرسش‌وپاسخ و آمادگی آزمون.</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-indigo-700 ring-1 ring-indigo-200/80">Student community</span>
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-indigo-700 ring-1 ring-indigo-200/80">Course-ready</span>
          </div>
          <Link href={studyGroupHref} className={PRIMARY_CTA + ' mt-3 inline-flex !bg-indigo-700 hover:!bg-indigo-600 !px-3.5 !py-2 !text-[11px]'}>
            ساخت Study Group
          </Link>
        </article>

        <article className={SUB_CARD + ' min-h-[11.25rem] bg-indigo-50/50 ring-1 ring-indigo-100'}>
          <p className="text-sm font-extrabold text-slate-900">Create Class Community</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-600">برای دانشجویان یک کلاس/ورودی جهت هماهنگی، بحث و پیگیری جلسات.</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-indigo-700 ring-1 ring-indigo-200/80">Batch-focused</span>
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-indigo-700 ring-1 ring-indigo-200/80">Assignments soon</span>
          </div>
          <Link href={classCommunityHref} className={PRIMARY_CTA + ' mt-3 inline-flex !bg-indigo-700 hover:!bg-indigo-600 !px-3.5 !py-2 !text-[11px]'}>
            ساخت Class Community
          </Link>
        </article>

        <article className={SUB_CARD + ' min-h-[11.25rem] bg-indigo-50/50 ring-1 ring-indigo-100'}>
          <p className="text-sm font-extrabold text-slate-900">Create Teacher Channel</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-600">برای اطلاع‌رسانی یک‌به‌چند: درس، برنامه، اعلان و منابع آموزشی.</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-indigo-700 ring-1 ring-indigo-200/80">Teacher-led</span>
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-indigo-700 ring-1 ring-indigo-200/80">One-to-many</span>
          </div>
          <Link href={teacherChannelHref} className={SECONDARY_CTA + ' mt-3 inline-flex !px-3.5 !py-2 !text-[11px]'}>
            {memberNetworkId ? 'ساخت Teacher Channel' : 'ابتدا عضو شبکه آموزشی شوید'}
          </Link>
        </article>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className={SUB_CARD + ' min-h-[10.5rem]'}>
          <h3 className="text-sm font-extrabold text-slate-900">Popular Study Groups</h3>
          <ul className="mt-2 space-y-1.5 text-[11px] text-slate-700">
            {curatedStudyGroups.length === 0 ? (
              <li className="rounded-xl bg-slate-100/70 px-2.5 py-2 text-slate-500">هنوز Study Group فعالی ثبت نشده است.</li>
            ) : (
              curatedStudyGroups.map((g) => (
                <li key={g.id} className="rounded-xl bg-white px-2.5 py-2 ring-1 ring-slate-200/80">
                  <Link href={`/groups/${g.id}`} className="font-bold text-sky-700 hover:underline">
                    {g.name}
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className={SUB_CARD + ' min-h-[10.5rem]'}>
          <h3 className="text-sm font-extrabold text-slate-900">Active Teacher Channels</h3>
          <ul className="mt-2 space-y-1.5 text-[11px] text-slate-700">
            {curatedTeacherChannels.length === 0 ? (
              <li className="rounded-xl bg-slate-100/70 px-2.5 py-2 text-slate-500">کانال آموزشی فعالی پیدا نشد.</li>
            ) : (
              curatedTeacherChannels.map((c) => (
                <li key={c.id} className="rounded-xl bg-white px-2.5 py-2 ring-1 ring-slate-200/80">
                  <Link href={`/channels/${c.id}?network=${encodeURIComponent(c.networkId)}`} className="font-bold text-sky-700 hover:underline">
                    {c.name}
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className={SUB_CARD + ' min-h-[10.5rem]'}>
          <h3 className="text-sm font-extrabold text-slate-900">Recently Growing Communities</h3>
          <ul className="mt-2 space-y-1.5 text-[11px] text-slate-700">
            {curatedGrowingCommunities.length === 0 ? (
              <li className="rounded-xl bg-slate-100/70 px-2.5 py-2 text-slate-500">در حال حاضر شبکه آموزشی قابل نمایش نیست.</li>
            ) : (
              curatedGrowingCommunities.map((n) => (
                <li key={n.id} className="rounded-xl bg-white px-2.5 py-2 ring-1 ring-slate-200/80">
                  <Link href={`/networks/${n.id}`} className="font-bold text-sky-700 hover:underline">
                    {n.name}
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </section>
  );
});

const BusinessCapabilitySection = memo(function BusinessCapabilitySection({
  groups,
  channels,
  networks,
  memberNetworkId,
}: {
  groups: GroupRow[];
  channels: ChannelRow[];
  networks: Array<NetworkRow & { isMember?: boolean }>;
  memberNetworkId: string | null;
}) {
  const businessTokens = [
    'job',
    'hire',
    'hiring',
    'career',
    'startup',
    'founder',
    'business',
    'marketing',
    'sales',
    'product',
    'design',
    'freelance',
    'agency',
    'remote',
    'developer',
    'work',
    'career',
    'job',
    'استخدام',
    'کاریابی',
    'شغل',
    'فریلنس',
    'فریلنسر',
    'استارتاپ',
    'بنیان',
    'کسب',
    'مارکتینگ',
    'فروش',
    'محصول',
    'طراح',
    'توسعه',
    'دورکار',
    'پروژه',
  ];
  const hiringTokens = ['hire', 'hiring', 'job', 'career', 'talent', 'استخدام', 'شغل', 'کاریابی'];
  const startupTokens = ['startup', 'founder', 'builder', 'venture', 'استارتاپ', 'بنیان', 'هم', 'رشد'];
  const freelanceTokens = ['freelance', 'project', 'gig', 'remote', 'client', 'فریلنس', 'پروژه', 'دورکار'];
  const professionalTokens = ['professional', 'industry', 'insight', 'mentor', 'business', 'حرفه', 'صنعت', 'منتور'];

  function scoreByTokens(text: string, tokens: string[]) {
    const normalized = text.toLowerCase();
    return tokens.reduce((acc, token) => (normalized.includes(token) ? acc + 1 : acc), 0);
  }

  const rankedGroups = [...groups]
    .sort((a, b) => {
      const aScore =
        scoreByTokens(`${a.name} ${a.description ?? ''}`, businessTokens) + scoreByTokens(`${a.name} ${a.description ?? ''}`, hiringTokens) + (a.joinable ? 1 : 0);
      const bScore =
        scoreByTokens(`${b.name} ${b.description ?? ''}`, businessTokens) + scoreByTokens(`${b.name} ${b.description ?? ''}`, hiringTokens) + (b.joinable ? 1 : 0);
      return bScore - aScore;
    })
    .slice(0, 4);

  const rankedStartupGroups = [...groups]
    .sort((a, b) => {
      const aScore = scoreByTokens(`${a.name} ${a.description ?? ''}`, startupTokens);
      const bScore = scoreByTokens(`${b.name} ${b.description ?? ''}`, startupTokens);
      return bScore - aScore;
    })
    .slice(0, 4);

  const rankedChannels = [...channels]
    .sort((a, b) => {
      const aScore =
        scoreByTokens(`${a.name} ${a.description ?? ''}`, businessTokens) + scoreByTokens(`${a.name} ${a.description ?? ''}`, professionalTokens);
      const bScore =
        scoreByTokens(`${b.name} ${b.description ?? ''}`, businessTokens) + scoreByTokens(`${b.name} ${b.description ?? ''}`, professionalTokens);
      return bScore - aScore;
    })
    .slice(0, 4);

  const rankedFreelanceNetworks = [...networks]
    .sort((a, b) => {
      const aScore =
        scoreByTokens(`${a.name} ${a.description ?? ''}`, freelanceTokens) + scoreByTokens(`${a.name} ${a.description ?? ''}`, businessTokens) + (a.isMember ? 2 : 0);
      const bScore =
        scoreByTokens(`${b.name} ${b.description ?? ''}`, freelanceTokens) + scoreByTokens(`${b.name} ${b.description ?? ''}`, businessTokens) + (b.isMember ? 2 : 0);
      return bScore - aScore;
    })
    .slice(0, 4);

  const recommendedCommunities = [...networks]
    .sort((a, b) => {
      const aScore = scoreByTokens(`${a.name} ${a.description ?? ''}`, businessTokens) + (a.isMember ? 2 : 0);
      const bScore = scoreByTokens(`${b.name} ${b.description ?? ''}`, businessTokens) + (b.isMember ? 2 : 0);
      return bScore - aScore;
    })
    .slice(0, 4);

  const hiringGroupHref = `/groups/new?kind=community&spaceKey=PUBLIC_GENERAL${memberNetworkId ? `&networkId=${encodeURIComponent(memberNetworkId)}` : ''}&returnTo=spaces&preset=hiring`;
  const startupCommunityHref = `/groups/new?kind=community&spaceKey=PUBLIC_GENERAL${memberNetworkId ? `&networkId=${encodeURIComponent(memberNetworkId)}` : ''}&returnTo=spaces&preset=startup`;
  const professionalChannelHref = `/channels/new?preset=professional&spaceKey=PUBLIC_GENERAL${memberNetworkId ? `&networkId=${encodeURIComponent(memberNetworkId)}` : ''}`;
  const freelanceNetworkHref = `/groups/new?kind=community&spaceKey=PUBLIC_GENERAL${memberNetworkId ? `&networkId=${encodeURIComponent(memberNetworkId)}` : ''}&returnTo=spaces&preset=freelance`;

  return (
    <section className={SECTION_CARD}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-black tracking-tight text-slate-900">Business Capability v1</h2>
        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-amber-800 ring-1 ring-amber-200/80">
          Work & Opportunity
        </span>
      </div>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">
        اینجا لایه مدرن کامیونیتی برای کار، استخدام، همکاری و رشد حرفه‌ای است.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <article className={SUB_CARD + ' min-h-[11rem] bg-amber-50/60 ring-1 ring-amber-100'}>
          <p className="text-sm font-extrabold text-slate-900">Create Hiring Group</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-600">Jobs, recruiting, referrals و hiring discussion در یک فضای متمرکز.</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-200/80">Hiring-ready</span>
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-200/80">Talent network</span>
          </div>
          <Link href={hiringGroupHref} className={PRIMARY_CTA + ' mt-3 inline-flex !bg-amber-700 hover:!bg-amber-600 !px-3.5 !py-2 !text-[11px]'}>
            ساخت Hiring Group
          </Link>
        </article>

        <article className={SUB_CARD + ' min-h-[11rem] bg-amber-50/60 ring-1 ring-amber-100'}>
          <p className="text-sm font-extrabold text-slate-900">Create Startup Community</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-600">Founders, builders, cofounders و startup networking برای رشد تیم و محصول.</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-200/80">Founder-led</span>
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-200/80">Remote-friendly</span>
          </div>
          <Link href={startupCommunityHref} className={PRIMARY_CTA + ' mt-3 inline-flex !bg-amber-700 hover:!bg-amber-600 !px-3.5 !py-2 !text-[11px]'}>
            ساخت Startup Community
          </Link>
        </article>

        <article className={SUB_CARD + ' min-h-[11rem] bg-amber-50/60 ring-1 ring-amber-100'}>
          <p className="text-sm font-extrabold text-slate-900">Create Professional Channel</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-600">Updates, insights, industry news و mentorship برای مخاطب حرفه‌ای.</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-200/80">High-signal</span>
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-200/80">Industry flow</span>
          </div>
          <Link href={professionalChannelHref} className={SECONDARY_CTA + ' mt-3 inline-flex !px-3.5 !py-2 !text-[11px]'}>
            {memberNetworkId ? 'ساخت Professional Channel' : 'ابتدا عضو یک شبکه کاری شوید'}
          </Link>
        </article>

        <article className={SUB_CARD + ' min-h-[11rem] bg-amber-50/60 ring-1 ring-amber-100'}>
          <p className="text-sm font-extrabold text-slate-900">Create Freelance Network</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-600">Gigs, projects, client leads و collaboration برای فریلنسرها و تیم‌های کوچک.</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-200/80">Deals soon</span>
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-200/80">Marketplace next</span>
          </div>
          <Link href={freelanceNetworkHref} className={PRIMARY_CTA + ' mt-3 inline-flex !bg-amber-700 hover:!bg-amber-600 !px-3.5 !py-2 !text-[11px]'}>
            ساخت Freelance Network
          </Link>
        </article>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className={SUB_CARD + ' min-h-[10.5rem]'}>
          <h3 className="text-sm font-extrabold text-slate-900">Growing Startup Communities</h3>
          <ul className="mt-2 space-y-1.5 text-[11px] text-slate-700">
            {rankedStartupGroups.length === 0 ? (
              <li className="rounded-xl bg-slate-100/70 px-2.5 py-2 text-slate-500">هنوز Startup Community برجسته‌ای ثبت نشده است.</li>
            ) : (
              rankedStartupGroups.map((g) => (
                <li key={g.id} className="rounded-xl bg-white px-2.5 py-2 ring-1 ring-slate-200/80">
                  <Link href={`/groups/${g.id}`} className="font-bold text-sky-700 hover:underline">
                    {g.name}
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className={SUB_CARD + ' min-h-[10.5rem]'}>
          <h3 className="text-sm font-extrabold text-slate-900">Active Hiring Groups</h3>
          <ul className="mt-2 space-y-1.5 text-[11px] text-slate-700">
            {rankedGroups.length === 0 ? (
              <li className="rounded-xl bg-slate-100/70 px-2.5 py-2 text-slate-500">فعلاً گروه استخدامی فعالی برای نمایش پیدا نشد.</li>
            ) : (
              rankedGroups.map((g) => (
                <li key={g.id} className="rounded-xl bg-white px-2.5 py-2 ring-1 ring-slate-200/80">
                  <Link href={`/groups/${g.id}`} className="font-bold text-sky-700 hover:underline">
                    {g.name}
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className={SUB_CARD + ' min-h-[10.5rem]'}>
          <h3 className="text-sm font-extrabold text-slate-900">Professional Channels</h3>
          <ul className="mt-2 space-y-1.5 text-[11px] text-slate-700">
            {rankedChannels.length === 0 ? (
              <li className="rounded-xl bg-slate-100/70 px-2.5 py-2 text-slate-500">Professional Channel برجسته‌ای موجود نیست.</li>
            ) : (
              rankedChannels.map((c) => (
                <li key={c.id} className="rounded-xl bg-white px-2.5 py-2 ring-1 ring-slate-200/80">
                  <Link href={`/channels/${c.id}?network=${encodeURIComponent(c.networkId)}`} className="font-bold text-sky-700 hover:underline">
                    {c.name}
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className={SUB_CARD + ' min-h-[10.5rem]'}>
          <h3 className="text-sm font-extrabold text-slate-900">Freelance Opportunities</h3>
          <ul className="mt-2 space-y-1.5 text-[11px] text-slate-700">
            {rankedFreelanceNetworks.length === 0 ? (
              <li className="rounded-xl bg-slate-100/70 px-2.5 py-2 text-slate-500">فرصت فریلنس آماده نمایش نیست.</li>
            ) : (
              rankedFreelanceNetworks.map((n) => (
                <li key={n.id} className="rounded-xl bg-white px-2.5 py-2 ring-1 ring-slate-200/80">
                  <Link href={`/networks/${n.id}`} className="font-bold text-sky-700 hover:underline">
                    {n.name}
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      <div className="mt-3">
        <h3 className="text-sm font-extrabold text-slate-900">Recommended Work Communities</h3>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {recommendedCommunities.length === 0 ? (
            <li className="rounded-xl bg-slate-100/70 px-2.5 py-2 text-[11px] text-slate-500">
              هنوز کامیونیتی کاری پیشنهادی در این فضا موجود نیست.
            </li>
          ) : (
            recommendedCommunities.map((n) => (
              <li key={n.id} className="rounded-xl bg-white px-2.5 py-2 ring-1 ring-slate-200/80">
                <Link href={`/networks/${n.id}`} className="text-[11px] font-bold text-sky-700 hover:underline">
                  {n.name}
                </Link>
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {['Hiring-ready', 'Founder-led', 'Talent network', 'Remote-friendly', 'Deals soon', 'Marketplace next'].map((chip) => (
          <span
            key={chip}
            className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-800"
          >
            {chip}
          </span>
        ))}
      </div>
    </section>
  );
});

const SportsCapabilitySection = memo(function SportsCapabilitySection({
  groups,
  channels,
  networks,
  memberNetworkId,
}: {
  groups: GroupRow[];
  channels: ChannelRow[];
  networks: Array<NetworkRow & { isMember?: boolean }>;
  memberNetworkId: string | null;
}) {
  const sportsTokens = [
    'football',
    'soccer',
    'basketball',
    'volleyball',
    'gym',
    'fitness',
    'running',
    'cycling',
    'club',
    'team',
    'coach',
    'match',
    'league',
    'fan',
    'sports',
    'فوتبال',
    'بسکتبال',
    'والیبال',
    'باشگاه',
    'تیم',
    'مربی',
    'بدنسازی',
    'دویدن',
    'دوچرخه',
    'هوادار',
    'مسابقه',
    'لیگ',
    'ورزش',
  ];
  const fanTokens = ['fan', 'club', 'match', 'league', 'هوادار', 'باشگاه', 'مسابقه', 'تیم'];
  const teamTokens = ['team', 'club', 'squad', 'coach', 'تیم', 'باشگاه', 'اسکاد', 'مربی'];
  const fitnessTokens = ['fitness', 'gym', 'running', 'cycling', 'workout', 'بدنسازی', 'دویدن', 'دوچرخه'];
  const coachTokens = ['coach', 'training', 'team', 'matchday', 'مربی', 'تمرین', 'تیم', 'مسابقه'];

  function tokenScore(text: string, tokens: string[]) {
    const norm = text.toLowerCase();
    return tokens.reduce((acc, t) => (norm.includes(t) ? acc + 1 : acc), 0);
  }

  const trendingFanGroups = [...groups]
    .sort((a, b) => {
      const aScore = tokenScore(`${a.name} ${a.description ?? ''}`, sportsTokens) + tokenScore(`${a.name} ${a.description ?? ''}`, fanTokens) + (a.joinable ? 1 : 0);
      const bScore = tokenScore(`${b.name} ${b.description ?? ''}`, sportsTokens) + tokenScore(`${b.name} ${b.description ?? ''}`, fanTokens) + (b.joinable ? 1 : 0);
      return bScore - aScore;
    })
    .slice(0, 4);

  const activeTeamCommunities = [...groups]
    .sort((a, b) => {
      const aScore = tokenScore(`${a.name} ${a.description ?? ''}`, teamTokens);
      const bScore = tokenScore(`${b.name} ${b.description ?? ''}`, teamTokens);
      return bScore - aScore;
    })
    .slice(0, 4);

  const fitnessCircles = [...groups]
    .sort((a, b) => {
      const aScore = tokenScore(`${a.name} ${a.description ?? ''}`, fitnessTokens);
      const bScore = tokenScore(`${b.name} ${b.description ?? ''}`, fitnessTokens);
      return bScore - aScore;
    })
    .slice(0, 4);

  const coachChannels = [...channels]
    .sort((a, b) => {
      const aScore = tokenScore(`${a.name} ${a.description ?? ''}`, coachTokens) + tokenScore(`${a.name} ${a.description ?? ''}`, sportsTokens);
      const bScore = tokenScore(`${b.name} ${b.description ?? ''}`, coachTokens) + tokenScore(`${b.name} ${b.description ?? ''}`, sportsTokens);
      return bScore - aScore;
    })
    .slice(0, 4);

  const fastGrowingCommunities = [...networks]
    .sort((a, b) => {
      const aScore = tokenScore(`${a.name} ${a.description ?? ''}`, sportsTokens) + (a.isMember ? 2 : 0);
      const bScore = tokenScore(`${b.name} ${b.description ?? ''}`, sportsTokens) + (b.isMember ? 2 : 0);
      return bScore - aScore;
    })
    .slice(0, 4);

  const fanGroupHref = `/groups/new?kind=community&spaceKey=SPORT${memberNetworkId ? `&networkId=${encodeURIComponent(memberNetworkId)}` : ''}&returnTo=spaces&preset=fan`;
  const teamCommunityHref = `/groups/new?kind=community&spaceKey=SPORT${memberNetworkId ? `&networkId=${encodeURIComponent(memberNetworkId)}` : ''}&returnTo=spaces&preset=team`;
  const fitnessCircleHref = `/groups/new?kind=community&spaceKey=SPORT${memberNetworkId ? `&networkId=${encodeURIComponent(memberNetworkId)}` : ''}&returnTo=spaces&preset=fitness`;
  const coachChannelHref = `/channels/new?preset=coach&spaceKey=SPORT${memberNetworkId ? `&networkId=${encodeURIComponent(memberNetworkId)}` : ''}`;

  return (
    <section className={SECTION_CARD}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-black tracking-tight text-slate-900">Sports Capability v1</h2>
        <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-orange-800 ring-1 ring-orange-200/80">
          Team & Fitness
        </span>
      </div>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">
        اینجا جامعه‌های طرفداری، تیمی و تمرینی شکل می‌گیرند؛ سریع، اجتماعی و انگیزشی.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <article className={SUB_CARD + ' min-h-[11rem] bg-orange-50/50 ring-1 ring-orange-100'}>
          <p className="text-sm font-extrabold text-slate-900">Create Fan Group</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-600">برای هواداران یک تیم/باشگاه/بازیکن و گفتگوهای Matchday.</p>
          <Link href={fanGroupHref} className={PRIMARY_CTA + ' mt-3 inline-flex !bg-orange-700 hover:!bg-orange-600 !px-3.5 !py-2 !text-[11px]'}>
            ساخت Fan Group
          </Link>
        </article>

        <article className={SUB_CARD + ' min-h-[11rem] bg-orange-50/50 ring-1 ring-orange-100'}>
          <p className="text-sm font-extrabold text-slate-900">Create Team Community</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-600">برای تیم‌های واقعی، باشگاه‌های آماتور و اسکادهای محلی.</p>
          <Link href={teamCommunityHref} className={PRIMARY_CTA + ' mt-3 inline-flex !bg-orange-700 hover:!bg-orange-600 !px-3.5 !py-2 !text-[11px]'}>
            ساخت Team Community
          </Link>
        </article>

        <article className={SUB_CARD + ' min-h-[11rem] bg-orange-50/50 ring-1 ring-orange-100'}>
          <p className="text-sm font-extrabold text-slate-900">Create Fitness Circle</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-600">برای دویدن، باشگاه، دوچرخه‌سواری و تمرین گروهی روزانه.</p>
          <Link href={fitnessCircleHref} className={PRIMARY_CTA + ' mt-3 inline-flex !bg-orange-700 hover:!bg-orange-600 !px-3.5 !py-2 !text-[11px]'}>
            ساخت Fitness Circle
          </Link>
        </article>

        <article className={SUB_CARD + ' min-h-[11rem] bg-orange-50/50 ring-1 ring-orange-100'}>
          <p className="text-sm font-extrabold text-slate-900">Create Coach Channel</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-600">برای نکات تمرینی، برنامه تیم و اعلان‌های مربی‌محور.</p>
          <Link href={coachChannelHref} className={SECONDARY_CTA + ' mt-3 inline-flex !px-3.5 !py-2 !text-[11px]'}>
            {memberNetworkId ? 'ساخت Coach Channel' : 'ابتدا عضو شبکه ورزشی شوید'}
          </Link>
        </article>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className={SUB_CARD + ' min-h-[10.5rem]'}>
          <h3 className="text-sm font-extrabold text-slate-900">Trending Fan Groups</h3>
          <ul className="mt-2 space-y-1.5 text-[11px] text-slate-700">
            {trendingFanGroups.length === 0 ? (
              <li className="rounded-xl bg-slate-100/70 px-2.5 py-2 text-slate-500">فعلاً Fan Group شاخصی پیدا نشد.</li>
            ) : (
              trendingFanGroups.map((g) => (
                <li key={g.id} className="rounded-xl bg-white px-2.5 py-2 ring-1 ring-slate-200/80">
                  <Link href={`/groups/${g.id}`} className="font-bold text-sky-700 hover:underline">
                    {g.name}
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className={SUB_CARD + ' min-h-[10.5rem]'}>
          <h3 className="text-sm font-extrabold text-slate-900">Active Team Communities</h3>
          <ul className="mt-2 space-y-1.5 text-[11px] text-slate-700">
            {activeTeamCommunities.length === 0 ? (
              <li className="rounded-xl bg-slate-100/70 px-2.5 py-2 text-slate-500">Team Community فعالی برای نمایش نیست.</li>
            ) : (
              activeTeamCommunities.map((g) => (
                <li key={g.id} className="rounded-xl bg-white px-2.5 py-2 ring-1 ring-slate-200/80">
                  <Link href={`/groups/${g.id}`} className="font-bold text-sky-700 hover:underline">
                    {g.name}
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className={SUB_CARD + ' min-h-[10.5rem]'}>
          <h3 className="text-sm font-extrabold text-slate-900">Fitness Circles Near You</h3>
          <ul className="mt-2 space-y-1.5 text-[11px] text-slate-700">
            {fitnessCircles.length === 0 ? (
              <li className="rounded-xl bg-slate-100/70 px-2.5 py-2 text-slate-500">Fitness Circle شاخصی موجود نیست.</li>
            ) : (
              fitnessCircles.map((g) => (
                <li key={g.id} className="rounded-xl bg-white px-2.5 py-2 ring-1 ring-slate-200/80">
                  <Link href={`/groups/${g.id}`} className="font-bold text-sky-700 hover:underline">
                    {g.name}
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className={SUB_CARD + ' min-h-[10.5rem]'}>
          <h3 className="text-sm font-extrabold text-slate-900">Coach Channels</h3>
          <ul className="mt-2 space-y-1.5 text-[11px] text-slate-700">
            {coachChannels.length === 0 ? (
              <li className="rounded-xl bg-slate-100/70 px-2.5 py-2 text-slate-500">Coach Channel فعالی پیدا نشد.</li>
            ) : (
              coachChannels.map((c) => (
                <li key={c.id} className="rounded-xl bg-white px-2.5 py-2 ring-1 ring-slate-200/80">
                  <Link href={`/channels/${c.id}?network=${encodeURIComponent(c.networkId)}`} className="font-bold text-sky-700 hover:underline">
                    {c.name}
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      <div className="mt-3">
        <h3 className="text-sm font-extrabold text-slate-900">Fast Growing Sports Communities</h3>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {fastGrowingCommunities.length === 0 ? (
            <li className="rounded-xl bg-slate-100/70 px-2.5 py-2 text-[11px] text-slate-500">
              فعلاً شبکه ورزشی شاخصی برای نمایش نیست.
            </li>
          ) : (
            fastGrowingCommunities.map((n) => (
              <li key={n.id} className="rounded-xl bg-white px-2.5 py-2 ring-1 ring-slate-200/80">
                <Link href={`/networks/${n.id}`} className="text-[11px] font-bold text-sky-700 hover:underline">
                  {n.name}
                </Link>
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {['Matchday-ready', 'Team-led', 'Events soon', 'Challenges soon', 'Verified clubs later'].map((chip) => (
          <span
            key={chip}
            className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[10px] font-bold text-orange-800"
          >
            {chip}
          </span>
        ))}
      </div>
    </section>
  );
});

const GamingCapabilitySection = memo(function GamingCapabilitySection({
  groups,
  channels,
  networks,
  memberNetworkId,
}: {
  groups: GroupRow[];
  channels: ChannelRow[];
  networks: Array<NetworkRow & { isMember?: boolean }>;
  memberNetworkId: string | null;
}) {
  const gamingTokens = [
    'game',
    'gaming',
    'clan',
    'guild',
    'squad',
    'party',
    'ranked',
    'stream',
    'esports',
    'fps',
    'moba',
    'fifa',
    'fc',
    'pubg',
    'cod',
    'valorant',
    'dota',
    'league',
    'console',
    'pc',
    'playstation',
    'xbox',
    'گیم',
    'بازی',
    'کلن',
    'اسکاد',
    'استریم',
    'ای‌اسپورت',
    'تیم',
    'پارتی',
  ];
  const clanTokens = ['clan', 'guild', 'ranked', 'کلن', 'گیلد', 'رنک'];
  const squadTokens = ['squad', 'party', 'duo', 'trio', 'اسکاد', 'پارتی', 'تیم'];
  const lfgTokens = ['lfg', 'looking for group', 'teammate', 'party up', 'هم‌تیمی', 'تیم‌آپ'];
  const streamTokens = ['stream', 'live', 'clip', 'vod', 'creator', 'استریم', 'لایو', 'کلیپ'];

  function tokenScore(text: string, tokens: string[]) {
    const norm = text.toLowerCase();
    return tokens.reduce((acc, token) => (norm.includes(token) ? acc + 1 : acc), 0);
  }

  const activeClans = [...groups]
    .sort((a, b) => {
      const aScore =
        tokenScore(`${a.name} ${a.description ?? ''}`, gamingTokens) +
        tokenScore(`${a.name} ${a.description ?? ''}`, clanTokens) +
        (a.joinable ? 1 : 0);
      const bScore =
        tokenScore(`${b.name} ${b.description ?? ''}`, gamingTokens) +
        tokenScore(`${b.name} ${b.description ?? ''}`, clanTokens) +
        (b.joinable ? 1 : 0);
      return bScore - aScore;
    })
    .slice(0, 4);

  const popularGameCommunities = [...networks]
    .sort((a, b) => {
      const aScore = tokenScore(`${a.name} ${a.description ?? ''}`, gamingTokens) + (a.isMember ? 2 : 0);
      const bScore = tokenScore(`${b.name} ${b.description ?? ''}`, gamingTokens) + (b.isMember ? 2 : 0);
      return bScore - aScore;
    })
    .slice(0, 4);

  const squadCommunities = [...groups]
    .sort((a, b) => {
      const aScore =
        tokenScore(`${a.name} ${a.description ?? ''}`, gamingTokens) +
        tokenScore(`${a.name} ${a.description ?? ''}`, squadTokens) +
        (a.joinable ? 1 : 0);
      const bScore =
        tokenScore(`${b.name} ${b.description ?? ''}`, gamingTokens) +
        tokenScore(`${b.name} ${b.description ?? ''}`, squadTokens) +
        (b.joinable ? 1 : 0);
      return bScore - aScore;
    })
    .slice(0, 4);

  const streamChannels = [...channels]
    .sort((a, b) => {
      const aScore =
        tokenScore(`${a.name} ${a.description ?? ''}`, gamingTokens) +
        tokenScore(`${a.name} ${a.description ?? ''}`, streamTokens);
      const bScore =
        tokenScore(`${b.name} ${b.description ?? ''}`, gamingTokens) +
        tokenScore(`${b.name} ${b.description ?? ''}`, streamTokens);
      return bScore - aScore;
    })
    .slice(0, 4);

  const lfgPicks = [...groups]
    .sort((a, b) => {
      const aScore =
        tokenScore(`${a.name} ${a.description ?? ''}`, gamingTokens) +
        tokenScore(`${a.name} ${a.description ?? ''}`, lfgTokens) +
        (a.joinable ? 1 : 0);
      const bScore =
        tokenScore(`${b.name} ${b.description ?? ''}`, gamingTokens) +
        tokenScore(`${b.name} ${b.description ?? ''}`, lfgTokens) +
        (b.joinable ? 1 : 0);
      return bScore - aScore;
    })
    .slice(0, 4);

  const clanGroupHref = `/groups/new?kind=community&spaceKey=TECH${memberNetworkId ? `&networkId=${encodeURIComponent(memberNetworkId)}` : ''}&returnTo=spaces&preset=clan`;
  const squadCommunityHref = `/groups/new?kind=community&spaceKey=TECH${memberNetworkId ? `&networkId=${encodeURIComponent(memberNetworkId)}` : ''}&returnTo=spaces&preset=squad`;
  const streamChannelHref = `/channels/new?preset=stream&spaceKey=TECH${memberNetworkId ? `&networkId=${encodeURIComponent(memberNetworkId)}` : ''}`;
  const lfgGroupHref = `/groups/new?kind=community&spaceKey=TECH${memberNetworkId ? `&networkId=${encodeURIComponent(memberNetworkId)}` : ''}&returnTo=spaces&preset=lfg`;

  return (
    <section className={SECTION_CARD}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-black tracking-tight text-slate-900">Gaming Capability v1</h2>
        <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-violet-800 ring-1 ring-violet-200/80">
          Clan & Squad Ecosystem
        </span>
      </div>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">
        اینجا برای کلن‌های بلندمدت، اسکادهای سریع، کانال‌های استریم و تیم‌آپ‌های LFG طراحی شده است.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <article className={SUB_CARD + ' min-h-[11rem] bg-violet-50/55 ring-1 ring-violet-100'}>
          <p className="text-sm font-extrabold text-slate-900">Create Clan Group</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
            برای تیم‌های بلندمدت / guild / clan با هویت مشترک، نقش‌ها و هماهنگی پایدار.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-violet-700 ring-1 ring-violet-200/80">Long-term team</span>
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-violet-700 ring-1 ring-violet-200/80">Shared identity</span>
          </div>
          <Link href={clanGroupHref} className={PRIMARY_CTA + ' mt-3 inline-flex !bg-violet-700 hover:!bg-violet-600 !px-3.5 !py-2 !text-[11px]'}>
            ساخت Clan Group
          </Link>
        </article>

        <article className={SUB_CARD + ' min-h-[11rem] bg-violet-50/55 ring-1 ring-violet-100'}>
          <p className="text-sm font-extrabold text-slate-900">Create Squad Community</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
            برای تیم‌های کوچک / party / squad و هماهنگی سریع session-based.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-violet-700 ring-1 ring-violet-200/80">Session-ready</span>
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-violet-700 ring-1 ring-violet-200/80">Tight-knit players</span>
          </div>
          <Link href={squadCommunityHref} className={PRIMARY_CTA + ' mt-3 inline-flex !bg-violet-700 hover:!bg-violet-600 !px-3.5 !py-2 !text-[11px]'}>
            ساخت Squad Community
          </Link>
        </article>

        <article className={SUB_CARD + ' min-h-[11rem] bg-violet-50/55 ring-1 ring-violet-100'}>
          <p className="text-sm font-extrabold text-slate-900">Create Stream Channel</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
            برای استریم، کلیپ، اعلان لایو و آپدیت‌های یک‌به‌چند برای کامیونیتی گیمرها.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-violet-700 ring-1 ring-violet-200/80">One-to-many</span>
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-violet-700 ring-1 ring-violet-200/80">Creator flow</span>
          </div>
          <Link href={streamChannelHref} className={SECONDARY_CTA + ' mt-3 inline-flex !px-3.5 !py-2 !text-[11px]'}>
            {memberNetworkId ? 'ساخت Stream Channel' : 'ابتدا عضو شبکه گیمینگ شوید'}
          </Link>
        </article>

        <article className={SUB_CARD + ' min-h-[11rem] bg-violet-50/55 ring-1 ring-violet-100'}>
          <p className="text-sm font-extrabold text-slate-900">Create LFG Group</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
            برای looking-for-group، پیدا کردن هم‌تیمی و هماهنگی سریع تیم‌آپ‌های موقت.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-violet-700 ring-1 ring-violet-200/80">Match teammates</span>
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-violet-700 ring-1 ring-violet-200/80">Temporary squads</span>
          </div>
          <Link href={lfgGroupHref} className={PRIMARY_CTA + ' mt-3 inline-flex !bg-violet-700 hover:!bg-violet-600 !px-3.5 !py-2 !text-[11px]'}>
            ساخت LFG Group
          </Link>
        </article>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className={SUB_CARD + ' min-h-[10.5rem]'}>
          <h3 className="text-sm font-extrabold text-slate-900">Active Clans</h3>
          <ul className="mt-2 space-y-1.5 text-[11px] text-slate-700">
            {activeClans.length === 0 ? (
              <li className="rounded-xl bg-slate-100/70 px-2.5 py-2 text-slate-500">فعلاً کلن شاخصی برای نمایش نیست.</li>
            ) : (
              activeClans.map((g) => (
                <li key={g.id} className="rounded-xl bg-white px-2.5 py-2 ring-1 ring-slate-200/80">
                  <Link href={`/groups/${g.id}`} className="font-bold text-sky-700 hover:underline">
                    {g.name}
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className={SUB_CARD + ' min-h-[10.5rem]'}>
          <h3 className="text-sm font-extrabold text-slate-900">Popular Game Communities</h3>
          <ul className="mt-2 space-y-1.5 text-[11px] text-slate-700">
            {popularGameCommunities.length === 0 ? (
              <li className="rounded-xl bg-slate-100/70 px-2.5 py-2 text-slate-500">کامیونیتی گیمینگ برجسته‌ای ثبت نشده است.</li>
            ) : (
              popularGameCommunities.map((n) => (
                <li key={n.id} className="rounded-xl bg-white px-2.5 py-2 ring-1 ring-slate-200/80">
                  <Link href={`/networks/${n.id}`} className="font-bold text-sky-700 hover:underline">
                    {n.name}
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className={SUB_CARD + ' min-h-[10.5rem]'}>
          <h3 className="text-sm font-extrabold text-slate-900">Squad Communities</h3>
          <ul className="mt-2 space-y-1.5 text-[11px] text-slate-700">
            {squadCommunities.length === 0 ? (
              <li className="rounded-xl bg-slate-100/70 px-2.5 py-2 text-slate-500">Squad Community فعالی موجود نیست.</li>
            ) : (
              squadCommunities.map((g) => (
                <li key={g.id} className="rounded-xl bg-white px-2.5 py-2 ring-1 ring-slate-200/80">
                  <Link href={`/groups/${g.id}`} className="font-bold text-sky-700 hover:underline">
                    {g.name}
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className={SUB_CARD + ' min-h-[10.5rem]'}>
          <h3 className="text-sm font-extrabold text-slate-900">Stream Channels</h3>
          <ul className="mt-2 space-y-1.5 text-[11px] text-slate-700">
            {streamChannels.length === 0 ? (
              <li className="rounded-xl bg-slate-100/70 px-2.5 py-2 text-slate-500">Stream Channel فعالی پیدا نشد.</li>
            ) : (
              streamChannels.map((c) => (
                <li key={c.id} className="rounded-xl bg-white px-2.5 py-2 ring-1 ring-slate-200/80">
                  <Link href={`/channels/${c.id}?network=${encodeURIComponent(c.networkId)}`} className="font-bold text-sky-700 hover:underline">
                    {c.name}
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      <div className="mt-3">
        <h3 className="text-sm font-extrabold text-slate-900">Looking-for-Group Picks</h3>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {lfgPicks.length === 0 ? (
            <li className="rounded-xl bg-slate-100/70 px-2.5 py-2 text-[11px] text-slate-500">
              فعلاً LFG برجسته‌ای برای تیم‌آپ سریع پیدا نشد.
            </li>
          ) : (
            lfgPicks.map((g) => (
              <li key={g.id} className="rounded-xl bg-white px-2.5 py-2 ring-1 ring-slate-200/80">
                <Link href={`/groups/${g.id}`} className="text-[11px] font-bold text-sky-700 hover:underline">
                  {g.name}
                </Link>
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {['Clan-ready', 'Squad voice', 'Tournaments soon', 'Matchmaking later', 'Stream tools later'].map((chip) => (
          <span
            key={chip}
            className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-800"
          >
            {chip}
          </span>
        ))}
      </div>
    </section>
  );
});

export default function SpaceDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="px-4 py-10 text-center text-sm text-slate-500" dir="rtl">
          در حال بارگذاری…
        </div>
      }
    >
      <SpaceDetailInner />
    </Suspense>
  );
}

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
    const path = token
      ? `discover/spaces/detail/${encodeURIComponent(raw)}/with-membership?limit=${lim}`
      : `discover/spaces/detail/${encodeURIComponent(raw)}?limit=${lim}`;
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
      <main className="mx-auto w-full max-w-md px-4 pb-12 pt-3 sm:pb-14" dir="rtl">
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
            {blueprint ? <BlueprintIntroSection blueprint={blueprint} /> : null}

            {blueprint?.utilities?.length ? (
              <SpaceUtilitiesSection
                spaceId={blueprint.id}
                utilities={blueprint.utilities}
              />
            ) : null}
            {spaceKey === 'NEIGHBORHOOD' ? <NeighborhoodFormsCapabilitySection /> : null}

            {isNeighborhood ? (
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

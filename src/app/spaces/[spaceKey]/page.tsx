'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { notFound, useParams, useRouter } from 'next/navigation';
import { AuthGate } from '@/components/AuthGate';
import { getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
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

  const networksSection = (
    <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
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
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none ring-sky-300/0 transition focus:border-sky-300 focus:bg-white focus:ring-2"
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
                      className="rounded-lg bg-sky-600 px-2.5 py-1 text-[10px] font-bold text-white"
                    >
                      ساخت گروه اجتماعی
                    </Link>
                    <Link
                      href={`/networks/${n.id}`}
                      className="rounded-lg border border-slate-200 px-2.5 py-1 text-[10px] font-bold text-slate-700"
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
                  className="shrink-0 rounded-xl bg-slate-800 px-3 py-2 text-[11px] font-bold text-white disabled:opacity-50"
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
          className="mt-2 w-full rounded-xl border border-slate-200 py-2 text-[11px] font-bold text-slate-700 disabled:opacity-50"
        >
          {hoodSearchLoading ? '…' : 'بارگذاری بیشتر'}
        </button>
      ) : null}
    </section>
  );

  const groupsSection = (
    <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-extrabold text-slate-900">گروه‌های اجتماعی</h2>
        <Link
          href={`/groups/new?kind=community&spaceKey=${encodeURIComponent(spaceKey)}&returnTo=spaces`}
          className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-extrabold text-sky-800"
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
                    className="shrink-0 rounded-xl bg-emerald-600 px-3 py-2 text-[11px] font-bold text-white disabled:opacity-50"
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
    <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
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
                    className="rounded-xl border border-slate-200 px-3 py-2 text-[11px] font-bold text-slate-700"
                  >
                    شبکه
                  </Link>
                  <button
                    type="button"
                    disabled={joiningCh === c.id}
                    onClick={() => void joinChannel(c.id, c.networkId)}
                    className="rounded-xl bg-violet-700 px-3 py-2 text-[11px] font-bold text-white disabled:opacity-50"
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
      <main className="mx-auto w-full max-w-md px-4 pb-10 pt-2" dir="rtl">
        <div className="mb-4 flex items-center gap-2">
          <Link
            href="/spaces"
            className="flex h-10 min-w-[2.5rem] items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
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
          <div className="space-y-6">
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

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

const SECTION =
  'rounded-3xl border border-[var(--border-soft)] bg-[var(--card-bg)] p-4 shadow-sm ring-1 ring-[var(--border-soft)] sm:p-5';
const BTN_PRI =
  'shrink-0 rounded-full bg-[var(--accent)] px-3 py-2 text-[11px] font-extrabold text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)] disabled:opacity-50';
const BTN_SEC =
  'shrink-0 rounded-full border border-[var(--border-soft)] bg-[var(--card-bg)] px-3 py-2 text-[11px] font-extrabold text-[var(--text-primary)] hover:bg-[var(--surface-soft)]';

function capabilityLinks(sk: SpaceKey, mid: string | null): { label: string; href: string }[] {
  const nid = mid ? `&networkId=${encodeURIComponent(mid)}` : '';
  switch (sk) {
    case 'NEIGHBORHOOD':
      return [
        { label: 'نظرسنجی حرفه‌ای', href: '/spaces/neighborhood/forms' },
        { label: 'فرم‌های مدیریتی', href: '/spaces/neighborhood/forms/manage' },
        { label: 'معرفی کسب‌وکار محلی', href: '/groups/new?kind=community&spaceKey=NEIGHBORHOOD&returnTo=spaces' },
        { label: 'تابلو اعلانات محلی', href: '/spaces/NEIGHBORHOOD' },
      ];
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
        /* optional */
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

  const memberNetworkId = useMemo(
    () => displayNetworks.find((n) => n.isMember)?.id ?? null,
    [displayNetworks],
  );

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
              <ul className="divide-y divide-[var(--border-soft)]">
                {displayNetworks.length === 0 ? (
                  <li className="py-6 text-center text-xs text-[var(--text-secondary)]">
                    {hoodSearchLoading ? '…' : 'شبکه‌ای نیست'}
                  </li>
                ) : (
                  displayNetworks.map((n) => (
                    <li key={n.id} className="flex items-start justify-between gap-2 py-3">
                      <div className="min-w-0 flex-1">
                        <Link href={`/networks/${n.id}`} className="text-sm font-extrabold text-[var(--accent-hover)] hover:underline">
                          {n.name}
                        </Link>
                        {n.description ? (
                          <p className="mt-0.5 line-clamp-2 text-[11px] text-[var(--text-secondary)]">{n.description}</p>
                        ) : null}
                        {n.isMember ? (
                          <p className="mt-1 text-[10px] font-bold text-emerald-700">عضو هستید</p>
                        ) : null}
                      </div>
                      {!n.isMember ? (
                        <button type="button" disabled={joiningNet === n.id} onClick={() => void joinNetwork(n.id)} className={BTN_PRI}>
                          {joiningNet === n.id ? '…' : 'پیوستن'}
                        </button>
                      ) : (
                        <Link href={`/networks/${n.id}`} className={BTN_SEC}>
                          ورود
                        </Link>
                      )}
                    </li>
                  ))
                )}
              </ul>

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
                ابزارها
              </h2>
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

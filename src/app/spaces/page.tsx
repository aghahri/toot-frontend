'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthGate } from '@/components/AuthGate';
import { getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { USER_SPACE_KEYS, USER_SPACE_META, type UserSpaceKey } from '@/lib/user-spaces';
import { SPACE_BLUEPRINTS, type SpaceBlueprint } from '@/lib/spacesBlueprint';

type SpacePrefsResponse = { preferredSpaces: UserSpaceKey[] };

type SuggestionBlock = {
  key: UserSpaceKey;
  title: string;
  networks: Array<{ id: string; name: string; description: string | null }>;
  groups: Array<{ id: string; name: string; description: string | null; networkId: string | null; joinable?: boolean }>;
  channels: Array<{ id: string; name: string; description: string | null; networkId: string }>;
};

type PersonalizedResponse = {
  preferredSpaces: UserSpaceKey[];
  suggestions: SuggestionBlock[];
};

type TrendingGroupRow = {
  id: string;
  name: string;
  description: string | null;
  networkId: string | null;
  joinable: boolean;
};

type RecommendedItem =
  | { kind: 'network'; id: string; name: string; description: string | null; spaceKey: UserSpaceKey }
  | { kind: 'group'; id: string; name: string; description: string | null; joinable: boolean; spaceKey: UserSpaceKey }
  | { kind: 'channel'; id: string; name: string; description: string | null; networkId: string; spaceKey: UserSpaceKey };

const MANDATORY_SPACE: UserSpaceKey = 'neighborhood';
const MIN_SPACES = 2;
const MAX_SPACES = 4;
const STORAGE_KEY = 'toot:spaces-dashboard:v1';
const DEFAULT_SPACES: UserSpaceKey[] = ['neighborhood', 'education', 'sports', 'business'];

const DETAIL_ROUTE: Record<UserSpaceKey, string> = {
  neighborhood: 'NEIGHBORHOOD',
  education: 'EDUCATION',
  sports: 'SPORT',
  business: 'PUBLIC_GENERAL',
  gaming: 'TECH',
  technology: 'TECH',
  culture: 'PUBLIC_GENERAL',
  family: 'PUBLIC_GENERAL',
  health: 'PUBLIC_GENERAL',
  university: 'EDUCATION',
};

/** Persian-only explore labels (backend routes unchanged). */
const EXPLORE_TITLE_FA: Record<SpaceBlueprint['id'], string> = {
  neighborhood: 'محله',
  education: 'آموزش',
  sports: 'ورزش',
  gaming: 'گیمینگ',
  business: 'کسب‌وکار',
};

const EXPLORE_ONE_LINE: Record<SpaceBlueprint['id'], string> = {
  neighborhood: 'شبکه محلی، فرم و همسایگی',
  education: 'کلاس، کانال و گروه مطالعه',
  sports: 'تیم، هوادار و تمرین',
  gaming: 'کلن، اسکاد و استریم',
  business: 'استخدام، استارتاپ و شبکه حرفه‌ای',
};

const EXPLORE_ORDER: SpaceBlueprint['id'][] = ['neighborhood', 'education', 'sports', 'gaming', 'business'];

const TREND_TAGS = ['محبوب', 'فعال', 'در حال رشد', 'نزدیک شما'] as const;

function normalizeSpaces(items: UserSpaceKey[]): UserSpaceKey[] {
  const seen = new Set<UserSpaceKey>();
  const unique = items.filter((k) => {
    if (!USER_SPACE_KEYS.includes(k)) return false;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const withoutMandatory = unique.filter((k) => k !== MANDATORY_SPACE);
  const next = [MANDATORY_SPACE, ...withoutMandatory].slice(0, MAX_SPACES);
  if (next.length >= MIN_SPACES) return next;
  const out = [...next];
  for (const fallback of DEFAULT_SPACES) {
    if (!out.includes(fallback) && out.length < MIN_SPACES) out.push(fallback);
  }
  return out.slice(0, MAX_SPACES);
}

function flattenGroupsBuckets(
  data: Record<string, TrendingGroupRow[]>,
): Array<TrendingGroupRow & { tag: string }> {
  const order = ['NEIGHBORHOOD', 'EDUCATION', 'SPORT', 'TECH', 'PUBLIC_GENERAL'];
  const out: Array<TrendingGroupRow & { tag: string }> = [];
  const seen = new Set<string>();
  let i = 0;
  for (const cat of order) {
    const rows = data[cat] ?? [];
    for (const g of rows) {
      if (seen.has(g.id)) continue;
      seen.add(g.id);
      out.push({ ...g, tag: TREND_TAGS[i % TREND_TAGS.length] });
      i += 1;
      if (out.length >= 5) return out;
    }
  }
  return out;
}

function buildRecommendations(p: PersonalizedResponse | null): RecommendedItem[] {
  if (!p?.suggestions?.length) return [];
  const out: RecommendedItem[] = [];
  for (const block of p.suggestions) {
    const n0 = block.networks[0];
    if (n0) out.push({ kind: 'network', ...n0, spaceKey: block.key });
    const g0 = block.groups[0];
    if (g0)
      out.push({
        kind: 'group',
        id: g0.id,
        name: g0.name,
        description: g0.description,
        joinable: g0.joinable ?? g0.networkId != null,
        spaceKey: block.key,
      });
    const c0 = block.channels[0];
    if (c0) out.push({ kind: 'channel', ...c0, spaceKey: block.key });
    if (out.length >= 3) break;
  }
  return out.slice(0, 3);
}

export default function SpacesOverviewPage() {
  const [preferredSpaces, setPreferredSpaces] = useState<UserSpaceKey[]>([]);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [draftPrefs, setDraftPrefs] = useState<UserSpaceKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [localReady, setLocalReady] = useState(false);
  const [personalized, setPersonalized] = useState<PersonalizedResponse | null>(null);
  const [trending, setTrending] = useState<Array<TrendingGroupRow & { tag: string }>>([]);
  const [filter, setFilter] = useState<'followed' | 'suggested' | 'new'>('suggested');
  const [discoverLoading, setDiscoverLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const persistLocal = (spaces: UserSpaceKey[]) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(spaces));
  };

  const loadSpaces = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      const fallback = normalizeSpaces(DEFAULT_SPACES);
      setPreferredSpaces(fallback);
      setDraftPrefs(fallback);
      return;
    }
    const prefs = await apiFetch<SpacePrefsResponse>('users/me/spaces', { method: 'GET', token });
    const selected = normalizeSpaces(Array.isArray(prefs.preferredSpaces) ? prefs.preferredSpaces : DEFAULT_SPACES);
    setPreferredSpaces(selected);
    setDraftPrefs(selected);
    persistLocal(selected);
  }, []);

  const loadDiscover = useCallback(async () => {
    setDiscoverLoading(true);
    try {
      const groupsRaw = await apiFetch<Record<string, TrendingGroupRow[]>>('discover/spaces/groups?limit=8', {
        method: 'GET',
      });
      setTrending(flattenGroupsBuckets(groupsRaw ?? {}));
    } catch {
      setTrending([]);
    } finally {
      setDiscoverLoading(false);
    }
  }, []);

  const loadPersonalized = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setPersonalized(null);
      return;
    }
    try {
      const p = await apiFetch<PersonalizedResponse>('discover/spaces/personalized', { method: 'GET', token });
      setPersonalized(p);
    } catch {
      setPersonalized(null);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as UserSpaceKey[];
        const selected = normalizeSpaces(Array.isArray(parsed) ? parsed : DEFAULT_SPACES);
        setPreferredSpaces(selected);
        setDraftPrefs(selected);
      }
    } catch {
      /* ignore */
    } finally {
      setLocalReady(true);
    }
  }, []);

  useEffect(() => {
    if (!localReady) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        await loadSpaces();
        await loadDiscover();
        await loadPersonalized();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'خطا در بارگذاری');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [localReady, loadSpaces, loadDiscover, loadPersonalized]);

  const recommendations = useMemo(() => buildRecommendations(personalized), [personalized]);

  const exploreBlueprints = useMemo(
    () => EXPLORE_ORDER.map((id) => SPACE_BLUEPRINTS.find((b) => b.id === id)).filter(Boolean) as SpaceBlueprint[],
    [],
  );

  // Hide blueprints the user already has pinned on their dashboard so the
  // selected-spaces grid and the discovery grid never repeat the same cards.
  const discoveryBlueprints = useMemo(
    () => exploreBlueprints.filter((bp) => !preferredSpaces.includes(bp.id as UserSpaceKey)),
    [exploreBlueprints, preferredSpaces],
  );

  async function savePreferredSpaces() {
    const selected = normalizeSpaces(draftPrefs);
    if (selected.length < MIN_SPACES || selected.length > MAX_SPACES) {
      setError(`باید بین ${MIN_SPACES} تا ${MAX_SPACES} فضا انتخاب شود.`);
      return;
    }
    const token = getAccessToken();
    setPrefsSaving(true);
    setError(null);
    try {
      if (token) {
        const updated = await apiFetch<SpacePrefsResponse>('users/me/spaces', {
          method: 'PATCH',
          token,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ preferredSpaces: selected }),
        });
        const fromServer = normalizeSpaces(updated.preferredSpaces ?? selected);
        setPreferredSpaces(fromServer);
        persistLocal(fromServer);
      } else {
        setPreferredSpaces(selected);
        persistLocal(selected);
      }
      setEditOpen(false);
      void loadPersonalized();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ذخیره انجام نشد');
    } finally {
      setPrefsSaving(false);
    }
  }

  function toggleDraftSpace(k: UserSpaceKey) {
    if (k === MANDATORY_SPACE) return;
    setDraftPrefs((prev) => {
      if (prev.includes(k)) return prev.filter((x) => x !== k);
      if (prev.length >= MAX_SPACES) return prev;
      return [...prev, k];
    });
  }

  function moveDraft(key: UserSpaceKey, dir: -1 | 1) {
    if (key === MANDATORY_SPACE) return;
    setDraftPrefs((prev) => {
      const arr = [...prev];
      const idx = arr.indexOf(key);
      if (idx < 0) return arr;
      const nextIdx = idx + dir;
      if (nextIdx < 1 || nextIdx >= arr.length) return arr;
      const tmp = arr[nextIdx];
      arr[nextIdx] = arr[idx];
      arr[idx] = tmp;
      return arr;
    });
  }

  async function joinTrendingGroup(groupId: string) {
    const token = getAccessToken();
    if (!token) return;
    setJoiningId(groupId);
    setError(null);
    try {
      await apiFetch(`groups/${groupId}/join`, { method: 'POST', token });
      window.location.href = `/groups/${groupId}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'پیوستن ممکن نیست');
    } finally {
      setJoiningId(null);
    }
  }

  const dashboardSpaces = preferredSpaces.slice(0, MAX_SPACES);
  const hasMySpaces = dashboardSpaces.length > 0;

  // Cover-gradient palette per the handoff `.space-item.{v2,v3,v4}` variants.
  // Picked deterministically by hash of the row's id so the same item keeps
  // the same color across refreshes.
  const COVER_GRADIENTS = [
    'linear-gradient(135deg,#C8B8A5,#9A8475)',
    'linear-gradient(135deg,#B4C5A5,#7A9875)',
    'linear-gradient(135deg,#D1BA9E,#A58262)',
    'linear-gradient(135deg,#E0C9A0,#B48A5F)',
  ] as const;
  const pickCover = (key: string) => {
    let h = 0;
    for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) | 0;
    return COVER_GRADIENTS[Math.abs(h) % COVER_GRADIENTS.length];
  };

  return (
    <AuthGate>
      <main
        className="mx-auto min-h-[100dvh] w-full max-w-md px-3 pb-28 pt-3 bg-[var(--bg-page)] sm:max-w-xl sm:pb-16"
        dir="rtl"
      >
        <div className="mb-3 flex items-center justify-between px-1">
          <h1 className="text-[15px] font-extrabold text-[var(--ink)]">فضاها</h1>
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="rounded-full bg-[var(--surface)] border border-[var(--line)] px-3 py-1.5 text-[11px] font-extrabold text-[var(--accent-hover)] transition active:scale-[0.97]"
            aria-label="ویرایش فضاهای منتخب"
          >
            ویرایش
          </button>
        </div>

        {loading ? (
          <div className="space-y-4" aria-busy>
            <div className="h-[180px] animate-pulse rounded-2xl border border-[var(--line)] bg-[var(--surface-2)]" />
            <div className="flex gap-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-7 w-20 animate-pulse rounded-full border border-[var(--line)] bg-[var(--surface-2)]"
                />
              ))}
            </div>
            <ul className="space-y-2">
              {[0, 1, 2].map((i) => (
                <li
                  key={i}
                  className="h-[88px] animate-pulse rounded-2xl border border-[var(--line)] bg-[var(--surface-2)]"
                />
              ))}
            </ul>
          </div>
        ) : error && !hasMySpaces ? (
          <p
            className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--accent-hover)]"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {!loading && error && hasMySpaces ? (
          <p
            className="mb-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-center text-xs font-semibold text-[var(--accent-hover)]"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {!loading ? (
          <div className="flex flex-col gap-4">
            {/* 1. Neighborhood hero — handoff .neighborhood-hero */}
            {hasMySpaces && dashboardSpaces.includes('neighborhood') ? (
              <article className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
                <div
                  className="relative h-20"
                  style={{
                    background:
                      'linear-gradient(135deg, #E0C9A0 0%, #B48A5F 60%, #8B4E1E 100%)',
                  }}
                  aria-hidden
                >
                  <span className="absolute bottom-2.5 start-3.5 text-[16px] font-extrabold tracking-tight text-white">
                    {USER_SPACE_META.neighborhood.labelFa}
                  </span>
                </div>
                <div className="flex gap-2 p-3">
                  <Link
                    href={`/spaces/${DETAIL_ROUTE.neighborhood}`}
                    className="flex-1 rounded-xl bg-[var(--accent)] px-3 py-2.5 text-center text-[12.5px] font-extrabold text-white"
                  >
                    ورود به محله
                  </Link>
                  <Link
                    href="/spaces/neighborhood/bulletin"
                    className="flex-1 rounded-xl bg-[var(--surface-2)] px-3 py-2.5 text-center text-[12.5px] font-extrabold text-[var(--ink)]"
                  >
                    اعلان‌ها
                  </Link>
                </div>
              </article>
            ) : null}

            {/* 2. Section title + dashboard tiles */}
            {hasMySpaces ? (
              <section aria-labelledby="my-spaces-heading">
                <div className="mb-2 flex items-baseline justify-between px-1">
                  <h2 id="my-spaces-heading" className="text-[15px] font-extrabold text-[var(--ink)]">
                    فضاهای من
                  </h2>
                  <button
                    type="button"
                    onClick={() => setEditOpen(true)}
                    className="text-[12px] font-bold text-[var(--accent-hover)]"
                  >
                    کشف بیشتر
                  </button>
                </div>
                {dashboardSpaces.filter((k) => k !== 'neighborhood').length > 0 ? (
                  <ul className="grid grid-cols-3 gap-2.5">
                    {dashboardSpaces
                      .filter((k) => k !== 'neighborhood')
                      .map((k) => (
                        <li key={k}>
                          <Link
                            href={k === 'business' ? '/spaces/business' : `/spaces/${DETAIL_ROUTE[k]}`}
                            className="flex h-full flex-col items-center gap-1.5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-2 py-3 text-center transition active:scale-[0.97]"
                          >
                            <span className="text-2xl leading-none" aria-hidden>
                              {USER_SPACE_META[k].emoji}
                            </span>
                            <p className="line-clamp-1 text-[12px] font-extrabold text-[var(--ink)]">
                              {USER_SPACE_META[k].labelFa}
                            </p>
                          </Link>
                        </li>
                      ))}
                  </ul>
                ) : null}
              </section>
            ) : (
              <div className="mx-auto flex max-w-xs flex-col items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-12 text-center">
                <span
                  className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--surface-2)] text-3xl"
                  aria-hidden
                >
                  🏘
                </span>
                <p className="text-sm font-extrabold text-[var(--ink)]">هنوز عضو فضایی نیستی</p>
                <p className="text-balance text-xs text-[var(--ink-3)]">
                  چند فضا انتخاب کن تا اجتماع‌های نزدیک به سلیقه‌ات اینجا جمع شوند.
                </p>
                <button
                  type="button"
                  onClick={() => setEditOpen(true)}
                  className="mt-1 rounded-full bg-[var(--accent)] px-5 py-2.5 text-xs font-extrabold text-[var(--accent-contrast)]"
                >
                  کشف فضاها
                </button>
              </div>
            )}

            {/* 3. Filter chip row — handoff .chip-row + .chip / .chip.active */}
            <div
              role="tablist"
              aria-label="فیلتر فضاها"
              className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [&::-webkit-scrollbar]:hidden"
            >
              {([
                { id: 'followed', label: 'دنبال‌شده' },
                { id: 'suggested', label: 'پیشنهادی' },
                { id: 'new', label: 'جدید' },
              ] as const).map((c) => {
                const active = filter === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setFilter(c.id)}
                    className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12px] font-bold transition ${
                      active
                        ? 'bg-[var(--ink)] text-white border border-[var(--ink)]'
                        : 'bg-[var(--surface)] text-[var(--ink-2)] border border-[var(--line)]'
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>

            {/* 4. Unified .space-list — recommendations + discovery for
                'suggested', trending for 'new'; hidden for 'followed'. */}
            {filter !== 'followed' ? (
              <section aria-label="فهرست فضاها">
                <ul className="space-y-2">
                  {filter === 'suggested' && getAccessToken()
                    ? recommendations.map((item, idx) => {
                        const key = `rec-${item.kind}-${item.id}-${idx}`;
                        const href =
                          item.kind === 'network'
                            ? `/networks/${item.id}`
                            : item.kind === 'group'
                              ? `/groups/${item.id}`
                              : `/channels/${item.id}?network=${encodeURIComponent(item.networkId)}`;
                        const cat =
                          item.kind === 'network' ? 'شبکه' : item.kind === 'group' ? 'گروه' : 'کانال';
                        return (
                          <li key={key}>
                            <Link
                              href={href}
                              className="flex items-start gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3 transition active:scale-[0.99]"
                            >
                              <span
                                className="h-[52px] w-[52px] shrink-0 rounded-xl"
                                style={{ background: pickCover(item.id) }}
                                aria-hidden
                              />
                              <div className="min-w-0 flex-1">
                                <p className="line-clamp-1 text-[13.5px] font-bold leading-tight text-[var(--ink)]">
                                  {item.name}
                                </p>
                                <p className="mt-0.5 text-[10.5px] font-bold text-[var(--accent-hover)]">{cat}</p>
                                {item.description ? (
                                  <p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-[var(--ink-3)]">
                                    {item.description}
                                  </p>
                                ) : null}
                              </div>
                              <span className="self-center shrink-0 rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-[11px] font-extrabold text-[var(--accent-soft-ink)]">
                                مشاهده
                              </span>
                            </Link>
                          </li>
                        );
                      })
                    : null}

                  {filter === 'suggested'
                    ? discoveryBlueprints.map((bp) => {
                        const href =
                          bp.id === 'business'
                            ? '/spaces/business'
                            : bp.id === 'education'
                              ? '/spaces/education'
                              : `/spaces/${bp.mappedCategory}`;
                        const title = EXPLORE_TITLE_FA[bp.id];
                        const line = EXPLORE_ONE_LINE[bp.id];
                        return (
                          <li key={`bp-${bp.id}`}>
                            <Link
                              href={href}
                              className="flex items-start gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3 transition active:scale-[0.99]"
                            >
                              <span
                                className="h-[52px] w-[52px] shrink-0 rounded-xl"
                                style={{ background: pickCover(bp.id) }}
                                aria-hidden
                              />
                              <div className="min-w-0 flex-1">
                                <p className="line-clamp-1 text-[13.5px] font-bold leading-tight text-[var(--ink)]">
                                  {title}
                                </p>
                                <p className="mt-0.5 text-[10.5px] font-bold text-[var(--accent-hover)]">پیشنهادی</p>
                                <p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-[var(--ink-3)]">
                                  {line}
                                </p>
                              </div>
                              <span className="self-center shrink-0 rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-[11px] font-extrabold text-[var(--accent-soft-ink)]">
                                ورود
                              </span>
                            </Link>
                          </li>
                        );
                      })
                    : null}

                  {filter === 'new'
                    ? trending.map((g) => (
                        <li key={`tr-${g.id}`}>
                          <div className="flex items-start gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
                            <Link
                              href={`/groups/${g.id}`}
                              className="contents"
                              aria-label={g.name}
                            >
                              <span
                                className="h-[52px] w-[52px] shrink-0 rounded-xl"
                                style={{ background: pickCover(g.id) }}
                                aria-hidden
                              />
                              <div className="min-w-0 flex-1">
                                <p className="line-clamp-1 text-[13.5px] font-bold leading-tight text-[var(--ink)]">
                                  {g.name}
                                </p>
                                <p className="mt-0.5 text-[10.5px] font-bold text-[var(--accent-hover)]">{g.tag}</p>
                                {g.description ? (
                                  <p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-[var(--ink-3)]">
                                    {g.description}
                                  </p>
                                ) : null}
                              </div>
                            </Link>
                            {g.joinable ? (
                              <button
                                type="button"
                                disabled={joiningId === g.id}
                                onClick={() => void joinTrendingGroup(g.id)}
                                className="self-center shrink-0 rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-[11px] font-extrabold text-[var(--accent-soft-ink)] disabled:opacity-50"
                              >
                                {joiningId === g.id ? '…' : 'پیوستن'}
                              </button>
                            ) : (
                              <Link
                                href={`/groups/${g.id}`}
                                className="self-center shrink-0 rounded-full bg-[var(--surface-2)] px-3 py-1.5 text-[11px] font-extrabold text-[var(--ink-3)]"
                              >
                                عضو
                              </Link>
                            )}
                          </div>
                        </li>
                      ))
                    : null}
                </ul>

                {/* Empty state per filter — only render when both buckets are empty. */}
                {filter === 'suggested' &&
                recommendations.length === 0 &&
                discoveryBlueprints.length === 0 ? (
                  <p className="mt-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3 py-6 text-center text-xs text-[var(--ink-3)]">
                    فعلاً پیشنهاد جدیدی برای شما نیست.
                  </p>
                ) : null}
                {filter === 'new' && trending.length === 0 && !discoverLoading ? (
                  <p className="mt-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3 py-6 text-center text-xs text-[var(--ink-3)]">
                    به‌زودی
                  </p>
                ) : null}
              </section>
            ) : null}
          </div>
        ) : null}

        {editOpen ? (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--ink)]/40 p-3 backdrop-blur-[2px]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="spaces-edit-title"
            onClick={() => setEditOpen(false)}
            dir="rtl"
          >
            <div
              className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-2 flex items-center justify-between">
                <h3 id="spaces-edit-title" className="text-sm font-extrabold text-[var(--ink)]">
                  فضاهای منتخب
                </h3>
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-xs font-bold text-[var(--ink-2)] transition hover:bg-[var(--surface-2)]"
                  aria-label="بستن"
                >
                  بستن
                </button>
              </div>
              <p className="mb-3 text-[11px] text-[var(--ink-3)]">
                حداقل {MIN_SPACES} و حداکثر {MAX_SPACES} فضا. «محله» ثابت است.
              </p>
              <div className="mb-3 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-2.5">
                <p className="text-[11px] font-bold text-[var(--ink)]">ترتیب</p>
                <ul className="mt-2 space-y-1.5">
                  {draftPrefs.map((k, index) => (
                    <li
                      key={k}
                      className="flex items-center justify-between rounded-lg border border-[var(--line)] bg-[var(--surface)] px-2.5 py-2 text-xs"
                    >
                      <span className="font-bold text-[var(--ink)]">
                        {index + 1}. {USER_SPACE_META[k].labelFa}
                      </span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          disabled={k === MANDATORY_SPACE || index <= 1}
                          onClick={() => moveDraft(k, -1)}
                          aria-label="انتقال به بالا"
                          className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-0.5 text-[var(--ink-2)] transition hover:bg-[var(--surface-2)] disabled:opacity-40"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={k === MANDATORY_SPACE || index >= draftPrefs.length - 1}
                          onClick={() => moveDraft(k, 1)}
                          aria-label="انتقال به پایین"
                          className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-2 py-0.5 text-[var(--ink-2)] transition hover:bg-[var(--surface-2)] disabled:opacity-40"
                        >
                          ↓
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {USER_SPACE_KEYS.map((k) => {
                  const selected = draftPrefs.includes(k);
                  const blocked = k === MANDATORY_SPACE;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => toggleDraftSpace(k)}
                      aria-pressed={selected}
                      className={`rounded-xl border px-2.5 py-2.5 text-xs font-bold transition ${
                        selected
                          ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-soft-ink)]'
                          : 'border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-2)]'
                      }`}
                    >
                      <span className="ms-1" aria-hidden>
                        {USER_SPACE_META[k].emoji}
                      </span>
                      {USER_SPACE_META[k].labelFa}
                      {blocked ? ' · ثابت' : ''}
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-xs font-extrabold text-[var(--ink)] transition hover:bg-[var(--surface-2)]"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  disabled={prefsSaving || draftPrefs.length < MIN_SPACES || draftPrefs.length > MAX_SPACES}
                  onClick={() => void savePreferredSpaces()}
                  className="rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-extrabold text-[var(--accent-contrast)] transition hover:bg-[var(--accent-hover)] disabled:opacity-50"
                >
                  {prefsSaving ? '…' : 'ذخیره'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </AuthGate>
  );
}

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

  return (
    <AuthGate>
      <main
        className="theme-page-bg theme-text-primary mx-auto w-full max-w-lg px-4 pb-28 pt-5 sm:max-w-xl sm:pb-16"
        dir="rtl"
      >
        <header className="mb-8 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-black tracking-tight text-[var(--text-primary)] sm:text-3xl">فضاها</h1>
          </div>
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="shrink-0 rounded-2xl border border-[var(--border-soft)] bg-[var(--card-bg)] px-3 py-2.5 text-xs font-extrabold text-[var(--accent-hover)] shadow-sm transition hover:bg-[var(--surface-soft)] active:scale-[0.99]"
            aria-label="ویرایش فضاهای منتخب"
          >
            ویرایش
          </button>
        </header>

        {loading ? (
          <div className="space-y-4" aria-busy>
            <div className="h-24 animate-pulse rounded-3xl bg-[var(--surface-strong)]" />
            <div className="h-32 animate-pulse rounded-3xl bg-[var(--surface-strong)]" />
          </div>
        ) : error && !hasMySpaces ? (
          <p className="text-sm font-semibold text-red-600">{error}</p>
        ) : null}

        {!loading && error && hasMySpaces ? (
          <p className="mb-4 rounded-2xl border border-red-100 bg-red-50/80 px-3 py-2 text-center text-xs font-semibold text-red-700">
            {error}
          </p>
        ) : null}

        {!loading ? (
          <div className="flex flex-col gap-10">
            <section aria-label="فضاهای منتخب">
              {hasMySpaces ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {dashboardSpaces.map((k) => (
                    <Link
                      key={k}
                      href={k === 'business' ? '/spaces/business' : `/spaces/${DETAIL_ROUTE[k]}`}
                      className="flex flex-col items-center rounded-3xl border border-[var(--border-soft)] bg-[var(--card-bg)] px-3 py-5 text-center shadow-sm ring-1 ring-[var(--border-soft)] transition hover:shadow-md active:scale-[0.98]"
                    >
                      <span className="text-4xl leading-none" aria-hidden>
                        {USER_SPACE_META[k].emoji}
                      </span>
                      <p className="mt-3 text-sm font-black text-[var(--text-primary)]">{USER_SPACE_META[k].labelFa}</p>
                      <p className="mt-2 text-[10px] font-bold text-[var(--accent-hover)]">ورود</p>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="rounded-3xl border border-[var(--border-soft)] bg-[var(--card-bg)] px-4 py-10 text-center shadow-sm">
                  <p className="text-sm font-extrabold text-[var(--text-primary)]">فضایی انتخاب نشده</p>
                  <button
                    type="button"
                    onClick={() => setEditOpen(true)}
                    className="mt-4 rounded-full bg-[var(--accent)] px-6 py-2.5 text-xs font-extrabold text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)]"
                  >
                    انتخاب فضاها
                  </button>
                </div>
              )}
            </section>

            {getAccessToken() && recommendations.length > 0 ? (
              <section aria-labelledby="rec-heading">
                <h2 id="rec-heading" className="mb-4 text-xs font-extrabold uppercase tracking-wider text-[var(--text-secondary)]">
                  پیشنهاد برای شما
                </h2>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {recommendations.map((item, idx) => (
                    <Link
                      key={`${item.kind}-${item.id}-${idx}`}
                      href={
                        item.kind === 'network'
                          ? `/networks/${item.id}`
                          : item.kind === 'group'
                            ? `/groups/${item.id}`
                            : `/channels/${item.id}?network=${encodeURIComponent(item.networkId)}`
                      }
                      className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-3 transition hover:border-[var(--accent-ring)]"
                    >
                      <p className="text-[10px] font-bold text-[var(--accent-hover)]">
                        {item.kind === 'network' ? 'شبکه' : item.kind === 'group' ? 'گروه' : 'کانال'}
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm font-extrabold text-[var(--text-primary)]">{item.name}</p>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}

            <section aria-labelledby="explore-heading">
              <h2 id="explore-heading" className="mb-4 text-xs font-extrabold uppercase tracking-wider text-[var(--text-secondary)]">
                کاوش فضاها
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {exploreBlueprints.map((bp) => {
                  const isHood = bp.id === 'neighborhood';
                  const title = EXPLORE_TITLE_FA[bp.id];
                  const line = EXPLORE_ONE_LINE[bp.id];
                  return (
                    <Link
                      key={bp.id}
                      href={
                        bp.id === 'business'
                          ? '/spaces/business'
                          : bp.id === 'education'
                            ? '/spaces/education'
                            : `/spaces/${bp.mappedCategory}`
                      }
                      className={`relative block overflow-hidden rounded-3xl border border-[var(--border-soft)] bg-[var(--card-bg)] p-5 shadow-sm ring-1 ring-[var(--border-soft)] transition hover:shadow-md active:scale-[0.99] ${
                        isHood ? 'sm:col-span-2' : ''
                      }`}
                    >
                      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-bl opacity-[0.12] ${bp.accentClass}`} aria-hidden />
                      <div className="relative flex items-center gap-4">
                        <span className="text-4xl" aria-hidden>
                          {bp.id === 'neighborhood'
                            ? '🏘'
                            : bp.id === 'education'
                              ? '🎓'
                              : bp.id === 'sports'
                                ? '⚽'
                                : bp.id === 'gaming'
                                  ? '🎮'
                                  : '💼'}
                        </span>
                        <div className="min-w-0 flex-1 text-right">
                          <p className="text-lg font-black text-[var(--text-primary)]">{title}</p>
                          <p className="mt-1 text-[12px] text-[var(--text-secondary)]">{line}</p>
                          <p className="mt-3 text-xs font-extrabold text-[var(--accent-hover)]">ورود به فضا ←</p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>

            <section aria-labelledby="trend-heading">
              <h2 id="trend-heading" className="mb-4 text-xs font-extrabold uppercase tracking-wider text-[var(--text-secondary)]">
                اجتماع‌های داغ
              </h2>
              {trending.length === 0 && !discoverLoading ? (
                <p className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-6 text-center text-xs text-[var(--text-secondary)]">
                  به‌زودی
                </p>
              ) : (
                <ul className="space-y-2">
                  {trending.map((g) => (
                    <li
                      key={g.id}
                      className="flex flex-col gap-2 rounded-2xl border border-[var(--border-soft)] bg-[var(--card-bg)] px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/groups/${g.id}`}
                            className="truncate text-sm font-extrabold text-[var(--accent-hover)] hover:underline"
                          >
                            {g.name}
                          </Link>
                          <span className="rounded-full bg-[var(--surface-soft)] px-2 py-0.5 text-[9px] font-bold text-[var(--text-secondary)] ring-1 ring-[var(--border-soft)]">
                            {g.tag}
                          </span>
                        </div>
                        {g.description ? (
                          <p className="mt-0.5 line-clamp-1 text-[11px] text-[var(--text-secondary)]">{g.description}</p>
                        ) : null}
                      </div>
                      {g.joinable ? (
                        <button
                          type="button"
                          disabled={joiningId === g.id}
                          onClick={() => void joinTrendingGroup(g.id)}
                          className="shrink-0 rounded-full bg-[var(--accent)] px-4 py-2 text-[11px] font-extrabold text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)] disabled:opacity-50"
                        >
                          {joiningId === g.id ? '…' : 'پیوستن'}
                        </button>
                      ) : (
                        <Link
                          href={`/groups/${g.id}`}
                          className="shrink-0 rounded-full border border-[var(--border-soft)] px-4 py-2 text-center text-[11px] font-extrabold text-[var(--text-primary)] hover:bg-[var(--surface-soft)]"
                        >
                          مشاهده
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : null}

        {editOpen ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3" dir="rtl">
            <div className="theme-card-bg theme-border-soft max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border p-5 shadow-2xl">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-[var(--text-primary)]">فضاهای منتخب</h3>
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className="rounded-full border border-[var(--border-soft)] px-3 py-1 text-xs font-bold text-[var(--text-secondary)]"
                >
                  بستن
                </button>
              </div>
              <p className="mb-3 text-[11px] text-[var(--text-secondary)]">
                حداقل {MIN_SPACES} و حداکثر {MAX_SPACES} فضا. «محله» ثابت است.
              </p>
              <div className="mb-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-2.5">
                <p className="text-[11px] font-bold text-[var(--text-primary)]">ترتیب</p>
                <ul className="mt-2 space-y-1.5">
                  {draftPrefs.map((k, index) => (
                    <li
                      key={k}
                      className="flex items-center justify-between rounded-lg bg-[var(--card-bg)] px-2.5 py-2 text-xs ring-1 ring-[var(--border-soft)]"
                    >
                      <span className="font-bold text-[var(--text-primary)]">
                        {index + 1}. {USER_SPACE_META[k].labelFa}
                      </span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          disabled={k === MANDATORY_SPACE || index <= 1}
                          onClick={() => moveDraft(k, -1)}
                          className="rounded border border-[var(--border-soft)] px-2 py-0.5 disabled:opacity-40"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={k === MANDATORY_SPACE || index >= draftPrefs.length - 1}
                          onClick={() => moveDraft(k, 1)}
                          className="rounded border border-[var(--border-soft)] px-2 py-0.5 disabled:opacity-40"
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
                      className={`rounded-2xl px-2.5 py-2.5 text-xs font-bold ring-1 transition ${
                        selected ? `${USER_SPACE_META[k].accent} ring-2` : 'bg-[var(--surface-soft)] text-[var(--text-primary)] ring-[var(--border-soft)] hover:bg-[var(--accent-soft)]/40'
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
                  className="rounded-full border border-[var(--border-soft)] px-4 py-2 text-xs font-extrabold text-[var(--text-primary)]"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  disabled={prefsSaving || draftPrefs.length < MIN_SPACES || draftPrefs.length > MAX_SPACES}
                  onClick={() => void savePreferredSpaces()}
                  className="rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-extrabold text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)] disabled:opacity-50"
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

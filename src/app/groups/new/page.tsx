'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AuthGate } from '@/components/AuthGate';
import { IconPlus } from '@/components/MessagingTabIcons';
import { getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';

type NetworkRow = {
  id: string;
  name: string;
  isMember?: boolean;
};

type UserSearchHit = {
  id: string;
  name: string;
  username: string;
  phoneMasked: string;
};
type SuggestedNetworkRow = { id: string; name: string; description: string | null };
type NetworkSpaceCategory = 'PUBLIC_GENERAL' | 'NEIGHBORHOOD' | 'EDUCATION' | 'SPORT' | 'TECH';

type CreateMode = 'normal' | 'network';

type Step = 'members' | 'details';

function CreateGroupPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const kind = (searchParams.get('kind') ?? '').toLowerCase();
  const preset = (searchParams.get('preset') ?? '').trim().toLowerCase();
  const presetNetworkId = (searchParams.get('networkId') ?? '').trim();
  const spaceKey = (searchParams.get('spaceKey') ?? '').trim();
  const returnTo = (searchParams.get('returnTo') ?? '').trim().toLowerCase();
  const isStudyPreset = preset === 'study';
  const isClassPreset = preset === 'class';
  const isHiringPreset = preset === 'hiring';
  const isStartupPreset = preset === 'startup';
  const isFreelancePreset = preset === 'freelance';
  const isFanPreset = preset === 'fan';
  const isTeamPreset = preset === 'team';
  const isFitnessPreset = preset === 'fitness';
  const isSportsPreset = isFanPreset || isTeamPreset || isFitnessPreset;
  const isBusinessPreset = isHiringPreset || isStartupPreset || isFreelancePreset;
  const presetForcesCommunity = isStudyPreset || isClassPreset || isBusinessPreset || isSportsPreset;
  const forceChatMode = kind === 'chat';
  const forceCommunityMode = kind === 'community' || presetForcesCommunity;
  const forcedMode: CreateMode | null = forceCommunityMode ? 'network' : forceChatMode ? 'normal' : null;
  const isNeighborhoodFlow = spaceKey.toUpperCase() === 'NEIGHBORHOOD';

  const [step, setStep] = useState<Step>('members');
  const [mode, setMode] = useState<CreateMode>(() => (kind === 'community' ? 'network' : 'normal'));
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [networks, setNetworks] = useState<NetworkRow[]>([]);
  const [networkId, setNetworkId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [searchHits, setSearchHits] = useState<UserSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [memberSearchError, setMemberSearchError] = useState<string | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedProfiles, setSelectedProfiles] = useState<Record<string, UserSearchHit>>({});
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [loadingBoot, setLoadingBoot] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestedNetworks, setSuggestedNetworks] = useState<SuggestedNetworkRow[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [joiningSuggestionId, setJoiningSuggestionId] = useState<string | null>(null);
  const [createNetworkOpen, setCreateNetworkOpen] = useState(false);
  const [networkCreating, setNetworkCreating] = useState(false);
  const [newNetworkName, setNewNetworkName] = useState('');
  const [newNetworkDescription, setNewNetworkDescription] = useState('');
  const submitLockRef = useRef(false);

  function resolveSpaceCategoryForNetwork(raw: string): NetworkSpaceCategory {
    const v = raw.trim().toUpperCase();
    if (v === 'NEIGHBORHOOD') return 'NEIGHBORHOOD';
    if (v === 'EDUCATION') return 'EDUCATION';
    if (v === 'SPORT') return 'SPORT';
    if (v === 'TECH') return 'TECH';
    return 'PUBLIC_GENERAL';
  }

  const memberNetworks = useMemo(
    () => networks.filter((n) => n.isMember),
    [networks],
  );

  const loadNetworks = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    const list = await apiFetch<NetworkRow[]>('networks', { method: 'GET', token });
    setNetworks(Array.isArray(list) ? list : []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = getAccessToken();
      if (!token) {
        setLoadingBoot(false);
        return;
      }
      setLoadingBoot(true);
      setError(null);
      try {
        const me = await apiFetch<{ id: string }>('users/me', { method: 'GET', token });
        if (cancelled) return;
        setMyUserId(me.id);
        await loadNetworks();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'خطا در بارگذاری');
      } finally {
        if (!cancelled) setLoadingBoot(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadNetworks]);

  useEffect(() => {
    if (memberNetworks.length === 0 && mode === 'network' && !forceCommunityMode) {
      setMode('normal');
      setNetworkId('');
      setSelectedIds([]);
      setSelectedProfiles({});
      setSearch('');
      setSearchHits([]);
    }
  }, [memberNetworks.length, mode, forceCommunityMode]);

  useEffect(() => {
    if (memberNetworks.length === 1 && !networkId && mode === 'network') {
      setNetworkId(memberNetworks[0].id);
    }
  }, [memberNetworks, networkId, mode]);

  useEffect(() => {
    if (!presetNetworkId || mode !== 'network') return;
    if (!memberNetworks.some((n) => n.id === presetNetworkId)) return;
    setNetworkId((prev) => (prev === presetNetworkId ? prev : presetNetworkId));
  }, [presetNetworkId, memberNetworks, mode]);

  useEffect(() => {
    if (!forcedMode) return;
    setMode((prev) => (prev === forcedMode ? prev : forcedMode));
  }, [forcedMode]);

  useEffect(() => {
    if (!forceCommunityMode || memberNetworks.length > 0 || !spaceKey) {
      setSuggestedNetworks([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const token = getAccessToken();
      if (!token) return;
      setLoadingSuggestions(true);
      try {
        const detail = await apiFetch<{ networks?: SuggestedNetworkRow[] }>(
          `discover/spaces/detail/${encodeURIComponent(spaceKey)}?limit=20`,
          { method: 'GET', token },
        );
        if (cancelled) return;
        setSuggestedNetworks(Array.isArray(detail.networks) ? detail.networks : []);
      } catch {
        if (!cancelled) setSuggestedNetworks([]);
      } finally {
        if (!cancelled) setLoadingSuggestions(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [forceCommunityMode, memberNetworks.length, spaceKey]);

  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) {
      setSearchHits([]);
      setSearching(false);
      setMemberSearchError(null);
      return;
    }
    const token = getAccessToken();
    if (!token) {
      setSearchHits([]);
      setSearching(false);
      setMemberSearchError('برای جستجوی اعضا باید وارد شوید.');
      return;
    }

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      void (async () => {
        if (mode === 'network' && !networkId) {
          setSearchHits([]);
          setSearching(false);
          setMemberSearchError('ابتدا یک شبکه انتخاب کنید.');
          return;
        }
        setSearching(true);
        setMemberSearchError(null);
        try {
          const netQ =
            mode === 'network' && networkId
              ? `&networkId=${encodeURIComponent(networkId)}`
              : '';
          const rows = await apiFetch<UserSearchHit[]>(
            `users/search?q=${encodeURIComponent(q)}&limit=30${netQ}`,
            { method: 'GET', token },
          );
          setSearchHits(Array.isArray(rows) ? rows.filter((h) => h.id !== myUserId) : []);
        } catch (e) {
          setSearchHits([]);
          const msg = e instanceof Error ? e.message : 'جستجو انجام نشد';
          setMemberSearchError(msg);
        } finally {
          setSearching(false);
        }
      })();
    }, 320);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [search, myUserId, networkId, mode]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const selectedUserChips = useMemo(
    () =>
      selectedIds
        .map((id) => selectedProfiles[id] ?? searchHits.find((h) => h.id === id))
        .filter(Boolean) as UserSearchHit[],
    [selectedIds, selectedProfiles, searchHits],
  );

  function toggleUser(id: string, hit?: UserSearchHit) {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((x) => x !== id));
      setSelectedProfiles((p) => {
        const next = { ...p };
        delete next[id];
        return next;
      });
    } else {
      setSelectedIds([...selectedIds, id]);
      if (hit) setSelectedProfiles((p) => ({ ...p, [id]: hit }));
    }
  }

  function removeSelected(id: string) {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
    setSelectedProfiles((p) => {
      const next = { ...p };
      delete next[id];
      return next;
    });
  }

  const canNextNormal = selectedIds.length >= 1;
  const canNextNetwork = selectedIds.length >= 1 && !!networkId;
  const canNext = mode === 'normal' ? canNextNormal : canNextNetwork;

  const canCreateNormal =
    groupName.trim().length >= 2 && selectedIds.length >= 1 && !creating && mode === 'normal';
  const canCreateNetwork =
    groupName.trim().length >= 2 &&
    selectedIds.length >= 1 &&
    !!networkId &&
    !creating &&
    mode === 'network';
  const canCreate = mode === 'normal' ? canCreateNormal : canCreateNetwork;

  function setModeAndReset(next: CreateMode) {
    setMode(next);
    setSelectedIds([]);
    setSelectedProfiles({});
    setSearch('');
    setSearchHits([]);
    setMemberSearchError(null);
    setError(null);
    setStep('members');
  }

  function formatMemberSearchFailure(raw: string): string {
    if (raw.includes('active member') || raw.includes('Forbidden')) {
      return 'جستجوی اعضای این شبکه فقط برای اعضای فعال شبکه مجاز است. اگر تازه پیوسته‌اید، صفحه را یک‌بار به‌روز کنید یا شبکه درست را انتخاب کنید.';
    }
    if (raw.includes('Request failed with 403')) {
      return 'دسترسی به جستجوی این شبکه مجاز نیست (احتمالاً عضو فعال این شبکه نیستید).';
    }
    return raw;
  }

  async function handleCreate() {
    if (!canCreate || submitLockRef.current) return;
    const token = getAccessToken();
    if (!token) return;

    submitLockRef.current = true;
    setCreating(true);
    setError(null);
    try {
      const base = {
        name: groupName.trim(),
        description: description.trim() || undefined,
        memberUserIds: [...new Set(selectedIds)],
      };
      const body =
        mode === 'network' && networkId
          ? { ...base, networkId, type: 'COMMUNITY' as const }
          : { ...base, type: 'CHAT' as const };

      const created = await apiFetch<{ id: string }>('groups', {
        method: 'POST',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const targetReturn =
        returnTo === 'direct' || returnTo === 'spaces' || returnTo === 'groups' || returnTo === 'network'
          ? returnTo
          : mode === 'normal'
            ? 'direct'
            : 'groups';
      router.replace(`/groups/${created.id}?created=1&returnTo=${encodeURIComponent(targetReturn)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ساخت گروه انجام نشد');
    } finally {
      setCreating(false);
      submitLockRef.current = false;
    }
  }

  async function joinSuggestedNetwork(networkIdToJoin: string) {
    const token = getAccessToken();
    if (!token) return;
    setJoiningSuggestionId(networkIdToJoin);
    setError(null);
    try {
      await apiFetch(`networks/${networkIdToJoin}/join`, { method: 'POST', token });
      await loadNetworks();
      setNetworkId(networkIdToJoin);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'پیوستن به شبکه ممکن نیست');
    } finally {
      setJoiningSuggestionId(null);
    }
  }

  async function createFirstNetworkInline() {
    const token = getAccessToken();
    const name = newNetworkName.trim();
    if (!token || !name || name.length < 2) return;
    setNetworkCreating(true);
    setError(null);
    try {
      const created = await apiFetch<{ id: string; name: string }>('networks', {
        method: 'POST',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: newNetworkDescription.trim() || undefined,
          visibility: 'PUBLIC',
          spaceCategory: resolveSpaceCategoryForNetwork(spaceKey),
        }),
      });
      await loadNetworks();
      setNetworkId(created.id);
      setCreateNetworkOpen(false);
      setNewNetworkName('');
      setNewNetworkDescription('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ساخت شبکه انجام نشد');
    } finally {
      setNetworkCreating(false);
    }
  }

  const backHref =
    returnTo === 'direct'
      ? '/direct'
      : returnTo === 'spaces'
        ? '/spaces'
        : returnTo === 'network'
          ? '/spaces'
          : '/groups';

  if (loadingBoot) {
    return (
      <AuthGate>
        <main className="mx-auto min-h-[50vh] w-full max-w-md px-4 py-10 text-center text-sm text-stone-600" dir="rtl">
          در حال بارگذاری…
        </main>
      </AuthGate>
    );
  }

  return (
    <AuthGate>
      <main className="mx-auto min-h-[60vh] w-full max-w-md bg-stone-100/90 pb-24" dir="rtl">
        <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-stone-200/80 bg-stone-50/95 px-3 py-2.5 backdrop-blur-sm">
          <Link
            href={backHref}
            className="flex h-10 min-w-[2.5rem] items-center justify-center rounded-full text-stone-600 hover:bg-stone-200/80"
            aria-label="بازگشت"
          >
            ←
          </Link>
          <h1 className="min-w-0 flex-1 text-sm font-bold text-stone-800">
            {step === 'members'
              ? mode === 'normal'
                ? 'ایجاد گروه چت — اعضا'
                : isStudyPreset
                  ? 'Study Group — اعضا'
                  : isClassPreset
                    ? 'Class Community — اعضا'
                  : isHiringPreset
                    ? 'Hiring Group — اعضا'
                    : isStartupPreset
                      ? 'Startup Community — اعضا'
                      : isFreelancePreset
                        ? 'Freelance Network — اعضا'
                        : isFanPreset
                          ? 'Fan Group — اعضا'
                          : isTeamPreset
                            ? 'Team Community — اعضا'
                            : isFitnessPreset
                              ? 'Fitness Circle — اعضا'
                    : 'ایجاد گروه اجتماعی — اعضا'
              : mode === 'normal'
                ? 'ایجاد گروه چت — جزئیات'
                : isStudyPreset
                  ? 'Study Group — جزئیات'
                  : isClassPreset
                    ? 'Class Community — جزئیات'
                    : isHiringPreset
                      ? 'Hiring Group — جزئیات'
                      : isStartupPreset
                        ? 'Startup Community — جزئیات'
                        : isFreelancePreset
                          ? 'Freelance Network — جزئیات'
                          : isFanPreset
                            ? 'Fan Group — جزئیات'
                            : isTeamPreset
                              ? 'Team Community — جزئیات'
                              : isFitnessPreset
                                ? 'Fitness Circle — جزئیات'
                    : 'ایجاد گروه اجتماعی — جزئیات'}
          </h1>
        </header>

        {step === 'members' && memberNetworks.length > 0 && !forcedMode ? (
          <div className="mx-3 mt-3 flex gap-1 rounded-xl border border-stone-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setModeAndReset('normal')}
              className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
                mode === 'normal' ? 'bg-emerald-500 text-white shadow-sm' : 'text-stone-600'
              }`}
            >
              گروه چت
            </button>
            <button
              type="button"
              onClick={() => setModeAndReset('network')}
              className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
                mode === 'network' ? 'bg-sky-600 text-white shadow-sm' : 'text-stone-600'
              }`}
            >
              گروه اجتماعی شبکه
            </button>
          </div>
        ) : null}

        <div className="mx-3 mt-3 rounded-xl border border-stone-200 bg-white px-3 py-2 text-[11px] text-stone-600">
          {mode === 'normal'
            ? 'گروه چت برای گفتگوی خصوصی چندنفره است و در فضاهای عمومی نمایش داده نمی‌شود.'
            : isStudyPreset
              ? 'Study Group برای یادگیری همتا، بحث درسی و آمادگی آزمون است.'
              : isClassPreset
                ? 'Class Community برای دانشجویان یک کلاس/درس و هماهنگی متمرکز است.'
                : isHiringPreset
                  ? 'Hiring Group برای فرصت‌های شغلی، جذب نیرو، ارجاع و گفتگوهای استخدامی است.'
                  : isStartupPreset
                    ? 'Startup Community برای بنیان‌گذارها و سازنده‌ها جهت شبکه‌سازی و رشد است.'
                    : isFreelancePreset
                      ? 'Freelance Network برای پروژه‌ها، لید مشتری و همکاری حرفه‌ای است.'
                  : isFanPreset
                    ? 'Fan Group برای اجتماع هواداران تیم/باشگاه/بازیکن است.'
                    : isTeamPreset
                      ? 'Team Community برای تیم‌های واقعی، باشگاه‌های آماتور و اسکادها است.'
                      : isFitnessPreset
                        ? 'Fitness Circle برای دویدن، باشگاه، دوچرخه‌سواری و تمرین گروهی است.'
                : 'گروه اجتماعی برای جامعه و فضا/شبکه است و در سطوح اجتماعی قابل کشف است.'}
        </div>

        {step === 'members' && mode === 'normal' ? (
          <div className="px-3 pt-3">
            <p className="mb-2 text-[11px] leading-relaxed text-stone-600">
              حداقل یک نفر را برای شروع گروه چت انتخاب کنید (بدون شبکه). نام، نام کاربری، ایمیل یا بخشی از شماره موبایل را
              جستجو کنید (حداقل ۲ نویسه).
            </p>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجو…"
              className="mb-3 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              autoComplete="off"
            />

            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-stone-600">انتخاب‌شده: {selectedIds.length}</span>
              {selectedUserChips.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => removeSelected(u.id)}
                  className="inline-flex max-w-full items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-900"
                >
                  <span className="truncate">{u.name}</span>
                  <span aria-hidden>×</span>
                </button>
              ))}
            </div>

            {error ? (
              <p className="mb-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800">
                {error}
              </p>
            ) : null}

            <div className="mb-2 max-h-64 overflow-y-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
              {search.trim().length < 2 ? (
                <p className="px-3 py-6 text-center text-sm text-stone-500">حداقل ۲ نویسه برای جستجو وارد کنید.</p>
              ) : searching ? (
                <p className="px-3 py-6 text-center text-sm text-stone-500">در حال جستجو…</p>
              ) : memberSearchError ? (
                <p className="px-3 py-6 text-center text-sm font-semibold text-red-800">
                  {formatMemberSearchFailure(memberSearchError)}
                </p>
              ) : searchHits.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-stone-500">نتیجه‌ای یافت نشد.</p>
              ) : (
                <ul className="divide-y divide-stone-100">
                  {searchHits.map((hit) => {
                    const on = selectedSet.has(hit.id);
                    return (
                      <li key={hit.id}>
                        <button
                          type="button"
                          onClick={() => toggleUser(hit.id, hit)}
                          className={`flex w-full items-center gap-3 px-3 py-3 text-right transition ${
                            on ? 'bg-emerald-50' : 'hover:bg-stone-50'
                          }`}
                        >
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                              on ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-stone-300 text-transparent'
                            }`}
                            aria-hidden
                          >
                            ✓
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-stone-900">{hit.name}</p>
                            <p className="truncate text-[11px] text-stone-500" dir="ltr">
                              @{hit.username} · {hit.phoneMasked}
                            </p>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="sticky bottom-0 mt-4 bg-stone-100/95 py-2 backdrop-blur-sm">
              <button
                type="button"
                disabled={!canNext}
                onClick={() => {
                  setError(null);
                  setStep('details');
                }}
                className="w-full rounded-2xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-md shadow-emerald-800/20 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                بعدی
              </button>
            </div>
          </div>
        ) : null}

        {step === 'members' && mode === 'network' ? (
          <div className="px-3 pt-3">
            {memberNetworks.length === 0 ? (
              <div className="mb-3 space-y-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <p className="font-semibold">
                  {isNeighborhoodFlow
                    ? 'برای گروه اجتماعی محله، ابتدا باید یک شبکه محله داشته باشید.'
                    : 'برای ساخت گروه اجتماعی ابتدا یک شبکه مرتبط انتخاب یا به آن بپیوندید.'}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link href="/spaces" className="rounded-lg bg-white px-2.5 py-1.5 font-extrabold text-amber-900">
                    مشاهده فضاها
                  </Link>
                  <button
                    type="button"
                    onClick={() => setCreateNetworkOpen(true)}
                    className="rounded-lg bg-amber-600 px-2.5 py-1.5 font-extrabold text-white"
                  >
                    ایجاد اولین شبکه
                  </button>
                </div>
                {loadingSuggestions ? (
                  <p className="text-[11px] text-amber-700">در حال دریافت شبکه‌های مرتبط…</p>
                ) : suggestedNetworks.length > 0 ? (
                  <div className="space-y-1 rounded-lg border border-amber-200/80 bg-white/70 p-2">
                    <p className="text-[11px] font-bold text-amber-900">شبکه‌های پیشنهادی این فضا:</p>
                    {suggestedNetworks.slice(0, 5).map((n) => (
                      <div key={n.id} className="flex items-center justify-between gap-2">
                        <span className="truncate text-[11px] text-amber-900">{n.name}</span>
                        <button
                          type="button"
                          disabled={joiningSuggestionId === n.id}
                          onClick={() => void joinSuggestedNetwork(n.id)}
                          className="shrink-0 rounded-lg bg-amber-600 px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-50"
                        >
                          {joiningSuggestionId === n.id ? '…' : 'پیوستن'}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-amber-700">
                    هنوز شبکه‌ای برای این فضا ساخته نشده؛ اولین شبکه را همین‌جا ایجاد کنید.
                  </p>
                )}
              </div>
            ) : null}
            {memberNetworks.length > 1 ? (
              <label className="mb-3 block">
                <span className="mb-1 block text-[11px] font-bold text-stone-500">شبکه</span>
                <select
                  value={networkId}
                  onChange={(e) => {
                    setNetworkId(e.target.value);
                    setSelectedIds([]);
                    setSelectedProfiles({});
                    setSearch('');
                    setSearchHits([]);
                    setMemberSearchError(null);
                  }}
                  className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                >
                  <option value="">انتخاب شبکه…</option>
                  {memberNetworks.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <p className="mb-2 text-[11px] leading-relaxed text-stone-600">
              {isStudyPreset
                ? 'هم‌گروهی‌های مطالعه را از اعضای فعال همین شبکه آموزشی انتخاب کنید (حداقل ۲ نویسه).'
                : isClassPreset
                  ? 'اعضای کلاس را از اعضای فعال همین شبکه آموزشی انتخاب کنید (حداقل ۲ نویسه).'
                  : isHiringPreset
                    ? 'اعضای حرفه‌ای مرتبط با جذب نیرو را از اعضای فعال شبکه انتخاب کنید (حداقل ۲ نویسه).'
                    : isStartupPreset
                      ? 'بنیان‌گذارها و همکارهای سازنده را از اعضای فعال شبکه انتخاب کنید (حداقل ۲ نویسه).'
                      : isFreelancePreset
                        ? 'اعضای فریلنسر و همکارهای پروژه‌ای را از اعضای فعال شبکه انتخاب کنید (حداقل ۲ نویسه).'
                        : isFanPreset
                          ? 'هواداران فعال را از اعضای شبکه انتخاب کنید تا اجتماع طرفداری شکل بگیرد (حداقل ۲ نویسه).'
                          : isTeamPreset
                            ? 'اعضای تیم/باشگاه را از شبکه انتخاب کنید تا Team Community منسجم بسازید (حداقل ۲ نویسه).'
                            : isFitnessPreset
                              ? 'هم‌تمرینی‌ها را از اعضای شبکه انتخاب کنید (دویدن، باشگاه، دوچرخه) (حداقل ۲ نویسه).'
                  : 'اعضای فعال این شبکه را با نام، نام کاربری، ایمیل یا بخشی از شماره موبایل جستجو کنید (حداقل ۲ نویسه) — همان رفتار جستجوی گفتگوی جدید.'}
            </p>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجو…"
              disabled={!networkId}
              className="mb-3 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 disabled:opacity-50"
              autoComplete="off"
            />

            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-stone-600">انتخاب‌شده: {selectedIds.length}</span>
              {selectedUserChips.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => removeSelected(u.id)}
                  className="inline-flex max-w-full items-center gap-1 rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-bold text-sky-900"
                >
                  <span className="truncate">{u.name}</span>
                  <span aria-hidden>×</span>
                </button>
              ))}
            </div>

            {error ? (
              <p className="mb-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800">
                {error}
              </p>
            ) : null}

            {!networkId ? (
              <p className="py-8 text-center text-sm text-stone-500">یک شبکه انتخاب کنید.</p>
            ) : (
              <div className="mb-2 max-h-64 overflow-y-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
                {search.trim().length < 2 ? (
                  <p className="px-3 py-6 text-center text-sm text-stone-500">حداقل ۲ نویسه برای جستجو وارد کنید.</p>
                ) : searching ? (
                  <p className="px-3 py-6 text-center text-sm text-stone-500">در حال جستجو…</p>
                ) : memberSearchError ? (
                  <p className="px-3 py-6 text-center text-sm font-semibold text-red-800">
                    {formatMemberSearchFailure(memberSearchError)}
                  </p>
                ) : searchHits.length === 0 ? (
                  <p className="px-3 py-6 text-center text-sm text-stone-500">
                    نتیجه‌ای یافت نشد. فقط اعضای فعال این شبکه در این فهرست می‌آیند؛ اگر عضو دیگری در شبکه نیست، کسی نمایش داده
                    نمی‌شود.
                  </p>
                ) : (
                  <ul className="divide-y divide-stone-100">
                    {searchHits.map((hit) => {
                      const on = selectedSet.has(hit.id);
                      return (
                        <li key={hit.id}>
                          <button
                            type="button"
                            onClick={() => toggleUser(hit.id, hit)}
                            className={`flex w-full items-center gap-3 px-3 py-3 text-right transition ${
                              on ? 'bg-sky-50' : 'hover:bg-stone-50'
                            }`}
                          >
                            <span
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                                on ? 'border-sky-500 bg-sky-500 text-white' : 'border-stone-300 text-transparent'
                              }`}
                              aria-hidden
                            >
                              ✓
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold text-stone-900">{hit.name}</p>
                              <p className="truncate text-[11px] text-stone-500" dir="ltr">
                                @{hit.username} · {hit.phoneMasked}
                              </p>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            <div className="sticky bottom-0 mt-4 bg-stone-100/95 py-2 backdrop-blur-sm">
              <button
                type="button"
                disabled={!canNext}
                onClick={() => {
                  setError(null);
                  setStep('details');
                }}
                className="w-full rounded-2xl bg-sky-600 py-3 text-sm font-bold text-white shadow-md shadow-sky-700/20 transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                بعدی
              </button>
            </div>
          </div>
        ) : null}

        {step === 'details' ? (
          <div className="px-3 pt-3">
            <button
              type="button"
              onClick={() => setStep('members')}
              className="mb-3 text-xs font-bold text-sky-700 underline"
            >
              ← بازگشت به انتخاب اعضا
            </button>

            <p className="mb-2 text-[11px] font-bold text-stone-500">
              {selectedIds.length} عضو به‌اضافهٔ شما
              {mode === 'normal' ? ' · گروه چت خصوصی' : ' · گروه اجتماعی شبکه'}
            </p>

            <label className="mb-3 block">
              <span className="mb-1 block text-[11px] font-bold text-stone-500">نام گروه (الزامی)</span>
              <input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder={
                  mode === 'normal'
                    ? 'مثلاً برنامه سفر دوستان'
                    : isStudyPreset
                      ? 'مثلاً Exam Prep Group'
                      : isClassPreset
                        ? 'مثلاً Class Community - فیزیک ۱'
                        : isHiringPreset
                          ? 'مثلاً Product Hiring Group'
                          : isStartupPreset
                            ? 'مثلاً Startup Builders Community'
                            : isFreelancePreset
                              ? 'مثلاً Freelance Opportunities Network'
                              : isFanPreset
                                ? 'مثلاً Persepolis Fan Group'
                                : isTeamPreset
                                  ? 'مثلاً Team Community - Runners Club'
                                  : isFitnessPreset
                                    ? 'مثلاً Morning Fitness Circle'
                              : 'مثلاً جامعه آموزش برنامه‌نویسی'
                }
                minLength={2}
                maxLength={100}
                className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
            </label>

            <label className="mb-3 block">
              <span className="mb-1 block text-[11px] font-bold text-stone-500">توضیحات (اختیاری)</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  isStudyPreset
                    ? 'Peer learning and discussion (اختیاری)'
                    : isClassPreset
                      ? 'Students of one course/class (اختیاری)'
                      : isHiringPreset
                        ? 'Recruiting, openings, referrals (اختیاری)'
                        : isStartupPreset
                          ? 'Founders, builders, growth (اختیاری)'
                          : isFreelancePreset
                            ? 'Gigs, projects, collaboration (اختیاری)'
                            : isFanPreset
                              ? 'Supporters, match chat, fan updates (اختیاری)'
                              : isTeamPreset
                                ? 'Team lineup, training, match plans (اختیاری)'
                                : isFitnessPreset
                                  ? 'Running, gym, cycling buddies (اختیاری)'
                      : 'اختیاری'
                }
                rows={3}
                maxLength={500}
                className="w-full resize-none rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
            </label>

            {error ? (
              <p className="mb-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800">
                {error}
              </p>
            ) : null}

            <button
              type="button"
              disabled={!canCreate}
              onClick={() => void handleCreate()}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-md shadow-emerald-800/20 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {creating ? (
                'در حال ساخت…'
              ) : (
                <>
                  <IconPlus className="h-5 w-5 stroke-[2.5]" />
                  {mode === 'normal'
                    ? 'ساخت گروه چت'
                    : isStudyPreset
                      ? 'ساخت Study Group'
                      : isClassPreset
                        ? 'ساخت Class Community'
                        : isHiringPreset
                          ? 'ساخت Hiring Group'
                          : isStartupPreset
                            ? 'ساخت Startup Community'
                            : isFreelancePreset
                              ? 'ساخت Freelance Network'
                              : isFanPreset
                                ? 'ساخت Fan Group'
                                : isTeamPreset
                                  ? 'ساخت Team Community'
                                  : isFitnessPreset
                                    ? 'ساخت Fitness Circle'
                        : 'ساخت گروه اجتماعی'}
                </>
              )}
            </button>
          </div>
        ) : null}
      </main>

      {createNetworkOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-3" dir="rtl">
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900">ایجاد اولین شبکه</h3>
              <button
                type="button"
                onClick={() => setCreateNetworkOpen(false)}
                className="rounded-full px-2 py-1 text-xs font-bold text-slate-500 hover:bg-slate-100"
              >
                بستن
              </button>
            </div>
            <p className="mb-3 text-xs text-slate-500">
              شبکه را بسازید تا بلافاصله بتوانید گروه اجتماعی همین مسیر را ایجاد کنید.
            </p>
            <label className="mb-2 block">
              <span className="mb-1 block text-[11px] font-bold text-slate-600">نام شبکه</span>
              <input
                value={newNetworkName}
                onChange={(e) => setNewNetworkName(e.target.value)}
                placeholder={isNeighborhoodFlow ? 'مثلاً محله نارمک' : 'مثلاً شبکه برنامه‌نویسان'}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
            </label>
            <label className="mb-3 block">
              <span className="mb-1 block text-[11px] font-bold text-slate-600">توضیح کوتاه (اختیاری)</span>
              <textarea
                value={newNetworkDescription}
                onChange={(e) => setNewNetworkDescription(e.target.value)}
                rows={2}
                maxLength={500}
                className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
            </label>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreateNetworkOpen(false)}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={networkCreating || newNetworkName.trim().length < 2}
                onClick={() => void createFirstNetworkInline()}
                className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
              >
                {networkCreating ? 'در حال ایجاد...' : 'ایجاد شبکه'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AuthGate>
  );
}

export default function CreateGroupPage() {
  return (
    <Suspense
      fallback={
        <AuthGate>
          <main className="mx-auto min-h-[50vh] w-full max-w-md px-4 py-10 text-center text-sm text-stone-600" dir="rtl">
            در حال بارگذاری…
          </main>
        </AuthGate>
      }
    >
      <CreateGroupPageInner />
    </Suspense>
  );
}

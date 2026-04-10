'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AuthGate } from '@/components/AuthGate';
import { IconPlus } from '@/components/MessagingTabIcons';
import { getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';

/** `normal` = no scope; `network` = optional higher-level scope (future: space). */
type GroupScopeMode = 'normal' | 'network';

type Step = 'scope' | 'members' | 'details';

type NetworkRow = {
  id: string;
  name: string;
  isMember?: boolean;
};

type NetMember = {
  user: { id: string; name: string; avatar: string | null; email: string };
};

type UserSearchHit = {
  id: string;
  name: string;
  username: string;
  phoneMasked: string;
};

export default function CreateGroupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('scope');
  const [scopeMode, setScopeMode] = useState<GroupScopeMode>('normal');
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [networks, setNetworks] = useState<NetworkRow[]>([]);
  const [networkId, setNetworkId] = useState<string>('');
  const [members, setMembers] = useState<NetMember[]>([]);
  const [search, setSearch] = useState('');
  const [searchHits, setSearchHits] = useState<UserSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  /** Normal mode: names for chips when hits list no longer contains the user. */
  const [pickedNames, setPickedNames] = useState<Record<string, string>>({});
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [loadingBoot, setLoadingBoot] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitLockRef = useRef(false);

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
    if (scopeMode !== 'network' || !networkId || !myUserId) {
      if (scopeMode !== 'network') setMembers([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const token = getAccessToken();
      if (!token) return;
      setLoadingMembers(true);
      try {
        const rows = await apiFetch<NetMember[]>(`networks/${networkId}/members`, {
          method: 'GET',
          token,
        });
        if (cancelled) return;
        setMembers(Array.isArray(rows) ? rows : []);
      } catch {
        if (!cancelled) setMembers([]);
      } finally {
        if (!cancelled) setLoadingMembers(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scopeMode, networkId, myUserId]);

  useEffect(() => {
    if (scopeMode !== 'normal' || step !== 'members') {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      return;
    }

    const q = search.trim();
    if (q.length < 2) {
      setSearchHits([]);
      setSearching(false);
      return;
    }

    searchDebounceRef.current = setTimeout(async () => {
      const token = getAccessToken();
      if (!token) return;
      setSearching(true);
      try {
        const hits = await apiFetch<UserSearchHit[]>(
          `users/search?q=${encodeURIComponent(q)}&limit=30`,
          { method: 'GET', token },
        );
        setSearchHits(Array.isArray(hits) ? hits : []);
      } catch {
        setSearchHits([]);
      } finally {
        setSearching(false);
      }
    }, 320);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [search, scopeMode, step]);

  const others = useMemo(
    () => members.filter((m) => m.user?.id && m.user.id !== myUserId),
    [members, myUserId],
  );

  const filteredNet = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return others;
    return others.filter((m) => {
      const name = (m.user.name ?? '').toLowerCase();
      const email = (m.user.email ?? '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [others, search]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  function toggleUser(id: string, displayName?: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        if (scopeMode === 'normal') {
          setPickedNames((n) => {
            const next = { ...n };
            delete next[id];
            return next;
          });
        }
        return prev.filter((x) => x !== id);
      }
      if (scopeMode === 'normal' && displayName) {
        setPickedNames((n) => ({ ...n, [id]: displayName }));
      }
      return [...prev, id];
    });
  }

  function removeSelected(id: string) {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
    setPickedNames((n) => {
      const next = { ...n };
      delete next[id];
      return next;
    });
  }

  const selectedChips = useMemo(() => {
    return selectedIds
      .map((id) => {
        if (scopeMode === 'normal') {
          const h = searchHits.find((x) => x.id === id);
          const name = h?.name ?? pickedNames[id] ?? 'کاربر';
          return { id, name };
        }
        const u = others.find((m) => m.user.id === id)?.user;
        return u ? { id, name: u.name } : null;
      })
      .filter(Boolean) as { id: string; name: string }[];
  }, [scopeMode, selectedIds, searchHits, others, pickedNames]);

  const canNextMembers =
    selectedIds.length >= 1 &&
    (scopeMode === 'normal' || (networkId !== '' && !loadingMembers));

  const canCreate =
    groupName.trim().length >= 2 && selectedIds.length >= 1 && !creating &&
    (scopeMode === 'normal' || networkId !== '');

  async function handleCreate() {
    if (!canCreate || submitLockRef.current) return;
    const token = getAccessToken();
    if (!token) return;

    submitLockRef.current = true;
    setCreating(true);
    setError(null);
    try {
      const body: {
        name: string;
        description?: string;
        memberUserIds: string[];
        networkId?: string;
      } = {
        name: groupName.trim(),
        memberUserIds: [...new Set(selectedIds)],
      };
      const desc = description.trim();
      if (desc) body.description = desc;
      if (scopeMode === 'network' && networkId) body.networkId = networkId;

      const created = await apiFetch<{ id: string }>('groups', {
        method: 'POST',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      router.replace(`/groups/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ساخت گروه انجام نشد');
    } finally {
      setCreating(false);
      submitLockRef.current = false;
    }
  }

  function goNormalFlow() {
    setScopeMode('normal');
    setNetworkId('');
    setSelectedIds([]);
    setPickedNames({});
    setSearch('');
    setSearchHits([]);
    setMembers([]);
    setError(null);
    setStep('members');
  }

  function goNetworkFlow() {
    setScopeMode('network');
    setSelectedIds([]);
    setPickedNames({});
    setSearch('');
    setSearchHits([]);
    setError(null);
    setStep('members');
    if (memberNetworks.length === 1) {
      setNetworkId(memberNetworks[0].id);
    } else {
      setNetworkId('');
    }
  }

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
            href="/direct"
            className="flex h-10 min-w-[2.5rem] items-center justify-center rounded-full text-stone-600 hover:bg-stone-200/80"
            aria-label="بازگشت"
          >
            ←
          </Link>
          <h1 className="min-w-0 flex-1 text-sm font-bold text-stone-800">
            {step === 'scope'
              ? 'گروه جدید'
              : step === 'members'
                ? scopeMode === 'normal'
                  ? 'انتخاب اعضا'
                  : 'انتخاب اعضا (شبکه)'
                : 'جزئیات گروه'}
          </h1>
        </header>

        {step === 'scope' ? (
          <div className="space-y-3 px-4 pt-6">
            <p className="text-sm text-stone-600">نوع گروه را انتخاب کنید.</p>
            <button
              type="button"
              onClick={() => goNormalFlow()}
              className="w-full rounded-2xl border border-emerald-200 bg-emerald-50 py-4 text-sm font-bold text-emerald-900 shadow-sm transition hover:bg-emerald-100"
            >
              گروه معمولی
            </button>
            <p className="text-[11px] text-stone-500">
              بدون نیاز به شبکه؛ اعضا را از میان کاربران جستجو می‌کنید.
            </p>
            {memberNetworks.length > 0 ? (
              <>
                <button
                  type="button"
                  onClick={() => goNetworkFlow()}
                  className="mt-4 w-full rounded-2xl border border-sky-200 bg-sky-50 py-4 text-sm font-bold text-sky-900 shadow-sm transition hover:bg-sky-100"
                >
                  گروه مرتبط با شبکه
                </button>
                <p className="text-[11px] text-stone-500">
                  فقط اعضای همان شبکه قابل افزودن هستند.
                </p>
              </>
            ) : null}
            {error ? (
              <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800">
                {error}
              </p>
            ) : null}
          </div>
        ) : step === 'members' ? (
          <div className="px-3 pt-3">
            <button
              type="button"
              onClick={() => {
                setStep('scope');
                setSelectedIds([]);
                setPickedNames({});
                setError(null);
              }}
              className="mb-3 text-xs font-bold text-sky-700 underline"
            >
              ← تغییر نوع گروه
            </button>

            {scopeMode === 'network' && memberNetworks.length > 1 ? (
              <label className="mb-3 block">
                <span className="mb-1 block text-[11px] font-bold text-stone-500">شبکه</span>
                <select
                  value={networkId}
                  onChange={(e) => {
                    setNetworkId(e.target.value);
                    setSelectedIds([]);
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

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={scopeMode === 'normal' ? 'جستجوی نام یا نام کاربری… (حداقل ۲ نویسه)' : 'فیلتر نام یا ایمیل…'}
              disabled={scopeMode === 'network' && !networkId}
              className="mb-3 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 disabled:opacity-50"
              autoComplete="off"
            />

            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-stone-600">انتخاب‌شده: {selectedIds.length}</span>
              {selectedChips.map((u) => (
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

            {scopeMode === 'normal' ? (
              <>
                {search.trim().length < 2 ? (
                  <p className="py-6 text-center text-sm text-stone-500">حداقل ۲ نویسه برای جستجو وارد کنید.</p>
                ) : searching ? (
                  <p className="py-8 text-center text-sm text-stone-500">در حال جستجو…</p>
                ) : searchHits.length === 0 ? (
                  <p className="py-8 text-center text-sm text-stone-500">نتیجه‌ای یافت نشد.</p>
                ) : (
                  <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
                    {searchHits.map((hit) => {
                      const on = selectedSet.has(hit.id);
                      return (
                        <li key={hit.id}>
                          <button
                            type="button"
                            onClick={() => toggleUser(hit.id, hit.name)}
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
              </>
            ) : !networkId ? (
              <p className="py-8 text-center text-sm text-stone-500">یک شبکه انتخاب کنید.</p>
            ) : loadingMembers ? (
              <p className="py-8 text-center text-sm text-stone-500">در حال بارگذاری اعضا…</p>
            ) : filteredNet.length === 0 ? (
              <p className="py-8 text-center text-sm text-stone-500">
                {others.length === 0
                  ? 'عضو دیگری در این شبکه نیست.'
                  : 'نتیجه‌ای یافت نشد.'}
              </p>
            ) : (
              <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
                {filteredNet.map((m) => {
                  const u = m.user;
                  const on = selectedSet.has(u.id);
                  return (
                    <li key={u.id}>
                      <button
                        type="button"
                        onClick={() => toggleUser(u.id, u.name)}
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
                          <p className="truncate text-sm font-bold text-stone-900">{u.name}</p>
                          <p className="truncate text-[11px] text-stone-500">{u.email}</p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="sticky bottom-0 mt-4 bg-stone-100/95 py-2 backdrop-blur-sm">
              <button
                type="button"
                disabled={!canNextMembers}
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
        ) : (
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
              {scopeMode === 'network' && networkId ? (
                <span className="mr-2 text-stone-400">
                  ·{' '}
                  {memberNetworks.find((n) => n.id === networkId)?.name ?? 'شبکه'}
                </span>
              ) : null}
            </p>

            <label className="mb-3 block">
              <span className="mb-1 block text-[11px] font-bold text-stone-500">نام گروه (الزامی)</span>
              <input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="مثلاً خانواده"
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
                placeholder="اختیاری"
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
                  ساخت گروه
                </>
              )}
            </button>
          </div>
        )}
      </main>
    </AuthGate>
  );
}

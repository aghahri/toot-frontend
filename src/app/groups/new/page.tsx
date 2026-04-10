'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AuthGate } from '@/components/AuthGate';
import { IconPlus } from '@/components/MessagingTabIcons';
import { getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';

type NetworkRow = {
  id: string;
  name: string;
  isMember?: boolean;
};

type NetMember = {
  user: { id: string; name: string; avatar: string | null; email: string };
};

type Step = 'members' | 'details';

export default function CreateGroupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('members');
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [networks, setNetworks] = useState<NetworkRow[]>([]);
  const [networkId, setNetworkId] = useState<string>('');
  const [members, setMembers] = useState<NetMember[]>([]);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
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
    if (memberNetworks.length === 1 && !networkId) {
      setNetworkId(memberNetworks[0].id);
    }
  }, [memberNetworks, networkId]);

  useEffect(() => {
    if (!networkId || !myUserId) {
      setMembers([]);
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
  }, [networkId, myUserId]);

  const others = useMemo(
    () => members.filter((m) => m.user?.id && m.user.id !== myUserId),
    [members, myUserId],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return others;
    return others.filter((m) => {
      const name = (m.user.name ?? '').toLowerCase();
      const email = (m.user.email ?? '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [others, search]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  function toggleUser(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function removeSelected(id: string) {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  }

  const selectedUsers = useMemo(
    () => selectedIds.map((id) => others.find((m) => m.user.id === id)?.user).filter(Boolean) as NetMember['user'][],
    [selectedIds, others],
  );

  const canNext = selectedIds.length >= 1 && !!networkId;
  const canCreate =
    groupName.trim().length >= 2 && selectedIds.length >= 1 && !!networkId && !creating;

  async function handleCreate() {
    if (!canCreate || submitLockRef.current) return;
    const token = getAccessToken();
    if (!token || !networkId) return;

    submitLockRef.current = true;
    setCreating(true);
    setError(null);
    try {
      const body = {
        name: groupName.trim(),
        description: description.trim() || undefined,
        networkId,
        memberUserIds: [...new Set(selectedIds)],
      };
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
            href="/groups"
            className="flex h-10 min-w-[2.5rem] items-center justify-center rounded-full text-stone-600 hover:bg-stone-200/80"
            aria-label="بازگشت"
          >
            ←
          </Link>
          <h1 className="min-w-0 flex-1 text-sm font-bold text-stone-800">
            {step === 'members' ? 'گروه جدید — اعضا' : 'گروه جدید — جزئیات'}
          </h1>
        </header>

        {memberNetworks.length === 0 ? (
          <div className="mx-4 mt-8 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-6 text-center">
            <p className="text-sm font-bold text-amber-900">ابتدا به یک شبکه بپیوندید</p>
            <p className="mt-2 text-xs text-amber-800/90">
              برای ساخت گروه باید عضو حداقل یک شبکه باشید.
            </p>
            <Link
              href="/spaces"
              className="mt-4 inline-block rounded-full bg-amber-600 px-4 py-2 text-sm font-bold text-white"
            >
              رفتن به فضاها
            </Link>
          </div>
        ) : step === 'members' ? (
          <div className="px-3 pt-3">
            {memberNetworks.length > 1 ? (
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
              placeholder="جستجوی نام یا ایمیل…"
              disabled={!networkId}
              className="mb-3 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 disabled:opacity-50"
              autoComplete="off"
            />

            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-stone-600">
                انتخاب‌شده: {selectedIds.length}
              </span>
              {selectedUsers.map((u) => (
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
            ) : loadingMembers ? (
              <p className="py-8 text-center text-sm text-stone-500">در حال بارگذاری اعضا…</p>
            ) : filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-stone-500">
                {others.length === 0
                  ? 'عضو دیگری در این شبکه نیست. دیگران باید ابتدا به شبکه بپیوندند.'
                  : 'نتیجه‌ای یافت نشد.'}
              </p>
            ) : (
              <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
                {filtered.map((m) => {
                  const u = m.user;
                  const on = selectedSet.has(u.id);
                  return (
                    <li key={u.id}>
                      <button
                        type="button"
                        onClick={() => toggleUser(u.id)}
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

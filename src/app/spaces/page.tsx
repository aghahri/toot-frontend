'use client';

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AuthGate } from '@/components/AuthGate';
import { getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { USER_SPACE_KEYS, USER_SPACE_META, type UserSpaceKey } from '@/lib/user-spaces';
import { SPACE_BLUEPRINTS, capabilityStageLabel } from '@/lib/spacesBlueprint';

type SpacePrefsResponse = { preferredSpaces: UserSpaceKey[] };
type SuggestionBlock = {
  key: UserSpaceKey;
  title: string;
  networks: Array<{ id: string; name: string; description: string | null }>;
  groups: Array<{ id: string; name: string; description: string | null; networkId: string | null }>;
  channels: Array<{ id: string; name: string; description: string | null; networkId: string }>;
};
type PersonalizedResponse = {
  preferredSpaces: UserSpaceKey[];
  suggestions: SuggestionBlock[];
};

const SPACE_DETAIL_MAP: Partial<Record<UserSpaceKey, string>> = {
  neighborhood: 'NEIGHBORHOOD',
  education: 'EDUCATION',
  sports: 'SPORT',
  technology: 'TECH',
};

const SECTION_CARD =
  'rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.06)]';
const SUB_CARD = 'rounded-2xl border border-slate-200 bg-slate-50 p-3.5';
const PRIMARY_CTA =
  'rounded-2xl bg-slate-900 px-4 py-2.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.99]';
const SECONDARY_CTA =
  'rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-extrabold text-slate-700 transition hover:bg-slate-50 active:scale-[0.99]';

export default function SpacesOverviewPage() {
  const STORAGE_KEY = 'toot:spaces-dashboard:v1';
  const DEFAULT_SPACES: UserSpaceKey[] = ['neighborhood', 'education', 'sports', 'business'];
  const MANDATORY_SPACE: UserSpaceKey = 'neighborhood';
  const MIN_SPACES = 2;
  const MAX_SPACES = 4;

  const [preferredSpaces, setPreferredSpaces] = useState<UserSpaceKey[]>([]);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [draftPrefs, setDraftPrefs] = useState<UserSpaceKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [localReady, setLocalReady] = useState(false);

  const normalizeSpaces = (items: UserSpaceKey[]) => {
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
    for (const fallback of DEFAULT_SPACES) {
      if (!next.includes(fallback) && next.length < MIN_SPACES) next.push(fallback);
    }
    return next.slice(0, MAX_SPACES);
  };

  const persistLocal = (spaces: UserSpaceKey[]) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(spaces));
  };

  const loadSpaces = async () => {
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
  };

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
      /* ignore parse failures */
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
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'خطا در بارگذاری فضاها');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [localReady]);

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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ذخیره علایق انجام نشد');
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

  const detailMap: Record<UserSpaceKey, string> = {
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
  const dashboardSpaces = preferredSpaces.slice(0, MAX_SPACES);

  return (
    <AuthGate>
      <main className="mx-auto w-full max-w-lg px-4 pb-12 pt-4 sm:pb-14" dir="rtl">
        <header className="mb-5">
          <h1 className="text-2xl font-black tracking-tight text-slate-900">My Spaces</h1>
          <p className="mt-1 text-sm text-slate-500">اکوسیستم‌های اصلی شما در یک داشبورد ساده.</p>
        </header>

        {loading ? (
          <p className="text-sm text-slate-500">در حال بارگذاری…</p>
        ) : error ? (
          <p className="text-sm font-semibold text-red-700">{error}</p>
        ) : (
          <div className="space-y-6">
            <section className={SECTION_CARD}>
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="text-sm font-extrabold text-slate-900">My Spaces</h2>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-700">
                  {dashboardSpaces.length} از {MAX_SPACES}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {dashboardSpaces.map((k) => (
                  <Link
                    key={k}
                    href={`/spaces/${detailMap[k]}`}
                    className={`${SUB_CARD} block bg-white transition hover:border-slate-300 hover:bg-slate-50`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-extrabold text-slate-900">{USER_SPACE_META[k].labelFa}</p>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${USER_SPACE_META[k].accent}`}>
                        Selected
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">{USER_SPACE_META[k].labelEn}</p>
                    <p className="mt-2 text-xs font-bold text-sky-700">ورود به فضا ←</p>
                  </Link>
                ))}
              </div>
            </section>

            <section className={SECTION_CARD}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-extrabold text-slate-900">Manage Interests</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    بین {MIN_SPACES} تا {MAX_SPACES} فضا انتخاب کنید. محله همیشه فعال است.
                  </p>
                </div>
                <button type="button" onClick={() => setEditOpen(true)} className={PRIMARY_CTA}>
                  Edit My Spaces
                </button>
              </div>
            </section>
          </div>
        )}

        {editOpen ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-3" dir="rtl">
            <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-slate-900">Manage Interests</h3>
                <button type="button" onClick={() => setEditOpen(false)} className={SECONDARY_CTA + ' !rounded-full !px-2.5 !py-1.5 !text-xs !font-bold !border-transparent'}>
                  بستن
                </button>
              </div>
              <p className="mb-3 text-xs text-slate-500">
                حداقل {MIN_SPACES} و حداکثر {MAX_SPACES} فضا. «محله» اجباری است.
              </p>

              <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                <p className="text-[11px] font-bold text-slate-700">ترتیب نمایش</p>
                <ul className="mt-2 space-y-1.5">
                  {draftPrefs.map((k, index) => (
                    <li key={k} className="flex items-center justify-between rounded-lg bg-white px-2.5 py-2 text-xs">
                      <span className="font-bold text-slate-800">{index + 1}. {USER_SPACE_META[k].labelFa}</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={k === MANDATORY_SPACE || index <= 1}
                          onClick={() => moveDraft(k, -1)}
                          className="rounded border border-slate-200 px-2 py-0.5 text-slate-600 disabled:opacity-40"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={k === MANDATORY_SPACE || index >= draftPrefs.length - 1}
                          onClick={() => moveDraft(k, 1)}
                          className="rounded border border-slate-200 px-2 py-0.5 text-slate-600 disabled:opacity-40"
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
                        selected ? `${USER_SPACE_META[k].accent} ring-2` : 'bg-slate-50 text-slate-700 ring-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span className="ms-1" aria-hidden>{USER_SPACE_META[k].emoji}</span>
                      {USER_SPACE_META[k].labelFa}
                      {blocked ? ' (اجباری)' : ''}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 flex items-center justify-end gap-2">
                <button type="button" onClick={() => setEditOpen(false)} className={SECONDARY_CTA + ' !rounded-full !px-3.5 !py-2'}>
                  انصراف
                </button>
                <button
                  type="button"
                  disabled={prefsSaving || draftPrefs.length < MIN_SPACES || draftPrefs.length > MAX_SPACES}
                  onClick={() => void savePreferredSpaces()}
                  className={PRIMARY_CTA + ' !rounded-full !px-3.5 !py-2 disabled:opacity-60'}
                >
                  {prefsSaving ? 'در حال ذخیره...' : 'ذخیره'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </AuthGate>
  );
}

const SpacesModelSection = memo(function SpacesModelSection() {
  return (
    <section className={SECTION_CARD}>
      <h2 className="text-sm font-extrabold text-slate-900">مدل Spaces در توت</h2>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">
        Spaces سومین ستون توت است: چت برای ارتباط، ویترین برای مقصد/سرویس، و Spaces برای اکوسیستم‌های تخصصی.
      </p>
      <ol className="mt-3 grid gap-2.5 text-xs sm:grid-cols-3">
        <li className={SUB_CARD}>
          <p className="font-extrabold text-slate-800">1) Space</p>
          <p className="mt-1 text-slate-600">هدف تخصصی‌تان را مشخص کنید (محله، آموزش، ورزش، گیمینگ، کسب‌وکار).</p>
        </li>
        <li className={SUB_CARD}>
          <p className="font-extrabold text-slate-800">2) Network</p>
          <p className="mt-1 text-slate-600">شبکه‌ی مرتبط را پیدا کنید و عضو شوید تا زمینه عملیاتی شما مشخص شود.</p>
        </li>
        <li className={SUB_CARD}>
          <p className="font-extrabold text-slate-800">3) Group / Channel</p>
          <p className="mt-1 text-slate-600">پس از عضویت شبکه، در گروه‌ها و کانال‌های مرتبط همکاری و گفتگو کنید.</p>
        </li>
      </ol>
    </section>
  );
});

const FlagshipSpacesSection = memo(function FlagshipSpacesSection() {
  return (
    <section id="flagship-spaces" className={SECTION_CARD}>
      <h2 className="text-sm font-extrabold text-slate-900">Flagship Spaces</h2>
      <p className="mt-1 text-xs text-slate-500">پایه‌های اصلی اکوسیستم Spaces با مسیر رشد قابلیت‌های تخصصی.</p>
      <ul className="mt-3 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        {SPACE_BLUEPRINTS.map((space) => (
          <li key={space.id}>
            <Link
              href={`/spaces/${space.mappedCategory}`}
              className={`block rounded-3xl bg-gradient-to-br p-4 text-white shadow-md ring-2 ring-inset transition hover:scale-[1.01] hover:shadow-lg active:scale-[0.99] ${space.accentClass}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-base font-extrabold">{space.titleFa}</p>
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold">{space.badge}</span>
              </div>
              <p className="mt-1 text-[11px] text-white/90">{space.titleEn}</p>
              <p className="mt-2 text-[12px] leading-relaxed text-white/95">{space.summaryFa}</p>
              <p className="mt-2 text-[11px] font-bold text-white/85">{space.valueFa}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {space.capabilities.slice(0, 2).map((cap) => (
                  <span key={cap.id} className="rounded-full bg-white/20 px-2 py-0.5 text-[10px]">
                    {cap.title} · {capabilityStageLabel(cap.stage)}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-[11px] font-extrabold text-white/90">ورود به این Space ←</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
});

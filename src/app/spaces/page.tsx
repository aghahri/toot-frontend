'use client';

import { useEffect, useMemo, useState } from 'react';
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

export default function SpacesOverviewPage() {
  const [preferredSpaces, setPreferredSpaces] = useState<UserSpaceKey[]>([]);
  const [personalized, setPersonalized] = useState<SuggestionBlock[]>([]);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [draftPrefs, setDraftPrefs] = useState<UserSpaceKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSpaces = async () => {
    const token = getAccessToken();
    if (!token) return;
    const [prefs, discovery] = await Promise.all([
      apiFetch<SpacePrefsResponse>('users/me/spaces', { method: 'GET', token }),
      apiFetch<PersonalizedResponse>('discover/spaces/personalized', { method: 'GET', token }),
    ]);
    const selected = Array.isArray(prefs.preferredSpaces) ? prefs.preferredSpaces : [];
    setPreferredSpaces(selected);
    setDraftPrefs(selected);
    setPersonalized(Array.isArray(discovery.suggestions) ? discovery.suggestions : []);
  };

  useEffect(() => {
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
  }, []);

  const preferredSet = useMemo(() => new Set(preferredSpaces), [preferredSpaces]);

  async function savePreferredSpaces() {
    const token = getAccessToken();
    if (!token) return;
    setPrefsSaving(true);
    setError(null);
    try {
      const updated = await apiFetch<SpacePrefsResponse>('users/me/spaces', {
        method: 'PATCH',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferredSpaces: draftPrefs }),
      });
      setPreferredSpaces(updated.preferredSpaces ?? []);
      setEditOpen(false);
      await loadSpaces();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ذخیره علایق انجام نشد');
    } finally {
      setPrefsSaving(false);
    }
  }

  function toggleDraftSpace(k: UserSpaceKey) {
    setDraftPrefs((prev) => {
      if (prev.includes(k)) return prev.filter((x) => x !== k);
      if (prev.length >= 5) return prev;
      return [...prev, k];
    });
  }

  return (
    <AuthGate>
      <main className="mx-auto w-full max-w-lg px-4 pb-12 pt-4 sm:pb-14" dir="rtl">
        <header className="mb-5 overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br from-indigo-600 via-violet-700 to-slate-900 p-5 text-white shadow-lg ring-1 ring-inset ring-white/20">
          <p className="inline-flex rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/90">
            Toot Spaces
          </p>
          <h1 className="mt-3 text-2xl font-black tracking-tight">اکوسیستم‌های تخصصی توت</h1>
          <p className="mt-2 text-sm leading-relaxed text-white/90">
            Spaces ستون سوم محصول است: یک سطح حرفه‌ای برای ساخت دنیاهای تخصصی و توسعه‌ی شبکه‌های هدفمند.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Link
              href="#flagship-spaces"
              className="rounded-2xl bg-white px-4 py-2.5 text-center text-xs font-extrabold text-indigo-700 shadow-sm transition hover:bg-slate-100"
            >
              ورود به Flagship Spaces
            </Link>
            <button
              type="button"
              onClick={() => {
                setDraftPrefs(preferredSpaces);
                setEditOpen(true);
              }}
              className="rounded-2xl border border-white/35 bg-white/10 px-4 py-2.5 text-xs font-extrabold text-white transition hover:bg-white/20"
            >
              تنظیم علاقه‌مندی‌ها
            </button>
          </div>
        </header>

        {loading ? (
          <p className="text-sm text-slate-500">در حال بارگذاری…</p>
        ) : error ? (
          <p className="text-sm font-semibold text-red-700">{error}</p>
        ) : (
          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="text-sm font-extrabold text-slate-900">مدل Spaces در توت</h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Spaces سومین ستون توت است: چت برای ارتباط، ویترین برای مقصد/سرویس، و Spaces برای اکوسیستم‌های تخصصی.
              </p>
              <ol className="mt-3 grid gap-2.5 text-xs sm:grid-cols-3">
                <li className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="font-extrabold text-slate-800">1) Space</p>
                  <p className="mt-1 text-slate-600">هدف تخصصی‌تان را مشخص کنید (محله، آموزش، ورزش، گیمینگ، کسب‌وکار).</p>
                </li>
                <li className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="font-extrabold text-slate-800">2) Network</p>
                  <p className="mt-1 text-slate-600">شبکه‌ی مرتبط را پیدا کنید و عضو شوید تا زمینه عملیاتی شما مشخص شود.</p>
                </li>
                <li className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="font-extrabold text-slate-800">3) Group / Channel</p>
                  <p className="mt-1 text-slate-600">پس از عضویت شبکه، در گروه‌ها و کانال‌های مرتبط همکاری و گفتگو کنید.</p>
                </li>
              </ol>
            </section>

            <section id="flagship-spaces" className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="text-sm font-extrabold text-slate-900">Flagship Spaces</h2>
              <p className="mt-1 text-xs text-slate-500">پایه‌های اصلی اکوسیستم Spaces با مسیر رشد قابلیت‌های تخصصی.</p>
              <ul className="mt-3 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                {SPACE_BLUEPRINTS.map((space) => (
                  <li key={space.id}>
                    <Link
                      href={`/spaces/${space.mappedCategory}`}
                      className={`block rounded-2xl bg-gradient-to-br p-4 text-white shadow-sm ring-2 ring-inset transition hover:scale-[1.01] hover:shadow-md active:scale-[0.99] ${space.accentClass}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-base font-extrabold">{space.titleFa}</p>
                        <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold">{space.badge}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-white/90">{space.titleEn}</p>
                      <p className="mt-2 text-xs leading-relaxed text-white/95">{space.summaryFa}</p>
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

            <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-extrabold text-slate-900">My Spaces</h2>
                <button
                  type="button"
                  onClick={() => {
                    setDraftPrefs(preferredSpaces);
                    setEditOpen(true);
                  }}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  ویرایش علاقه‌ها
                </button>
              </div>
              {preferredSpaces.length === 0 ? (
                <div className="rounded-xl bg-slate-50 px-3 py-4 text-center">
                  <p className="text-sm font-semibold text-slate-700">علاقه‌ای انتخاب نشده است</p>
                  <p className="mt-1 text-xs text-slate-500">
                    برای شخصی‌سازی Spaces علاقه‌های خود را انتخاب کنید.
                  </p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {preferredSpaces.map((k) => (
                    <span
                      key={k}
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ring-1 ${USER_SPACE_META[k].accent}`}
                    >
                      <span aria-hidden>{USER_SPACE_META[k].emoji}</span>
                      {USER_SPACE_META[k].labelFa}
                    </span>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-extrabold text-slate-900">پیشنهادهای شخصی‌سازی‌شده</h2>
              <p className="mt-1 text-xs text-slate-500">بر اساس علاقه‌ها و اجتماع‌های موجود در توت</p>
              {personalized.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">هنوز پیشنهادی برای شما موجود نیست.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {personalized.map((block) => (
                    <article key={block.key} className="rounded-xl border border-slate-200/80 p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-lg" aria-hidden>
                          {USER_SPACE_META[block.key].emoji}
                        </span>
                        <h3 className="text-sm font-extrabold text-slate-900">
                          {USER_SPACE_META[block.key].labelFa}
                        </h3>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="rounded-lg bg-slate-50 p-2">
                          <p className="mb-1 font-bold text-slate-700">شبکه‌های برتر</p>
                          {block.networks.length === 0 ? (
                            <p className="text-slate-400">شبکه‌ای پیدا نشد</p>
                          ) : (
                            <ul className="space-y-1">
                              {block.networks.slice(0, 3).map((n) => (
                                <li key={n.id}>
                                  <Link className="font-semibold text-sky-700 hover:underline" href={`/networks/${n.id}`}>
                                    {n.name}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-lg bg-slate-50 p-2">
                            <p className="mb-1 font-bold text-slate-700">گروه‌های اجتماعی</p>
                            {block.groups.length === 0 ? (
                              <p className="text-slate-400">موردی نیست</p>
                            ) : (
                              <ul className="space-y-1">
                                {block.groups.slice(0, 2).map((g) => (
                                  <li key={g.id}>
                                    <Link className="font-semibold text-slate-700 hover:underline" href={`/groups/${g.id}`}>
                                      {g.name}
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                          <div className="rounded-lg bg-slate-50 p-2">
                            <p className="mb-1 font-bold text-slate-700">کانال‌ها</p>
                            {block.channels.length === 0 ? (
                              <p className="text-slate-400">موردی نیست</p>
                            ) : (
                              <ul className="space-y-1">
                                {block.channels.slice(0, 2).map((c) => (
                                  <li key={c.id}>
                                    <Link className="font-semibold text-slate-700 hover:underline" href={`/channels/${c.id}`}>
                                      {c.name}
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      </div>
                      {SPACE_DETAIL_MAP[block.key] ? (
                        <div className="mt-2 flex items-center justify-between gap-2 text-left">
                          <Link
                            href={
                              SPACE_DETAIL_MAP[block.key]
                                ? `/groups/new?kind=community&spaceKey=${encodeURIComponent(
                                    SPACE_DETAIL_MAP[block.key]!,
                                  )}&returnTo=spaces`
                                : '/groups/new?kind=community&returnTo=spaces'
                            }
                            className="text-[11px] font-bold text-emerald-700 hover:underline"
                          >
                            ساخت گروه اجتماعی
                          </Link>
                          <Link
                            href={`/spaces/${SPACE_DETAIL_MAP[block.key]}`}
                            className="text-[11px] font-bold text-sky-700 hover:underline"
                          >
                            مشاهده جزئیات فضا ←
                          </Link>
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-extrabold text-slate-900">Explore All Spaces</h2>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {USER_SPACE_KEYS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      setDraftPrefs(preferredSpaces);
                      setEditOpen(true);
                    }}
                    className={`rounded-xl px-2 py-2 text-xs font-bold ring-1 transition ${
                      preferredSet.has(k)
                        ? `${USER_SPACE_META[k].accent} ring-2`
                        : 'bg-slate-50 text-slate-700 ring-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span className="ms-1" aria-hidden>
                      {USER_SPACE_META[k].emoji}
                    </span>
                    {USER_SPACE_META[k].labelFa}
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}

        {editOpen ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-3" dir="rtl">
            <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-slate-900">ویرایش علاقه‌ها</h3>
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className="rounded-full px-2 py-1 text-xs font-bold text-slate-500 hover:bg-slate-100"
                >
                  بستن
                </button>
              </div>
              <p className="mb-3 text-xs text-slate-500">حداکثر ۵ مورد انتخاب کنید.</p>
              <div className="grid grid-cols-2 gap-2">
                {USER_SPACE_KEYS.map((k) => {
                  const selected = draftPrefs.includes(k);
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => toggleDraftSpace(k)}
                      className={`rounded-xl px-2 py-2 text-xs font-bold ring-1 transition ${
                        selected
                          ? `${USER_SPACE_META[k].accent} ring-2`
                          : 'bg-slate-50 text-slate-700 ring-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span className="ms-1" aria-hidden>
                        {USER_SPACE_META[k].emoji}
                      </span>
                      {USER_SPACE_META[k].labelFa}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  disabled={prefsSaving}
                  onClick={() => void savePreferredSpaces()}
                  className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
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

'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthGate } from '@/components/AuthGate';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

type NetworkRow = {
  id: string;
  name: string;
  isMember?: boolean;
  myRole?: 'NETWORK_ADMIN' | 'MEMBER' | null;
};

function NewChannelPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preset = (searchParams.get('preset') ?? '').trim().toLowerCase();
  const presetNetworkId = (searchParams.get('networkId') ?? '').trim();
  const isTeacherPreset = preset === 'teacher';
  const isProfessionalPreset = preset === 'professional';
  const isCoachPreset = preset === 'coach';

  const [networks, setNetworks] = useState<NetworkRow[]>([]);
  const [networkId, setNetworkId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eligibleNetworks = useMemo(
    () => networks.filter((n) => n.isMember && n.myRole === 'NETWORK_ADMIN'),
    [networks],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = getAccessToken();
      if (!token) {
        setLoading(false);
        setError('برای ساخت کانال باید وارد شوید.');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const rows = await apiFetch<NetworkRow[]>('networks', { method: 'GET', token });
        if (cancelled) return;
        const list = Array.isArray(rows) ? rows : [];
        setNetworks(list);
        const preferred = list.find((n) => n.id === presetNetworkId && n.isMember && n.myRole === 'NETWORK_ADMIN');
        if (preferred) {
          setNetworkId(preferred.id);
        } else if (list.some((n) => n.isMember && n.myRole === 'NETWORK_ADMIN')) {
          setNetworkId(list.find((n) => n.isMember && n.myRole === 'NETWORK_ADMIN')!.id);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'بارگذاری شبکه‌ها انجام نشد');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [presetNetworkId]);

  async function createChannel() {
    if (!networkId || name.trim().length < 2 || creating) return;
    const token = getAccessToken();
    if (!token) return;
    setCreating(true);
    setError(null);
    try {
      const created = await apiFetch<{ id: string; networkId: string }>('channels', {
        method: 'POST',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          networkId,
          spaceCategory: isTeacherPreset ? 'EDUCATION' : isCoachPreset ? 'SPORT' : 'PUBLIC_GENERAL',
        }),
      });
      router.replace(`/channels/${created.id}?network=${encodeURIComponent(created.networkId)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ساخت کانال انجام نشد');
    } finally {
      setCreating(false);
    }
  }

  return (
    <AuthGate>
      <main className="mx-auto w-full max-w-md px-4 pb-12 pt-4 sm:pb-14" dir="rtl">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h1 className="text-lg font-extrabold text-slate-900">
            {isTeacherPreset
              ? 'Teacher Channel — ساخت کانال آموزشی'
              : isProfessionalPreset
                ? 'Professional Channel — کانال حرفه‌ای'
                : isCoachPreset
                  ? 'Coach Channel — کانال مربی'
                : 'ساخت کانال'}
          </h1>
          <Link
            href={isProfessionalPreset ? '/spaces/PUBLIC_GENERAL' : isCoachPreset ? '/spaces/SPORT' : '/spaces/EDUCATION'}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-extrabold text-slate-700 transition hover:bg-slate-50"
          >
            بازگشت
          </Link>
        </div>

        <section className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
          {isTeacherPreset ? (
            <p className="mb-3 rounded-2xl bg-indigo-50 px-3 py-2 text-xs text-indigo-800 ring-1 ring-indigo-200/80">
              Teacher Channel برای انتشار درس، اعلان و آپدیت‌های آموزشی به‌صورت یک‌به‌چند.
            </p>
          ) : isProfessionalPreset ? (
            <p className="mb-3 rounded-2xl bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200/80">
              Professional Channel برای انتشار insightها، آپدیت‌های کاری و mentorship در جامعه حرفه‌ای.
            </p>
          ) : isCoachPreset ? (
            <p className="mb-3 rounded-2xl bg-orange-50 px-3 py-2 text-xs text-orange-800 ring-1 ring-orange-200/80">
              Coach Channel برای نکات تمرینی، برنامه تیم و اعلان‌های ورزشی یک‌به‌چند.
            </p>
          ) : null}

          {loading ? <p className="text-sm text-slate-500">در حال بارگذاری…</p> : null}
          {error ? <p className="mb-3 rounded-2xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p> : null}

          {!loading && eligibleNetworks.length === 0 ? (
            <p className="rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200/80">
              برای ساخت کانال باید ادمین یکی از شبکه‌ها باشید.
            </p>
          ) : (
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold text-slate-600">شبکه</span>
                <select
                  value={networkId}
                  onChange={(e) => setNetworkId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="">انتخاب شبکه…</option>
                  {eligibleNetworks.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-[11px] font-bold text-slate-600">نام کانال</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={
                    isTeacherPreset
                      ? 'مثلاً Teacher Channel - ریاضی گسسته'
                      : isProfessionalPreset
                        ? 'مثلاً Industry Updates Channel'
                        : isCoachPreset
                          ? 'مثلاً Coach Channel - Team A'
                        : 'نام کانال'
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[11px] font-bold text-slate-600">توضیحات (اختیاری)</span>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={
                    isTeacherPreset
                      ? 'Lessons, notices, updates'
                      : isProfessionalPreset
                        ? 'Insights and announcements'
                        : isCoachPreset
                          ? 'Training tips, matchday updates'
                        : 'اختیاری'
                  }
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </label>

              <button
                type="button"
                onClick={() => void createChannel()}
                disabled={creating || !networkId || name.trim().length < 2}
                className="w-full rounded-2xl bg-indigo-700 py-3 text-sm font-bold text-white shadow-md shadow-indigo-700/20 transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {creating
                  ? 'در حال ساخت…'
                  : isTeacherPreset
                    ? 'ساخت Teacher Channel'
                    : isProfessionalPreset
                      ? 'ساخت Professional Channel'
                      : isCoachPreset
                        ? 'ساخت Coach Channel'
                      : 'ساخت کانال'}
              </button>
            </div>
          )}
        </section>
      </main>
    </AuthGate>
  );
}

export default function NewChannelPage() {
  return (
    <Suspense
      fallback={
        <AuthGate>
          <main className="mx-auto min-h-[50vh] w-full max-w-md px-4 py-10 text-center text-sm text-slate-600" dir="rtl">
            در حال بارگذاری…
          </main>
        </AuthGate>
      }
    >
      <NewChannelPageInner />
    </Suspense>
  );
}

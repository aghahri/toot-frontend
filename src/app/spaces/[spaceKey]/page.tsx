'use client';

import { Suspense, useEffect, useState } from 'react';
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

type NetworkRow = { id: string; name: string; description: string | null; slug: string | null };

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

  useEffect(() => {
    if (!isSpaceKey(raw)) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const token = getAccessToken();
        const res = await apiFetch<DetailResponse>(
          `discover/spaces/detail/${encodeURIComponent(raw)}?limit=50`,
          {
            method: 'GET',
            ...(token ? { token } : {}),
          },
        );
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'خطا');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [raw]);

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
      router.push(`/networks/${networkId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'پیوستن به شبکه ممکن نیست');
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
            <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-extrabold text-slate-900">گروه‌های اجتماعی</h2>
                <Link
                  href="/groups/new?kind=community"
                  className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-extrabold text-sky-800"
                >
                  ساخت گروه اجتماعی
                </Link>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                فقط گروه‌های اجتماعی این فضا؛ گروه‌های چت خصوصی در این بخش نمایش داده نمی‌شوند.
              </p>
              <ul className="mt-3 divide-y divide-slate-100">
                {data.groups.length === 0 ? (
                  <li className="py-6 text-center text-xs text-slate-400">گروهی نیست</li>
                ) : (
                  data.groups.map((g) => (
                    <li key={g.id} className="flex items-start justify-between gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <Link href={`/groups/${g.id}`} className="text-sm font-bold text-sky-800 underline-offset-2 hover:underline">
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
                )}
              </ul>
            </section>

            <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-extrabold text-slate-900">شبکه‌ها</h2>
              <p className="mt-1 text-[11px] text-slate-500">فقط شبکه‌های عمومی با همین برچسب فضا.</p>
              <ul className="mt-3 divide-y divide-slate-100">
                {data.networks.length === 0 ? (
                  <li className="py-6 text-center text-xs text-slate-400">شبکه‌ای نیست</li>
                ) : (
                  data.networks.map((n) => (
                    <li key={n.id} className="flex items-start justify-between gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <Link href={`/networks/${n.id}`} className="text-sm font-bold text-sky-800 underline-offset-2 hover:underline">
                          {n.name}
                        </Link>
                        {n.description ? (
                          <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">{n.description}</p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        disabled={joiningNet === n.id}
                        onClick={() => void joinNetwork(n.id)}
                        className="shrink-0 rounded-xl bg-slate-800 px-3 py-2 text-[11px] font-bold text-white disabled:opacity-50"
                      >
                        {joiningNet === n.id ? '…' : 'پیوستن'}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </section>

            <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-extrabold text-slate-900">کانال‌ها</h2>
              <p className="mt-1 text-[11px] text-slate-500">
                کانال با همان فضا؛ باز کردن کانال نیازمند عضویت در شبکه و سپس کانال است.
              </p>
              <ul className="mt-3 divide-y divide-slate-100">
                {data.channels.length === 0 ? (
                  <li className="py-6 text-center text-xs text-slate-400">کانالی نیست</li>
                ) : (
                  data.channels.map((c) => (
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
                )}
              </ul>
            </section>
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

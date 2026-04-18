'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AuthGate } from '@/components/AuthGate';
import { CommunityToolsSheet } from '@/components/capability/CommunityToolsSheet';
import { getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { fetchNetworkCommunitySurfaces, type CommunitySurfacesPayload } from '@/lib/networkCommunity';

type NetworkPayload = {
  id: string;
  name: string;
  description: string | null;
  slug: string | null;
  visibility: string;
  isMember: boolean;
  myRole: string | null;
};

export default function NetworkDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === 'string' ? params.id : '';

  const [net, setNet] = useState<NetworkPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [surfaces, setSurfaces] = useState<CommunitySurfacesPayload | null>(null);
  const [surfacesLoading, setSurfacesLoading] = useState(false);
  const [surfacesError, setSurfacesError] = useState<string | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token || !id) return;
    setLoading(true);
    setError(null);
    try {
      const row = await apiFetch<NetworkPayload>(`networks/${encodeURIComponent(id)}`, {
        method: 'GET',
        token,
      });
      setNet(row);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا');
      setNet(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadSurfaces = useCallback(async () => {
    const token = getAccessToken();
    if (!token || !id) return;
    setSurfacesLoading(true);
    setSurfacesError(null);
    try {
      const data = await fetchNetworkCommunitySurfaces(id);
      setSurfaces(data);
    } catch (e) {
      setSurfaces(null);
      setSurfacesError(e instanceof Error ? e.message : 'خطا');
    } finally {
      setSurfacesLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (net?.isMember && id) void loadSurfaces();
    else setSurfaces(null);
  }, [net?.isMember, id, loadSurfaces]);

  async function join() {
    const token = getAccessToken();
    if (!token || !id) return;
    setJoining(true);
    setError(null);
    try {
      await apiFetch(`networks/${encodeURIComponent(id)}/join`, { method: 'POST', token });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'پیوستن ممکن نیست');
    } finally {
      setJoining(false);
    }
  }

  const isNetAdmin = net?.myRole === 'NETWORK_ADMIN';

  return (
    <AuthGate>
      <main
        className="theme-page-bg theme-text-primary mx-auto min-h-[70vh] w-full max-w-md px-4 pb-12 pt-2"
        dir="rtl"
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-10 min-w-[2.5rem] items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--surface-soft)]"
            aria-label="بازگشت"
          >
            ←
          </button>
          <Link href="/spaces" className="text-xs font-bold text-[var(--accent-hover)] underline">
            فضاها
          </Link>
          {net?.isMember && id ? (
            <button
              type="button"
              onClick={() => setToolsOpen(true)}
              className="mr-auto flex items-center gap-1 rounded-full border border-[var(--border-soft)] bg-[var(--card-bg)] px-3 py-1.5 text-[11px] font-extrabold text-[var(--text-primary)] shadow-sm ring-1 ring-[var(--border-soft)] transition hover:bg-[var(--surface-soft)]"
            >
              <span aria-hidden>🧰</span>
              ابزارها
            </button>
          ) : null}
        </div>

        {loading ? (
          <p className="text-sm text-[var(--text-secondary)]">در حال بارگذاری…</p>
        ) : error && !net ? (
          <p className="text-sm font-semibold text-red-600">{error}</p>
        ) : net ? (
          <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--card-bg)] p-5 shadow-sm ring-1 ring-[var(--border-soft)]">
            <h1 className="text-xl font-extrabold text-[var(--text-primary)]">{net.name}</h1>
            {net.slug ? (
              <p className="mt-1 text-xs text-[var(--text-secondary)]" dir="ltr">
                {net.slug}
              </p>
            ) : null}
            {net.description ? (
              <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">{net.description}</p>
            ) : null}
            <p className="mt-2 text-[11px] font-medium text-[var(--text-secondary)]">وضعیت: {net.visibility}</p>

            {error ? <p className="mt-3 text-xs font-semibold text-amber-800">{error}</p> : null}

            <div className="mt-5 flex flex-wrap gap-2">
              {!net.isMember ? (
                <button
                  type="button"
                  disabled={joining}
                  onClick={() => void join()}
                  className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  {joining ? '…' : 'پیوستن به شبکه'}
                </button>
              ) : (
                <span className="rounded-xl bg-emerald-500/15 px-4 py-2.5 text-sm font-bold text-emerald-800 dark:text-emerald-300">
                  عضو شبکه هستید
                </span>
              )}
            </div>

            {net.isMember ? (
              <div className="mt-6 space-y-4 border-t border-[var(--border-soft)] pt-4">
                <p className="text-[11px] font-extrabold text-[var(--text-secondary)]">جامعه در این شبکه</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3 ring-1 ring-[var(--border-soft)]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-black text-[var(--text-primary)]">گروه‌ها</span>
                      <span className="tabular-nums text-[11px] font-bold text-[var(--text-secondary)]">
                        {surfacesLoading ? '…' : surfaces ? surfaces.groupCount : '—'}
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] text-[var(--text-secondary)]">گفتگو و هماهنگی</p>
                    <Link
                      href={`/groups/new?kind=community&networkId=${encodeURIComponent(net.id)}&returnTo=network`}
                      className="mt-3 inline-flex w-full justify-center rounded-xl bg-[var(--accent)] px-3 py-2 text-center text-[11px] font-extrabold text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)]"
                    >
                      ساخت گروه
                    </Link>
                    {surfacesError ? (
                      <p className="mt-2 text-[10px] text-amber-700">{surfacesError}</p>
                    ) : surfaces && surfaces.groups.length > 0 ? (
                      <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-right">
                        {surfaces.groups.map((g) => (
                          <li key={g.id}>
                            <Link
                              href={`/groups/${g.id}`}
                              className="block truncate rounded-lg px-1 py-1 text-[12px] font-bold text-[var(--accent-hover)] hover:bg-[var(--card-bg)] hover:underline"
                            >
                              {g.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : surfaces && surfaces.groups.length === 0 ? (
                      <p className="mt-2 text-[10px] text-[var(--text-secondary)]">هنوز گروهی نیست.</p>
                    ) : null}
                  </div>

                  <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3 ring-1 ring-[var(--border-soft)]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-black text-[var(--text-primary)]">کانال‌ها</span>
                      <span className="tabular-nums text-[11px] font-bold text-[var(--text-secondary)]">
                        {surfacesLoading ? '…' : surfaces ? surfaces.channelCount : '—'}
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] text-[var(--text-secondary)]">اعلان و محتوای ساخت‌یافته</p>
                    {isNetAdmin ? (
                      <Link
                        href={`/channels/new?networkId=${encodeURIComponent(net.id)}`}
                        className="mt-3 inline-flex w-full justify-center rounded-xl border border-violet-500/40 bg-violet-500/10 px-3 py-2 text-center text-[11px] font-extrabold text-violet-900 hover:bg-violet-500/20 dark:text-violet-200"
                      >
                        ساخت کانال
                      </Link>
                    ) : (
                      <p className="mt-3 text-[10px] leading-relaxed text-[var(--text-secondary)]">
                        ساخت کانال برای <strong className="text-[var(--text-primary)]">ادمین شبکه</strong> است. از مدیر بخواهید کانال بسازد یا لینک دعوت بگیرید.
                      </p>
                    )}
                    {surfacesError ? (
                      <p className="mt-2 text-[10px] text-amber-700">{surfacesError}</p>
                    ) : surfaces && surfaces.channels.length > 0 ? (
                      <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-right">
                        {surfaces.channels.map((c) => (
                          <li key={c.id}>
                            <Link
                              href={`/channels/${c.id}?network=${encodeURIComponent(net.id)}`}
                              className="block truncate rounded-lg px-1 py-1 text-[12px] font-bold text-[var(--accent-hover)] hover:bg-[var(--card-bg)] hover:underline"
                            >
                              {c.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : surfaces && surfaces.channels.length === 0 ? (
                      <p className="mt-2 text-[10px] text-[var(--text-secondary)]">هنوز کانالی نیست.</p>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {net?.isMember && id ? (
          <CommunityToolsSheet
            open={toolsOpen}
            onClose={() => setToolsOpen(false)}
            targetType="NETWORK"
            targetId={id}
            title="ابزارهای شبکه"
          />
        ) : null}
      </main>
    </AuthGate>
  );
}

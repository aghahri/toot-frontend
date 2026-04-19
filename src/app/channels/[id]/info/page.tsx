'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AuthGate } from '@/components/AuthGate';
import { getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { ChannelReframeHero } from '@/components/community/ChannelReframeHero';
import {
  channelEmptyStateCopy,
  resolveChannelEmptyKind,
} from '@/components/community/channelRichLabels';
import { CommunityBackButton, CommunityWorkspaceHeaderBar, CommunityWorkspaceShell } from '@/components/community/CommunityWorkspace';

type NetworkPayload = {
  id: string;
  name: string;
  networkType?: string;
  spaceCategory?: string;
  description?: string | null;
};

type ChannelPayload = {
  id: string;
  name: string;
  description: string | null;
  networkId: string;
  spaceCategory?: string;
  postingMode?: string;
  network: NetworkPayload;
  isMember: boolean;
  myRole: string | null;
  canPost?: boolean;
  memberCount?: number;
  postCount?: number;
  openJobsCount?: number | null;
};

function fmtCount(n: number | undefined): string {
  if (n === undefined || Number.isNaN(n)) return '—';
  try {
    return n.toLocaleString('fa-IR');
  } catch {
    return String(n);
  }
}

function ChannelInfoInner() {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : '';

  const [channel, setChannel] = useState<ChannelPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titleInitial = useMemo(() => {
    const t = channel?.name?.trim();
    if (!t) return 'ک';
    return t.slice(0, 1);
  }, [channel?.name]);

  const loadChannel = useCallback(async () => {
    const token = getAccessToken();
    if (!token || !id) return;
    setLoading(true);
    setError(null);
    try {
      const row = await apiFetch<ChannelPayload>(`channels/${encodeURIComponent(id)}`, {
        method: 'GET',
        token,
      });
      setChannel(row);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا');
      setChannel(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadChannel();
  }, [loadChannel]);

  async function joinChannel() {
    const token = getAccessToken();
    if (!token || !id) return;
    setJoining(true);
    setError(null);
    try {
      await apiFetch(`channels/${encodeURIComponent(id)}/join`, { method: 'POST', token });
      await loadChannel();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'پیوستن ممکن نیست');
    } finally {
      setJoining(false);
    }
  }

  const emptyKind = channel
    ? resolveChannelEmptyKind(channel.spaceCategory, channel.network.networkType)
    : 'general';
  const emptyCopy = channel ? channelEmptyStateCopy(emptyKind, false) : { title: '', subtitle: '', cta: undefined };

  const canShowComposer =
    channel?.isMember &&
    (channel.canPost !== undefined
      ? channel.canPost
      : (() => {
          const mode = channel.postingMode ?? 'ADMINS_ONLY';
          const role = channel.myRole;
          if (!role) return false;
          if (mode === 'ALL_MEMBERS') return true;
          if (mode === 'PUBLISHERS_AND_ADMINS') return role === 'CHANNEL_ADMIN' || role === 'PUBLISHER';
          return role === 'CHANNEL_ADMIN';
        })());

  return (
    <AuthGate>
      <CommunityWorkspaceShell withWorkspaceGradient>
        <CommunityWorkspaceHeaderBar>
          <CommunityBackButton href={id ? `/channels/${encodeURIComponent(id)}` : '/spaces'} />
          <div className="min-w-0 flex-1 text-right">
            <p className="theme-text-primary truncate text-[12px] font-black">اطلاعات کانال</p>
            <p className="truncate text-[10px] text-stone-500">{channel?.name ?? (loading ? '…' : '')}</p>
          </div>
          {id ? (
            <Link
              href={`/channels/${encodeURIComponent(id)}`}
              className="shrink-0 rounded-full px-2 py-1 text-[10px] font-extrabold text-[var(--accent-hover)] hover:underline"
            >
              بازگشت به فید
            </Link>
          ) : null}
        </CommunityWorkspaceHeaderBar>

        <div className="px-2.5 pb-8 pt-3 sm:px-3">
          {loading && !channel ? (
            <p className="theme-text-secondary mt-4 text-center text-sm">در حال بارگذاری…</p>
          ) : null}

          {!loading && channel ? (
            <ChannelReframeHero
              titleInitial={titleInitial}
              channelName={channel.name}
              description={channel.description}
              network={channel.network}
              emptyKind={emptyKind}
              memberCount={channel.memberCount !== undefined ? fmtCount(channel.memberCount) : undefined}
              postCount={channel.postCount !== undefined ? fmtCount(channel.postCount) : undefined}
              openJobsCount={channel.openJobsCount}
              postingMode={channel.postingMode}
              spaceCategory={channel.spaceCategory}
              isMember={channel.isMember}
              myRole={channel.myRole}
              error={error ? <p className="text-xs font-semibold text-red-700">{error}</p> : null}
              joinButton={
                !channel.isMember ? (
                  <button
                    type="button"
                    disabled={joining}
                    onClick={() => void joinChannel()}
                    className="w-full rounded-xl bg-violet-700 px-4 py-3 text-sm font-bold text-white shadow-md transition hover:bg-violet-800 disabled:opacity-50"
                  >
                    {joining ? '…' : 'پیوستن به کانال'}
                  </button>
                ) : null
              }
              actions={
                channel.isMember && id ? (
                  <div className="-mx-1 flex max-w-full flex-wrap gap-2">
                    <Link
                      href={`/channels/${encodeURIComponent(id)}`}
                      className="inline-flex items-center rounded-full border border-violet-300/90 bg-violet-600 px-3 py-2 text-[11px] font-extrabold text-white shadow-sm hover:bg-violet-700"
                    >
                      رفتن به فید انتشار
                    </Link>
                    <Link
                      href={`/networks/${channel.networkId}`}
                      className="inline-flex items-center rounded-full border border-slate-200/90 bg-white px-3 py-2 text-[11px] font-extrabold text-slate-800 shadow-sm hover:bg-slate-50"
                    >
                      دربارهٔ شبکه
                    </Link>
                    {canShowComposer ? (
                      <Link
                        href={`/channels/${encodeURIComponent(id)}/scheduled`}
                        className="inline-flex items-center rounded-full border border-slate-200/90 bg-white px-3 py-2 text-[11px] font-extrabold text-slate-800 shadow-sm hover:bg-slate-50"
                      >
                        زمان‌بندی
                      </Link>
                    ) : null}
                  </div>
                ) : null
              }
            />
          ) : null}

          {!loading && !channel ? (
            <p className="theme-text-secondary mt-6 text-center text-sm">
              {error ?? 'کانال پیدا نشد'}
            </p>
          ) : null}

          {!loading && channel && !channel.isMember ? (
            <p className="theme-text-secondary mt-4 text-center text-[11px] leading-relaxed">{emptyCopy.subtitle}</p>
          ) : null}
        </div>
      </CommunityWorkspaceShell>
    </AuthGate>
  );
}

export default function ChannelInfoPage() {
  return (
    <Suspense
      fallback={
        <div className="theme-page-bg theme-text-secondary px-4 py-10 text-center text-sm" dir="rtl">
          در حال بارگذاری…
        </div>
      }
    >
      <ChannelInfoInner />
    </Suspense>
  );
}

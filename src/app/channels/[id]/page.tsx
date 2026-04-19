'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { AuthGate } from '@/components/AuthGate';
import { getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { CommunityToolsSheet } from '@/components/capability/CommunityToolsSheet';
import { ChannelRichComposer } from '@/components/community/ChannelRichComposer';
import { ChannelFeaturedZone } from '@/components/community/ChannelFeaturedZone';
import { ChannelPublicationCard } from '@/components/community/ChannelPublicationCard';
import { ChannelReframeHero } from '@/components/community/ChannelReframeHero';
import type { ChannelMsg } from '@/components/community/channelTypes';
import {
  channelEmptyStateCopy,
  readOnlyHintForPostingMode,
  resolveChannelEmptyKind,
} from '@/components/community/channelRichLabels';
import {
  CommunityBackButton,
  CommunityReadOnlyComposerBar,
  CommunityTimelineFrame,
  CommunityToolsTrigger,
  CommunityWorkspaceHeaderBar,
  CommunityWorkspaceShell,
} from '@/components/community/CommunityWorkspace';

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

function ChannelDetailInner() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = typeof params?.id === 'string' ? params.id : '';
  const fallbackNetworkId = searchParams.get('network')?.trim() || '';

  const [channel, setChannel] = useState<ChannelPayload | null>(null);
  const [messages, setMessages] = useState<ChannelMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendErr, setSendErr] = useState<string | null>(null);
  const [excludeMessageId, setExcludeMessageId] = useState<string | null>(null);
  const [pinnedMessage, setPinnedMessage] = useState<ChannelMsg | null>(null);
  const [pinBusyId, setPinBusyId] = useState<string | null>(null);

  const titleInitial = useMemo(() => {
    const t = channel?.name?.trim();
    if (!t) return 'ک';
    return t.slice(0, 1);
  }, [channel?.name]);

  const loadChannel = useCallback(async (soft?: boolean) => {
    const token = getAccessToken();
    if (!token || !id) return;
    if (!soft) setLoading(true);
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
      if (!soft) setLoading(false);
    }
  }, [id]);

  const loadMessages = useCallback(async (soft?: boolean) => {
    const token = getAccessToken();
    if (!token || !id) return;
    if (!soft) setLoadingMsgs(true);
    try {
      const res = await apiFetch<{ data: ChannelMsg[] }>(
        `channels/${encodeURIComponent(id)}/messages?limit=40`,
        { method: 'GET', token },
      );
      setMessages(Array.isArray(res?.data) ? res.data : []);
    } catch {
      setMessages([]);
    } finally {
      if (!soft) setLoadingMsgs(false);
    }
  }, [id]);

  const loadPinned = useCallback(async () => {
    const token = getAccessToken();
    if (!token || !id || !channel?.isMember) return;
    try {
      const res = await apiFetch<{ message: ChannelMsg | null }>(`channels/${encodeURIComponent(id)}/pinned-message`, {
        method: 'GET',
        token,
      });
      setPinnedMessage(res?.message ?? null);
    } catch {
      setPinnedMessage(null);
    }
  }, [id, channel?.isMember]);

  useEffect(() => {
    void loadChannel();
  }, [loadChannel]);

  useEffect(() => {
    if (channel?.isMember) void loadMessages();
    else setMessages([]);
  }, [channel?.id, channel?.isMember, loadMessages]);

  useEffect(() => {
    if (channel?.isMember) void loadPinned();
    else setPinnedMessage(null);
  }, [channel?.id, channel?.isMember, loadPinned]);

  const onTimelineExclude = useCallback((mid: string | null) => {
    setExcludeMessageId(mid);
  }, []);

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
  const canManagePins = channel?.myRole === 'CHANNEL_ADMIN';
  const canManageSchedule = !!canShowComposer;

  const newestPost = useMemo(
    () => (messages.length ? messages[messages.length - 1] : null),
    [messages],
  );

  const timelineMessages = useMemo(() => {
    if (!excludeMessageId) return messages;
    return messages.filter((m) => m.id !== excludeMessageId);
  }, [messages, excludeMessageId]);

  async function joinChannel() {
    const token = getAccessToken();
    if (!token || !id) return;
    setJoining(true);
    setError(null);
    try {
      await apiFetch(`channels/${encodeURIComponent(id)}/join`, { method: 'POST', token });
      await loadChannel(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'پیوستن ممکن نیست');
    } finally {
      setJoining(false);
    }
  }

  const emptyKind = channel
    ? resolveChannelEmptyKind(channel.spaceCategory, channel.network.networkType)
    : 'general';
  const emptyCopy = channel
    ? channelEmptyStateCopy(emptyKind, !!channel.isMember && !!canShowComposer)
    : { title: '', subtitle: '', cta: undefined };

  const heroActions =
    channel?.isMember && id ? (
      <div className="-mx-1 flex max-w-full gap-2 overflow-x-auto overflow-y-hidden pb-1 [-webkit-overflow-scrolling:touch]">
        <button
          type="button"
          onClick={() => setToolsOpen(true)}
          className="flex shrink-0 items-center gap-1 rounded-full border border-slate-200/90 bg-white px-3 py-2 text-[11px] font-extrabold text-slate-800 shadow-sm transition hover:bg-slate-50"
        >
          <span aria-hidden>🧰</span>
          ابزارها
        </button>
        <Link
          href={`/networks/${channel.networkId}`}
          className="flex shrink-0 items-center rounded-full border border-slate-200/90 bg-white px-3 py-2 text-[11px] font-extrabold text-slate-800 shadow-sm transition hover:bg-slate-50"
        >
          دربارهٔ شبکه
        </Link>
        <button
          type="button"
          onClick={() => document.getElementById('channel-feed-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className="flex shrink-0 items-center rounded-full border border-slate-200/90 bg-white px-3 py-2 text-[11px] font-extrabold text-slate-800 shadow-sm transition hover:bg-slate-50"
        >
          فید انتشار
        </button>
        {canShowComposer ? (
          <button
            type="button"
            onClick={() =>
              document.getElementById('channel-composer-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }
            className="flex shrink-0 items-center rounded-full border border-violet-300/90 bg-violet-600 px-3 py-2 text-[11px] font-extrabold text-white shadow-sm transition hover:bg-violet-700"
          >
            انتشار
          </button>
        ) : null}
        <Link
          href="/search"
          className="flex shrink-0 items-center rounded-full border border-slate-200/90 bg-white px-3 py-2 text-[11px] font-extrabold text-slate-800 shadow-sm transition hover:bg-slate-50"
        >
          جستجو
        </Link>
        {canManageSchedule ? (
          <>
            <Link
              href={`/channels/${encodeURIComponent(id)}/scheduled`}
              className="flex shrink-0 items-center rounded-full border border-slate-200/90 bg-white px-3 py-2 text-[11px] font-extrabold text-slate-800 shadow-sm transition hover:bg-slate-50"
            >
              زمان‌بندی انتشار
            </Link>
            {canManagePins ? (
              <Link
                href={`/channels/${encodeURIComponent(id)}/analytics`}
                className="flex shrink-0 items-center rounded-full border border-slate-200/90 bg-white px-3 py-2 text-[11px] font-extrabold text-slate-800 shadow-sm transition hover:bg-slate-50"
              >
                آمار کانال
              </Link>
            ) : null}
          </>
        ) : null}
      </div>
    ) : null;

  return (
    <AuthGate>
      <CommunityWorkspaceShell withWorkspaceGradient>
        {loading && !channel ? (
          <CommunityWorkspaceHeaderBar>
            <CommunityBackButton onClick={() => router.back()} />
            <span className="text-[12px] text-[var(--text-secondary)]">در حال بارگذاری…</span>
          </CommunityWorkspaceHeaderBar>
        ) : null}

        {!loading && channel ? (
          <>
            {/* Minimal sticky bar — identity lives in hero (broadcast, not chat header) */}
            <CommunityWorkspaceHeaderBar>
              <CommunityBackButton onClick={() => router.back()} />
              <Link
                href="/spaces"
                className="shrink-0 rounded-full px-1.5 py-1 text-[10px] font-extrabold text-[var(--accent-hover)] hover:underline"
              >
                فضاها
              </Link>
              <div className="min-w-0 flex-1 text-right">
                <p className="theme-text-primary truncate text-[12px] font-black">کانال انتشار</p>
                <p className="truncate text-[10px] text-stone-500">{channel.name}</p>
              </div>
              {channel.isMember && id ? (
                <CommunityToolsTrigger onClick={() => setToolsOpen(true)} title="ابزارهای کانال" />
              ) : null}
            </CommunityWorkspaceHeaderBar>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-2.5 pb-10 pt-3 sm:px-3">
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
                actions={heroActions}
              />

              {channel.isMember && id ? (
                <div className="mt-4">
                  <ChannelFeaturedZone
                    channelId={id}
                    pinnedPost={pinnedMessage}
                    newestPost={newestPost}
                    onOpenTools={() => setToolsOpen(true)}
                    canPost={!!canShowComposer}
                    onTimelineExcludeId={onTimelineExclude}
                  />
                </div>
              ) : null}

              {channel.isMember ? (
                <div id="channel-feed-anchor" className="min-h-0 flex-1 scroll-mt-28">
                  <CommunityTimelineFrame
                    title="انتشارات"
                    subtitle="فید رسمی کانال — نه گفت‌وگوی گروهی"
                    className="mt-4 min-h-[200px] overflow-hidden"
                  >
                    {loadingMsgs ? (
                      <p className="theme-text-secondary mt-3 px-1 text-xs">بارگذاری فید…</p>
                    ) : messages.length === 0 ? (
                      <div className="mt-4 rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--surface-soft)]/90 px-4 py-8 text-center">
                        <p className="text-[15px] font-black text-[var(--text-primary)]">{emptyCopy.title}</p>
                        <p className="theme-text-secondary mt-2 text-[13px] leading-relaxed">{emptyCopy.subtitle}</p>
                        {!canShowComposer && channel.isMember ? (
                          <p className="theme-text-secondary mt-4 text-[12px] font-medium">{emptyCopy.cta}</p>
                        ) : null}
                        {canShowComposer && emptyCopy.cta ? (
                          <p className="mt-4 text-[12px] font-black text-[var(--accent-hover)]">{emptyCopy.cta}</p>
                        ) : null}
                        {!canShowComposer && channel.isMember && channel.postingMode !== 'ALL_MEMBERS' ? (
                          <p className="theme-text-secondary mt-3 text-[11px]">
                            فقط نقش‌های مجاز می‌توانند منتشر کنند؛ شما مخاطب فید هستید.
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <div className="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5 [-webkit-overflow-scrolling:touch]">
                        <ul className="space-y-4">
                        {timelineMessages.map((m) => (
                          <li key={m.id}>
                            <ChannelPublicationCard
                              message={m}
                              variant="timeline"
                              broadcastLabel="انتشار کانال"
                              pinActionLabel={
                                canManagePins ? (pinnedMessage?.id === m.id ? 'برداشتن سنجاق' : 'سنجاق کردن') : undefined
                              }
                              pinActionDisabled={pinBusyId === m.id}
                              onPinAction={
                                canManagePins
                                  ? (msg) => {
                                      const token = getAccessToken();
                                      if (!token || !id) return;
                                      const targetId = pinnedMessage?.id === msg.id ? null : msg.id;
                                      setPinBusyId(msg.id);
                                      void apiFetch<{ message: ChannelMsg | null }>(`channels/${encodeURIComponent(id)}/pin`, {
                                        method: 'POST',
                                        token,
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ messageId: targetId }),
                                      })
                                        .then((res) => setPinnedMessage(res?.message ?? null))
                                        .finally(() => setPinBusyId(null));
                                    }
                                  : undefined
                              }
                            />
                          </li>
                        ))}
                        </ul>
                      </div>
                    )}
                  </CommunityTimelineFrame>
                </div>
              ) : null}

              {channel.isMember && canShowComposer && id ? (
                <>
                  <ChannelRichComposer
                    channelId={id}
                    id="channel-composer-anchor"
                    className="mt-4 shrink-0 scroll-mt-24"
                    sending={sending}
                    setSending={setSending}
                    onSent={(created) => {
                      setSendErr(null);
                      setMessages((prev) => {
                        if (prev.some((m) => m.id === created.id)) return prev;
                        return [...prev, created];
                      });
                      setChannel((c) => (c ? { ...c, postCount: (c.postCount ?? 0) + 1 } : c));
                    }}
                    onError={setSendErr}
                  />
                  {sendErr ? <p className="mt-2 text-center text-[11px] font-semibold text-red-700">{sendErr}</p> : null}
                </>
              ) : null}

              {channel.isMember && !canShowComposer ? (
                <CommunityReadOnlyComposerBar>
                  {readOnlyHintForPostingMode(channel.postingMode)}{' '}
                  <span className="opacity-90">برای گفت‌وگوی آزاد، گروه مرتبط را باز کنید.</span>
                </CommunityReadOnlyComposerBar>
              ) : null}
            </div>

            {channel.isMember && id ? (
              <CommunityToolsSheet
                open={toolsOpen}
                onClose={() => setToolsOpen(false)}
                targetType="CHANNEL"
                targetId={id}
              />
            ) : null}
          </>
        ) : null}

        {!loading && !channel && fallbackNetworkId ? (
          <div className="px-3 pt-4">
            <CommunityWorkspaceHeaderBar>
              <CommunityBackButton onClick={() => router.back()} />
            </CommunityWorkspaceHeaderBar>
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-950">
              <p className="font-bold">دسترسی به کانال</p>
              <p className="mt-2 text-xs leading-relaxed">
                احتمالاً هنوز عضو شبکهٔ این کانال نیستید. ابتدا به شبکه بپیوندید، سپس دوباره کانال را باز کنید.
              </p>
              <Link
                href={`/networks/${encodeURIComponent(fallbackNetworkId)}`}
                className="mt-3 inline-block text-xs font-bold text-sky-800 underline"
              >
                رفتن به صفحهٔ شبکه و پیوستن
              </Link>
              {error ? <p className="mt-2 text-[11px] text-amber-900/90">{error}</p> : null}
            </div>
          </div>
        ) : null}

        {!loading && !channel && !fallbackNetworkId ? (
          <div className="px-3 pt-4">
            <CommunityWorkspaceHeaderBar>
              <CommunityBackButton onClick={() => router.back()} />
            </CommunityWorkspaceHeaderBar>
            {error ? <p className="mt-4 text-sm font-semibold text-red-700">{error}</p> : (
              <p className="theme-text-secondary mt-4 text-sm">کانال پیدا نشد</p>
            )}
          </div>
        ) : null}
      </CommunityWorkspaceShell>
    </AuthGate>
  );
}

export default function ChannelDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="theme-page-bg theme-text-secondary px-4 py-10 text-center text-sm" dir="rtl">
          در حال بارگذاری…
        </div>
      }
    >
      <ChannelDetailInner />
    </Suspense>
  );
}

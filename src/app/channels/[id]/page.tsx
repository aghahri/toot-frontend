'use client';

import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { AuthGate } from '@/components/AuthGate';
import { getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { CommunityToolsSheet } from '@/components/capability/CommunityToolsSheet';
import { ChannelActionStrip } from '@/components/community/ChannelActionStrip';
import { ChannelRichComposer } from '@/components/community/ChannelRichComposer';
import { ChannelFeaturedZone } from '@/components/community/ChannelFeaturedZone';
import { ChannelPinnedStrip } from '@/components/community/ChannelPinnedStrip';
import { ChannelPublicationCard } from '@/components/community/ChannelPublicationCard';
import type { ChannelMsg } from '@/components/community/channelTypes';
import {
  channelEmptyStateCopy,
  channelHeroTagline,
  readOnlyHintForPostingMode,
  resolveChannelEmptyKind,
} from '@/components/community/channelRichLabels';
import {
  CommunityAvatarInitial,
  CommunityBackButton,
  CommunityReadOnlyComposerBar,
  CommunityTimelineFrame,
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

function ChannelDetailInner() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = typeof params?.id === 'string' ? params.id : '';
  const fallbackNetworkId = searchParams.get('network')?.trim() || '';

  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const initialTimelineScrollDoneRef = useRef(false);

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

  const scrollTimelineToTop = useCallback(() => {
    timelineScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

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

  const taglineGuest = channel ? channelHeroTagline(emptyKind, channel.network.name) : '';

  const fixedMemberWorkspace = !loading && !!channel?.isMember;

  useEffect(() => {
    initialTimelineScrollDoneRef.current = false;
  }, [id]);

  useLayoutEffect(() => {
    if (!fixedMemberWorkspace || loadingMsgs) return;
    const el = timelineScrollRef.current;
    if (!el || messages.length === 0) return;
    if (!initialTimelineScrollDoneRef.current) {
      el.scrollTop = el.scrollHeight;
      initialTimelineScrollDoneRef.current = true;
    }
  }, [fixedMemberWorkspace, loadingMsgs, messages]);

  const scrollTimelineToBottom = useCallback(() => {
    const el = timelineScrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, []);

  const memberWorkspace = channel?.isMember ? (
    <>
      <div
        className="theme-page-bg fixed left-0 right-0 z-[5] mx-auto flex min-h-0 w-full max-w-md flex-col overflow-hidden shadow-none"
        style={{
          top: 'var(--toot-navbar-height)',
          bottom: 'var(--toot-bottom-nav-height)',
        }}
      >
        <CommunityWorkspaceShell withWorkspaceGradient fixedWorkspace>
          <CommunityWorkspaceHeaderBar>
            <CommunityBackButton onClick={() => router.back()} />
            {id ? (
              <Link
                href={`/channels/${encodeURIComponent(id)}/info`}
                className="flex min-w-0 max-w-[46%] flex-1 items-center gap-2 rounded-xl px-1 py-0.5 text-right transition hover:bg-[var(--surface-soft)] sm:max-w-[55%]"
              >
                <CommunityAvatarInitial letter={titleInitial} label={channel.name} size="md" />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-black text-[var(--text-primary)]">{channel.name}</p>
                  <p className="text-[10px] text-[var(--text-secondary)]">کانال انتشار</p>
                </div>
              </Link>
            ) : (
              <div className="min-w-0 flex-1" />
            )}
            {id ? (
              <Link
                href={`/channels/${encodeURIComponent(id)}/info`}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-600 transition hover:bg-[var(--surface-soft)]"
                aria-label="اطلاعات کانال"
                title="اطلاعات کانال"
              >
                <span className="text-base" aria-hidden>
                  ⓘ
                </span>
              </Link>
            ) : null}
          </CommunityWorkspaceHeaderBar>

          {error ? (
            <div className="shrink-0 border-b border-red-200/80 bg-red-50/90 px-3 py-2 text-center text-[11px] font-semibold text-red-800">
              {error}
            </div>
          ) : null}

          {id ? (
            <ChannelActionStrip
              channelId={id}
              networkId={channel.networkId}
              canShowComposer={!!canShowComposer}
              canManageSchedule={canManageSchedule}
              canManagePins={canManagePins}
              onOpenTools={() => setToolsOpen(true)}
              scrollTimelineToTop={scrollTimelineToTop}
            />
          ) : null}

          {pinnedMessage ? (
            <ChannelPinnedStrip message={pinnedMessage} onOpenTools={() => setToolsOpen(true)} />
          ) : null}

          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-2 sm:px-2.5">
            <div
              ref={timelineScrollRef}
              id="channel-feed-anchor"
              className="channel-timeline-scroll min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-0.5 [-webkit-overflow-scrolling:touch]"
            >
              {id ? (
                <div className="pt-2">
                  <ChannelFeaturedZone
                    channelId={id}
                    pinnedPost={pinnedMessage}
                    pinnedPresentation="external"
                    newestPost={newestPost}
                    onOpenTools={() => setToolsOpen(true)}
                    canPost={!!canShowComposer}
                    onTimelineExcludeId={onTimelineExclude}
                  />
                </div>
              ) : null}

              <CommunityTimelineFrame
                title="انتشارات"
                subtitle="پست‌های کانال"
                className="mt-3 border-0 bg-transparent p-0 shadow-none"
              >
                {loadingMsgs ? (
                  <p className="theme-text-secondary mt-3 px-1 text-xs">بارگذاری فید…</p>
                ) : messages.length === 0 ? (
                  <div className="mt-3 rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--surface-soft)]/90 px-4 py-8 text-center">
                    <p className="text-[15px] font-black text-[var(--text-primary)]">{emptyCopy.title}</p>
                    <p className="theme-text-secondary mt-2 text-[13px] leading-relaxed">{emptyCopy.subtitle}</p>
                    {!canShowComposer ? (
                      <p className="theme-text-secondary mt-4 text-[12px] font-medium">{emptyCopy.cta}</p>
                    ) : null}
                    {canShowComposer && emptyCopy.cta ? (
                      <p className="mt-4 text-[12px] font-black text-[var(--accent-hover)]">{emptyCopy.cta}</p>
                    ) : null}
                    {!canShowComposer && channel.postingMode !== 'ALL_MEMBERS' ? (
                      <p className="theme-text-secondary mt-3 text-[11px]">
                        فقط نقش‌های مجاز می‌توانند منتشر کنند؛ شما مخاطب فید هستید.
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-3 pr-0.5">
                    <ul className="space-y-4">
                      {timelineMessages.map((m) => (
                        <li key={m.id} id={`channel-msg-${m.id}`}>
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
          </div>

          {canShowComposer && id ? (
            <div className="theme-panel-bg shrink-0 border-t border-[var(--border-soft)] px-0 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
              <ChannelRichComposer
                channelId={id}
                id="channel-composer-anchor"
                className=""
                sending={sending}
                setSending={setSending}
                onSent={(created) => {
                  setSendErr(null);
                  setMessages((prev) => {
                    if (prev.some((m) => m.id === created.id)) return prev;
                    return [...prev, created];
                  });
                  setChannel((c) => (c ? { ...c, postCount: (c.postCount ?? 0) + 1 } : c));
                  scrollTimelineToBottom();
                }}
                onError={setSendErr}
              />
              {sendErr ? <p className="mt-2 text-center text-[11px] font-semibold text-red-700">{sendErr}</p> : null}
            </div>
          ) : null}

          {!canShowComposer ? (
            <div className="shrink-0 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1">
              <CommunityReadOnlyComposerBar>
                {readOnlyHintForPostingMode(channel.postingMode)}{' '}
                <span className="opacity-90">برای گفت‌وگوی آزاد، گروه مرتبط را باز کنید.</span>
              </CommunityReadOnlyComposerBar>
            </div>
          ) : null}
        </CommunityWorkspaceShell>
      </div>

      {id ? (
        <CommunityToolsSheet open={toolsOpen} onClose={() => setToolsOpen(false)} targetType="CHANNEL" targetId={id} />
      ) : null}
    </>
  ) : null;

  return (
    <AuthGate>
      {loading && !channel ? (
        <CommunityWorkspaceShell withWorkspaceGradient>
          <CommunityWorkspaceHeaderBar>
            <CommunityBackButton onClick={() => router.back()} />
            <span className="text-[12px] text-[var(--text-secondary)]">در حال بارگذاری…</span>
          </CommunityWorkspaceHeaderBar>
        </CommunityWorkspaceShell>
      ) : null}

      {!loading && channel && channel.isMember ? memberWorkspace : null}

      {!loading && channel && !channel.isMember ? (
        <CommunityWorkspaceShell withWorkspaceGradient>
          <CommunityWorkspaceHeaderBar>
            <CommunityBackButton onClick={() => router.back()} />
            <div className="min-w-0 flex-1 text-right">
              <p className="theme-text-primary truncate text-[12px] font-black">کانال</p>
              <p className="truncate text-[10px] text-stone-500">{channel.name}</p>
            </div>
            {id ? (
              <Link
                href={`/channels/${encodeURIComponent(id)}/info`}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-600 transition hover:bg-[var(--surface-soft)]"
                aria-label="اطلاعات کانال"
                title="اطلاعات کانال"
              >
                <span className="text-base" aria-hidden>
                  ⓘ
                </span>
              </Link>
            ) : null}
          </CommunityWorkspaceHeaderBar>

          <div className="px-2.5 pb-10 pt-4 sm:px-3">
            <div className={`rounded-2xl border border-[var(--border-soft)] bg-[var(--card-bg)] p-4 shadow-sm`}>
              <div className="flex gap-3">
                <CommunityAvatarInitial letter={titleInitial} label={channel.name} size="lg" />
                <div className="min-w-0 flex-1 text-right">
                  <h2 className="theme-text-primary text-[16px] font-black leading-tight">{channel.name}</h2>
                  <p className="theme-text-secondary mt-1 line-clamp-3 text-[12px] leading-relaxed">{taglineGuest}</p>
                  {id ? (
                    <Link
                      href={`/channels/${encodeURIComponent(id)}/info`}
                      className="mt-2 inline-block text-[11px] font-extrabold text-[var(--accent-hover)] underline-offset-2 hover:underline"
                    >
                      مشاهده جزئیات
                    </Link>
                  ) : null}
                </div>
              </div>
              {error ? <p className="mt-3 text-center text-[11px] font-semibold text-red-700">{error}</p> : null}
              <button
                type="button"
                disabled={joining}
                onClick={() => void joinChannel()}
                className="mt-4 w-full rounded-xl bg-violet-700 px-4 py-3 text-sm font-bold text-white shadow-md transition hover:bg-violet-800 disabled:opacity-50"
              >
                {joining ? '…' : 'پیوستن به کانال'}
              </button>
            </div>
          </div>
        </CommunityWorkspaceShell>
      ) : null}

      {!loading && !channel && fallbackNetworkId ? (
        <div className="px-3 pt-4">
          <CommunityWorkspaceHeaderBar>
            <CommunityBackButton onClick={() => router.back()} />
          </CommunityWorkspaceHeaderBar>
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-950">
            <p className="font-bold">دسترسی به کانال</p>
            <p className="mt-2 text-xs leading-relaxed">
              احتمالاً هنوز عضو شبکه این کانال نیستید. ابتدا عضو شوید.
            </p>
            <Link
              href={`/networks/${encodeURIComponent(fallbackNetworkId)}`}
              className="mt-3 inline-block text-xs font-bold text-sky-800 underline"
            >
              مشاهده شبکه
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

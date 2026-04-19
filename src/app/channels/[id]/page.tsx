'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { AuthGate } from '@/components/AuthGate';
import { getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { CommunityToolsSheet } from '@/components/capability/CommunityToolsSheet';
import { CommunityTextComposer } from '@/components/community/CommunityTextComposer';
import { ChannelLinkedToolsPreview } from '@/components/community/ChannelLinkedToolsPreview';
import {
  channelEmptyStateCopy,
  channelRoleHintFa,
  networkTypeBadgeFa,
  POSTING_MODE_FA,
  readOnlyHintForPostingMode,
  resolveChannelEmptyKind,
  spaceCategoryBadgeFa,
  CHANNEL_ROLE_FA,
} from '@/components/community/channelRichLabels';
import {
  CommunityAvatarInitial,
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

type ChannelMsg = {
  id: string;
  content: string | null;
  createdAt: string;
  sender: { id: string; name: string };
  media?: { url: string; mimeType?: string } | null;
};

function fmtCount(n: number | undefined): string {
  if (n === undefined || Number.isNaN(n)) return '—';
  try {
    return n.toLocaleString('fa-IR');
  } catch {
    return String(n);
  }
}

function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fa-IR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
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
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendErr, setSendErr] = useState<string | null>(null);

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

  const loadMessages = useCallback(async () => {
    const token = getAccessToken();
    if (!token || !id) return;
    setLoadingMsgs(true);
    try {
      const res = await apiFetch<{ data: ChannelMsg[]; meta?: { total?: number } }>(
        `channels/${encodeURIComponent(id)}/messages?limit=40`,
        { method: 'GET', token },
      );
      setMessages(Array.isArray(res?.data) ? res.data : []);
    } catch {
      setMessages([]);
    } finally {
      setLoadingMsgs(false);
    }
  }, [id]);

  useEffect(() => {
    void loadChannel();
  }, [loadChannel]);

  useEffect(() => {
    if (channel?.isMember) void loadMessages();
    else setMessages([]);
  }, [channel?.id, channel?.isMember, loadMessages]);

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

  const lastActivityHint = useMemo(() => {
    if (!messages.length) return null;
    const last = messages[messages.length - 1];
    if (!last?.createdAt) return null;
    return `آخرین انتشار: ${fmtDateTime(last.createdAt)}`;
  }, [messages]);

  async function sendMessage() {
    const token = getAccessToken();
    if (!token || !id || !draft.trim() || sending) return;
    setSending(true);
    setSendErr(null);
    try {
      await apiFetch(`channels/${encodeURIComponent(id)}/messages`, {
        method: 'POST',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: draft.trim() }),
      });
      setDraft('');
      await Promise.all([loadMessages(), loadChannel()]);
    } catch (e) {
      setSendErr(e instanceof Error ? e.message : 'ارسال نشد');
    } finally {
      setSending(false);
    }
  }

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
  const emptyCopy = channel
    ? channelEmptyStateCopy(emptyKind, !!channel.isMember && !!canShowComposer)
    : { title: '', subtitle: '' };

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
            <CommunityWorkspaceHeaderBar>
              <CommunityBackButton onClick={() => router.back()} />
              <Link
                href="/spaces"
                className="shrink-0 rounded-full px-1.5 py-1 text-[10px] font-extrabold text-[var(--accent-hover)] hover:underline"
              >
                فضاها
              </Link>
              <CommunityAvatarInitial letter={titleInitial} label={channel.name} size="lg" />
              <div className="min-w-0 flex-1 text-right">
                <h1 className="theme-text-primary line-clamp-2 text-[15px] font-black leading-snug">{channel.name}</h1>
                <p className="mt-0.5 truncate text-[10px] text-stone-500">
                  <Link
                    href={`/networks/${channel.networkId}`}
                    className="font-semibold text-[var(--accent-hover)] hover:underline"
                  >
                    {channel.network.name}
                  </Link>
                  {channel.memberCount !== undefined ? (
                    <span className="text-stone-400"> · {fmtCount(channel.memberCount)} عضو</span>
                  ) : null}
                  {channel.postCount !== undefined ? (
                    <span className="text-stone-400"> · {fmtCount(channel.postCount)} انتشار</span>
                  ) : null}
                </p>
              </div>
              {channel.isMember && id ? (
                <CommunityToolsTrigger onClick={() => setToolsOpen(true)} title="ابزارهای کانال" />
              ) : null}
            </CommunityWorkspaceHeaderBar>

            <div className="flex min-h-0 flex-1 flex-col px-2.5 pb-10 pt-2 sm:px-3">
              {/* Identity & context — publication-first, not chat-room */}
              <section className="theme-card-bg theme-border-soft relative overflow-hidden rounded-2xl border shadow-md">
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(99,102,241,0.07)_0%,transparent_52%)]" />
                <div className="relative p-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {spaceCategoryBadgeFa(channel.spaceCategory ?? channel.network.spaceCategory) ? (
                      <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-extrabold text-violet-800 ring-1 ring-violet-300/40">
                        {spaceCategoryBadgeFa(channel.spaceCategory ?? channel.network.spaceCategory)}
                      </span>
                    ) : null}
                    {networkTypeBadgeFa(channel.network.networkType) ? (
                      <span className="rounded-full bg-slate-500/10 px-2 py-0.5 text-[10px] font-extrabold text-slate-700 ring-1 ring-slate-300/50">
                        {networkTypeBadgeFa(channel.network.networkType)}
                      </span>
                    ) : null}
                    {channel.postingMode ? (
                      <span
                        className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-extrabold text-emerald-900 ring-1 ring-emerald-400/30"
                        title="حالت ارسال در کانال"
                      >
                        ارسال: {POSTING_MODE_FA[channel.postingMode] ?? channel.postingMode}
                      </span>
                    ) : null}
                    {channel.network.networkType === 'BUSINESS' &&
                    channel.openJobsCount != null &&
                    channel.openJobsCount > 0 ? (
                      <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-extrabold text-sky-900 ring-1 ring-sky-400/35">
                        فرصت شغلی فعال: {fmtCount(channel.openJobsCount)}
                      </span>
                    ) : null}
                  </div>

                  {channel.description?.trim() ? (
                    <p className="theme-text-secondary mt-3 text-[13px] leading-relaxed">{channel.description.trim()}</p>
                  ) : (
                    <p className="theme-text-secondary mt-3 text-[12px] leading-relaxed opacity-90">
                      {emptyKind === 'neighborhood'
                        ? 'کانال اطلاع‌رسانی محله — اخبار و اعلان‌ها را اینجا دنبال کنید.'
                        : emptyKind === 'business'
                          ? 'کانال رسمی سازمان — اعلان‌ها و فرصت‌ها در یک فید منظم.'
                          : 'فضای انتشار متمرکز برای این شبکه؛ پیام‌ها به‌صورت فید نمایش داده می‌شوند.'}
                    </p>
                  )}

                  {channel.isMember && channel.myRole ? (
                    <p className="mt-2 text-[11px] font-medium text-[var(--text-secondary)]">
                      {channelRoleHintFa(channel.myRole, true) ?? (
                        <>
                          نقش شما: {CHANNEL_ROLE_FA[channel.myRole] ?? channel.myRole}
                        </>
                      )}
                    </p>
                  ) : null}

                  {channel.isMember && lastActivityHint ? (
                    <p className="mt-1.5 text-[10px] text-stone-500">{lastActivityHint}</p>
                  ) : null}

                  {error ? <p className="mt-3 text-xs font-semibold text-red-700">{error}</p> : null}

                  {!channel.isMember ? (
                    <button
                      type="button"
                      disabled={joining}
                      onClick={() => void joinChannel()}
                      className="mt-4 w-full rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-violet-800 disabled:opacity-50"
                    >
                      {joining ? '…' : 'پیوستن به کانال'}
                    </button>
                  ) : null}
                </div>
              </section>

              {channel.isMember && id ? (
                <div className="mt-3">
                  <ChannelLinkedToolsPreview channelId={id} maxItems={2} onOpenTools={() => setToolsOpen(true)} />
                </div>
              ) : null}

              {channel.isMember ? (
                <CommunityTimelineFrame title="فید انتشار" className="mt-3 min-h-[200px]">
                  {loadingMsgs ? (
                    <p className="theme-text-secondary mt-3 px-1 text-xs">بارگذاری انتشارات…</p>
                  ) : messages.length === 0 ? (
                    <div className="mt-4 rounded-xl border border-dashed border-[var(--border-soft)] bg-[var(--surface-soft)]/80 px-4 py-6 text-center">
                      <p className="text-sm font-black text-[var(--text-primary)]">{emptyCopy.title}</p>
                      <p className="theme-text-secondary mt-2 text-[12px] leading-relaxed">{emptyCopy.subtitle}</p>
                      {!canShowComposer && channel.isMember ? (
                        <p className="theme-text-secondary mt-3 text-[11px]">
                          {channel.postingMode === 'ALL_MEMBERS'
                            ? 'با نقش فعلی فقط مشاهده دارید؛ برای ارسال با مدیر هماهنگ شوید.'
                            : 'فقط مدیران و ناشران می‌توانند اینجا منتشر کنند؛ شما مشترک هستید.'}
                        </p>
                      ) : null}
                      {canShowComposer && emptyCopy.cta ? (
                        <p className="mt-4 text-[11px] font-bold text-[var(--accent-hover)]">{emptyCopy.cta}</p>
                      ) : null}
                    </div>
                  ) : (
                    <ul className="mt-3 max-h-[min(52vh,24rem)] flex-1 space-y-3 overflow-y-auto overscroll-contain pr-0.5">
                      {messages.map((m) => (
                        <li
                          key={m.id}
                          className="relative overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--card-bg)] shadow-sm"
                        >
                          <div className="absolute right-0 top-0 h-full w-1 rounded-l bg-gradient-to-b from-violet-400/90 to-indigo-500/80" />
                          <div className="px-3.5 py-3 pl-3">
                            <div className="flex items-baseline justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-[10px] font-extrabold uppercase tracking-wide text-violet-700/90">
                                  انتشار کانال
                                </p>
                                <p className="theme-text-primary mt-0.5 truncate text-[13px] font-bold">{m.sender.name}</p>
                              </div>
                              <time
                                className="shrink-0 text-[10px] tabular-nums text-[var(--text-secondary)]"
                                dateTime={m.createdAt}
                                dir="ltr"
                              >
                                {fmtDateTime(m.createdAt)}
                              </time>
                            </div>
                            {m.content?.trim() ? (
                              <p className="theme-text-primary mt-2 whitespace-pre-wrap text-[14px] leading-relaxed">
                                {m.content}
                              </p>
                            ) : m.media?.url ? (
                              <a
                                href={m.media.url}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--accent-hover)] underline"
                              >
                                پیوست رسانه
                              </a>
                            ) : (
                              <p className="theme-text-secondary mt-2 text-[12px]">(بدون متن)</p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CommunityTimelineFrame>
              ) : null}

              {channel.isMember && canShowComposer ? (
                <CommunityTextComposer
                  value={draft}
                  onChange={setDraft}
                  onSubmit={() => void sendMessage()}
                  sending={sending}
                  error={sendErr}
                  hint={null}
                  title="انتشار در کانال"
                  placeholder="متن انتشار را بنویسید…"
                  className="mt-3 shrink-0"
                />
              ) : null}

              {channel.isMember && !canShowComposer ? (
                <CommunityReadOnlyComposerBar>
                  {readOnlyHintForPostingMode(channel.postingMode)}
                  {' '}
                  <span className="opacity-80">
                    {channel.myRole === 'SUBSCRIBER' ? 'شما در حالت مشترک هستید.' : ''}
                  </span>
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

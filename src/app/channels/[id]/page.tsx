'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { AuthGate } from '@/components/AuthGate';
import { getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { CommunityToolsSheet } from '@/components/capability/CommunityToolsSheet';
import { CommunityTextComposer } from '@/components/community/CommunityTextComposer';
import {
  CommunityAvatarInitial,
  CommunityBackButton,
  CommunityReadOnlyComposerBar,
  CommunityTimelineFrame,
  CommunityToolsTrigger,
  CommunityWorkspaceHeaderBar,
  CommunityWorkspaceShell,
} from '@/components/community/CommunityWorkspace';

type ChannelPayload = {
  id: string;
  name: string;
  description: string | null;
  networkId: string;
  postingMode?: string;
  network: { id: string; name: string };
  isMember: boolean;
  myRole: string | null;
  canPost?: boolean;
};

const POSTING_MODE_FA: Record<string, string> = {
  ADMINS_ONLY: 'ارسال: فقط مدیر کانال',
  PUBLISHERS_AND_ADMINS: 'ارسال: ناشر و مدیر',
  ALL_MEMBERS: 'ارسال: همه اعضا',
};

type ChannelMsg = {
  id: string;
  content: string | null;
  createdAt: string;
  sender: { id: string; name: string };
  media?: { url: string; mimeType?: string } | null;
};

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
      const res = await apiFetch<{ data: ChannelMsg[] }>(
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
      await loadMessages();
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

  const headerSubtitle = channel ? (
    <>
      <Link href={`/networks/${channel.networkId}`} className="font-semibold text-[var(--accent-hover)] hover:underline">
        {channel.network.name}
      </Link>
      {channel.postingMode ? (
        <span className="text-stone-400"> · {POSTING_MODE_FA[channel.postingMode] ?? channel.postingMode}</span>
      ) : null}
    </>
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
            <CommunityWorkspaceHeaderBar>
              <CommunityBackButton onClick={() => router.back()} />
              <Link
                href="/spaces"
                className="shrink-0 rounded-full px-1.5 py-1 text-[10px] font-extrabold text-[var(--accent-hover)] hover:underline"
              >
                فضاها
              </Link>
              <CommunityAvatarInitial letter={titleInitial} label={channel.name} />
              <div className="min-w-0 flex-1 text-right">
                <h1 className="theme-text-primary truncate text-[15px] font-bold leading-tight">{channel.name}</h1>
                <p className="mt-0.5 truncate text-[11px] text-stone-500">{headerSubtitle}</p>
                {channel.myRole ? (
                  <p className="mt-0.5 truncate text-[10px] text-stone-400">نقش شما: {channel.myRole}</p>
                ) : null}
              </div>
              {channel.isMember && id ? (
                <CommunityToolsTrigger onClick={() => setToolsOpen(true)} title="ابزارهای کانال" />
              ) : null}
            </CommunityWorkspaceHeaderBar>

            <div className="flex min-h-0 flex-1 flex-col px-2.5 pb-8 pt-2 sm:px-3">
              <div className="theme-card-bg theme-border-soft rounded-2xl border p-4 shadow-sm">
                {channel.description ? (
                  <p className="theme-text-secondary text-sm leading-relaxed">{channel.description}</p>
                ) : (
                  <p className="theme-text-secondary text-[11px]">کانال انتشاراتی — پیام‌ها در بخش پایین.</p>
                )}

                {error ? <p className="mt-3 text-xs font-semibold text-red-700">{error}</p> : null}

                {!channel.isMember ? (
                  <button
                    type="button"
                    disabled={joining}
                    onClick={() => void joinChannel()}
                    className="mt-4 w-full rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {joining ? '…' : 'پیوستن به کانال'}
                  </button>
                ) : (
                  <p className="mt-3 text-[12px] font-bold text-emerald-800">عضو کانال هستید</p>
                )}
              </div>

              {channel.isMember ? (
                <CommunityTimelineFrame title="پیام‌ها" className="mt-3 min-h-[180px]">
                  {loadingMsgs ? (
                    <p className="theme-text-secondary mt-3 px-1 text-xs">بارگذاری پیام‌ها…</p>
                  ) : messages.length === 0 ? (
                    <p className="theme-text-secondary mt-3 px-1 text-xs">هنوز پیامی نیست</p>
                  ) : (
                    <ul className="mt-2 max-h-[min(50vh,22rem)] flex-1 space-y-2 overflow-y-auto overscroll-contain">
                      {messages.map((m) => (
                        <li
                          key={m.id}
                          className="theme-card-bg theme-border-soft rounded-xl border px-3 py-2 text-xs shadow-sm"
                        >
                          <div className="theme-text-secondary flex justify-between gap-2 text-[10px]">
                            <span className="theme-text-primary font-bold">{m.sender.name}</span>
                            <span dir="ltr">{new Date(m.createdAt).toLocaleString('fa-IR')}</span>
                          </div>
                          {m.content?.trim() ? (
                            <p className="theme-text-primary mt-1 whitespace-pre-wrap text-sm">{m.content}</p>
                          ) : m.media?.url ? (
                            <a
                              href={m.media.url}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1 inline-block text-[var(--accent-hover)] underline"
                            >
                              رسانه
                            </a>
                          ) : (
                            <p className="theme-text-secondary mt-1">(بدون متن)</p>
                          )}
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
                  title="ارسال در کانال"
                  placeholder="پیام خود را بنویسید…"
                  className="mt-3 shrink-0"
                />
              ) : null}

              {channel.isMember && !canShowComposer ? (
                <CommunityReadOnlyComposerBar>
                  فقط مدیران، ناشران یا نقش تعیین‌شده می‌توانند در این کانال پست بگذارند. حالت انتشار طبق تنظیمات کانال است.
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

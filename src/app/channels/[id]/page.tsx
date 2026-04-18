'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { AuthGate } from '@/components/AuthGate';
import { getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { CommunityToolsSheet } from '@/components/capability/CommunityToolsSheet';

type ChannelPayload = {
  id: string;
  name: string;
  description: string | null;
  networkId: string;
  postingMode?: string;
  network: { id: string; name: string };
  isMember: boolean;
  myRole: string | null;
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

  return (
    <AuthGate>
      <main className="theme-page-bg theme-text-primary mx-auto flex min-h-[70vh] w-full max-w-md flex-col px-4 pb-10 pt-2" dir="rtl">
        <div className="mb-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="theme-text-secondary flex h-10 min-w-[2.5rem] items-center justify-center rounded-full hover:bg-[var(--surface-soft)]"
            aria-label="بازگشت"
          >
            ←
          </button>
          <Link href="/spaces" className="text-xs font-bold text-[var(--accent-hover)] underline">
            فضاها
          </Link>
        </div>

        {loading ? (
          <p className="theme-text-secondary text-sm">در حال بارگذاری…</p>
        ) : channel ? (
          <>
            <div className="theme-card-bg theme-border-soft rounded-2xl border p-5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <h1 className="theme-text-primary min-w-0 flex-1 text-xl font-extrabold">{channel.name}</h1>
                {channel.isMember && id ? (
                  <button
                    type="button"
                    onClick={() => setToolsOpen(true)}
                    className="flex shrink-0 items-center gap-1 rounded-full border border-[var(--border-soft)] bg-[var(--surface-soft)] px-2.5 py-1.5 text-[11px] font-extrabold text-[var(--text-primary)] shadow-sm transition hover:bg-[var(--card-bg)]"
                  >
                    <span aria-hidden>🧰</span>
                    <span className="max-[380px]:hidden">ابزارها</span>
                  </button>
                ) : null}
              </div>
              <p className="theme-text-secondary mt-1 text-xs">
                شبکه:{' '}
                <Link href={`/networks/${channel.networkId}`} className="font-bold text-[var(--accent-hover)] underline">
                  {channel.network.name}
                </Link>
              </p>
              {channel.postingMode ? (
                <p className="theme-text-secondary mt-1 text-[11px]">
                  {POSTING_MODE_FA[channel.postingMode] ?? channel.postingMode}
                </p>
              ) : null}
              {channel.myRole ? (
                <p className="theme-text-secondary mt-0.5 text-[10px]">نقش شما: {channel.myRole}</p>
              ) : null}
              {channel.description ? (
                <p className="theme-text-secondary mt-3 text-sm leading-relaxed">{channel.description}</p>
              ) : null}

              {error ? <p className="mt-3 text-xs font-semibold text-red-700">{error}</p> : null}

              {!channel.isMember ? (
                <button
                  type="button"
                  disabled={joining}
                  onClick={() => void joinChannel()}
                  className="mt-4 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  {joining ? '…' : 'پیوستن به کانال'}
                </button>
              ) : (
                <p className="mt-4 text-sm font-bold text-emerald-800">عضو کانال هستید</p>
              )}
            </div>

            {channel.isMember ? (
              <section className="theme-panel-bg theme-border-soft mt-6 flex-1 rounded-2xl border p-3">
                <h2 className="theme-text-secondary px-1 text-xs font-extrabold">آخرین پیام‌ها</h2>
                {loadingMsgs ? (
                  <p className="theme-text-secondary mt-3 px-1 text-xs">بارگذاری پیام‌ها…</p>
                ) : messages.length === 0 ? (
                  <p className="theme-text-secondary mt-3 px-1 text-xs">هنوز پیامی نیست</p>
                ) : (
                  <ul className="mt-2 max-h-[55vh] space-y-2 overflow-y-auto">
                    {messages.map((m) => (
                      <li key={m.id} className="theme-card-bg theme-border-soft rounded-xl border px-3 py-2 text-xs shadow-sm">
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
              </section>
            ) : null}

            {channel.isMember && id ? (
              <CommunityToolsSheet
                open={toolsOpen}
                onClose={() => setToolsOpen(false)}
                targetType="CHANNEL"
                targetId={id}
              />
            ) : null}
          </>
        ) : fallbackNetworkId ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-950">
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
        ) : error ? (
          <p className="text-sm font-semibold text-red-700">{error}</p>
        ) : (
          <p className="theme-text-secondary text-sm">کانال پیدا نشد</p>
        )}
      </main>
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

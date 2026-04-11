'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { AuthGate } from '@/components/AuthGate';
import { getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';

type ChannelPayload = {
  id: string;
  name: string;
  description: string | null;
  networkId: string;
  network: { id: string; name: string };
  isMember: boolean;
  myRole: string | null;
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
      <main className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col px-4 pb-10 pt-2" dir="rtl">
        <div className="mb-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-10 min-w-[2.5rem] items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
            aria-label="بازگشت"
          >
            ←
          </button>
          <Link href="/spaces" className="text-xs font-bold text-sky-700 underline">
            فضاها
          </Link>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">در حال بارگذاری…</p>
        ) : channel ? (
          <>
            <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
              <h1 className="text-xl font-extrabold text-slate-900">{channel.name}</h1>
              <p className="mt-1 text-xs text-slate-500">
                شبکه:{' '}
                <Link href={`/networks/${channel.networkId}`} className="font-bold text-sky-700 underline">
                  {channel.network.name}
                </Link>
              </p>
              {channel.description ? (
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{channel.description}</p>
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
              <section className="mt-6 flex-1 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3">
                <h2 className="px-1 text-xs font-extrabold text-slate-600">آخرین پیام‌ها</h2>
                {loadingMsgs ? (
                  <p className="mt-3 px-1 text-xs text-slate-500">بارگذاری پیام‌ها…</p>
                ) : messages.length === 0 ? (
                  <p className="mt-3 px-1 text-xs text-slate-500">هنوز پیامی نیست</p>
                ) : (
                  <ul className="mt-2 max-h-[55vh] space-y-2 overflow-y-auto">
                    {messages.map((m) => (
                      <li key={m.id} className="rounded-xl bg-white px-3 py-2 text-xs shadow-sm ring-1 ring-slate-100">
                        <div className="flex justify-between gap-2 text-[10px] text-slate-500">
                          <span className="font-bold text-slate-800">{m.sender.name}</span>
                          <span dir="ltr">{new Date(m.createdAt).toLocaleString('fa-IR')}</span>
                        </div>
                        {m.content?.trim() ? (
                          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{m.content}</p>
                        ) : m.media?.url ? (
                          <a
                            href={m.media.url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-block text-sky-700 underline"
                          >
                            رسانه
                          </a>
                        ) : (
                          <p className="mt-1 text-slate-400">(بدون متن)</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
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
          <p className="text-sm text-slate-500">کانال پیدا نشد</p>
        )}
      </main>
    </AuthGate>
  );
}

export default function ChannelDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="px-4 py-10 text-center text-sm text-slate-500" dir="rtl">
          در حال بارگذاری…
        </div>
      }
    >
      <ChannelDetailInner />
    </Suspense>
  );
}

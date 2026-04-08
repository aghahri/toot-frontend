'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AuthGate } from '@/components/AuthGate';
import { getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  DirectConversationRow,
  type DirectConversationRowMessage,
} from '@/components/direct/DirectConversationRow';

type Conversation = {
  id: string;
  createdAt: string;
  updatedAt: string;
  participants: Array<{
    id: string;
    userId: string;
    user: {
      id: string;
      name: string;
      avatar: string | null;
    };
  }>;
  messages: Array<DirectConversationRowMessage>;
  /** Present when the API returns direct unread metadata. */
  unreadCount?: number;
  lastMessage?: DirectConversationRowMessage;
  lastActivityAt?: string;
};

function ConversationListSkeleton() {
  return (
    <div className="space-y-2" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-[5.25rem] animate-pulse rounded-2xl bg-slate-100/90" />
      ))}
    </div>
  );
}

export default function DirectPage() {
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [otherUserId, setOtherUserId] = useState('');

  async function loadMeAndConversations() {
    const token = getAccessToken();
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const me = await apiFetch<{ id: string; name: string; email: string }>('users/me', {
        method: 'GET',
        token,
      });

      setMyUserId(me.id);

      const conversations = await apiFetch<Conversation[]>('direct/conversations', {
        method: 'GET',
        token,
      });

      setItems(conversations);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در دریافت گفتگوها');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMeAndConversations();
  }, []);

  async function createConversation() {
    const token = getAccessToken();
    if (!token) return;

    const trimmed = otherUserId.trim();
    if (!trimmed) {
      setError('شناسه کاربر مقصد را وارد کنید');
      return;
    }

    try {
      setError(null);

      const conversation = await apiFetch<Conversation>('direct/conversations', {
        method: 'POST',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otherUserId: trimmed }),
      });

      window.location.href = `/direct/${conversation.id}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در ساخت گفتگو');
    }
  }

  return (
    <AuthGate>
      <main className="mx-auto w-full max-w-md px-4 pb-4 pt-3">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">پیام خصوصی</h1>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">گفتگوهای مستقیم شما</p>
          </div>

          <Link
            href="/home"
            className="shrink-0 rounded-xl px-2 py-1.5 text-sm font-semibold text-slate-700 underline-offset-4 hover:underline"
          >
            خانه
          </Link>
        </div>

        <Card>
          <div className="space-y-3">
            <div className="text-sm font-semibold text-slate-800">شروع گفتگو با شناسه کاربر</div>

            <input
              value={otherUserId}
              onChange={(e) => setOtherUserId(e.target.value)}
              placeholder="otherUserId"
              className="w-full rounded-xl border border-slate-200 bg-white p-3.5 text-sm outline-none transition-colors focus:border-slate-400"
            />

            <Button type="button" onClick={createConversation}>
              ساخت / باز کردن گفتگو
            </Button>

            {myUserId ? (
              <div className="break-all text-[11px] leading-relaxed text-slate-500">
                شناسه شما: {myUserId}
              </div>
            ) : null}
          </div>
        </Card>

        <div className="mt-6 flex items-center justify-between gap-2">
          <h2 className="text-base font-extrabold text-slate-900">گفتگوها</h2>
          <button
            type="button"
            onClick={loadMeAndConversations}
            disabled={loading}
            className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 underline-offset-4 hover:underline disabled:opacity-50"
          >
            {loading ? '…' : 'رفرش'}
          </button>
        </div>

        <div className="mt-3 space-y-2">
          {loading ? (
            <ConversationListSkeleton />
          ) : error ? (
            <div className="rounded-2xl border border-red-100 bg-red-50/90 px-4 py-4">
              <p className="text-sm font-semibold text-red-800">{error}</p>
              <button
                type="button"
                onClick={loadMeAndConversations}
                className="mt-3 text-xs font-semibold text-red-900 underline"
              >
                تلاش دوباره
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/90 px-4 py-10 text-center">
              <p className="text-base font-extrabold text-slate-900">هنوز گفتگویی ندارید</p>
              <p className="mx-auto mt-2 max-w-[18rem] text-sm leading-relaxed text-slate-600">
                با وارد کردن شناسه کاربر بالا، اولین گفتگو را بسازید. لیست اینجا به‌مرور پر می‌شود.
              </p>
            </div>
          ) : (
            items.map((item) => {
              const other =
                item.participants.find((p) => p.user.id !== myUserId)?.user ??
                item.participants[0]?.user;

              const lastMessage = item.lastMessage ?? item.messages[0];
              const preview = lastMessage?.text?.trim()
                ? lastMessage.text
                : 'هنوز پیامی ارسال نشده';
              const previewTimeIso =
                lastMessage?.createdAt ?? item.lastActivityAt ?? item.updatedAt;
              const unreadCount =
                typeof item.unreadCount === 'number' ? item.unreadCount : 0;

              return (
                <DirectConversationRow
                  key={item.id}
                  href={`/direct/${item.id}`}
                  peerName={other?.name ?? 'کاربر'}
                  peerAvatarUrl={other?.avatar ?? null}
                  peerId={other?.id ?? '-'}
                  preview={preview}
                  previewTimeIso={previewTimeIso}
                  myUserId={myUserId}
                  lastMessage={lastMessage}
                  unreadCount={unreadCount}
                />
              );
            })
          )}
        </div>
      </main>
    </AuthGate>
  );
}

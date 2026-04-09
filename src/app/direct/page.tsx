'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AuthGate } from '@/components/AuthGate';
import { getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { IconPlus } from '@/components/MessagingTabIcons';
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
  unreadCount?: number;
  lastMessage?: DirectConversationRowMessage;
  lastActivityAt?: string;
};

function ConversationListSkeleton() {
  return (
    <div className="divide-y divide-stone-100" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex gap-3 bg-white px-4 py-3.5">
          <div className="h-14 w-14 shrink-0 animate-pulse rounded-full bg-stone-100" />
          <div className="min-w-0 flex-1 space-y-2 py-0.5">
            <div className="h-4 w-2/5 animate-pulse rounded bg-stone-100" />
            <div className="h-3 w-full animate-pulse rounded bg-stone-50" />
          </div>
        </div>
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
  const [newChatOpen, setNewChatOpen] = useState(false);

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

      setNewChatOpen(false);
      setOtherUserId('');
      window.location.href = `/direct/${conversation.id}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در ساخت گفتگو');
    }
  }

  return (
    <AuthGate>
      <main className="mx-auto min-h-[60vh] w-full max-w-md bg-stone-100/90 pb-2">
        <div
          className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-stone-200/80 bg-stone-50/95 px-4 py-2.5 backdrop-blur-sm"
          dir="rtl"
        >
          <p className="text-sm font-semibold text-stone-600">گفتگوهای اخیر</p>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={loadMeAndConversations}
              disabled={loading}
              title="رفرش"
              className="flex h-10 w-10 items-center justify-center rounded-full text-stone-600 transition hover:bg-stone-200/80 disabled:opacity-40"
            >
              <span className={`text-lg ${loading ? 'animate-pulse' : ''}`} aria-hidden>
                ↻
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setNewChatOpen(true);
                setError(null);
              }}
              title="گفتگوی جدید"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md shadow-emerald-600/25 transition hover:bg-emerald-600 active:scale-95"
            >
              <IconPlus className="h-6 w-6 stroke-[2.5]" />
            </button>
          </div>
        </div>

        <div className="relative mt-1 overflow-hidden rounded-2xl border border-stone-200/60 bg-white shadow-sm">
          {loading ? (
            <ConversationListSkeleton />
          ) : error && items.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-semibold text-red-800">{error}</p>
              <button
                type="button"
                onClick={loadMeAndConversations}
                className="mt-3 text-xs font-bold text-emerald-700 underline"
              >
                تلاش دوباره
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <p className="text-base font-bold text-stone-900">هنوز گفتگویی ندارید</p>
              <p className="mx-auto mt-2 max-w-[17rem] text-sm leading-relaxed text-stone-500">
                با دکمهٔ سبز <span className="font-bold text-emerald-600">+</span> گفتگوی جدید بسازید.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-stone-100">
              {items.map((item) => {
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
              })}
            </div>
          )}
        </div>

        {error && items.length > 0 ? (
          <div className="mx-4 mt-3 rounded-xl border border-red-100 bg-red-50/90 px-3 py-2 text-center text-xs font-semibold text-red-800">
            {error}
          </div>
        ) : null}

        <div className="mt-4 px-4 text-center">
          <Link
            href="/home"
            className="text-xs font-semibold text-stone-500 underline-offset-2 hover:text-stone-700 hover:underline"
          >
            بازگشت به خانه
          </Link>
        </div>

        {myUserId ? (
          <p className="mt-2 break-all px-4 text-center text-[10px] text-stone-400" dir="ltr">
            شناسه شما: {myUserId}
          </p>
        ) : null}
      </main>

      {newChatOpen ? (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center bg-black/35 p-4 pt-[min(30vh,8rem)] backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-chat-title"
          onClick={() => setNewChatOpen(false)}
          dir="rtl"
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="new-chat-title" className="text-base font-bold text-stone-900">
              گفتگوی جدید
            </h2>
            <p className="mt-1 text-xs text-stone-500">شناسهٔ کاربر مقصد را وارد کنید.</p>

            <input
              value={otherUserId}
              onChange={(e) => setOtherUserId(e.target.value)}
              placeholder="شناسه کاربر"
              className="mt-4 w-full rounded-xl border border-stone-200 bg-stone-50/50 p-3.5 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              dir="ltr"
            />

            {error ? <p className="mt-2 text-xs font-semibold text-red-600">{error}</p> : null}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={createConversation}
                className="min-h-[48px] flex-1 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-600 active:scale-[0.99]"
              >
                شروع گفتگو
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewChatOpen(false);
                  setError(null);
                }}
                className="min-h-[48px] rounded-xl border border-stone-200 px-4 py-3 text-sm font-semibold text-stone-700 hover:bg-stone-50"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AuthGate>
  );
}

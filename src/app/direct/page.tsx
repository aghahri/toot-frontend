'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AuthGate } from '@/components/AuthGate';
import { getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { IconPlus } from '@/components/MessagingTabIcons';
import {
  DirectConversationRow,
  type DirectConversationRowMessage,
} from '@/components/direct/DirectConversationRow';

type PeerUser = {
  id: string;
  name: string;
  avatar: string | null;
  username: string;
  phoneMasked: string;
  lastSeenAt?: string | null;
};

type Conversation = {
  id: string;
  createdAt: string;
  updatedAt: string;
  participants: Array<{
    id: string;
    userId: string;
    user: PeerUser;
  }>;
  messages: Array<DirectConversationRowMessage>;
  unreadCount?: number;
  lastMessage?: DirectConversationRowMessage;
  lastActivityAt?: string;
  peerOnline?: boolean;
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

type UserSearchHit = {
  id: string;
  name: string;
  username: string;
  phoneMasked: string;
};

function peerSubtitle(u: PeerUser | undefined): string {
  if (!u) return '';
  const parts = [`@${u.username}`, u.phoneMasked].filter(Boolean);
  return parts.join(' · ');
}

export default function DirectPage() {
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchHits, setSearchHits] = useState<UserSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    if (!newChatOpen) return;

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchHits([]);
      setSearching(false);
      return;
    }

    searchDebounceRef.current = setTimeout(async () => {
      const token = getAccessToken();
      if (!token) return;

      setSearching(true);
      try {
        const hits = await apiFetch<UserSearchHit[]>(
          `users/search?q=${encodeURIComponent(q)}&limit=20`,
          { method: 'GET', token },
        );
        setSearchHits(Array.isArray(hits) ? hits : []);
      } catch {
        setSearchHits([]);
      } finally {
        setSearching(false);
      }
    }, 320);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery, newChatOpen]);

  async function startConversationWithUser(otherUserId: string) {
    const token = getAccessToken();
    if (!token) return;

    try {
      setError(null);

      const conversation = await apiFetch<Conversation>('direct/conversations', {
        method: 'POST',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otherUserId }),
      });

      setNewChatOpen(false);
      setSearchQuery('');
      setSearchHits([]);
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
                setSearchQuery('');
                setSearchHits([]);
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
                    peerSubtitle={peerSubtitle(other)}
                    preview={preview}
                    previewTimeIso={previewTimeIso}
                    myUserId={myUserId}
                    lastMessage={lastMessage}
                    unreadCount={unreadCount}
                    peerOnline={item.peerOnline === true}
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

      </main>

      {newChatOpen ? (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center bg-black/35 p-4 pt-[min(30vh,8rem)] backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-chat-title"
          onClick={() => {
            setNewChatOpen(false);
            setSearchQuery('');
            setSearchHits([]);
          }}
          dir="rtl"
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="new-chat-title" className="text-base font-bold text-stone-900">
              گفتگوی جدید
            </h2>
            <p className="mt-1 text-xs text-stone-500">
              نام، نام کاربری یا بخشی از شماره موبایل را جستجو کنید (حداقل ۲ نویسه).
            </p>

            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجو…"
              className="mt-4 w-full rounded-xl border border-stone-200 bg-stone-50/50 p-3.5 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              autoComplete="off"
              dir="rtl"
            />

            <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-stone-100 bg-stone-50/40">
              {searchQuery.trim().length < 2 ? (
                <p className="px-3 py-4 text-center text-xs text-stone-400">برای شروع تایپ کنید.</p>
              ) : searching ? (
                <p className="px-3 py-4 text-center text-xs text-stone-500">در حال جستجو…</p>
              ) : searchHits.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-stone-500">نتیجه‌ای یافت نشد.</p>
              ) : (
                <ul className="divide-y divide-stone-100">
                  {searchHits.map((hit) => (
                    <li key={hit.id}>
                      <button
                        type="button"
                        className="flex w-full flex-col items-start gap-0.5 px-3 py-3 text-right transition hover:bg-white"
                        onClick={() => void startConversationWithUser(hit.id)}
                      >
                        <span className="text-sm font-bold text-stone-900">{hit.name}</span>
                        <span className="text-[11px] font-medium text-stone-500" dir="ltr">
                          @{hit.username} · {hit.phoneMasked}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {error ? <p className="mt-2 text-xs font-semibold text-red-600">{error}</p> : null}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setNewChatOpen(false);
                  setError(null);
                  setSearchQuery('');
                  setSearchHits([]);
                }}
                className="min-h-[48px] w-full rounded-xl border border-stone-200 px-4 py-3 text-sm font-semibold text-stone-700 hover:bg-stone-50"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AuthGate>
  );
}

'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  FormEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { io } from 'socket.io-client';
import { AuthGate } from '@/components/AuthGate';
import { getAccessToken } from '@/lib/auth';
import { apiFetch, getApiBaseUrl, getErrorMessageFromResponse } from '@/lib/api';
import { markGroupConversationRead } from '@/lib/mark-group-read';
import { DIRECT_REACTION_EMOJIS } from '@/lib/direct-reactions';
import { clearGroupDraft, getGroupDraft, setGroupDraft } from '@/lib/group-drafts';

const PAGE_SIZE = 40;

type ReplyTo = {
  id: string;
  senderId: string;
  content: string | null;
  createdAt: string;
  deletedAt?: string | null;
  isEdited: boolean;
  sender: { id: string; name: string; avatar: string | null } | null;
};

type GroupMessage = {
  id: string;
  groupId: string;
  senderId: string;
  content: string | null;
  deletedAt?: string | null;
  isEdited?: boolean;
  createdAt: string;
  sender: { id: string; name: string; avatar: string | null };
  media: {
    id: string;
    type: string;
    url: string;
    mimeType: string;
    originalName: string | null;
  } | null;
  replyTo: ReplyTo | null;
  reactions: { emoji: string; count: number; reactedByMe: boolean }[];
};

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dayLabelFa(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fa-IR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

export default function GroupThreadPage() {
  const params = useParams();
  const groupId = typeof params?.id === 'string' ? params.id : '';

  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('');
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<GroupMessage | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [lastReadMessageId, setLastReadMessageId] = useState<string | null>(null);
  const [pinned, setPinned] = useState<GroupMessage | null>(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const [reactionForId, setReactionForId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchHits, setSearchHits] = useState<GroupMessage[]>([]);

  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
  };

  const loadOlder = useCallback(async () => {
    const token = getAccessToken();
    if (!token || !groupId || loadingOlder || !hasMore) return;
    setLoadingOlder(true);
    try {
      const nextOff = offset + PAGE_SIZE;
      const res = await apiFetch<{ data: GroupMessage[]; meta: { hasMore: boolean } }>(
        `groups/${groupId}/messages?offset=${nextOff}&limit=${PAGE_SIZE}`,
        { method: 'GET', token },
      );
      const older = res.data ?? [];
      if (older.length === 0) {
        setHasMore(false);
        return;
      }
      setMessages((prev) => [...older, ...prev]);
      setOffset(nextOff);
      setHasMore(res.meta?.hasMore ?? false);
    } catch {
      /* ignore */
    } finally {
      setLoadingOlder(false);
    }
  }, [groupId, hasMore, loadingOlder, offset]);

  useEffect(() => {
    if (!groupId) return;
    const token = getAccessToken();
    if (!token) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const [me, grp, pack, self, pin] = await Promise.all([
          apiFetch<{ id: string }>('users/me', { method: 'GET', token }),
          apiFetch<{ name: string; memberCount?: number }>(`groups/${groupId}`, { method: 'GET', token }),
          apiFetch<{ data: GroupMessage[]; meta: { hasMore: boolean; total: number } }>(
            `groups/${groupId}/messages?offset=0&limit=${PAGE_SIZE}`,
            { method: 'GET', token },
          ),
          apiFetch<{ lastReadMessageId: string | null }>(`groups/${groupId}/participant-self`, {
            method: 'GET',
            token,
          }),
          apiFetch<{ message: GroupMessage | null }>(`groups/${groupId}/pinned-message`, {
            method: 'GET',
            token,
          }),
        ]);
        if (cancelled) return;
        setMyUserId(me.id);
        setGroupName(grp.name);
        setMemberCount(grp.memberCount ?? null);
        setMessages(pack.data ?? []);
        setOffset(0);
        setHasMore(pack.meta?.hasMore ?? false);
        setLastReadMessageId(self.lastReadMessageId ?? null);
        setPinned(pin.message ?? null);
        setText(getGroupDraft(groupId));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'خطا');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  useLayoutEffect(() => {
    if (!loading && messages.length > 0) scrollToBottom();
  }, [loading, groupId]);

  useEffect(() => {
    if (!groupId) return;
    const token = getAccessToken();
    if (!token) return;
    const mark = () => {
      void markGroupConversationRead(token, groupId).catch(() => {});
    };
    mark();
    const onVis = () => {
      if (document.visibilityState === 'visible') mark();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [groupId]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token || !groupId || !myUserId) return;
    const socket = io(getApiBaseUrl().replace(/\/+$/, ''), {
      transports: ['websocket'],
      auth: { token },
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_group', { groupId });
    });

    socket.on('group_message', (msg: GroupMessage) => {
      if (msg.groupId !== groupId) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      scrollToBottom();
    });

    socket.on(
      'group_message_edited',
      (p: { groupId: string; messageId: string; content: string | null; isEdited: boolean }) => {
        if (p.groupId !== groupId) return;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === p.messageId ? { ...m, content: p.content, isEdited: p.isEdited } : m,
          ),
        );
      },
    );

    socket.on(
      'group_message_deleted',
      (p: { groupId: string; messageId: string; content: null; deletedAt: string | null; media: null }) => {
        if (p.groupId !== groupId) return;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === p.messageId
              ? { ...m, content: null, deletedAt: p.deletedAt, media: null }
              : m,
          ),
        );
        setPinned((pin) => (pin?.id === p.messageId ? null : pin));
      },
    );

    socket.on(
      'message_reaction_added',
      (p: { groupId: string; messageId: string; reactions: GroupMessage['reactions'] }) => {
        if (p.groupId !== groupId) return;
        setMessages((prev) =>
          prev.map((m) => (m.id === p.messageId ? { ...m, reactions: p.reactions ?? [] } : m)),
        );
      },
    );

    socket.on(
      'group_pinned_message_updated',
      (p: { groupId: string; pinnedMessage: GroupMessage | null }) => {
        if (p.groupId !== groupId) return;
        setPinned(p.pinnedMessage ?? null);
      },
    );

    socket.on('group_typing', (p: { groupId: string; userId: string; isTyping: boolean }) => {
      if (p.groupId !== groupId || p.userId === myUserId) return;
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (p.isTyping) {
        setOtherTyping(true);
        typingTimerRef.current = setTimeout(() => {
          setOtherTyping(false);
          typingTimerRef.current = null;
        }, 2000);
      } else {
        setOtherTyping(false);
      }
    });

    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      socket.emit('leave_group', { groupId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [groupId, myUserId]);

  async function uploadMedia(token: string, file: File): Promise<string> {
    const uploadUrl = `${getApiBaseUrl().replace(/\/+$/, '')}/media/upload`;
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!res.ok) throw new Error(await getErrorMessageFromResponse(res));
    const data = (await res.json()) as { media?: { id: string } };
    if (!data.media?.id) throw new Error('آپلود ناقص بود');
    return data.media.id;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const token = getAccessToken();
    if (!token || !groupId || sending) return;
    const trimmed = text.trim();
    const picked = fileInputRef.current?.files?.[0] ?? null;

    if (editingId) {
      if (!trimmed) return;
      setSending(true);
      try {
        await apiFetch(`messages/group/${editingId}`, {
          method: 'PATCH',
          token,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: trimmed }),
        });
        setEditingId(null);
        setText(getGroupDraft(groupId));
        setReplyTo(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'خطا');
      } finally {
        setSending(false);
      }
      return;
    }

    if (!trimmed && !picked) return;

    setSending(true);
    setError(null);
    try {
      let mediaId: string | undefined;
      if (picked) {
        mediaId = await uploadMedia(token, picked);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
      await apiFetch(`groups/${groupId}/messages`, {
        method: 'POST',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: trimmed || undefined,
          mediaId,
          replyToMessageId: replyTo?.id,
        }),
      });
      setText('');
      clearGroupDraft(groupId);
      setReplyTo(null);
      scrollToBottom();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setSending(false);
    }
  }

  async function toggleReaction(msg: GroupMessage, emoji: string) {
    const token = getAccessToken();
    if (!token) return;
    const row = msg.reactions?.find((r) => r.emoji === emoji);
    const reacted = !!row?.reactedByMe;
    try {
      if (reacted) {
        await apiFetch(`messages/group/${msg.id}/reactions/${encodeURIComponent(emoji)}`, {
          method: 'DELETE',
          token,
        });
      } else {
        await apiFetch(`messages/group/${msg.id}/reactions`, {
          method: 'POST',
          token,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emoji }),
        });
      }
    } catch {
      /* ignore */
    }
    setReactionForId(null);
  }

  async function runSearch() {
    const token = getAccessToken();
    if (!token || !groupId || !searchQ.trim()) return;
    try {
      const hits = await apiFetch<GroupMessage[]>(
        `groups/${groupId}/messages/search?q=${encodeURIComponent(searchQ.trim())}&limit=30`,
        { method: 'GET', token },
      );
      setSearchHits(Array.isArray(hits) ? hits : []);
    } catch {
      setSearchHits([]);
    }
  }

  const readIdx =
    lastReadMessageId != null ? messages.findIndex((m) => m.id === lastReadMessageId) : -1;
  const firstUnreadIdx = readIdx >= 0 ? readIdx + 1 : -1;

  return (
    <AuthGate>
      <main
        className="mx-auto min-h-[100dvh] w-full max-w-md bg-[#e5ddd5] pb-28 pt-0"
        dir="rtl"
      >
        <header className="sticky top-0 z-20 border-b border-stone-200/90 bg-[#f8f8f8] px-3 py-2 shadow-sm backdrop-blur-md">
          <div className="flex items-center justify-between gap-2">
            <Link href="/groups" className="shrink-0 text-sm font-bold text-sky-700">
              ←
            </Link>
            <Link href={`/groups/${groupId}/info`} className="min-w-0 flex-1 text-center">
              <div className="truncate text-[15px] font-extrabold text-stone-900">{groupName || 'گروه'}</div>
              <div className="truncate text-[11px] text-stone-500">
                {otherTyping
                  ? 'در حال نوشتن…'
                  : memberCount != null
                    ? `${memberCount} عضو`
                    : 'گفتگوی گروه'}
              </div>
            </Link>
            <button
              type="button"
              className="shrink-0 text-xs font-bold text-sky-700"
              onClick={() => setSearchOpen((v) => !v)}
            >
              جستجو
            </button>
          </div>
          {searchOpen ? (
            <div className="mt-2 flex gap-2 border-t border-stone-100 pt-2">
              <input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="متن…"
                className="min-w-0 flex-1 rounded-lg border border-stone-200 px-2 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={() => void runSearch()}
                className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-bold text-white"
              >
                برو
              </button>
            </div>
          ) : null}
          {searchHits.length > 0 ? (
            <ul className="mt-2 max-h-32 overflow-y-auto rounded-lg bg-white text-xs">
              {searchHits.map((h) => (
                <li key={h.id} className="border-b border-stone-100 px-2 py-1 truncate">
                  {(h.content ?? '').slice(0, 80)}
                </li>
              ))}
            </ul>
          ) : null}
        </header>

        {pinned ? (
          <div className="mx-2 mt-2 rounded-lg border border-amber-200/80 bg-amber-50/95 px-3 py-2 text-xs text-amber-950">
            <span className="font-bold">📌 سنجاق: </span>
            <span>{(pinned.content ?? '').slice(0, 120) || 'رسانه'}</span>
          </div>
        ) : null}

        {loading ? (
          <p className="px-4 py-8 text-center text-sm text-stone-600">در حال بارگذاری…</p>
        ) : error ? (
          <p className="px-4 py-8 text-center text-sm text-red-700">{error}</p>
        ) : (
          <div className="space-y-1 px-2 py-3">
            {hasMore ? (
              <button
                type="button"
                className="mb-2 w-full rounded-lg bg-white/80 py-2 text-xs font-bold text-stone-700 shadow-sm"
                onClick={() => void loadOlder()}
                disabled={loadingOlder}
              >
                {loadingOlder ? '…' : 'پیام‌های قدیمی‌تر'}
              </button>
            ) : null}
            {messages.map((m, idx) => {
              const prev = messages[idx - 1];
              const showDay =
                !prev || !sameDay(new Date(prev.createdAt), new Date(m.createdAt));
              const showUnread = firstUnreadIdx >= 0 && idx === firstUnreadIdx;
              const mine = myUserId != null && m.senderId === myUserId;
              return (
                <div key={m.id}>
                  {showDay ? (
                    <div className="my-2 text-center text-[11px] font-bold text-stone-600">
                      {dayLabelFa(m.createdAt)}
                    </div>
                  ) : null}
                  {showUnread ? (
                    <div className="my-2 flex items-center gap-2 text-[11px] font-bold text-sky-700">
                      <div className="h-px flex-1 bg-sky-300" />
                      پیام‌های خوانده‌نشده
                      <div className="h-px flex-1 bg-sky-300" />
                    </div>
                  ) : null}
                  <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 shadow-sm ${
                        mine ? 'rounded-br-sm bg-sky-100' : 'rounded-bl-sm bg-white'
                      }`}
                    >
                      {!mine ? (
                        <div className="mb-1 text-[11px] font-bold text-emerald-800">{m.sender.name}</div>
                      ) : null}
                      {m.replyTo ? (
                        <div className="mb-1 border-r-2 border-sky-400 pr-2 text-[11px] text-stone-500">
                          {m.replyTo.sender?.name ?? 'کاربر'}: {(m.replyTo.content ?? '').slice(0, 60)}
                        </div>
                      ) : null}
                      {m.deletedAt ? (
                        <p className="text-sm italic text-stone-500">پیام حذف شد</p>
                      ) : m.media ? (
                        m.mimeType?.startsWith('image/') || m.media.type === 'IMAGE' ? (
                          <img src={m.media.url} alt="" className="max-h-56 rounded-lg" />
                        ) : m.mimeType?.startsWith('video/') || m.media.type === 'VIDEO' ? (
                          <video src={m.media.url} controls className="max-h-56 rounded-lg" />
                        ) : m.media.type === 'VOICE' || m.mimeType?.startsWith('audio/') ? (
                          <audio src={m.media.url} controls className="w-full" />
                        ) : (
                          <a
                            href={m.media.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm font-semibold text-sky-700 underline"
                          >
                            {m.media.originalName || 'فایل'}
                          </a>
                        )
                      ) : null}
                      {m.content ? <p className="whitespace-pre-wrap text-sm text-stone-900">{m.content}</p> : null}
                      {m.isEdited ? (
                        <p className="mt-0.5 text-[10px] text-stone-400">ویرایش شده</p>
                      ) : null}
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        {(m.reactions ?? []).map((r) => (
                          <button
                            key={r.emoji}
                            type="button"
                            className={`rounded-full px-2 py-0.5 text-[11px] ${
                              r.reactedByMe ? 'bg-sky-200' : 'bg-stone-100'
                            }`}
                            onClick={() => void toggleReaction(m, r.emoji)}
                          >
                            {r.emoji} {r.count}
                          </button>
                        ))}
                        <button
                          type="button"
                          className="text-[11px] font-bold text-stone-500"
                          onClick={() => setReactionForId((id) => (id === m.id ? null : m.id))}
                        >
                          +
                        </button>
                        {mine && !m.deletedAt ? (
                          <>
                            <button
                              type="button"
                              className="text-[11px] font-bold text-stone-500"
                              onClick={() => {
                                setEditingId(m.id);
                                setText(m.content ?? '');
                                setReplyTo(null);
                              }}
                            >
                              ویرایش
                            </button>
                            <button
                              type="button"
                              className="text-[11px] font-bold text-red-600"
                              onClick={async () => {
                                const token = getAccessToken();
                                if (!token) return;
                                await apiFetch(`messages/group/${m.id}`, { method: 'DELETE', token });
                              }}
                            >
                              حذف
                            </button>
                          </>
                        ) : null}
                        {!mine && !m.deletedAt ? (
                          <button
                            type="button"
                            className="text-[11px] font-bold text-stone-500"
                            onClick={() => setReplyTo(m)}
                          >
                            پاسخ
                          </button>
                        ) : null}
                      </div>
                      {reactionForId === m.id ? (
                        <div className="mt-1 flex flex-wrap gap-1 border-t border-stone-100 pt-1">
                          {DIRECT_REACTION_EMOJIS.map((em) => (
                            <button
                              key={em}
                              type="button"
                              className="text-lg"
                              onClick={() => void toggleReaction(m, em)}
                            >
                              {em}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}

        <form
          onSubmit={onSubmit}
          className="fixed bottom-0 left-0 right-0 z-30 mx-auto max-w-md border-t border-stone-200 bg-[#f0f0f0] px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        >
          {replyTo && !editingId ? (
            <div className="mb-1 flex items-center justify-between rounded-lg bg-white px-2 py-1 text-[11px]">
              <span className="truncate">پاسخ به {(replyTo.content ?? '').slice(0, 40)}</span>
              <button type="button" onClick={() => setReplyTo(null)} className="font-bold text-red-600">
                ×
              </button>
            </div>
          ) : null}
          {editingId ? (
            <div className="mb-1 flex items-center justify-between text-[11px] font-bold text-amber-800">
              <span>حالت ویرایش پیام</span>
              <button
                type="button"
                className="text-red-600"
                onClick={() => {
                  setEditingId(null);
                  setText(getGroupDraft(groupId));
                }}
              >
                لغو
              </button>
            </div>
          ) : null}
          <div className="flex items-end gap-2">
            <label className="shrink-0 cursor-pointer rounded-xl border border-stone-300 bg-white px-2 py-2 text-xs font-bold text-stone-600">
              فایل
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*,video/*,.pdf,.doc,.docx,.zip"
              />
            </label>
            <textarea
              value={text}
              onChange={(e) => {
                const v = e.target.value;
                setText(v);
                if (!editingId) {
                  if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
                  draftTimerRef.current = setTimeout(() => {
                    setGroupDraft(groupId, v);
                    draftTimerRef.current = null;
                  }, 200);
                }
                socketRef.current?.emit('group_typing', {
                  groupId,
                  isTyping: v.trim().length > 0,
                });
              }}
              onBlur={() => {
                if (!editingId) setGroupDraft(groupId, text);
                socketRef.current?.emit('group_typing', { groupId, isTyping: false });
              }}
              rows={1}
              placeholder={editingId ? 'ویرایش…' : 'پیام…'}
              className="min-h-[2.5rem] flex-1 resize-none rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={sending}
              className="shrink-0 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {editingId ? 'ذخیره' : 'ارسال'}
            </button>
          </div>
        </form>
      </main>
    </AuthGate>
  );
}

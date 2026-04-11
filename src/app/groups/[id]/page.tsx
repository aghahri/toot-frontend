'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  FormEvent,
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
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
import { ReplyQuoteBlock, groupReplyToModel } from '@/components/chat/ReplyQuoteBlock';
import { VoiceMessageBubble } from '@/components/chat/VoiceMessageBubble';
import { ForwardPickerSheet } from '@/components/chat/ForwardPickerSheet';
import { loadForwardPickTargets, type ForwardPickTarget } from '@/lib/chat-forward';
import { isVoiceMedia } from '@/lib/chat-media';
import { calendarDayKey, dayDividerLabelFa } from '@/lib/chat-dates';

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
    size?: number;
    durationMs?: number | null;
  } | null;
  replyTo: ReplyTo | null;
  reactions: { emoji: string; count: number; reactedByMe: boolean }[];
};

function isPureTextGroupMessage(m: GroupMessage): boolean {
  if (m.deletedAt) return false;
  if (m.media) return false;
  return !!m.content?.trim();
}

function replySnippetGroup(msg: GroupMessage): string {
  if (msg.deletedAt) return 'این پیام حذف شده است';
  const t = msg.content?.trim();
  if (t) return t.length > 100 ? `${t.slice(0, 100)}…` : t;
  if (msg.media && isVoiceMedia(msg.media)) return 'پیام صوتی';
  if (msg.media) return 'رسانه';
  return 'پیام';
}

export default function GroupThreadPage() {
  const params = useParams();
  const router = useRouter();
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
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(() => new Set());
  const isSelectionMode = selectedMessageIds.size > 0;
  const [openActionsMessageId, setOpenActionsMessageId] = useState<string | null>(null);
  const [forwardPickerOpen, setForwardPickerOpen] = useState(false);
  const [forwardPickLoading, setForwardPickLoading] = useState(false);
  const [forwardPickError, setForwardPickError] = useState<string | null>(null);
  const [forwardPickItems, setForwardPickItems] = useState<ForwardPickTarget[]>([]);
  const [forwardPickSubmitting, setForwardPickSubmitting] = useState(false);
  const [pinSubmitting, setPinSubmitting] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [flashMessageId, setFlashMessageId] = useState<string | null>(null);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);

  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesRef = useRef<GroupMessage[]>([]);
  messagesRef.current = messages;
  const forwardIdsOverrideRef = useRef<string[] | null>(null);
  const wasSelectionModeRef = useRef(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdGestureRef = useRef<{ x: number; y: number } | null>(null);
  const skipNextRowClickRef = useRef(false);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
  };

  function scrollToMessageAndFlash(messageId: string) {
    const el = document.getElementById(`group-msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setFlashMessageId(messageId);
      window.setTimeout(() => {
        setFlashMessageId((id) => (id === messageId ? null : id));
      }, 1400);
    }
  }

  function exitSelectionMode() {
    setSelectedMessageIds(new Set());
    setOpenActionsMessageId(null);
  }

  function toggleMessageInSelection(messageId: string) {
    setSelectedMessageIds((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  }

  function clearHoldTimer() {
    if (holdTimerRef.current != null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    holdGestureRef.current = null;
  }

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

  useEffect(() => {
    const was = wasSelectionModeRef.current;
    wasSelectionModeRef.current = isSelectionMode;
    if (was && !isSelectionMode && !forwardPickSubmitting) {
      forwardIdsOverrideRef.current = null;
      setForwardPickerOpen(false);
      setForwardPickError(null);
      setForwardPickItems([]);
    }
  }, [isSelectionMode, forwardPickSubmitting]);

  useEffect(() => {
    if (!openActionsMessageId) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (!t.closest('[data-group-msg-actions]')) setOpenActionsMessageId(null);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [openActionsMessageId]);

  useEffect(() => {
    if (!forwardPickerOpen && !searchOpen && !openActionsMessageId && selectedMessageIds.size === 0) {
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (forwardPickerOpen && !forwardPickSubmitting) {
        forwardIdsOverrideRef.current = null;
        setForwardPickerOpen(false);
        setForwardPickError(null);
        setForwardPickItems([]);
        return;
      }
      if (searchOpen) {
        setSearchOpen(false);
        return;
      }
      setOpenActionsMessageId(null);
      setSelectedMessageIds(new Set());
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [
    forwardPickerOpen,
    forwardPickSubmitting,
    searchOpen,
    openActionsMessageId,
    selectedMessageIds.size,
  ]);

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
    if (isSelectionMode) return;
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

  async function pinMessageOnServer(messageId: string | null) {
    const token = getAccessToken();
    if (!token || !groupId) return;
    setPinSubmitting(true);
    try {
      await apiFetch(`groups/${groupId}/pin`, {
        method: 'POST',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId }),
      });
      if (!messageId) {
        setPinned(null);
      } else {
        const row = messagesRef.current.find((x) => x.id === messageId);
        if (row) setPinned(row);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در سنجاق');
    } finally {
      setPinSubmitting(false);
    }
  }

  async function softDeleteGroupMessageClient(messageId: string): Promise<boolean> {
    const token = getAccessToken();
    if (!token) return false;
    try {
      await apiFetch(`messages/group/${messageId}`, { method: 'DELETE', token });
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, content: null, deletedAt: new Date().toISOString(), media: null }
            : m,
        ),
      );
      setPinned((p) => (p?.id === messageId ? null : p));
      return true;
    } catch {
      return false;
    }
  }

  async function openForwardPicker(overrideSelection?: Set<string>) {
    if (forwardPickerOpen) return;
    if (overrideSelection && overrideSelection.size > 0) {
      forwardIdsOverrideRef.current = [...overrideSelection];
    } else {
      forwardIdsOverrideRef.current = null;
      if (selectedMessageIds.size === 0) return;
    }
    setForwardPickerOpen(true);
    setForwardPickError(null);
    setForwardPickLoading(true);
    setForwardPickItems([]);
    const token = getAccessToken();
    if (!token) {
      setForwardPickLoading(false);
      setForwardPickError('ابتدا وارد شوید');
      return;
    }
    try {
      const targets = await loadForwardPickTargets(token, myUserId, null, groupId);
      setForwardPickItems(targets);
    } catch (e) {
      setForwardPickError(e instanceof Error ? e.message : 'خطا در دریافت گفتگوها');
    } finally {
      setForwardPickLoading(false);
    }
  }

  function dismissForwardPicker() {
    if (forwardPickSubmitting) return;
    forwardIdsOverrideRef.current = null;
    setForwardPickerOpen(false);
    setForwardPickError(null);
    setForwardPickItems([]);
  }

  async function confirmForwardTo(target: ForwardPickTarget) {
    if (forwardPickSubmitting) return;
    const token = getAccessToken();
    if (!token || !groupId) return;
    const fromOverride = forwardIdsOverrideRef.current;
    const orderedIds =
      fromOverride && fromOverride.length > 0
        ? fromOverride.filter((id) => {
            const m = messagesRef.current.find((x) => x.id === id);
            return m && !m.deletedAt;
          })
        : messagesRef.current
            .filter((m) => selectedMessageIds.has(m.id) && !m.deletedAt)
            .map((m) => m.id);
    forwardIdsOverrideRef.current = null;
    if (orderedIds.length === 0) {
      setForwardPickError('پیامی برای ارسال نیست');
      return;
    }
    setForwardPickSubmitting(true);
    setForwardPickError(null);
    setError(null);
    try {
      const body =
        target.kind === 'direct'
          ? { targetConversationId: target.id, messageIds: orderedIds }
          : { targetGroupId: target.id, messageIds: orderedIds };
      await apiFetch<{ forwarded: number }>(`groups/${groupId}/messages/forward`, {
        method: 'POST',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setForwardPickerOpen(false);
      setForwardPickError(null);
      setForwardPickItems([]);
      exitSelectionMode();
      if (target.kind === 'direct') {
        router.push(`/direct/${target.id}`);
      } else {
        router.push(`/groups/${target.id}`);
      }
    } catch (e) {
      setForwardPickError(e instanceof Error ? e.message : 'خطا در فوروارد');
    } finally {
      setForwardPickSubmitting(false);
    }
  }

  const canCopySelection =
    selectedMessageIds.size > 0 &&
    [...selectedMessageIds].every((id) => {
      const m = messagesRef.current.find((x) => x.id === id);
      return m && isPureTextGroupMessage(m);
    });

  async function copySelectedMessages() {
    if (!canCopySelection) return;
    const ids = new Set(selectedMessageIds);
    const ordered = messagesRef.current.filter((m) => ids.has(m.id));
    const text = ordered.map((m) => (m.content ?? '').trim()).join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در کپی');
    }
  }

  async function bulkDeleteSelectedMessages() {
    if (selectedMessageIds.size === 0) return;
    setBulkDeleting(true);
    try {
      for (const id of [...selectedMessageIds]) {
        await softDeleteGroupMessageClient(id);
      }
      exitSelectionMode();
    } finally {
      setBulkDeleting(false);
    }
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

  const readAnchorIndex = useMemo(() => {
    if (!lastReadMessageId) return -1;
    return messages.findIndex((m) => m.id === lastReadMessageId);
  }, [messages, lastReadMessageId]);

  return (
    <AuthGate>
      <main
        className="mx-auto min-h-[100dvh] w-full max-w-md bg-[#e5ddd5] pb-28 pt-0"
        dir="rtl"
      >
        <header className="sticky top-0 z-20 border-b border-stone-200/90 bg-[#f8f8f8] shadow-sm backdrop-blur-md">
          {isSelectionMode ? (
            <div className="space-y-2 px-3 py-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={exitSelectionMode}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100"
                  aria-label="لغو انتخاب"
                >
                  <span className="text-xl font-semibold leading-none text-slate-800" aria-hidden>
                    ›
                  </span>
                </button>
                <div className="min-w-0 flex-1 text-center">
                  <div className="text-[15px] font-bold text-stone-900">
                    {selectedMessageIds.size} انتخاب‌شده
                  </div>
                </div>
                <div className="h-10 w-10 shrink-0" aria-hidden />
              </div>
              <div className="flex flex-wrap items-center justify-center gap-1.5 pb-0.5">
                <button
                  type="button"
                  disabled={selectedMessageIds.size === 0}
                  onClick={() => void openForwardPicker()}
                  className="rounded-full bg-slate-900 px-3 py-2 text-[11px] font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  فوروارد
                </button>
                <button
                  type="button"
                  disabled={bulkDeleting || selectedMessageIds.size === 0}
                  onClick={() => void bulkDeleteSelectedMessages()}
                  className="rounded-full border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  حذف برای من
                </button>
                <button
                  type="button"
                  disabled={!canCopySelection}
                  onClick={() => void copySelectedMessages()}
                  className="rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  کپی
                </button>
                <button
                  type="button"
                  onClick={exitSelectionMode}
                  className="rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  لغو
                </button>
              </div>
            </div>
          ) : (
            <div className="px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <Link href="/direct" className="shrink-0 text-sm font-bold text-sky-700">
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
            </div>
          )}
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
            {messages.map((m, i) => {
              const mine = myUserId != null && m.senderId === myUserId;
              const deleted = !!m.deletedAt;
              const media = deleted ? null : m.media;
              const timeShort = new Date(m.createdAt).toLocaleTimeString('fa-IR', {
                hour: '2-digit',
                minute: '2-digit',
              });
              const rowSelected = selectedMessageIds.has(m.id);
              const prevMsg = i > 0 ? messages[i - 1] : null;
              const showDayDivider =
                !prevMsg || calendarDayKey(prevMsg.createdAt) !== calendarDayKey(m.createdAt);
              const showUnreadDivider =
                readAnchorIndex >= 0 && i === readAnchorIndex + 1 && !!lastReadMessageId;

              return (
                <Fragment key={m.id}>
                  {showDayDivider ? (
                    <div className="flex justify-center py-2">
                      <span className="rounded-full bg-white/85 px-3 py-1 text-[11px] font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200/70">
                        {dayDividerLabelFa(m.createdAt)}
                      </span>
                    </div>
                  ) : null}
                  {showUnreadDivider ? (
                    <div className="flex justify-center py-2">
                      <span className="rounded-full bg-sky-600 px-3 py-1 text-[10px] font-bold text-white shadow-md">
                        پیام‌های خوانده‌نشده
                      </span>
                    </div>
                  ) : null}
                  <div
                    id={`group-msg-${m.id}`}
                    className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                    onPointerDown={(e) => {
                      if (e.button !== 0) return;
                      if (editingId || isSelectionMode) return;
                      const t = e.target as HTMLElement;
                      if (
                        t.closest(
                          'button, a, [role="menu"], video, audio, textarea, input, [data-group-msg-actions]',
                        )
                      ) {
                        return;
                      }
                      clearHoldTimer();
                      holdGestureRef.current = { x: e.clientX, y: e.clientY };
                      holdTimerRef.current = window.setTimeout(() => {
                        holdTimerRef.current = null;
                        holdGestureRef.current = null;
                        skipNextRowClickRef.current = true;
                        setSelectedMessageIds(new Set([m.id]));
                        setOpenActionsMessageId(null);
                      }, 480);
                    }}
                    onPointerMove={(e) => {
                      if (holdTimerRef.current == null || !holdGestureRef.current) return;
                      const dx = e.clientX - holdGestureRef.current.x;
                      const dy = e.clientY - holdGestureRef.current.y;
                      if (dx * dx + dy * dy > 144) clearHoldTimer();
                    }}
                    onPointerUp={clearHoldTimer}
                    onPointerCancel={clearHoldTimer}
                    onPointerLeave={(e) => {
                      if (e.pointerType === 'mouse') clearHoldTimer();
                    }}
                    onClick={(e) => {
                      if (skipNextRowClickRef.current) {
                        skipNextRowClickRef.current = false;
                        return;
                      }
                      if (!isSelectionMode) return;
                      const el = e.target as HTMLElement;
                      if (
                        el.closest(
                          'button, a, [role="menu"], video, audio, textarea, input, [data-group-msg-actions]',
                        )
                      ) {
                        return;
                      }
                      toggleMessageInSelection(m.id);
                    }}
                  >
                    <div
                      className={`relative max-w-[88%] rounded-[1.15rem] px-3.5 py-2.5 shadow-sm ${
                        deleted
                          ? mine
                            ? rowSelected
                              ? 'bg-slate-800/75 text-white/85 ring-2 ring-sky-400 ring-offset-2 ring-offset-stone-100'
                              : 'bg-slate-800/75 text-white/85 ring-1 ring-white/10'
                            : rowSelected
                              ? 'bg-slate-200/60 text-slate-600 ring-2 ring-sky-500 ring-offset-2 ring-offset-stone-100'
                              : 'bg-slate-200/60 text-slate-600 ring-1 ring-slate-300/50'
                          : mine
                            ? rowSelected
                              ? 'bg-slate-900 text-white ring-2 ring-sky-400 ring-offset-2 ring-offset-stone-100'
                              : 'bg-slate-900 text-white ring-1 ring-slate-800/40'
                            : rowSelected
                              ? 'bg-white text-slate-900 ring-2 ring-sky-500 ring-offset-2 ring-offset-stone-100'
                              : 'bg-white text-slate-900 ring-1 ring-slate-200/80'
                      } ${
                        flashMessageId === m.id
                          ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-[#e5ddd5]'
                          : ''
                      }`}
                    >
                      <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px]">
                        <span
                          className={`min-w-0 truncate font-medium ${
                            mine ? 'text-white/75' : 'text-slate-500'
                          }`}
                        >
                          {m.sender.name}
                        </span>
                        {!deleted && !isSelectionMode ? (
                          <div className="relative shrink-0" data-group-msg-actions>
                            <button
                              type="button"
                              aria-haspopup="menu"
                              aria-expanded={openActionsMessageId === m.id}
                              aria-label="اقدامات پیام"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenActionsMessageId((id) => (id === m.id ? null : m.id));
                              }}
                              className={`flex h-9 min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-lg leading-none transition ${
                                mine
                                  ? 'text-white/80 hover:bg-white/15 active:bg-white/20'
                                  : 'text-slate-500 hover:bg-slate-100 active:bg-slate-200'
                              }`}
                            >
                              <span className="select-none" aria-hidden>
                                ⋮
                              </span>
                            </button>
                            {openActionsMessageId === m.id ? (
                              <div
                                role="menu"
                                className="absolute end-0 top-full z-[45] mt-1 min-w-[11.5rem] max-w-[calc(100vw-1.5rem)] overflow-visible rounded-xl border border-slate-200/90 bg-white py-1 shadow-lg ring-1 ring-slate-900/5"
                                dir="rtl"
                              >
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="flex w-full px-4 py-3 text-right text-sm font-medium text-slate-800 transition hover:bg-slate-100 active:bg-slate-200"
                                  onClick={() => {
                                    setReplyTo(m);
                                    setOpenActionsMessageId(null);
                                  }}
                                >
                                  پاسخ
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="flex w-full px-4 py-3 text-right text-sm font-medium text-slate-800 transition hover:bg-slate-100 active:bg-slate-200"
                                  onClick={() => {
                                    setOpenActionsMessageId(null);
                                    void openForwardPicker(new Set([m.id]));
                                  }}
                                >
                                  فوروارد
                                </button>
                                {isPureTextGroupMessage(m) ? (
                                  <button
                                    type="button"
                                    role="menuitem"
                                    className="flex w-full px-4 py-3 text-right text-sm font-medium text-slate-800 transition hover:bg-slate-100 active:bg-slate-200"
                                    onClick={() => {
                                      setOpenActionsMessageId(null);
                                      void navigator.clipboard.writeText((m.content ?? '').trim());
                                    }}
                                  >
                                    کپی
                                  </button>
                                ) : null}
                                <div className="my-1 border-t border-slate-100" role="separator" aria-hidden />
                                <button
                                  type="button"
                                  role="menuitem"
                                  disabled={pinSubmitting}
                                  className="flex w-full items-center gap-2 px-4 py-3 text-right text-sm font-medium text-slate-800 transition hover:bg-slate-100 active:bg-slate-200 disabled:opacity-50"
                                  onClick={() =>
                                    void pinMessageOnServer(pinned?.id === m.id ? null : m.id)
                                  }
                                >
                                  <span className="shrink-0 text-base" aria-hidden>
                                    📌
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    {pinned?.id === m.id ? 'برداشتن سنجاق' : 'سنجاق در گفتگو'}
                                  </span>
                                </button>
                                <div className="border-t border-slate-100 px-1 py-2">
                                  <div className="px-3 pb-1 text-[10px] font-semibold text-slate-500">
                                    واکنش
                                  </div>
                                  <div className="flex flex-wrap justify-center gap-0.5 px-1" dir="ltr">
                                    {DIRECT_REACTION_EMOJIS.map((e) => (
                                      <button
                                        key={e}
                                        type="button"
                                        role="menuitem"
                                        className="flex h-10 min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-xl transition hover:bg-slate-100 active:scale-95 active:bg-slate-200"
                                        onClick={() => {
                                          setOpenActionsMessageId(null);
                                          void toggleReaction(m, e);
                                        }}
                                      >
                                        {e}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                {mine ? (
                                  <>
                                    <button
                                      type="button"
                                      role="menuitem"
                                      className="flex w-full px-4 py-3 text-right text-sm font-medium text-slate-800 transition hover:bg-slate-100 active:bg-slate-200"
                                      onClick={() => {
                                        setEditingId(m.id);
                                        setText(m.content ?? '');
                                        setReplyTo(null);
                                        setOpenActionsMessageId(null);
                                      }}
                                    >
                                      ویرایش
                                    </button>
                                    {!deleted ? (
                                      <button
                                        type="button"
                                        role="menuitem"
                                        className="flex w-full px-4 py-3 text-right text-sm font-medium text-red-600 transition hover:bg-red-50 active:bg-red-100"
                                        onClick={() => {
                                          setOpenActionsMessageId(null);
                                          void softDeleteGroupMessageClient(m.id);
                                        }}
                                      >
                                        حذف
                                      </button>
                                    ) : null}
                                  </>
                                ) : null}
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="flex w-full px-4 py-3 text-right text-sm font-medium text-slate-800 transition hover:bg-slate-100 active:bg-slate-200"
                                  onClick={() => {
                                    setOpenActionsMessageId(null);
                                    setSelectedMessageIds(new Set([m.id]));
                                  }}
                                >
                                  انتخاب
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>

                      {m.replyTo ? (
                        <ReplyQuoteBlock
                          model={groupReplyToModel(m.replyTo)}
                          mine={mine}
                          onNavigate={scrollToMessageAndFlash}
                        />
                      ) : null}

                      {deleted ? (
                        <p
                          className={`text-sm italic ${mine ? 'text-white/70' : 'text-slate-500'}`}
                        >
                          این پیام حذف شده است
                        </p>
                      ) : null}
                      {!deleted && media ? (
                        isVoiceMedia(media) ? (
                          <VoiceMessageBubble
                            media={media}
                            mine={mine}
                            messageId={m.id}
                            playingMessageId={playingMessageId}
                            setPlayingMessageId={setPlayingMessageId}
                          />
                        ) : media.mimeType?.startsWith('video/') || media.type === 'VIDEO' ? (
                          <video
                            src={media.url}
                            controls
                            className="mb-2 max-h-72 w-full rounded-xl bg-black shadow-inner"
                          />
                        ) : media.mimeType?.startsWith('image/') || media.type === 'IMAGE' ? (
                          <img
                            src={media.url}
                            alt={media.originalName || ''}
                            className="mb-2 max-h-72 w-full rounded-xl object-contain shadow-inner"
                          />
                        ) : (
                          <a
                            href={media.url}
                            target="_blank"
                            rel="noreferrer"
                            className={`mb-2 inline-block text-sm font-semibold underline ${
                              mine ? 'text-sky-200' : 'text-sky-700'
                            }`}
                          >
                            {media.originalName || 'فایل'}
                          </a>
                        )
                      ) : null}
                      {!deleted && m.content ? (
                        <div
                          className={`whitespace-pre-wrap text-[15px] leading-relaxed ${
                            mine ? 'text-white' : 'text-slate-900'
                          }`}
                        >
                          {m.content}
                        </div>
                      ) : null}
                      {m.isEdited ? (
                        <p className={`mt-0.5 text-[10px] ${mine ? 'text-white/50' : 'text-slate-400'}`}>
                          ویرایش شده
                        </p>
                      ) : null}

                      <div
                        className={`mt-2 flex flex-wrap items-center justify-end gap-x-2 gap-y-0.5 text-[10px] leading-none ${
                          deleted
                            ? mine
                              ? 'text-white/45'
                              : 'text-slate-500'
                            : mine
                              ? 'text-white/50'
                              : 'text-slate-400'
                        }`}
                        dir="rtl"
                      >
                        <span className="tabular-nums">{timeShort}</span>
                      </div>

                      {!deleted && (m.reactions?.length ?? 0) > 0 ? (
                        <div className="mt-1.5 flex flex-wrap gap-1" dir="ltr">
                          {(m.reactions ?? []).map((r) => (
                            <button
                              key={r.emoji}
                              type="button"
                              title={r.reactedByMe ? 'حذف واکنش' : 'واکنش'}
                              onClick={() => void toggleReaction(m, r.emoji)}
                              className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[13px] leading-none transition active:scale-95 ${
                                mine
                                  ? r.reactedByMe
                                    ? 'bg-white/25 text-white ring-1 ring-white/40'
                                    : 'bg-white/12 text-white/90'
                                  : r.reactedByMe
                                    ? 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200'
                                    : 'bg-slate-100/90 text-slate-700 ring-1 ring-slate-200/80'
                              }`}
                            >
                              <span>{r.emoji}</span>
                              {r.count > 1 ? (
                                <span className="text-[10px] font-bold tabular-nums opacity-90">
                                  {r.count}
                                </span>
                              ) : null}
                            </button>
                          ))}
                          <button
                            type="button"
                            className={`rounded-full px-2 py-0.5 text-[13px] ${
                              mine ? 'bg-white/10 text-white/80' : 'bg-slate-100 text-slate-600'
                            }`}
                            onClick={() => setReactionForId((id) => (id === m.id ? null : m.id))}
                          >
                            +
                          </button>
                        </div>
                      ) : !deleted ? (
                        <div className="mt-1" dir="ltr">
                          <button
                            type="button"
                            className={`rounded-full px-2 py-0.5 text-[13px] ${
                              mine ? 'bg-white/10 text-white/80' : 'bg-slate-100 text-slate-600'
                            }`}
                            onClick={() => setReactionForId((id) => (id === m.id ? null : m.id))}
                          >
                            + واکنش
                          </button>
                        </div>
                      ) : null}
                      {reactionForId === m.id ? (
                        <div
                          className={`mt-1 flex flex-wrap gap-1 border-t pt-1 ${
                            mine ? 'border-white/10' : 'border-slate-200/80'
                          }`}
                        >
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
                </Fragment>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}

        <form
          onSubmit={onSubmit}
          className={`fixed bottom-0 left-0 right-0 z-30 mx-auto max-w-md border-t border-stone-200 bg-[#f0f0f0] px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] ${
            isSelectionMode ? 'pointer-events-none opacity-50' : ''
          }`}
        >
          {replyTo && !editingId ? (
            <div className="mb-2 flex items-start gap-2 rounded-2xl border border-slate-200/90 bg-slate-50 px-3 py-2.5 shadow-sm ring-1 ring-slate-200/60">
              <div className="min-w-0 flex-1 text-right">
                <div className="text-[10px] font-bold text-sky-600">
                  پاسخ به {replyTo.sender.name}
                </div>
                <div className="mt-0.5 truncate text-sm text-slate-800">{replySnippetGroup(replyTo)}</div>
              </div>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
              >
                لغو
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
            <label
              className={`shrink-0 rounded-xl border border-stone-300 bg-white px-2 py-2 text-xs font-bold text-stone-600 ${
                isSelectionMode ? 'cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              فایل
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                disabled={isSelectionMode}
                accept="image/*,video/*,.pdf,.doc,.docx,.zip"
              />
            </label>
            <textarea
              value={text}
              disabled={isSelectionMode}
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
              disabled={sending || isSelectionMode}
              className="shrink-0 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {editingId ? 'ذخیره' : 'ارسال'}
            </button>
          </div>
        </form>

        <ForwardPickerSheet
          open={forwardPickerOpen}
          loading={forwardPickLoading}
          error={forwardPickError}
          submitting={forwardPickSubmitting}
          items={forwardPickItems}
          onDismiss={() => dismissForwardPicker()}
          onPick={(t) => void confirmForwardTo(t)}
        />
      </main>
    </AuthGate>
  );
}

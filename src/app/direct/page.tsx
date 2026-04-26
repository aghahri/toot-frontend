'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { io } from 'socket.io-client';
import { AuthGate } from '@/components/AuthGate';
import { getAccessToken } from '@/lib/auth';
import { apiFetch, getApiBaseUrl } from '@/lib/api';
import { IconPlus } from '@/components/MessagingTabIcons';
import {
  DirectConversationRow,
  type DirectConversationRowMessage,
  type DirectRowPreviewVariant,
} from '@/components/direct/DirectConversationRow';
import { listPreviewForLastMessage } from '@/lib/direct-list-preview';
import { DIRECT_DRAFT_CHANGED_EVENT, getDirectDraft } from '@/lib/direct-drafts';
import {
  DIRECT_CONVERSATION_READ_EVENT,
  type DirectConversationReadEventDetail,
} from '@/lib/direct-events';

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
  messages?: Array<DirectConversationRowMessage>;
  unreadCount?: number;
  lastMessage?: DirectConversationRowMessage;
  lastActivityAt?: string;
  peerOnline?: boolean;
  inboxPinned?: boolean;
  inboxArchived?: boolean;
  inboxMuted?: boolean;
};

type SocketMessage = DirectConversationRowMessage & {
  conversationId?: string;
  senderId?: string;
};

function sortConversations(a: Conversation, b: Conversation): number {
  const aArc = a.inboxArchived ? 1 : 0;
  const bArc = b.inboxArchived ? 1 : 0;
  if (aArc !== bArc) return aArc - bArc;
  const ap = a.inboxPinned ? 1 : 0;
  const bp = b.inboxPinned ? 1 : 0;
  if (ap !== bp) return bp - ap;
  const au = (a.unreadCount ?? 0) > 0 ? 1 : 0;
  const bu = (b.unreadCount ?? 0) > 0 ? 1 : 0;
  if (au !== bu) return bu - au;
  const ta = new Date(a.lastActivityAt ?? a.updatedAt).getTime();
  const tb = new Date(b.lastActivityAt ?? b.updatedAt).getTime();
  if (ta !== tb) return tb - ta;
  return a.id.localeCompare(b.id);
}

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
  if (u.lastSeenAt) {
    const last = new Date(u.lastSeenAt).getTime();
    if (!Number.isNaN(last)) {
      const mins = Math.floor((Date.now() - last) / 60000);
      if (mins <= 5) return 'فعال اخیراً';
    }
  }
  const parts = [`@${u.username}`, u.phoneMasked].filter(Boolean);
  return parts.join(' · ');
}

function matchesListFilter(item: Conversation, q: string, myUserId: string | null): boolean {
  const term = q.trim().toLowerCase();
  if (!term) return true;
  const other =
    item.participants.find((p) => p.user.id !== myUserId)?.user ?? item.participants[0]?.user;
  const last = item.lastMessage ?? item.messages?.[0];
  const preview = last ? listPreviewForLastMessage(last, myUserId) : 'هنوز پیامی ارسال نشده';
  const blob = [other?.name, other?.username, other?.phoneMasked, preview]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return blob.includes(term);
}

function renderConversationRows(
  list: Conversation[],
  ctx: {
    myUserId: string | null;
    menuOpenId: string | null;
    setMenuOpenId: (id: string | null) => void;
    typingByConv: Record<string, boolean>;
    onInboxAction: (conversationId: string, segment: string) => void;
  },
) {
  return list.map((item) => {
    const other =
      item.participants.find((p) => p.user.id !== ctx.myUserId)?.user ?? item.participants[0]?.user;

    const lastMessage = item.lastMessage ?? item.messages?.[0];
    const draft = getDirectDraft(item.id).trim();
    const peerTyping = ctx.typingByConv[item.id] === true;
    let previewVariant: DirectRowPreviewVariant = 'default';
    let preview: string;
    if (peerTyping) {
      previewVariant = 'typing';
      preview = 'در حال نوشتن…';
    } else if (draft) {
      previewVariant = 'draft';
      preview = `پیش‌نویس: ${draft.length > 80 ? `${draft.slice(0, 80)}…` : draft}`;
    } else {
      preview = lastMessage
        ? listPreviewForLastMessage(lastMessage, ctx.myUserId)
        : 'هنوز پیامی ارسال نشده';
    }

    const previewTimeIso =
      lastMessage?.createdAt ?? item.lastActivityAt ?? item.updatedAt;
    const unreadCount = typeof item.unreadCount === 'number' ? item.unreadCount : 0;

    return (
      <DirectConversationRow
        key={item.id}
        href={`/direct/${item.id}`}
        peerName={other?.name ?? 'کاربر'}
        peerAvatarUrl={other?.avatar ?? null}
        peerSubtitle={peerSubtitle(other)}
        preview={preview}
        previewVariant={previewVariant}
        previewTimeIso={previewTimeIso}
        myUserId={ctx.myUserId}
        lastMessage={lastMessage}
        unreadCount={unreadCount}
        peerOnline={item.peerOnline === true}
        inboxPinned={item.inboxPinned === true}
        inboxArchived={item.inboxArchived === true}
        inboxMuted={item.inboxMuted === true}
        unreadEmphasis={unreadCount > 0 && previewVariant === 'default'}
        menuOpen={ctx.menuOpenId === item.id}
        onMenuToggle={() =>
          ctx.setMenuOpenId(ctx.menuOpenId === item.id ? null : item.id)
        }
        onPin={() => void ctx.onInboxAction(item.id, item.inboxPinned ? 'inbox/unpin' : 'inbox/pin')}
        onArchiveToggle={() =>
          void ctx.onInboxAction(item.id, item.inboxArchived ? 'inbox/unarchive' : 'inbox/archive')
        }
        onMuteToggle={() =>
          void ctx.onInboxAction(item.id, item.inboxMuted ? 'inbox/unmute' : 'inbox/mute')
        }
      />
    );
  });
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
  const [listFilterQuery, setListFilterQuery] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [typingByConv, setTypingByConv] = useState<Record<string, boolean>>({});
  const [, setDraftRev] = useState(0);
  const plusMenuRef = useRef<HTMLDivElement | null>(null);

  const itemsRef = useRef(items);
  itemsRef.current = items;
  const myUserIdRef = useRef(myUserId);
  myUserIdRef.current = myUserId;
  const typingTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const socketRef = useRef<ReturnType<typeof io> | null>(null);

  const loadMeAndConversations = useCallback(async (opts?: { silent?: boolean }) => {
    const token = getAccessToken();
    if (!token) return;

    if (!opts?.silent) {
      setLoading(true);
      setError(null);
    }

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

      setItems(Array.isArray(conversations) ? [...conversations].sort(sortConversations) : []);
    } catch (e) {
      if (!opts?.silent) {
        setError(e instanceof Error ? e.message : 'خطا در دریافت گفتگوها');
      }
    } finally {
      if (!opts?.silent) {
        setLoading(false);
      }
    }
  }, []);

  const onInboxAction = useCallback(async (conversationId: string, segment: string) => {
    const token = getAccessToken();
    if (!token) return;
    try {
      setError(null);
      await apiFetch(`direct/conversations/${conversationId}/${segment}`, {
        method: 'POST',
        token,
      });
      await loadMeAndConversations({ silent: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در به‌روزرسانی گفتگو');
    }
  }, [loadMeAndConversations]);

  useEffect(() => {
    void loadMeAndConversations();
  }, [loadMeAndConversations]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        void loadMeAndConversations({ silent: true });
      }
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onVis);
    };
  }, [loadMeAndConversations]);

  useEffect(() => {
    const onConversationRead = (e: Event) => {
      const detail = (e as CustomEvent<DirectConversationReadEventDetail>).detail;
      const conversationId = detail?.conversationId;
      if (!conversationId) return;
      setItems((prev) =>
        prev.map((row) =>
          row.id === conversationId ? { ...row, unreadCount: 0 } : row,
        ),
      );
    };
    window.addEventListener(DIRECT_CONVERSATION_READ_EVENT, onConversationRead as EventListener);
    return () => {
      window.removeEventListener(
        DIRECT_CONVERSATION_READ_EVENT,
        onConversationRead as EventListener,
      );
    };
  }, []);

  useEffect(() => {
    const onDraft = () => setDraftRev((n) => n + 1);
    window.addEventListener(DIRECT_DRAFT_CHANGED_EVENT, onDraft);
    return () => window.removeEventListener(DIRECT_DRAFT_CHANGED_EVENT, onDraft);
  }, []);

  useEffect(() => {
    if (!plusMenuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const el = plusMenuRef.current;
      if (el && e.target instanceof Node && el.contains(e.target)) return;
      setPlusMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [plusMenuOpen]);

  useEffect(() => {
    if (menuOpenId == null) return;
    const onDown = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest?.('[data-direct-inbox-menu]')) return;
      setMenuOpenId(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpenId]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token || !myUserId) return;

    const socket = io(getApiBaseUrl().replace(/\/+$/, ''), {
      transports: ['websocket'],
      auth: { token },
    });
    socketRef.current = socket;

    const joinAll = () => {
      for (const id of itemsRef.current.map((i) => i.id)) {
        socket.emit('join_direct', { conversationId: id, skipDeliverySync: true });
      }
    };

    const leaveAll = () => {
      for (const id of itemsRef.current.map((i) => i.id)) {
        socket.emit('leave_direct', { conversationId: id });
      }
    };

    const onTyping = (payload: { conversationId: string; userId: string; isTyping: boolean }) => {
      const me = myUserIdRef.current;
      if (!me || payload.userId === me) return;
      const cid = payload.conversationId;
      const prevT = typingTimersRef.current.get(cid);
      if (prevT) clearTimeout(prevT);
      if (payload.isTyping) {
        setTypingByConv((m) => ({ ...m, [cid]: true }));
        typingTimersRef.current.set(
          cid,
          setTimeout(() => {
            setTypingByConv((m) => {
              const n = { ...m };
              delete n[cid];
              return n;
            });
            typingTimersRef.current.delete(cid);
          }, 2500),
        );
      } else {
        setTypingByConv((m) => {
          const n = { ...m };
          delete n[cid];
          return n;
        });
        typingTimersRef.current.delete(cid);
      }
    };

    const onMessage = (message: SocketMessage) => {
      const cid = message.conversationId;
      if (!cid) return;
      const uid = myUserIdRef.current;
      const rawCreated = message.createdAt as unknown;
      const created =
        typeof rawCreated === 'string'
          ? rawCreated
          : rawCreated instanceof Date
            ? rawCreated.toISOString()
            : String(rawCreated);
      setItems((prev) => {
        const ix = prev.findIndex((c) => c.id === cid);
        if (ix < 0) return prev;
        const c = prev[ix];
        const lastMessage = { ...(message as DirectConversationRowMessage), createdAt: created };
        const lastActivityAt = new Date(
          Math.max(new Date(c.lastActivityAt ?? c.updatedAt).getTime(), new Date(created).getTime()),
        ).toISOString();
        const incoming = !!(uid && message.senderId && message.senderId !== uid);
        const unreadCount = (c.unreadCount ?? 0) + (incoming ? 1 : 0);
        const next = [...prev];
        next[ix] = {
          ...c,
          lastMessage,
          messages: [lastMessage],
          lastActivityAt,
          updatedAt: lastActivityAt,
          unreadCount,
        };
        return next.sort(sortConversations);
      });
    };

    const onEdited = (payload: {
      conversationId: string;
      messageId: string;
      text: string | null;
      editedAt: string | null;
    }) => {
      setItems((prev) => {
        const ix = prev.findIndex((c) => c.id === payload.conversationId);
        if (ix < 0) return prev;
        const c = prev[ix];
        const lm = c.lastMessage ?? c.messages?.[0];
        if (!lm || lm.id !== payload.messageId) return prev;
        const nextLm = { ...lm, text: payload.text, editedAt: payload.editedAt };
        const next = [...prev];
        next[ix] = { ...c, lastMessage: nextLm, messages: [nextLm] };
        return next;
      });
    };

    const onDeleted = (payload: {
      conversationId: string;
      messageId: string;
      isDeleted: boolean;
      deletedAt: string | null;
      text: null;
      mediaId: null;
      media: null;
    }) => {
      setItems((prev) => {
        const ix = prev.findIndex((c) => c.id === payload.conversationId);
        if (ix < 0) return prev;
        const c = prev[ix];
        const lm = c.lastMessage ?? c.messages?.[0];
        if (!lm || lm.id !== payload.messageId) return prev;
        const nextLm: DirectConversationRowMessage = {
          ...lm,
          isDeleted: true,
          deletedAt: payload.deletedAt,
          text: null,
          mediaId: null,
          media: null,
        };
        const next = [...prev];
        next[ix] = { ...c, lastMessage: nextLm, messages: [nextLm] };
        return next.sort(sortConversations);
      });
    };

    const onPresence = (payload: {
      conversationId: string;
      userId: string;
      online: boolean;
    }) => {
      const me = myUserIdRef.current;
      if (!me || payload.userId === me) return;
      setItems((prev) =>
        prev.map((row) =>
          row.id === payload.conversationId ? { ...row, peerOnline: payload.online } : row,
        ),
      );
    };

    socket.on('connect', joinAll);
    socket.on('direct_typing', onTyping);
    socket.on('direct_message', onMessage);
    socket.on('direct_message_edited', onEdited);
    socket.on('direct_message_deleted', onDeleted);
    socket.on('direct_presence', onPresence);

    if (socket.connected) joinAll();

    return () => {
      typingTimersRef.current.forEach((t) => clearTimeout(t));
      typingTimersRef.current.clear();
      leaveAll();
      socket.off('connect', joinAll);
      socket.off('direct_typing', onTyping);
      socket.off('direct_message', onMessage);
      socket.off('direct_message_edited', onEdited);
      socket.off('direct_message_deleted', onDeleted);
      socket.off('direct_presence', onPresence);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [myUserId]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket?.connected) return;
    for (const id of items.map((i) => i.id)) {
      socket.emit('join_direct', { conversationId: id, skipDeliverySync: true });
    }
  }, [items]);

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

  const mainItems = items.filter(
    (i) => !i.inboxArchived && matchesListFilter(i, listFilterQuery, myUserId),
  );
  const archivedItems = items.filter(
    (i) => i.inboxArchived && matchesListFilter(i, listFilterQuery, myUserId),
  );

  const rowCtx = {
    myUserId,
    menuOpenId,
    setMenuOpenId,
    typingByConv,
    onInboxAction,
  };

  return (
    <AuthGate>
      <main className="mx-auto min-h-[100dvh] w-full max-w-md bg-[var(--bg-page)] pb-24">
        {/* Sticky header — handoff topbar pattern: brand on the start side,
            top-actions group on the end side. Refresh button + plus menu
            keep their existing handlers. */}
        <div className="sticky top-0 z-10 border-b border-[var(--line)] bg-[var(--surface)]/95 backdrop-blur-sm">
          <div
            className="flex items-center justify-between gap-3 px-3 py-2.5"
            dir="rtl"
          >
            <h1 className="text-[15px] font-extrabold text-[var(--ink)]">گفتگو</h1>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => void loadMeAndConversations()}
                disabled={loading}
                title="رفرش"
                className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--ink-2)] transition hover:bg-[var(--surface-2)] disabled:opacity-40"
              >
                <span className={`text-base ${loading ? 'animate-pulse' : ''}`} aria-hidden>
                  ↻
                </span>
              </button>
              <div className="relative" ref={plusMenuRef}>
                <button
                  type="button"
                  onClick={() => setPlusMenuOpen((v) => !v)}
                  title="جدید"
                  aria-expanded={plusMenuOpen}
                  aria-haspopup="menu"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] transition hover:bg-[var(--accent-hover)] active:scale-95"
                >
                  <IconPlus className="h-5 w-5 stroke-[2.5]" />
                </button>
                {plusMenuOpen ? (
                  <div
                    role="menu"
                    className="absolute end-0 top-full z-30 mt-1 min-w-[11rem] overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface)] py-1 shadow-lg"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      className="flex w-full px-4 py-3 text-right text-sm font-bold text-[var(--ink)] transition hover:bg-[var(--surface-2)]"
                      onClick={() => {
                        setPlusMenuOpen(false);
                        setNewChatOpen(true);
                        setError(null);
                        setSearchQuery('');
                        setSearchHits([]);
                      }}
                    >
                      گفتگوی جدید
                    </button>
                    <Link
                      href="/groups/new?kind=chat&returnTo=direct"
                      role="menuitem"
                      className="flex w-full px-4 py-3 text-right text-sm font-bold text-[var(--ink)] transition hover:bg-[var(--surface-2)]"
                      onClick={() => setPlusMenuOpen(false)}
                    >
                      ایجاد گروه چت
                    </Link>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* Search bar — handoff .search-bar: surface-2 pill with leading
              magnifier glyph. The input itself is invisible chrome on top
              of the pill so the visual matches but functionality (filter
              state) is preserved. */}
          {!loading && items.length > 0 ? (
            <div className="px-3 pb-2.5" dir="rtl">
              <div className="flex h-10 items-center gap-2 rounded-xl bg-[var(--surface-2)] px-3 text-[var(--ink-3)]">
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.5-3.5" />
                </svg>
                <input
                  value={listFilterQuery}
                  onChange={(e) => setListFilterQuery(e.target.value)}
                  placeholder="جستجو در گفتگوها"
                  className="h-full w-full bg-transparent text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-3)] outline-none"
                  autoComplete="off"
                  aria-label="جستجو در گفتگوها"
                />
              </div>
            </div>
          ) : null}
        </div>

        {/* Flat list — handoff drops the wrapping card; rows divided by
            1px var(--line) lines, sitting directly on the page surface.
            DirectConversationRow itself is shared with /groups and is
            intentionally unchanged in this pass. */}
        <div className="bg-[var(--surface)]">
          {loading ? (
            <ConversationListSkeleton />
          ) : error && items.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-semibold text-[var(--accent-hover)]">{error}</p>
              <button
                type="button"
                onClick={() => void loadMeAndConversations()}
                className="mt-3 text-xs font-bold text-[var(--accent-hover)] underline-offset-2 hover:underline"
              >
                تلاش دوباره
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="mx-auto flex max-w-xs flex-col items-center gap-3 px-6 py-16 text-center" dir="rtl">
              <span
                aria-hidden
                className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--surface-2)]"
              >
                <svg viewBox="0 0 24 24" className="h-8 w-8 text-[var(--ink-3)]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 11.5a8.4 8.4 0 0 1-3.6 6.9L20 21l-3.5-1.5A8.4 8.4 0 1 1 21 11.5Z" />
                </svg>
              </span>
              <p className="text-sm font-extrabold text-[var(--ink)]">هنوز گفتگویی نداری</p>
              <p className="text-balance text-xs leading-relaxed text-[var(--ink-3)]">
                از دکمه «گفتگوی جدید» شروع کن و با کسی که می‌خواهی پیام بفرست.
              </p>
              <button
                type="button"
                onClick={() => setNewChatOpen(true)}
                className="mt-1 rounded-full bg-[var(--accent)] px-5 py-2.5 text-xs font-extrabold text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)]"
              >
                شروع گفتگو
              </button>
            </div>
          ) : mainItems.length === 0 && archivedItems.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-[var(--ink-3)]">نتیجه‌ای یافت نشد.</div>
          ) : (
            <div className="divide-y divide-[var(--line)]">
              {renderConversationRows(mainItems, rowCtx)}
              {archivedItems.length > 0 ? (
                <>
                  <div
                    className="bg-[var(--surface-2)] px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-[var(--ink-3)]"
                    dir="rtl"
                  >
                    بایگانی‌شده
                  </div>
                  {renderConversationRows(archivedItems, rowCtx)}
                </>
              ) : null}
            </div>
          )}
        </div>

        {error && items.length > 0 ? (
          <div className="mx-3 mt-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-center text-xs font-semibold text-[var(--accent-hover)]">
            {error}
          </div>
        ) : null}

        <div className="mt-4 px-4 text-center">
          <Link
            href="/groups"
            className="mb-3 block rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs font-bold text-[var(--ink-2)] hover:bg-[var(--surface-2)]"
          >
            مشاهده گروه‌های چت و اجتماعی
          </Link>
          <Link
            href="/home"
            className="text-xs font-semibold text-[var(--ink-3)] underline-offset-2 hover:text-[var(--accent-hover)] hover:underline"
          >
            بازگشت به خانه
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setNewChatOpen(true)}
          aria-label="گفتگوی جدید"
          className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] start-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)] text-2xl font-light text-[var(--accent-contrast)] shadow-lg transition hover:bg-[var(--accent-hover)] hover:shadow-xl active:scale-95"
        >
          <span aria-hidden>+</span>
        </button>
      </main>

      {newChatOpen ? (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center bg-[var(--ink)]/40 p-4 pt-[min(30vh,8rem)] backdrop-blur-[2px]"
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
            className="w-full max-w-sm rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="new-chat-title" className="text-base font-extrabold text-[var(--ink)]">
              گفتگوی جدید
            </h2>
            <p className="mt-1 text-xs text-[var(--ink-3)]">
              نام، نام کاربری یا شماره را جستجو کنید.
            </p>

            <div className="mt-4 flex h-11 items-center gap-2 rounded-xl bg-[var(--surface-2)] px-3 text-[var(--ink-3)]">
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4 shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجو…"
                className="h-full w-full bg-transparent text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-3)] outline-none"
                autoComplete="off"
                dir="rtl"
                aria-label="جستجوی کاربر برای گفتگوی جدید"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-[18px] leading-none text-[var(--ink-3)] hover:text-[var(--ink-2)]"
                  aria-label="پاک کردن جستجو"
                >
                  ×
                </button>
              ) : null}
            </div>

            <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--surface-2)]">
              {searchQuery.trim().length < 2 ? (
                <p className="px-3 py-4 text-center text-xs text-[var(--ink-3)]">برای شروع تایپ کنید.</p>
              ) : searching ? (
                <p className="px-3 py-4 text-center text-xs text-[var(--ink-3)]">در حال جستجو…</p>
              ) : searchHits.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-[var(--ink-3)]">نتیجه‌ای یافت نشد.</p>
              ) : (
                <ul className="divide-y divide-[var(--line)]">
                  {searchHits.map((hit) => (
                    <li key={hit.id}>
                      <button
                        type="button"
                        className="flex w-full flex-col items-start gap-0.5 bg-[var(--surface)] px-3 py-3 text-right transition hover:bg-[var(--surface-strong)]"
                        onClick={() => void startConversationWithUser(hit.id)}
                      >
                        <span className="text-sm font-bold text-[var(--ink)]">{hit.name}</span>
                        <span className="text-[11px] font-medium text-[var(--ink-3)]" dir="ltr">
                          @{hit.username} · {hit.phoneMasked}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {error ? (
              <p className="mt-2 text-xs font-semibold text-[var(--accent-hover)]" role="alert">
                {error}
              </p>
            ) : null}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setNewChatOpen(false);
                  setError(null);
                  setSearchQuery('');
                  setSearchHits([]);
                }}
                className="min-h-[44px] w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm font-bold text-[var(--ink-2)] transition hover:bg-[var(--surface-2)]"
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

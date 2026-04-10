'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { GROUP_DRAFT_CHANGED_EVENT, getGroupDraft } from '@/lib/group-drafts';
import { groupListPreview } from '@/lib/group-list-preview';

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

type GroupInboxRow = {
  id: string;
  name: string;
  description: string | null;
  networkId: string | null;
  network?: { id: string; name: string } | null;
  memberCount: number;
  myRole: string;
  lastMessage: Record<string, unknown> | null;
  lastActivityAt: string;
  unreadCount?: number;
  inboxPinned?: boolean;
  inboxArchived?: boolean;
  inboxMuted?: boolean;
};

type SocketMessage = DirectConversationRowMessage & {
  conversationId?: string;
  senderId?: string;
};

type SocketGroupMessage = Record<string, unknown> & { groupId?: string; senderId?: string };

type UnifiedInboxRow =
  | { kind: 'direct'; item: Conversation }
  | { kind: 'group'; item: GroupInboxRow };

function sortConversations(a: Conversation, b: Conversation): number {
  const aArc = a.inboxArchived ? 1 : 0;
  const bArc = b.inboxArchived ? 1 : 0;
  if (aArc !== bArc) return aArc - bArc;
  const ap = a.inboxPinned ? 1 : 0;
  const bp = b.inboxPinned ? 1 : 0;
  if (ap !== bp) return bp - ap;
  const ta = new Date(a.lastActivityAt ?? a.updatedAt).getTime();
  const tb = new Date(b.lastActivityAt ?? b.updatedAt).getTime();
  return tb - ta;
}

function sortGroups(a: GroupInboxRow, b: GroupInboxRow): number {
  const aArc = a.inboxArchived ? 1 : 0;
  const bArc = b.inboxArchived ? 1 : 0;
  if (aArc !== bArc) return aArc - bArc;
  const ap = a.inboxPinned ? 1 : 0;
  const bp = b.inboxPinned ? 1 : 0;
  if (ap !== bp) return bp - ap;
  return new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime();
}

function sortUnified(a: UnifiedInboxRow, b: UnifiedInboxRow): number {
  const aArc =
    (a.kind === 'direct' ? a.item.inboxArchived : a.item.inboxArchived) ? 1 : 0;
  const bArc =
    (b.kind === 'direct' ? b.item.inboxArchived : b.item.inboxArchived) ? 1 : 0;
  if (aArc !== bArc) return aArc - bArc;
  const ap = (a.kind === 'direct' ? a.item.inboxPinned : a.item.inboxPinned) ? 1 : 0;
  const bp = (b.kind === 'direct' ? b.item.inboxPinned : b.item.inboxPinned) ? 1 : 0;
  if (ap !== bp) return bp - ap;
  const ta =
    a.kind === 'direct'
      ? new Date(a.item.lastActivityAt ?? a.item.updatedAt).getTime()
      : new Date(a.item.lastActivityAt).getTime();
  const tb =
    b.kind === 'direct'
      ? new Date(b.item.lastActivityAt ?? b.item.updatedAt).getTime()
      : new Date(b.item.lastActivityAt).getTime();
  return tb - ta;
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

function matchesGroupListFilter(item: GroupInboxRow, q: string, myUserId: string | null): boolean {
  const term = q.trim().toLowerCase();
  if (!term) return true;
  const lm = item.lastMessage;
  const preview = lm ? groupListPreview(lm as Parameters<typeof groupListPreview>[0], myUserId) : '';
  const blob = [item.name, item.network?.name, preview].filter(Boolean).join(' ').toLowerCase();
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
    const menuKey = `direct:${item.id}`;
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
        key={menuKey}
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
        menuOpen={ctx.menuOpenId === menuKey}
        onMenuToggle={() =>
          ctx.setMenuOpenId(ctx.menuOpenId === menuKey ? null : menuKey)
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

function renderGroupRows(
  list: GroupInboxRow[],
  ctx: {
    myUserId: string | null;
    menuOpenId: string | null;
    setMenuOpenId: (id: string | null) => void;
    typingByGroup: Record<string, boolean>;
    onInboxAction: (groupId: string, segment: string) => void;
  },
) {
  return list.map((item) => {
    const menuKey = `group:${item.id}`;
    const lm = item.lastMessage as Record<string, unknown> | null | undefined;
    const draft = getGroupDraft(item.id).trim();
    const typing = ctx.typingByGroup[item.id] === true;
    let previewVariant: DirectRowPreviewVariant = 'default';
    let preview: string;
    if (typing) {
      previewVariant = 'typing';
      preview = 'در حال نوشتن…';
    } else if (draft) {
      previewVariant = 'draft';
      preview = `پیش‌نویس: ${draft.length > 80 ? `${draft.slice(0, 80)}…` : draft}`;
    } else {
      preview = groupListPreview(lm as Parameters<typeof groupListPreview>[0], ctx.myUserId);
    }
    const previewTimeIso =
      (lm?.createdAt as string | undefined) ?? item.lastActivityAt ?? new Date().toISOString();
    const unread = typeof item.unreadCount === 'number' ? item.unreadCount : 0;
    const scopeLabel = item.network?.name ? `شبکه: ${item.network.name}` : 'گروه';
    const subtitle = [scopeLabel, `${item.memberCount} عضو`].join(' · ');

    return (
      <DirectConversationRow
        key={menuKey}
        href={`/groups/${item.id}`}
        peerName={item.name}
        peerAvatarUrl={null}
        peerSubtitle={subtitle}
        preview={preview}
        previewVariant={previewVariant}
        previewTimeIso={previewTimeIso}
        myUserId={ctx.myUserId}
        lastMessage={lm ? (lm as unknown as DirectConversationRowMessage) : undefined}
        unreadCount={unread}
        peerOnline={false}
        inboxPinned={item.inboxPinned === true}
        inboxArchived={item.inboxArchived === true}
        inboxMuted={item.inboxMuted === true}
        unreadEmphasis={unread > 0 && previewVariant === 'default'}
        menuOpen={ctx.menuOpenId === menuKey}
        onMenuToggle={() => ctx.setMenuOpenId(ctx.menuOpenId === menuKey ? null : menuKey)}
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
  const [directItems, setDirectItems] = useState<Conversation[]>([]);
  const [groupItems, setGroupItems] = useState<GroupInboxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchHits, setSearchHits] = useState<UserSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [listFilterQuery, setListFilterQuery] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [typingByConv, setTypingByConv] = useState<Record<string, boolean>>({});
  const [typingByGroup, setTypingByGroup] = useState<Record<string, boolean>>({});
  const [, setDraftRev] = useState(0);

  const directRef = useRef(directItems);
  directRef.current = directItems;
  const groupRef = useRef(groupItems);
  groupRef.current = groupItems;
  const myUserIdRef = useRef(myUserId);
  myUserIdRef.current = myUserId;
  const typingTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const groupTypingTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const plusMenuRef = useRef<HTMLDivElement | null>(null);

  const totalCount = directItems.length + groupItems.length;

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

      const [conversations, groupsRaw] = await Promise.all([
        apiFetch<Conversation[]>('direct/conversations', { method: 'GET', token }).catch(() => []),
        apiFetch<GroupInboxRow[]>('groups/conversations', { method: 'GET', token }).catch(() => []),
      ]);

      setDirectItems(Array.isArray(conversations) ? [...conversations].sort(sortConversations) : []);
      setGroupItems(Array.isArray(groupsRaw) ? [...groupsRaw].sort(sortGroups) : []);
      setError(null);
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

  const onInboxAction = useCallback(
    async (conversationId: string, segment: string) => {
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
    },
    [loadMeAndConversations],
  );

  const onGroupInboxAction = useCallback(
    async (groupId: string, segment: string) => {
      const token = getAccessToken();
      if (!token) return;
      try {
        setError(null);
        await apiFetch(`groups/${groupId}/${segment}`, { method: 'POST', token });
        await loadMeAndConversations({ silent: true });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'خطا در به‌روزرسانی گروه');
      }
    },
    [loadMeAndConversations],
  );

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
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [loadMeAndConversations]);

  useEffect(() => {
    const onDraft = () => setDraftRev((n) => n + 1);
    window.addEventListener(DIRECT_DRAFT_CHANGED_EVENT, onDraft);
    window.addEventListener(GROUP_DRAFT_CHANGED_EVENT, onDraft);
    return () => {
      window.removeEventListener(DIRECT_DRAFT_CHANGED_EVENT, onDraft);
      window.removeEventListener(GROUP_DRAFT_CHANGED_EVENT, onDraft);
    };
  }, []);

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
    if (!plusMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (plusMenuRef.current?.contains(el ?? null)) return;
      setPlusMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [plusMenuOpen]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token || !myUserId) return;

    const socket = io(getApiBaseUrl().replace(/\/+$/, ''), {
      transports: ['websocket'],
      auth: { token },
    });
    socketRef.current = socket;

    const joinDirect = () => {
      for (const id of directRef.current.map((i) => i.id)) {
        socket.emit('join_direct', { conversationId: id, skipDeliverySync: true });
      }
    };

    const leaveDirect = () => {
      for (const id of directRef.current.map((i) => i.id)) {
        socket.emit('leave_direct', { conversationId: id });
      }
    };

    const joinGroups = () => {
      for (const id of groupRef.current.map((i) => i.id)) {
        socket.emit('join_group', { groupId: id });
      }
    };

    const leaveGroups = () => {
      for (const id of groupRef.current.map((i) => i.id)) {
        socket.emit('leave_group', { groupId: id });
      }
    };

    const joinAll = () => {
      joinDirect();
      joinGroups();
    };

    const leaveAll = () => {
      leaveDirect();
      leaveGroups();
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
      setDirectItems((prev) => {
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
      setDirectItems((prev) => {
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
      setDirectItems((prev) => {
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
      setDirectItems((prev) =>
        prev.map((row) =>
          row.id === payload.conversationId ? { ...row, peerOnline: payload.online } : row,
        ),
      );
    };

    const onGroupTyping = (payload: { groupId: string; userId: string; isTyping: boolean }) => {
      const me = myUserIdRef.current;
      if (!me || payload.userId === me) return;
      const gid = payload.groupId;
      const prevT = groupTypingTimersRef.current.get(gid);
      if (prevT) clearTimeout(prevT);
      if (payload.isTyping) {
        setTypingByGroup((m) => ({ ...m, [gid]: true }));
        groupTypingTimersRef.current.set(
          gid,
          setTimeout(() => {
            setTypingByGroup((m) => {
              const n = { ...m };
              delete n[gid];
              return n;
            });
            groupTypingTimersRef.current.delete(gid);
          }, 2500),
        );
      } else {
        setTypingByGroup((m) => {
          const n = { ...m };
          delete n[gid];
          return n;
        });
        groupTypingTimersRef.current.delete(gid);
      }
    };

    const onGroupMessage = (msg: SocketGroupMessage) => {
      const gid = msg.groupId as string | undefined;
      if (!gid) return;
      const uid = myUserIdRef.current;
      const createdRaw = msg.createdAt;
      const created =
        typeof createdRaw === 'string'
          ? createdRaw
          : createdRaw instanceof Date
            ? createdRaw.toISOString()
            : String(createdRaw);
      setGroupItems((prev) => {
        const ix = prev.findIndex((c) => c.id === gid);
        if (ix < 0) return prev;
        const c = prev[ix];
        const lastMessage = { ...msg, createdAt: created } as GroupInboxRow['lastMessage'];
        const lastActivityAt = new Date(
          Math.max(new Date(c.lastActivityAt).getTime(), new Date(created).getTime()),
        ).toISOString();
        const incoming = !!(uid && msg.senderId && msg.senderId !== uid);
        const unreadCount = (c.unreadCount ?? 0) + (incoming ? 1 : 0);
        const next = [...prev];
        next[ix] = {
          ...c,
          lastMessage,
          lastActivityAt,
          unreadCount,
        };
        return next.sort(sortGroups);
      });
    };

    socket.on('connect', joinAll);
    socket.on('direct_typing', onTyping);
    socket.on('direct_message', onMessage);
    socket.on('direct_message_edited', onEdited);
    socket.on('direct_message_deleted', onDeleted);
    socket.on('direct_presence', onPresence);
    socket.on('group_typing', onGroupTyping);
    socket.on('group_message', onGroupMessage);

    if (socket.connected) joinAll();

    return () => {
      typingTimersRef.current.forEach((t) => clearTimeout(t));
      typingTimersRef.current.clear();
      groupTypingTimersRef.current.forEach((t) => clearTimeout(t));
      groupTypingTimersRef.current.clear();
      leaveAll();
      socket.off('connect', joinAll);
      socket.off('direct_typing', onTyping);
      socket.off('direct_message', onMessage);
      socket.off('direct_message_edited', onEdited);
      socket.off('direct_message_deleted', onDeleted);
      socket.off('direct_presence', onPresence);
      socket.off('group_typing', onGroupTyping);
      socket.off('group_message', onGroupMessage);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [myUserId]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket?.connected) return;
    for (const id of directItems.map((i) => i.id)) {
      socket.emit('join_direct', { conversationId: id, skipDeliverySync: true });
    }
  }, [directItems]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket?.connected) return;
    for (const id of groupItems.map((i) => i.id)) {
      socket.emit('join_group', { groupId: id });
    }
  }, [groupItems]);

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
      setPlusMenuOpen(false);
      setSearchQuery('');
      setSearchHits([]);
      window.location.href = `/direct/${conversation.id}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در ساخت گفتگو');
    }
  }

  const mainDirect = directItems.filter(
    (i) => !i.inboxArchived && matchesListFilter(i, listFilterQuery, myUserId),
  );
  const archivedDirect = directItems.filter(
    (i) => i.inboxArchived && matchesListFilter(i, listFilterQuery, myUserId),
  );
  const mainGroups = groupItems.filter(
    (i) => !i.inboxArchived && matchesGroupListFilter(i, listFilterQuery, myUserId),
  );
  const archivedGroups = groupItems.filter(
    (i) => i.inboxArchived && matchesGroupListFilter(i, listFilterQuery, myUserId),
  );

  const mainUnified: UnifiedInboxRow[] = [
    ...mainDirect.map((item) => ({ kind: 'direct' as const, item })),
    ...mainGroups.map((item) => ({ kind: 'group' as const, item })),
  ].sort(sortUnified);

  const archivedUnified: UnifiedInboxRow[] = [
    ...archivedDirect.map((item) => ({ kind: 'direct' as const, item })),
    ...archivedGroups.map((item) => ({ kind: 'group' as const, item })),
  ].sort(sortUnified);

  const directCtx = {
    myUserId,
    menuOpenId,
    setMenuOpenId,
    typingByConv,
    onInboxAction,
  };

  const groupCtx = {
    myUserId,
    menuOpenId,
    setMenuOpenId,
    typingByGroup,
    onInboxAction: onGroupInboxAction,
  };

  return (
    <AuthGate>
      <main className="mx-auto min-h-[60vh] w-full max-w-md bg-stone-100/90 pb-2">
        <div
          className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-stone-200/80 bg-stone-50/95 px-4 py-2.5 backdrop-blur-sm"
          dir="rtl"
        >
          <p className="text-sm font-semibold text-stone-600">چت‌ها</p>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => void loadMeAndConversations()}
              disabled={loading}
              title="رفرش"
              className="flex h-10 w-10 items-center justify-center rounded-full text-stone-600 transition hover:bg-stone-200/80 disabled:opacity-40"
            >
              <span className={`text-lg ${loading ? 'animate-pulse' : ''}`} aria-hidden>
                ↻
              </span>
            </button>
            <div className="relative" ref={plusMenuRef}>
              <button
                type="button"
                onClick={() => setPlusMenuOpen((o) => !o)}
                title="جدید"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md shadow-emerald-600/25 transition hover:bg-emerald-600 active:scale-95"
              >
                <IconPlus className="h-6 w-6 stroke-[2.5]" />
              </button>
              {plusMenuOpen ? (
                <div
                  className="absolute end-0 top-[calc(100%+6px)] z-30 min-w-[11rem] overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-xl"
                  dir="rtl"
                >
                  <button
                    type="button"
                    className="flex w-full px-4 py-2.5 text-right text-sm font-bold text-stone-800 hover:bg-stone-50"
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
                    href="/groups/new"
                    className="flex w-full px-4 py-2.5 text-right text-sm font-bold text-stone-800 hover:bg-stone-50"
                    onClick={() => setPlusMenuOpen(false)}
                  >
                    گروه جدید
                  </Link>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {!loading && totalCount > 0 ? (
          <div className="mt-2 px-3" dir="rtl">
            <input
              value={listFilterQuery}
              onChange={(e) => setListFilterQuery(e.target.value)}
              placeholder="جستجو در چت‌ها و گروه‌ها…"
              className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              autoComplete="off"
            />
          </div>
        ) : null}

        <div className="relative mt-1 overflow-hidden rounded-2xl border border-stone-200/60 bg-white shadow-sm">
          {loading ? (
            <ConversationListSkeleton />
          ) : error && totalCount === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-semibold text-red-800">{error}</p>
              <button
                type="button"
                onClick={() => void loadMeAndConversations()}
                className="mt-3 text-xs font-bold text-emerald-700 underline"
              >
                تلاش دوباره
              </button>
            </div>
          ) : totalCount === 0 ? (
            <div className="px-6 py-14 text-center">
              <p className="text-base font-bold text-stone-900">هنوز چتی ندارید</p>
              <p className="mx-auto mt-2 max-w-[17rem] text-sm leading-relaxed text-stone-500">
                با <span className="font-bold text-emerald-600">+</span> گفتگوی خصوصی یا گروه جدید بسازید.
              </p>
            </div>
          ) : mainUnified.length === 0 && archivedUnified.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-stone-500">نتیجه‌ای یافت نشد.</div>
          ) : (
            <div className="divide-y divide-stone-100">
              {mainUnified.map((row) =>
                row.kind === 'direct' ? (
                  <div key={`direct:${row.item.id}`}>
                    {renderConversationRows([row.item], directCtx)}
                  </div>
                ) : (
                  <div key={`group:${row.item.id}`}>{renderGroupRows([row.item], groupCtx)}</div>
                ),
              )}
              {archivedUnified.length > 0 ? (
                <>
                  <div
                    className="bg-stone-100/90 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-stone-500"
                    dir="rtl"
                  >
                    بایگانی‌شده
                  </div>
                  {archivedUnified.map((row) =>
                    row.kind === 'direct' ? (
                      <div key={`adirect:${row.item.id}`}>
                        {renderConversationRows([row.item], directCtx)}
                      </div>
                    ) : (
                      <div key={`agroup:${row.item.id}`}>{renderGroupRows([row.item], groupCtx)}</div>
                    ),
                  )}
                </>
              ) : null}
            </div>
          )}
        </div>

        {error && totalCount > 0 ? (
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

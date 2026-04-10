'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { io } from 'socket.io-client';
import { AuthGate } from '@/components/AuthGate';
import { getAccessToken } from '@/lib/auth';
import { apiFetch, getApiBaseUrl } from '@/lib/api';
import {
  DirectConversationRow,
  type DirectConversationRowMessage,
  type DirectRowPreviewVariant,
} from '@/components/direct/DirectConversationRow';
import { groupListPreview } from '@/lib/group-list-preview';
import { GROUP_DRAFT_CHANGED_EVENT, getGroupDraft } from '@/lib/group-drafts';

type GroupInboxRow = {
  id: string;
  name: string;
  description: string | null;
  networkId: string;
  network?: { id: string; name: string };
  memberCount: number;
  myRole: string;
  lastMessage: Record<string, unknown> | null;
  lastActivityAt: string;
  unreadCount?: number;
  inboxPinned?: boolean;
  inboxArchived?: boolean;
  inboxMuted?: boolean;
};

type SocketGroupMessage = Record<string, unknown> & { groupId?: string; senderId?: string };

function sortRows(a: GroupInboxRow, b: GroupInboxRow): number {
  const aArc = a.inboxArchived ? 1 : 0;
  const bArc = b.inboxArchived ? 1 : 0;
  if (aArc !== bArc) return aArc - bArc;
  const ap = a.inboxPinned ? 1 : 0;
  const bp = b.inboxPinned ? 1 : 0;
  if (ap !== bp) return bp - ap;
  return new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime();
}

function matchesFilter(item: GroupInboxRow, q: string, myUserId: string | null): boolean {
  const term = q.trim().toLowerCase();
  if (!term) return true;
  const lm = item.lastMessage;
  const preview = lm ? groupListPreview(lm as Parameters<typeof groupListPreview>[0], myUserId) : '';
  const blob = [item.name, item.network?.name, preview].filter(Boolean).join(' ').toLowerCase();
  return blob.includes(term);
}

export default function GroupsInboxPage() {
  const [items, setItems] = useState<GroupInboxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [listFilterQuery, setListFilterQuery] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [typingByGroup, setTypingByGroup] = useState<Record<string, boolean>>({});
  const [, setDraftRev] = useState(0);

  const itemsRef = useRef(items);
  itemsRef.current = items;
  const myUserIdRef = useRef(myUserId);
  myUserIdRef.current = myUserId;
  const typingTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const socketRef = useRef<ReturnType<typeof io> | null>(null);

  const loadList = useCallback(async (opts?: { silent?: boolean }) => {
    const token = getAccessToken();
    if (!token) return;
    if (!opts?.silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const me = await apiFetch<{ id: string }>('users/me', { method: 'GET', token });
      setMyUserId(me.id);
      const rows = await apiFetch<GroupInboxRow[]>('groups/conversations', { method: 'GET', token });
      setItems(Array.isArray(rows) ? [...rows].sort(sortRows) : []);
    } catch (e) {
      if (!opts?.silent) setError(e instanceof Error ? e.message : 'خطا');
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  const onInboxAction = useCallback(
    async (groupId: string, segment: string) => {
      const token = getAccessToken();
      if (!token) return;
      try {
        setError(null);
        await apiFetch(`groups/${groupId}/${segment}`, { method: 'POST', token });
        await loadList({ silent: true });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'خطا');
      }
    },
    [loadList],
  );

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') void loadList({ silent: true });
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [loadList]);

  useEffect(() => {
    const onDraft = () => setDraftRev((n) => n + 1);
    window.addEventListener(GROUP_DRAFT_CHANGED_EVENT, onDraft);
    return () => window.removeEventListener(GROUP_DRAFT_CHANGED_EVENT, onDraft);
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
    const token = getAccessToken();
    if (!token || !myUserId) return;

    const socket = io(getApiBaseUrl().replace(/\/+$/, ''), {
      transports: ['websocket'],
      auth: { token },
    });
    socketRef.current = socket;

    const joinAll = () => {
      for (const id of itemsRef.current.map((i) => i.id)) {
        socket.emit('join_group', { groupId: id });
      }
    };

    const leaveAll = () => {
      for (const id of itemsRef.current.map((i) => i.id)) {
        socket.emit('leave_group', { groupId: id });
      }
    };

    const onTyping = (payload: { groupId: string; userId: string; isTyping: boolean }) => {
      const me = myUserIdRef.current;
      if (!me || payload.userId === me) return;
      const gid = payload.groupId;
      const prevT = typingTimersRef.current.get(gid);
      if (prevT) clearTimeout(prevT);
      if (payload.isTyping) {
        setTypingByGroup((m) => ({ ...m, [gid]: true }));
        typingTimersRef.current.set(
          gid,
          setTimeout(() => {
            setTypingByGroup((m) => {
              const n = { ...m };
              delete n[gid];
              return n;
            });
            typingTimersRef.current.delete(gid);
          }, 2500),
        );
      } else {
        setTypingByGroup((m) => {
          const n = { ...m };
          delete n[gid];
          return n;
        });
        typingTimersRef.current.delete(gid);
      }
    };

    const onMessage = (msg: SocketGroupMessage) => {
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
      setItems((prev) => {
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
        return next.sort(sortRows);
      });
    };

    socket.on('connect', joinAll);
    socket.on('group_typing', onTyping);
    socket.on('group_message', onMessage);

    if (socket.connected) joinAll();

    return () => {
      typingTimersRef.current.forEach((t) => clearTimeout(t));
      typingTimersRef.current.clear();
      leaveAll();
      socket.off('connect', joinAll);
      socket.off('group_typing', onTyping);
      socket.off('group_message', onMessage);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [myUserId]);

  useEffect(() => {
    const s = socketRef.current;
    if (!s?.connected) return;
    for (const id of items.map((i) => i.id)) {
      s.emit('join_group', { groupId: id });
    }
  }, [items]);

  const mainItems = items.filter((i) => !i.inboxArchived && matchesFilter(i, listFilterQuery, myUserId));
  const archivedItems = items.filter((i) => i.inboxArchived && matchesFilter(i, listFilterQuery, myUserId));

  const rowCtx = { myUserId, menuOpenId, setMenuOpenId, typingByGroup, onInboxAction };

  return (
    <AuthGate>
      <main className="mx-auto min-h-[60vh] w-full max-w-md bg-stone-100/90 pb-2">
        <div
          className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-stone-200/80 bg-stone-50/95 px-4 py-2.5 backdrop-blur-sm"
          dir="rtl"
        >
          <p className="text-sm font-semibold text-stone-600">گروه‌ها</p>
          <button
            type="button"
            onClick={() => void loadList()}
            disabled={loading}
            className="flex h-10 w-10 items-center justify-center rounded-full text-stone-600 transition hover:bg-stone-200/80 disabled:opacity-40"
            title="رفرش"
          >
            <span className={`text-lg ${loading ? 'animate-pulse' : ''}`} aria-hidden>
              ↻
            </span>
          </button>
        </div>

        {!loading && items.length > 0 ? (
          <div className="mt-2 px-3" dir="rtl">
            <input
              value={listFilterQuery}
              onChange={(e) => setListFilterQuery(e.target.value)}
              placeholder="جستجو در گروه‌ها…"
              className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              autoComplete="off"
            />
          </div>
        ) : null}

        <div className="relative mt-1 overflow-hidden rounded-2xl border border-stone-200/60 bg-white shadow-sm">
          {loading ? (
            <div className="divide-y divide-stone-100 px-4 py-8 text-center text-sm text-stone-500">در حال بارگذاری…</div>
          ) : error && items.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm font-semibold text-red-800">{error}</div>
          ) : items.length === 0 ? (
            <div className="px-6 py-14 text-center" dir="rtl">
              <p className="text-base font-bold text-stone-900">هنوز عضو هیچ گروهی نیستید</p>
              <p className="mx-auto mt-2 max-w-[18rem] text-sm text-stone-500">
                از صفحهٔ فضاها شبکه‌ها را ببینید و به گروه بپیوندید.
              </p>
              <Link
                href="/spaces"
                className="mt-4 inline-block rounded-full bg-sky-600 px-4 py-2 text-sm font-bold text-white"
              >
                رفتن به فضاها
              </Link>
            </div>
          ) : mainItems.length === 0 && archivedItems.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-stone-500">نتیجه‌ای یافت نشد.</div>
          ) : (
            <div className="divide-y divide-stone-100">
              {mainItems.map((item) => renderGroupRow(item, rowCtx))}
              {archivedItems.length > 0 ? (
                <>
                  <div className="bg-stone-100/90 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-stone-500" dir="rtl">
                    بایگانی‌شده
                  </div>
                  {archivedItems.map((item) => renderGroupRow(item, rowCtx))}
                </>
              ) : null}
            </div>
          )}
        </div>

        {error && items.length > 0 ? (
          <div className="mx-4 mt-3 rounded-xl border border-red-100 bg-red-50/90 px-3 py-2 text-center text-xs font-semibold text-red-800">
            {error}
          </div>
        ) : null}

        <div className="mt-4 flex justify-center gap-4 px-4 text-center">
          <Link href="/direct" className="text-xs font-semibold text-stone-500 underline-offset-2 hover:underline">
            چت‌های خصوصی
          </Link>
          <Link href="/home" className="text-xs font-semibold text-stone-500 underline-offset-2 hover:underline">
            خانه
          </Link>
        </div>
      </main>
    </AuthGate>
  );
}

function renderGroupRow(
  item: GroupInboxRow,
  ctx: {
    myUserId: string | null;
    menuOpenId: string | null;
    setMenuOpenId: (id: string | null) => void;
    typingByGroup: Record<string, boolean>;
    onInboxAction: (id: string, seg: string) => void;
  },
) {
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
  const subtitle = [item.network?.name ? `شبکه: ${item.network.name}` : '', `${item.memberCount} عضو`]
    .filter(Boolean)
    .join(' · ');

  return (
    <DirectConversationRow
      key={item.id}
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
      menuOpen={ctx.menuOpenId === item.id}
      onMenuToggle={() => ctx.setMenuOpenId(ctx.menuOpenId === item.id ? null : item.id)}
      onPin={() => void ctx.onInboxAction(item.id, item.inboxPinned ? 'inbox/unpin' : 'inbox/pin')}
      onArchiveToggle={() =>
        void ctx.onInboxAction(item.id, item.inboxArchived ? 'inbox/unarchive' : 'inbox/archive')
      }
      onMuteToggle={() => void ctx.onInboxAction(item.id, item.inboxMuted ? 'inbox/unmute' : 'inbox/mute')}
    />
  );
}

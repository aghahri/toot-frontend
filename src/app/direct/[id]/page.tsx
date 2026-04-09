'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AuthGate } from '@/components/AuthGate';
import { getAccessToken } from '@/lib/auth';
import { apiFetch, getApiBaseUrl, getErrorMessageFromResponse } from '@/lib/api';
import { markDirectConversationRead } from '@/lib/mark-direct-read';
import { Card } from '@/components/ui/Card';
import { io } from 'socket.io-client';
import { FormEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

type MessageMedia = {
  id: string;
  type: string;
  url: string;
  mimeType: string;
  originalName: string | null;
  size: number;
  createdAt: string;
};

type ReplyToSummary = {
  id: string;
  text: string | null;
  senderId: string;
  mediaId: string | null;
  media?: MessageMedia | null;
  isDeleted?: boolean;
  deletedAt?: string | null;
  editedAt?: string | null;
  createdAt: string;
  sender: {
    id: string;
    name: string;
    avatar: string | null;
  };
};

const DIRECT_OLDER_PAGE_SIZE = 30;

function formatLastSeenFa(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const t = d.getTime();
  if (Number.isNaN(t)) return '';
  const sec = Math.round((Date.now() - t) / 1000);
  if (sec < 45) return 'همین الان';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} دقیقه پیش`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ساعت پیش`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} روز پیش`;
  return d.toLocaleDateString('fa-IR', { dateStyle: 'medium' });
}

type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  text: string | null;
  mediaId: string | null;
  isDeleted?: boolean;
  deletedAt?: string | null;
  editedAt?: string | null;
  deliveredAt?: string | null;
  seenAt?: string | null;
  createdAt: string;
  sender: {
    id: string;
    name: string;
    avatar: string | null;
  };
  media?: MessageMedia | null;
  replyToMessage?: ReplyToSummary | null;
  pending?: boolean;
};

function isWindowNearBottom(thresholdPx: number): boolean {
  if (typeof window === 'undefined') return true;
  const el = document.documentElement;
  return window.innerHeight + window.scrollY >= el.scrollHeight - thresholdPx;
}

/** Uses scroll metrics from *before* the latest DOM reflow (see layoutScrollSnapshotRef). */
function wasPinnedToBottomSnapshot(
  snap: { scrollY: number; scrollHeight: number },
  thresholdPx: number,
): boolean {
  if (typeof window === 'undefined') return false;
  if (snap.scrollHeight <= 0) return false;
  return window.innerHeight + snap.scrollY >= snap.scrollHeight - thresholdPx;
}

function replySnippetForMessage(msg: Message): string {
  if (msg.isDeleted) return 'این پیام حذف شده است';
  const t = msg.text?.trim();
  if (t) return t.length > 100 ? `${t.slice(0, 100)}…` : t;
  if (msg.mediaId) return 'رسانه';
  return 'پیام';
}

function ReplyQuoteBlock({
  reply,
  mine,
}: {
  reply: ReplyToSummary;
  mine: boolean;
}) {
  const isDeleted = !!reply.isDeleted || reply.text == null;
  const safeText = reply.text ?? '';
  const body = isDeleted
    ? 'این پیام حذف شده است'
    : safeText.trim()
      ? safeText.length > 140
        ? `${safeText.slice(0, 140)}…`
        : safeText
      : reply.mediaId
        ? 'رسانه'
        : '—';

  return (
    <div
      className={`mb-2 rounded-xl border-s-[3px] px-2.5 py-2 text-start text-[11px] leading-snug shadow-sm ${
        isDeleted ? 'border-s-slate-400/80' : 'border-s-sky-500'
      } ${mine ? 'bg-black/15 text-white/95' : 'bg-slate-100/90 text-slate-700 ring-1 ring-slate-200/60'} ${
        isDeleted ? 'opacity-75' : ''
      }`}
      dir="auto"
    >
      <div className="truncate text-[10px] font-semibold opacity-80">{reply.sender.name}</div>
      <div className="line-clamp-2 mt-0.5 opacity-90">{body}</div>
    </div>
  );
}

export default function DirectConversationPage() {
  const params = useParams();
  const conversationId = Array.isArray(params?.id) ? params.id[0] : params?.id ?? '';
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);
  /** Last committed scrollY + scrollHeight (before the current paint grew the document). */
  const layoutScrollSnapshotRef = useRef({ scrollY: 0, scrollHeight: 0 });
  const wasLoadingRef = useRef(false);
  const awaitingFirstLoadScrollRef = useRef(true);
  const forceScrollAfterLoadRef = useRef(false);
  const prevMessageTailRef = useRef<{
    len: number;
    lastId: string;
    firstId: string;
  } | null>(null);
  const [hasMoreOlder, setHasMoreOlder] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const [peerPresence, setPeerPresence] = useState<{
    online: boolean;
    lastSeenAt: string | null;
  }>({ online: false, lastSeenAt: null });
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [replyDraft, setReplyDraft] = useState<{
    id: string;
    senderName: string;
    preview: string;
  } | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [openActionsMessageId, setOpenActionsMessageId] = useState<string | null>(null);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const peerDisplay = useMemo(() => {
    const other = messages.find((m) => myUserId != null && m.senderId !== myUserId);
    if (other) {
      return { name: other.sender.name, avatar: other.sender.avatar };
    }
    return { name: 'مخاطب', avatar: null as string | null };
  }, [messages, myUserId]);

  const peerInitial = useMemo(() => {
    const t = peerDisplay.name.trim();
    if (!t) return '?';
    return t.slice(0, 1);
  }, [peerDisplay.name]);

  const headerStatusLine = useMemo(() => {
    if (otherTyping) {
      return { text: 'در حال تایپ…', className: 'font-semibold text-emerald-600' };
    }
    if (peerPresence.online) {
      return { text: 'آنلاین', className: 'font-semibold text-emerald-600' };
    }
    if (peerPresence.lastSeenAt) {
      return {
        text: `آخرین بازدید ${formatLastSeenFa(peerPresence.lastSeenAt)}`,
        className: 'text-stone-500',
      };
    }
    return { text: 'گفتگوی خصوصی', className: 'text-stone-500' };
  }, [otherTyping, peerPresence]);

useEffect(() => {
  if (!file) {
    setPreviewUrl(null);
    return;
  }

  const objectUrl = URL.createObjectURL(file);
  setPreviewUrl(objectUrl);

  return () => {
    URL.revokeObjectURL(objectUrl);
  };
}, [file]);

function renderMessageStatus(msg: Message, mine: boolean) {
  if (!mine || msg.pending) return null;

  if (msg.seenAt) {
    return <span className="text-sky-400">✓✓</span>;
  }

  if (msg.deliveredAt) {
    return <span className="text-slate-400">✓✓</span>;
  }

  return <span className="text-slate-400">✓</span>;
}
function clearSelectedFile() {
  setFile(null);
  setPreviewUrl(null);
}
function cancelEdit() {
  setEditMode(false);
  setEditingMessageId(null);
  setText('');
  socketRef.current?.emit('direct_typing', {
    conversationId,
    isTyping: false,
  });
}
function scrollThreadEnd(behavior: ScrollBehavior = 'auto') {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const root = document.documentElement;
      const y = root.scrollHeight - window.innerHeight;
      window.scrollTo({ top: Math.max(0, y), left: 0, behavior });
      layoutScrollSnapshotRef.current = {
        scrollY: window.scrollY,
        scrollHeight: document.documentElement.scrollHeight,
      };
    });
  });
}

  function scheduleLayoutScrollSnapshot() {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (typeof window === 'undefined') return;
        layoutScrollSnapshotRef.current = {
          scrollY: window.scrollY,
          scrollHeight: document.documentElement.scrollHeight,
        };
      });
    });
  }

  useEffect(() => {
    if (!conversationId) return;
    wasLoadingRef.current = false;
    awaitingFirstLoadScrollRef.current = true;
    forceScrollAfterLoadRef.current = false;
    prevMessageTailRef.current = null;
    layoutScrollSnapshotRef.current = { scrollY: 0, scrollHeight: 0 };
    setOpenActionsMessageId(null);
    setHasMoreOlder(true);
  }, [conversationId]);

  useEffect(() => {
    if (!openActionsMessageId) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenActionsMessageId(null);
    };

    const onPointerDown = (e: PointerEvent) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (!t.closest('[data-direct-msg-actions]')) setOpenActionsMessageId(null);
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [openActionsMessageId]);

  useEffect(() => {
    if (loading) wasLoadingRef.current = true;
  }, [loading]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onScroll = () => {
      layoutScrollSnapshotRef.current = {
        scrollY: window.scrollY,
        scrollHeight: document.documentElement.scrollHeight,
      };
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useLayoutEffect(() => {
    if (!conversationId) return;
    if (loading) return;
    if (!wasLoadingRef.current && messages.length === 0) return;

    const tailId = messages[messages.length - 1]?.id ?? '';
    const headId = messages[0]?.id ?? '';

    if (forceScrollAfterLoadRef.current) {
      forceScrollAfterLoadRef.current = false;
      scrollThreadEnd('auto');
      prevMessageTailRef.current = {
        len: messages.length,
        lastId: tailId,
        firstId: headId,
      };
      return;
    }

    if (awaitingFirstLoadScrollRef.current) {
      awaitingFirstLoadScrollRef.current = false;
      scrollThreadEnd('auto');
      prevMessageTailRef.current = {
        len: messages.length,
        lastId: tailId,
        firstId: headId,
      };
      return;
    }

    const prev = prevMessageTailRef.current;
    prevMessageTailRef.current = {
      len: messages.length,
      lastId: tailId,
      firstId: headId,
    };
    if (!prev) {
      scheduleLayoutScrollSnapshot();
      return;
    }

    /** Only true when new row(s) were appended at the end (not prepend, delete, edit, or status-only). */
    const appendedAtTail =
      messages.length > prev.len &&
      tailId !== prev.lastId &&
      (headId === (prev.firstId ?? '') || prev.len === 0);

    if (!appendedAtTail) {
      scheduleLayoutScrollSnapshot();
      return;
    }

    const snap = layoutScrollSnapshotRef.current;
    const wasPinnedBeforeAppend =
      wasPinnedToBottomSnapshot(snap, 120) ||
      (snap.scrollHeight <= 0 && isWindowNearBottom(120)) ||
      prev.len === 0;

    if (wasPinnedBeforeAppend) {
      scrollThreadEnd('auto');
    } else {
      scheduleLayoutScrollSnapshot();
    }
  }, [loading, messages, conversationId]);

async function loadMessages() {
    const token = getAccessToken();
    if (!token || !conversationId) return;

    setLoading(true);
    setError(null);

    try {
      const me = await apiFetch<{ id: string; name: string }>('users/me', {
        method: 'GET',
        token,
      });
      setMyUserId(me.id);

      const data = await apiFetch<Message[]>(
        `direct/conversations/${conversationId}/messages`,
        {
          method: 'GET',
          token,
        },
      );

      setMessages(data);
      setHasMoreOlder(data.length >= 100);
await apiFetch(`direct/conversations/${conversationId}/seen`, {
  method: 'POST',
  token,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({}),
});    


} catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در دریافت پیام‌ها');
    } finally {
      setLoading(false);
    }
  }

  async function loadOlderMessages() {
    const token = getAccessToken();
    if (!token || !conversationId || messages.length === 0 || loadingOlder) return;

    const anchorId = messages[0].id;
    setLoadingOlder(true);
    setError(null);

    try {
      const older = await apiFetch<Message[]>(
        `direct/conversations/${conversationId}/messages?before=${encodeURIComponent(anchorId)}&limit=${DIRECT_OLDER_PAGE_SIZE}`,
        { method: 'GET', token },
      );

      if (older.length === 0) {
        setHasMoreOlder(false);
        return;
      }

      const yBefore =
        typeof document !== 'undefined'
          ? document.getElementById(`direct-msg-${anchorId}`)?.getBoundingClientRect().top
          : undefined;

      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const merged = [...older.filter((m) => !seen.has(m.id)), ...prev];
        return merged;
      });

      if (older.length < DIRECT_OLDER_PAGE_SIZE) {
        setHasMoreOlder(false);
      }

      if (yBefore !== undefined) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const el = document.getElementById(`direct-msg-${anchorId}`);
            if (!el) return;
            const yAfter = el.getBoundingClientRect().top;
            window.scrollBy({ top: yAfter - yBefore, left: 0, behavior: 'auto' });
          });
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در بارگذاری پیام‌های قدیمی');
    } finally {
      setLoadingOlder(false);
    }
  }

  useEffect(() => {
    if (!conversationId) return;
    loadMessages();
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return;

    const markRead = () => {
      const token = getAccessToken();
      if (!token) return;
      void markDirectConversationRead(token, conversationId).catch(() => {});
    };

    markRead();

    const onVisibility = () => {
      if (document.visibilityState === 'visible') markRead();
    };

    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [conversationId]);

useEffect(() => {
  const token = getAccessToken();
  if (!token || !conversationId) return;

  setPeerPresence({ online: false, lastSeenAt: null });

  const socket = io(getApiBaseUrl().replace(/\/+$/, ''), {
    transports: ['websocket'],
    auth: { token },
  });

  socketRef.current = socket;

  const onDirectPresence = (payload: {
    conversationId: string;
    userId: string;
    online: boolean;
    lastSeenAt: string | null;
  }) => {
    if (payload.conversationId !== conversationId) return;
    if (myUserId && payload.userId === myUserId) return;
    setPeerPresence({
      online: payload.online,
      lastSeenAt: payload.lastSeenAt,
    });
  };

  socket.on('direct_presence', onDirectPresence);

  socket.on('connect', () => {
    socket.emit('join_direct', { conversationId });
  });

socket.on('direct_message', async (message: Message) => {
  if (message.conversationId !== conversationId) return;

  setMessages((prev) => {
    const exists = prev.some((m) => m.id === message.id);
    if (exists) return prev;
    return [...prev, message];
  });

  // 👇 اینو اضافه کن (کلید حل مشکل)
  if (message.senderId !== myUserId) {
    try {
      await apiFetch(`direct/conversations/${conversationId}/seen`, {
        method: 'POST',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
    } catch (e) {
      console.error('seen error', e);
    }
  }
});
  socket.on(
    'direct_typing',
    (payload: { conversationId: string; userId: string; isTyping: boolean }) => {
      if (payload.conversationId !== conversationId) return;
      if (payload.userId === myUserId) return;

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

      if (payload.isTyping) {
        setOtherTyping(true);

        typingTimeoutRef.current = setTimeout(() => {
          setOtherTyping(false);
          typingTimeoutRef.current = null;
        }, 1500);
      } else {
        setOtherTyping(false);
      }
    },
  );
socket.on(
  'direct_message_delivered',
  (payload: {
    conversationId: string;
    updates: Array<{ id: string; deliveredAt: string | null; seenAt: string | null }>;
  }) => {
    if (payload.conversationId !== conversationId) return;

    setMessages((prev) =>
      prev.map((m) => {
        const update = payload.updates.find((u) => u.id === m.id);
        return update
          ? {
              ...m,
              deliveredAt: update.deliveredAt,
              seenAt: update.seenAt,
            }
          : m;
      }),
    );
  },
);

socket.on(
  'direct_message_seen',
  (payload: {
    conversationId: string;
    updates: Array<{ id: string; deliveredAt: string | null; seenAt: string | null }>;
  }) => {
    if (payload.conversationId !== conversationId) return;

    setMessages((prev) =>
      prev.map((m) => {
        const update = payload.updates.find((u) => u.id === m.id);
        return update
          ? {
              ...m,
              deliveredAt: update.deliveredAt,
              seenAt: update.seenAt,
            }
          : m;
      }),
    );
  },
);

socket.on(
  'direct_message_deleted',
  (payload: {
    conversationId: string;
    messageId: string;
    isDeleted: boolean;
    deletedAt: string | null;
    text: null;
    mediaId: null;
    media: null;
  }) => {
    if (payload.conversationId !== conversationId) return;

    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === payload.messageId) {
          return {
            ...m,
            isDeleted: payload.isDeleted,
            deletedAt: payload.deletedAt,
            text: null,
            mediaId: null,
            media: null,
          };
        }
        if (m.replyToMessage?.id === payload.messageId) {
          return {
            ...m,
            replyToMessage: m.replyToMessage
              ? {
                  ...m.replyToMessage,
                  isDeleted: payload.isDeleted,
                  deletedAt: payload.deletedAt,
                  text: null,
                  mediaId: null,
                  media: null,
                }
              : m.replyToMessage,
          };
        }
        return m;
      }),
    );
  },
);

socket.on(
  'direct_message_edited',
  (payload: {
    conversationId: string;
    messageId: string;
    text: string | null;
    editedAt: string | null;
  }) => {
    if (payload.conversationId !== conversationId) return;

    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === payload.messageId) {
          return {
            ...m,
            text: payload.text,
            editedAt: payload.editedAt,
          };
        }
        if (m.replyToMessage?.id === payload.messageId) {
          return {
            ...m,
            replyToMessage: m.replyToMessage
              ? {
                  ...m.replyToMessage,
                  text: payload.text,
                  editedAt: payload.editedAt,
                }
              : m.replyToMessage,
          };
        }
        return m;
      }),
    );
  },
);
  return () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    socket.off('direct_presence', onDirectPresence);
    socket.off('direct_message_edited');
    socket.off('direct_message_deleted');

    socket.emit('leave_direct', { conversationId });
socket.emit('direct_typing', {
  conversationId,
  isTyping: false,
});

    socket.disconnect();
    socketRef.current = null;
  };
}, [conversationId, myUserId]);
async function uploadSelectedFile(token: string): Promise<string | null> {
  if (!file) return null;

  const mime = file.type || '';
  const isVideo = mime.startsWith('video/');
  const isImage = mime.startsWith('image/');

  if (!isImage && !isVideo) {
    throw new Error('فقط عکس و ویدیو مجاز است');
  }

  const maxBytes = isVideo ? 100 * 1024 * 1024 : 20 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error(isVideo ? 'حجم ویدیو از 100MB بیشتر است' : 'حجم تصویر از 20MB بیشتر است');
  }

  const form = new FormData();
  form.append('file', file);

  const uploadUrl = `${getApiBaseUrl().replace(/\/+$/, '')}/media/upload`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open('POST', uploadUrl);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const percent = Math.round((event.loaded / event.total) * 100);
      setUploadProgress(percent);
    };

    xhr.onload = () => {
      try {
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new Error('خطا در آپلود فایل'));
          return;
        }

        const data = JSON.parse(xhr.responseText) as {
          media?: { id: string };
        };

        resolve(data.media?.id ?? null);
      } catch {
        reject(new Error('پاسخ آپلود معتبر نیست'));
      }
    };

    xhr.onerror = () => {
      reject(new Error('خطا در ارتباط هنگام آپلود'));  };

    xhr.onabort = () => {
      reject(new Error('آپلود لغو شد'));
    };

    xhr.send(form);
  });
}

  async function onDeleteMessage(messageId: string) {
    const token = getAccessToken();
    if (!token || !conversationId) return;

    try {
      const updated = await apiFetch<Message>(
        `direct/conversations/${conversationId}/messages/${messageId}/delete`,
        {
          method: 'POST',
          token,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
      );

      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, ...updated } : m)));
      if (replyDraft?.id === messageId) setReplyDraft(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در حذف پیام');
    }
  }

  async function onSend(e: FormEvent) {
    e.preventDefault();
    const token = getAccessToken();
    if (!token) return;

    const trimmed = text.trim();

    if (editMode && editingMessageId) {
      if (!trimmed) return;

      setSending(true);
      setError(null);
      try {
        const updated = await apiFetch<Message>(
          `direct/conversations/${conversationId}/messages/${editingMessageId}`,
          {
            method: 'PATCH',
            token,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: trimmed }),
          },
        );

        setMessages((prev) =>
          prev.map((m) => (m.id === editingMessageId ? { ...m, ...updated } : m)),
        );
        setEditMode(false);
        setEditingMessageId(null);
        setText('');
        socketRef.current?.emit('direct_typing', {
          conversationId,
          isTyping: false,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'خطا در ویرایش پیام');
      } finally {
        setSending(false);
      }
      return;
    }

    if (!trimmed && !file) return;

	setSending(true);
	setError(null);
	setUploadProgress(file ? 0 : null);

      try {
      const mediaId = await uploadSelectedFile(token);

      await apiFetch<Message>(`direct/conversations/${conversationId}/messages`, {
        method: 'POST',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: trimmed || undefined,
          mediaId: mediaId || undefined,
          ...(replyDraft ? { replyToMessageId: replyDraft.id } : {}),
        }),
      });

    setText('');
    setFile(null);
    setPreviewUrl(null);
    setReplyDraft(null);
    scrollThreadEnd('auto');
socketRef.current?.emit('direct_typing', {
  conversationId,
  isTyping: false,
});    
} catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در ارسال پیام');
    } finally {
      setSending(false);
      setUploadProgress(null);
    
    }
  }

  return (
    <AuthGate>
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col bg-stone-100">
        <header
          className="sticky top-0 z-30 border-b border-stone-200/90 bg-[#f8f8f8] shadow-[0_1px_0_rgba(0,0,0,0.04)] backdrop-blur-md"
          dir="rtl"
        >
          <div className="flex items-center gap-2.5 px-3 py-2">
            <Link
              href="/direct"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100 active:bg-slate-200"
              aria-label="بازگشت"
            >
              <span className="text-xl font-semibold leading-none text-slate-800" aria-hidden>
                ›
              </span>
            </Link>

            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-stone-200 ring-2 ring-white">
              {peerDisplay.avatar ? (
                <img
                  src={peerDisplay.avatar}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-sm font-bold text-slate-600">
                  {peerInitial}
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1 text-right">
              <h1 className="truncate text-[16px] font-bold leading-tight text-stone-900">
                {peerDisplay.name}
              </h1>
              <p className={`mt-0.5 truncate text-[11px] ${headerStatusLine.className}`}>
                {headerStatusLine.text}
              </p>
            </div>

            <button
              type="button"
              title="رفرش پیام‌ها"
              onClick={() => {
                forceScrollAfterLoadRef.current = true;
                void loadMessages();
              }}
              disabled={loading}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
            >
              <span className={`text-lg ${loading ? 'animate-pulse' : ''}`} aria-hidden>
                ↻
              </span>
            </button>
          </div>
        </header>

        {error ? (
          <div className="px-3 pt-3">
            <Card>
              <div className="text-sm font-semibold text-red-600">{error}</div>
            </Card>
          </div>
        ) : null}

        <div className="flex-1 space-y-2 px-2.5 py-2 sm:px-3">
          {loading ? (
            <Card>
              <div className="text-sm text-slate-700">در حال دریافت پیام‌ها...</div>
            </Card>
          ) : messages.length === 0 ? (
            <Card>
              <div className="text-sm text-slate-700">هنوز پیامی در این گفتگو نیست.</div>
            </Card>
          ) : (
            <>
              {hasMoreOlder && messages.length > 0 ? (
                <div className="flex justify-center pb-2" dir="rtl">
                  <button
                    type="button"
                    disabled={loadingOlder}
                    onClick={() => void loadOlderMessages()}
                    className="rounded-full border border-slate-200/90 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loadingOlder ? 'در حال بارگذاری…' : 'پیام‌های قدیمی‌تر'}
                  </button>
                </div>
              ) : null}
              {messages.map((msg) => {
                const mine = msg.senderId === myUserId;
                const deleted = !!msg.isDeleted || msg.text == null;
                const media = deleted ? null : msg.media;
                const timeShort = new Date(msg.createdAt).toLocaleTimeString('fa-IR', {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={msg.id}
                    id={`direct-msg-${msg.id}`}
                    className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`relative max-w-[88%] rounded-[1.15rem] px-3.5 py-2.5 shadow-sm ${
                        deleted
                          ? mine
                            ? 'bg-slate-800/75 text-white/85 ring-1 ring-white/10'
                            : 'bg-slate-200/60 text-slate-600 ring-1 ring-slate-300/50'
                          : mine
                            ? 'bg-slate-900 text-white ring-1 ring-slate-800/40'
                            : 'bg-white text-slate-900 ring-1 ring-slate-200/80'
                      }`}
                    >
                      <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px]">
                        <span
                          className={`min-w-0 truncate font-medium ${
                            mine ? 'text-white/75' : 'text-slate-500'
                          }`}
                        >
                          {msg.sender.name}
                        </span>
                        {!msg.isDeleted ? (
                          <div className="relative shrink-0" data-direct-msg-actions>
                            <button
                              type="button"
                              aria-haspopup="menu"
                              aria-expanded={openActionsMessageId === msg.id}
                              aria-label="اقدامات پیام"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenActionsMessageId((id) => (id === msg.id ? null : msg.id));
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
                            {openActionsMessageId === msg.id ? (
                              <div
                                role="menu"
                                className="absolute right-0 top-full z-40 mt-1 min-w-[10.5rem] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-slate-200/90 bg-white py-1 shadow-lg ring-1 ring-slate-900/5"
                                dir="rtl"
                              >
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="flex w-full px-4 py-3 text-right text-sm font-medium text-slate-800 transition hover:bg-slate-100 active:bg-slate-200"
                                  onClick={() => {
                                    setReplyDraft({
                                      id: msg.id,
                                      senderName: msg.sender.name,
                                      preview: replySnippetForMessage(msg),
                                    });
                                    setOpenActionsMessageId(null);
                                  }}
                                >
                                  پاسخ
                                </button>
                                {mine ? (
                                  <>
                                    <button
                                      type="button"
                                      role="menuitem"
                                      className="flex w-full px-4 py-3 text-right text-sm font-medium text-slate-800 transition hover:bg-slate-100 active:bg-slate-200"
                                      onClick={() => {
                                        setEditMode(true);
                                        setEditingMessageId(msg.id);
                                        setText(msg.text ?? '');
                                        setReplyDraft(null);
                                        setFile(null);
                                        setPreviewUrl(null);
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
                                          void onDeleteMessage(msg.id);
                                        }}
                                      >
                                        حذف
                                      </button>
                                    ) : null}
                                  </>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>

                      {msg.replyToMessage ? (
                        <ReplyQuoteBlock reply={msg.replyToMessage} mine={mine} />
                      ) : null}

                      {media ? (
                        media.type === 'VIDEO' || media.mimeType?.startsWith('video/') ? (
                          <video
                            src={media.url}
                            controls
                            className="mb-2 max-h-72 w-full rounded-xl bg-black shadow-inner"
                          />
                        ) : (
                          <img
                            src={media.url}
                            alt={media.originalName || 'message media'}
                            className="mb-2 max-h-72 w-full rounded-xl bg-white object-contain shadow-inner"
                          />
                        )
                      ) : null}

                      {deleted ? (
                        <div className="text-sm font-medium italic opacity-80">
                          این پیام حذف شده است
                        </div>
                      ) : msg.text ? (
                        <div className="whitespace-pre-wrap text-[15px] leading-relaxed">{msg.text}</div>
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
                        {msg.editedAt ? (
                          <span className="opacity-80">ویرایش شده</span>
                        ) : null}
                        {renderMessageStatus(msg, mine)}
                      </div>
                    </div>
                  </div>
                );
              })}

            </>
          )}
        </div>

        <div className="sticky bottom-0 z-20 border-t border-stone-200/90 bg-[#f6f6f6]/98 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-2px_12px_rgba(0,0,0,0.05)] backdrop-blur-md">
          <form onSubmit={onSend} className="space-y-2.5" dir="rtl">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              disabled={sending || editMode}
              className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />

            {editMode && editingMessageId ? (
              <div className="flex items-start gap-2 rounded-2xl border border-amber-200/90 bg-amber-50/95 px-3 py-2.5 shadow-sm ring-1 ring-amber-100">
                <div className="min-w-0 flex-1 text-right">
                  <div className="text-[11px] font-bold text-amber-900">ویرایش پیام</div>
                  <div className="mt-0.5 truncate text-xs text-amber-800/90">
                    متن را اصلاح کنید و ذخیره را بزنید.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="shrink-0 rounded-xl border border-amber-300/80 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 shadow-sm transition hover:bg-amber-50"
                >
                  لغو ویرایش
                </button>
              </div>
            ) : replyDraft ? (
              <div className="flex items-start gap-2 rounded-2xl border border-slate-200/90 bg-slate-50 px-3 py-2.5 shadow-sm ring-1 ring-slate-200/60">
                <div className="min-w-0 flex-1 text-right">
                  <div className="text-[10px] font-bold text-sky-600">پاسخ به {replyDraft.senderName}</div>
                  <div className="mt-0.5 truncate text-sm text-slate-800">{replyDraft.preview}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyDraft(null)}
                  className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
                >
                  لغو
                </button>
              </div>
            ) : null}

            <div className="flex items-end gap-2">
              <button
                type="button"
                disabled={sending || editMode}
                title="افزودن عکس یا ویدیو"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200/90 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"
                  />
                </svg>
              </button>

              <textarea
                value={text}
                onChange={(e) => {
                  const value = e.target.value;
                  setText(value);

                  socketRef.current?.emit('direct_typing', {
                    conversationId,
                    isTyping: value.trim().length > 0,
                  });
                }}
                onBlur={() => {
                  socketRef.current?.emit('direct_typing', {
                    conversationId,
                    isTyping: false,
                  });
                }}
                placeholder="پیام…"
                rows={1}
                disabled={sending}
                className="min-h-[2.75rem] max-h-32 min-w-0 flex-1 resize-none rounded-2xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-[15px] leading-normal text-slate-900 shadow-sm outline-none ring-0 transition placeholder:text-slate-400 focus:border-sky-400/60 focus:ring-2 focus:ring-sky-100"
              />

              <button
                type="submit"
                disabled={sending}
                className="inline-flex h-11 min-w-[4.5rem] shrink-0 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? (
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                    aria-label={editMode ? 'در حال ذخیره' : 'در حال ارسال'}
                  />
                ) : (
                  <span>{editMode ? 'ذخیره' : 'ارسال'}</span>
                )}
              </button>
            </div>

{file ? (
  <div className="space-y-3">
    <div className="text-xs text-slate-600">
      فایل انتخاب شده: <span className="font-semibold">{file.name}</span>
    </div>

    {previewUrl ? (
      file.type.startsWith('video/') ? (
        <video
          src={previewUrl}
          controls
          className="max-h-72 w-full rounded-2xl border border-slate-200 bg-black"
        />
      ) : (
        <img
          src={previewUrl}
          alt={file.name}
          className="max-h-72 w-full rounded-2xl border border-slate-200 bg-white object-contain"
        />
      )
    ) : null}

    <button
      type="button"
      onClick={clearSelectedFile}
      className="rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600"
    >
      حذف فایل انتخاب‌شده
    </button>
  </div>
) : null}

{uploadProgress !== null ? (
  <div className="space-y-2">
    <div className="text-xs font-semibold text-slate-700">
      در حال آپلود: {uploadProgress}%
    </div>
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
      <div
        className="h-full rounded-full bg-slate-900 transition-all"
        style={{ width: `${uploadProgress}%` }}
      />
    </div>
  </div>
) : null}

            </form>
        </div>
        <div ref={threadEndRef} className="h-px w-full shrink-0" aria-hidden />
      </main>
    </AuthGate>
  );
}


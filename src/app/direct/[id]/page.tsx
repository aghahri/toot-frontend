'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AuthGate } from '@/components/AuthGate';
import { getAccessToken } from '@/lib/auth';
import { apiFetch, getApiBaseUrl, getErrorMessageFromResponse } from '@/lib/api';
import { markDirectConversationRead } from '@/lib/mark-direct-read';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { io } from 'socket.io-client';
import { FormEvent, useEffect, useRef, useState } from 'react';

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
  isDeleted?: boolean;
  deletedAt?: string | null;
  createdAt: string;
  sender: {
    id: string;
    name: string;
    avatar: string | null;
  };
};

type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  text: string | null;
  mediaId: string | null;
  isDeleted?: boolean;
  deletedAt?: string | null;
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
      className={`mb-2 rounded-lg border-s-4 px-2 py-1.5 text-start text-[11px] leading-snug ${
        isDeleted ? 'border-s-slate-400' : 'border-s-sky-500'
      } ${mine ? 'bg-white/10 text-white/95' : 'bg-slate-100 text-slate-700'} ${
        isDeleted ? 'opacity-80' : ''
      }`}
      dir="auto"
    >
      <div className="truncate font-semibold opacity-90">{reply.sender.name}</div>
      <div className="line-clamp-2 opacity-90">{body}</div>
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
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [replyDraft, setReplyDraft] = useState<{
    id: string;
    senderName: string;
    preview: string;
  } | null>(null);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
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
function scrollToBottom() {
  requestAnimationFrame(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  });
}
useEffect(() => {
  if (loading) return;
  if (messages.length === 0) return;

  scrollToBottom();
}, [loading, messages.length, otherTyping]);

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

  const socket = io(getApiBaseUrl().replace(/\/+$/, ''), {
    transports: ['websocket'],
    auth: { token },
  });

  socketRef.current = socket;

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
      prev.map((m) =>
        m.id === payload.messageId
          ? {
              ...m,
              isDeleted: payload.isDeleted,
              deletedAt: payload.deletedAt,
              text: null,
              mediaId: null,
              media: null,
            }
          : m,
      ),
    );
  },
);
  return () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

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
      <main className="mx-auto w-full max-w-md p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold">گفتگوی خصوصی</h1>
            <p className="mt-1 break-all text-xs text-slate-500">{conversationId}</p>
          </div>

          <Link href="/direct" className="text-sm font-semibold text-slate-700 underline">
            بازگشت
          </Link>
        </div>

        <div className="mb-4">
          <Button type="button" onClick={loadMessages} loading={loading}>
            {loading ? 'در حال بارگذاری...' : 'رفرش پیام‌ها'}
          </Button>
        </div>

        {error ? (
          <Card>
            <div className="text-sm font-semibold text-red-600">{error}</div>
          </Card>
        ) : null}

        <div className="space-y-3">
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
              {messages.map((msg) => {
                const mine = msg.senderId === myUserId;
                const deleted = !!msg.isDeleted || msg.text == null;
                const media = deleted ? null : msg.media;

                return (
                  <div
                    key={msg.id}
                    className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                        deleted
                          ? mine
                            ? 'bg-slate-900/60 text-white/90'
                            : 'border border-slate-200 bg-slate-50 text-slate-700'
                          : mine
                            ? 'bg-slate-900 text-white'
                            : 'border border-slate-200 bg-white text-slate-900'
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2 text-[11px] opacity-70">
                        <span className="min-w-0 truncate">{msg.sender.name}</span>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setReplyDraft({
                                id: msg.id,
                                senderName: msg.sender.name,
                                preview: replySnippetForMessage(msg),
                              })
                            }
                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                              mine
                                ? 'text-white/85 hover:bg-white/15'
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            پاسخ
                          </button>

                          {mine && !deleted ? (
                            <button
                              type="button"
                              onClick={() => onDeleteMessage(msg.id)}
                              className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                                mine
                                  ? 'text-red-200 hover:bg-white/15'
                                  : 'text-red-600 hover:bg-slate-100'
                              }`}
                            >
                              حذف
                            </button>
                          ) : null}
                        </div>
                      </div>

                      {msg.replyToMessage ? (
                        <ReplyQuoteBlock reply={msg.replyToMessage} mine={mine} />
                      ) : null}

                      {media ? (
                        media.type === 'VIDEO' || media.mimeType?.startsWith('video/') ? (
                          <video
                            src={media.url}
                            controls
                            className="mb-2 max-h-80 w-full rounded-xl bg-black"
                          />
                        ) : (
                          <img
                            src={media.url}
                            alt={media.originalName || 'message media'}
                            className="mb-2 max-h-80 w-full rounded-xl bg-white object-contain"
                          />
                        )
                      ) : null}

                      {deleted ? (
                        <div className="text-sm font-semibold opacity-80">
                          این پیام حذف شده است
                        </div>
                      ) : msg.text ? (
                        <div className="whitespace-pre-wrap text-sm">{msg.text}</div>
                      ) : null}

			<div className="mt-1 flex items-center gap-2 text-[10px] opacity-70">
  			<span>{new Date(msg.createdAt).toLocaleString('fa-IR')}</span>
  			{renderMessageStatus(msg, mine)}
			</div>
                    </div>
                  </div>
                );
              })}

{otherTyping ? (
  <div className="flex justify-start">
    <div className="max-w-[85%] rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500">
      طرف مقابل در حال تایپ است...
    </div>
  </div>
) : null}

              <div ref={bottomRef} />
            </>
          )}
        </div>
        <div className="mt-4">
          <Card>
            <form onSubmit={onSend} className="space-y-3">
              <div className="text-sm font-semibold text-slate-800">ارسال پیام</div>

              {replyDraft ? (
                <div
                  className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5"
                  dir="rtl"
                >
                  <div className="min-w-0 flex-1 text-right">
                    <div className="text-[10px] font-semibold text-slate-500">
                      پاسخ به {replyDraft.senderName}
                    </div>
                    <div className="truncate text-xs text-slate-800">{replyDraft.preview}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyDraft(null)}
                    className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200/80"
                  >
                    لغو
                  </button>
                </div>
              ) : null}

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

                placeholder="پیام خود را بنویسید..."
                rows={3}
                disabled={sending}
                className="w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-slate-400"
              />

              <label className="block">
                <div className="mb-2 text-xs font-semibold text-slate-700">
                  عکس / ویدیو (اختیاری)
                </div>
                <input
                  type="file"
                  accept="image/*,video/*"
                  disabled={sending}
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2 text-sm"
                />
              </label>

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

<Button type="submit" loading={sending}>
  {sending ? 'در حال ارسال...' : 'ارسال'}
</Button>            </form>
          </Card>
        </div>
      </main>
    </AuthGate>
  );
}


'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AuthGate } from '@/components/AuthGate';
import { getAccessToken } from '@/lib/auth';
import { apiFetch, getApiBaseUrl } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { io } from 'socket.io-client';

type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  createdAt: string;
  sender: {
    id: string;
    name: string;
    avatar: string | null;
  };
};

export default function DirectConversationPage() {
  const params = useParams();
  const conversationId = Array.isArray(params?.id) ? params.id[0] : params?.id ?? '';

  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    const token = getAccessToken();
    if (!token || !conversationId) return;

    const socket = io(getApiBaseUrl().replace(/\/+$/, ''), {
      transports: ['websocket'],
      auth: { token },
    });

    socket.on('connect', () => {
      socket.emit('join_direct', { conversationId });
    });

    socket.on('direct_message', (message: Message) => {
      if (message.conversationId !== conversationId) return;

      setMessages((prev) => {
        const exists = prev.some((m) => m.id === message.id);
        if (exists) return prev;
        return [...prev, message];
      });
    });

    return () => {
      socket.emit('leave_direct', { conversationId });
      socket.disconnect();
    };
  }, [conversationId]);

  async function onSend(e: FormEvent) {
    e.preventDefault();
    const token = getAccessToken();
    if (!token) return;

    const trimmed = text.trim();
    if (!trimmed) return;

    setSending(true);
    setError(null);

    try {
      await apiFetch<Message>(`direct/conversations/${conversationId}/messages`, {
        method: 'POST',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
      });

      setText('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در ارسال پیام');
    } finally {
      setSending(false);
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
            messages.map((msg) => {
              const mine = msg.senderId === myUserId;

              return (
                <div
                  key={msg.id}
                  className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                      mine
                        ? 'bg-slate-900 text-white'
                        : 'border border-slate-200 bg-white text-slate-900'
                    }`}
                  >
                    <div className="mb-1 text-[11px] opacity-70">{msg.sender.name}</div>
                    <div className="whitespace-pre-wrap text-sm">{msg.text}</div>
                    <div className="mt-1 text-[10px] opacity-70">
                      {new Date(msg.createdAt).toLocaleString('fa-IR')}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-4">
          <Card>
            <form onSubmit={onSend} className="space-y-3">
              <div className="text-sm font-semibold text-slate-800">ارسال پیام</div>

              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="پیام خود را بنویسید..."
                rows={3}
                disabled={sending}
                className="w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-slate-400"
              />

              <Button type="submit" loading={sending}>
                {sending ? 'در حال ارسال...' : 'ارسال'}
              </Button>
            </form>
          </Card>
        </div>
      </main>
    </AuthGate>
  );
}

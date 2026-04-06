'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AuthGate } from '@/components/AuthGate';
import { getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

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
  messages: Array<{
    id: string;
    text: string;
    createdAt: string;
    sender: {
      id: string;
      name: string;
      avatar: string | null;
    };
  }>;
};

export default function DirectPage() {
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [otherUserId, setOtherUserId] = useState('');

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

      window.location.href = `/direct/${conversation.id}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در ساخت گفتگو');
    }
  }

  return (
    <AuthGate>
      <main className="mx-auto w-full max-w-md p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold">پیام خصوصی</h1>
            <p className="mt-1 text-sm text-slate-700">گفتگوهای مستقیم شما</p>
          </div>

          <Link href="/home" className="text-sm font-semibold text-slate-700 underline">
            خانه
          </Link>
        </div>

        <Card>
          <div className="space-y-3">
            <div className="text-sm font-semibold text-slate-800">شروع گفتگو با شناسه کاربر</div>

            <input
              value={otherUserId}
              onChange={(e) => setOtherUserId(e.target.value)}
              placeholder="otherUserId"
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-slate-400"
            />

            <Button type="button" onClick={createConversation}>
              ساخت / باز کردن گفتگو
            </Button>

            {myUserId ? (
              <div className="break-all text-[11px] text-slate-500">شناسه شما: {myUserId}</div>
            ) : null}
          </div>
        </Card>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm font-semibold">لیست گفتگوها</div>
          <button
            type="button"
            onClick={loadMeAndConversations}
            className="text-xs font-semibold text-slate-700 underline"
          >
            رفرش
          </button>
        </div>

        <div className="mt-3 space-y-3">
          {loading ? (
            <Card>
              <div className="text-sm text-slate-700">در حال دریافت گفتگوها...</div>
            </Card>
          ) : error ? (
            <Card>
              <div className="text-sm font-semibold text-red-600">{error}</div>
            </Card>
          ) : items.length === 0 ? (
            <Card>
              <div className="text-sm text-slate-700">هنوز گفتگوی خصوصی ندارید.</div>
            </Card>
          ) : (
            items.map((item) => {
              const other =
                item.participants.find((p) => p.user.id !== myUserId)?.user ??
                item.participants[0]?.user;

              const lastMessage = item.messages[0];

              return (
                <Link key={item.id} href={`/direct/${item.id}`} className="block">
                  <Card>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-extrabold text-slate-900">
                            {other?.name ?? 'کاربر'}
                          </div>
                          <div className="truncate text-[11px] text-slate-500">
                            {other?.id ?? '-'}
                          </div>
                        </div>

                        <div className="text-[11px] text-slate-500">
                          {new Date(item.updatedAt).toLocaleString('fa-IR')}
                        </div>
                      </div>

                      <div className="truncate text-sm text-slate-700">
                        {lastMessage?.text ?? 'هنوز پیامی ارسال نشده'}
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })
          )}
        </div>
      </main>
    </AuthGate>
  );
}

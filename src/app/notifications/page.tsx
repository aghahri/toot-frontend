'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthGate } from '@/components/AuthGate';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

export type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  resourceType: string | null;
  resourceId: string | null;
  readAt: string | null;
  createdAt: string;
};

type NotificationsResponse = {
  data: NotificationRow[];
  meta: { total: number; limit: number; offset: number; hasMore: boolean };
};

function formatNotifTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('fa-IR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const t = getAccessToken();
    if (!t) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<NotificationsResponse>('notifications?limit=50', {
        method: 'GET',
        token: t,
      });
      setItems(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در بارگذاری اعلان‌ها');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function markRead(n: NotificationRow) {
    if (n.readAt) {
      navigateFromNotification(n);
      return;
    }
    const t = getAccessToken();
    if (!t) return;
    try {
      await apiFetch<{ id: string; readAt: string }>(
        `notifications/${encodeURIComponent(n.id)}/read`,
        { method: 'POST', token: t },
      );
      setItems((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)),
      );
    } catch {
      /* still try navigation */
    }
    navigateFromNotification(n);
  }

  function navigateFromNotification(n: NotificationRow) {
    if (n.resourceType === 'post' && n.resourceId) {
      router.push('/home');
      return;
    }
    if (n.resourceType === 'user' && n.resourceId) {
      router.push(`/profile/${n.resourceId}`);
      return;
    }
  }

  return (
    <AuthGate>
      <div className="min-h-[50dvh] bg-[#f7f9f9] pb-28" dir="rtl">
        <header className="sticky top-14 z-[12] border-b border-slate-200/80 bg-white/95 px-4 py-3 backdrop-blur-md">
          <div className="mx-auto flex max-w-lg items-center gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-full px-2 py-1 text-sm font-bold text-slate-600 hover:bg-slate-100"
            >
              ← بازگشت
            </button>
            <h1 className="text-lg font-extrabold text-slate-900">اعلان‌ها</h1>
          </div>
        </header>

        <main className="mx-auto max-w-lg px-3 pt-4">
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-200/60" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-100 bg-red-50/90 px-4 py-6 text-center">
              <p className="text-sm font-semibold text-red-700">{error}</p>
              <button
                type="button"
                onClick={() => void load()}
                className="mt-4 rounded-full bg-slate-900 px-5 py-2 text-sm font-bold text-white"
              >
                تلاش دوباره
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-slate-200/90 bg-white px-6 py-12 text-center shadow-sm">
              <p className="text-sm font-bold text-slate-800">اعلانی نیست</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                وقتی کسی پست شما را بپسندد، پاسخ دهد، بازنشر کند یا شما را دنبال کند، اینجا
                نمایش داده می‌شود.
              </p>
              <Link
                href="/home"
                className="mt-6 inline-block text-sm font-bold text-sky-700 hover:underline"
              >
                بازگشت به خانه
              </Link>
            </div>
          ) : (
            <ul className="space-y-2 pb-4">
              {items.map((n) => {
                const unread = !n.readAt;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => void markRead(n)}
                      className={[
                        'w-full rounded-2xl border px-4 py-3 text-start transition',
                        unread
                          ? 'border-sky-200/80 bg-sky-50/50 shadow-sm ring-1 ring-sky-100/60'
                          : 'border-slate-200/80 bg-white/90 hover:bg-slate-50',
                      ].join(' ')}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-extrabold text-slate-900">{n.title}</span>
                        {unread ? (
                          <span className="shrink-0 rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-bold text-white">
                            جدید
                          </span>
                        ) : null}
                      </div>
                      {n.body ? (
                        <p className="mt-1 text-sm leading-relaxed text-slate-600">{n.body}</p>
                      ) : null}
                      <p className="mt-2 text-[11px] text-slate-400">{formatNotifTime(n.createdAt)}</p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </main>
      </div>
    </AuthGate>
  );
}

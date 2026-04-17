'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthGate } from '@/components/AuthGate';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { calendarDayKey, dayDividerLabelFa } from '@/lib/chat-dates';

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

function categoryLabel(n: NotificationRow): string {
  switch (n.type) {
    case 'POST_LIKE':
      return 'پسند';
    case 'POST_REPLY':
      return 'پاسخ';
    case 'POST_REPOST':
      return 'بازنشر';
    case 'USER_FOLLOW':
      return 'دنبال‌کننده';
    default:
      if (n.resourceType === 'post') return 'پست';
      if (n.resourceType === 'user') return 'کاربر';
      return 'اعلان';
  }
}

function navigateFromNotification(n: NotificationRow, router: ReturnType<typeof useRouter>) {
  const rt = (n.resourceType ?? '').toLowerCase();
  if (rt === 'post' && n.resourceId) {
    router.push(`/home?postId=${encodeURIComponent(n.resourceId)}`);
    return;
  }
  if (rt === 'user' && n.resourceId) {
    router.push(`/profile/${encodeURIComponent(n.resourceId)}`);
    return;
  }
  router.push('/home');
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

  const unreadCount = useMemo(() => items.filter((n) => !n.readAt).length, [items]);

  async function markRead(n: NotificationRow) {
    if (n.readAt) {
      navigateFromNotification(n, router);
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
      /* still navigate */
    }
    navigateFromNotification(n, router);
  }

  return (
    <AuthGate>
      <div className="theme-page-bg theme-text-primary min-h-[50dvh] w-full min-w-0 pb-28" dir="rtl">
        <header className="theme-panel-bg theme-border-soft sticky top-14 z-[12] w-full min-w-0 max-w-[100vw] overflow-x-hidden border-b backdrop-blur-md">
          <div className="mx-auto flex w-full min-w-0 max-w-lg items-center gap-2 px-3 py-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex h-10 min-w-[2.5rem] shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-slate-700 transition hover:bg-slate-100 active:bg-slate-200"
              aria-label="بازگشت"
            >
              <span className="text-lg leading-none" aria-hidden>
                ‹
              </span>
            </button>
            <h1 className="min-w-0 flex-1 truncate text-[1.1rem] font-extrabold text-slate-950">اعلان‌ها</h1>
            {!loading && !error && items.length > 0 && unreadCount > 0 ? (
              <span
                className="shrink-0 rounded-full bg-sky-600 px-2.5 py-1 text-[11px] font-extrabold tabular-nums text-white shadow-sm"
                aria-live="polite"
              >
                {unreadCount} جدید
              </span>
            ) : null}
          </div>
        </header>

        <main className="mx-auto w-full min-w-0 max-w-lg px-3 pt-4">
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-[4.5rem] animate-pulse rounded-2xl bg-slate-200/50 ring-1 ring-slate-100/80"
                />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-100 bg-red-50/90 px-4 py-6 text-center shadow-sm">
              <p className="text-sm font-semibold text-red-800">{error}</p>
              <button
                type="button"
                onClick={() => void load()}
                className="mt-4 rounded-full bg-slate-900 px-5 py-2 text-sm font-extrabold text-white transition hover:bg-slate-800"
              >
                تلاش دوباره
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/50 px-6 py-12 text-center shadow-sm ring-1 ring-slate-100/80">
              <p className="text-base font-extrabold text-slate-900">هنوز اعلانی نیست</p>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
                وقتی کسی پست شما را بپسندد، به آن پاسخ دهد، بازنشر کند یا شما را دنبال کند، اینجا
                نمایش داده می‌شود. برای دیدن اعلان‌های تازه، گاهی به این صفحه سر بزنید.
              </p>
              <Link
                href="/home"
                className="mt-6 inline-block text-sm font-extrabold text-sky-700 underline-offset-2 hover:underline"
              >
                رفتن به خانه
              </Link>
            </div>
          ) : (
            <ul className="space-y-2 pb-6">
              {items.map((n, i) => {
                const prev = i > 0 ? items[i - 1] : null;
                const showDayDivider =
                  !prev || calendarDayKey(prev.createdAt) !== calendarDayKey(n.createdAt);
                const unread = !n.readAt;
                const cat = categoryLabel(n);
                return (
                  <li key={n.id}>
                    {showDayDivider ? (
                      <div
                        className={`pb-1 ${i === 0 ? 'pt-0' : 'pt-4'}`}
                        role="presentation"
                      >
                        <div className="text-center text-[11px] font-extrabold tracking-wide text-slate-400">
                          {dayDividerLabelFa(n.createdAt)}
                        </div>
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void markRead(n)}
                      className={[
                        'w-full rounded-2xl border px-3.5 py-3 text-start shadow-sm transition active:scale-[0.99]',
                        unread
                          ? 'border-sky-400/80 bg-gradient-to-br from-sky-50/95 to-white ring-2 ring-sky-200/60'
                          : 'border-slate-200/90 bg-white/95 ring-1 ring-slate-100/80 hover:bg-slate-50/90',
                      ].join(' ')}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${
                            unread
                              ? 'bg-sky-600 text-white shadow-sm'
                              : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200/80'
                          }`}
                        >
                          {cat}
                        </span>
                        <time
                          className="shrink-0 text-[10px] font-semibold tabular-nums text-slate-400"
                          dateTime={n.createdAt}
                        >
                          {formatNotifTime(n.createdAt)}
                        </time>
                      </div>
                      <div className="mt-2 text-[15px] font-extrabold leading-snug text-slate-900">{n.title}</div>
                      {n.body ? (
                        <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{n.body}</p>
                      ) : null}
                      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-slate-100/90 pt-2">
                        <span
                          className={`text-[10px] font-bold ${unread ? 'text-sky-800' : 'text-slate-500'}`}
                        >
                          {unread ? 'ضربه برای باز کردن و علامت خوانده‌شده' : 'ضربه برای رفتن به محتوای مرتبط'}
                        </span>
                        {unread ? (
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full bg-sky-500 shadow-sm ring-2 ring-sky-200/80"
                            aria-hidden
                          />
                        ) : null}
                      </div>
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

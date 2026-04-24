'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthGate } from '@/components/AuthGate';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { calendarDayKey, dayDividerLabelFa } from '@/lib/chat-dates';

export type NotificationActor = {
  id: string;
  username: string;
  name: string;
  avatar: string | null;
};

export type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  resourceType: string | null;
  resourceId: string | null;
  readAt: string | null;
  createdAt: string;
  actorUserId: string | null;
  postId: string | null;
  actor: NotificationActor | null;
  postSnippet: string | null;
};

type NotificationsResponse = {
  data: NotificationRow[];
  meta: { total: number; limit: number; offset: number; hasMore: boolean };
};

function bumpUnreadGlobals() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('toot-notifications-unread-changed'));
  }
}

function formatRelativeFa(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diffSec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (diffSec < 45) return 'همین الان';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} دقیقه`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} ساعت`;
  if (diffSec < 172800) return 'دیروز';
  return `${Math.floor(diffSec / 86400)} روز`;
}

function postTargetId(n: NotificationRow): string | null {
  if (n.postId) return n.postId;
  if ((n.resourceType ?? '').toLowerCase() === 'post' && n.resourceId) return n.resourceId;
  return null;
}

function primaryLine(n: NotificationRow): string {
  const a = n.actor?.name?.trim();
  if (a) {
    switch (n.type) {
      case 'POST_LIKE':
        return `${a} پست شما را پسندید`;
      case 'POST_REPLY':
        return `${a} به پست شما پاسخ داد`;
      case 'POST_REPOST':
        return `${a} پست شما را بازنشر کرد`;
      case 'MENTION_POST':
        return `${a} در پستی از شما نام برد`;
      case 'USER_FOLLOW':
        return `${a} شما را دنبال کرد`;
      default:
        break;
    }
  }
  if (n.body?.trim()) return n.body.trim();
  return n.title;
}

function secondaryLine(n: NotificationRow, primary: string): string | null {
  const snip = n.postSnippet?.trim();
  if (snip) {
    return snip === primary.trim() ? null : snip;
  }
  if (n.actor && n.body) {
    const name = n.actor.name.trim();
    if (name && n.body.startsWith(name)) {
      return n.body.slice(name.length).replace(/^\s*[،,.]\s*/, '').trim() || null;
    }
  }
  return n.body;
}

function navigateFromNotification(n: NotificationRow, router: ReturnType<typeof useRouter>) {
  const pid = postTargetId(n);
  if (pid) {
    router.push(`/home?postId=${encodeURIComponent(pid)}`);
    return;
  }
  const rt = (n.resourceType ?? '').toLowerCase();
  if (rt === 'user' && n.resourceId) {
    router.push(`/profile/${encodeURIComponent(n.resourceId)}`);
    return;
  }
  if (n.actor?.id) {
    router.push(`/profile/${encodeURIComponent(n.actor.id)}`);
    return;
  }
  router.push('/home');
}

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [readAllBusy, setReadAllBusy] = useState(false);

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
      bumpUnreadGlobals();
    } catch {
      /* still navigate */
    }
    navigateFromNotification(n, router);
  }

  async function markAllRead() {
    const t = getAccessToken();
    if (!t || unreadCount === 0) return;
    setReadAllBusy(true);
    try {
      await apiFetch<{ updated: number }>('notifications/read-all', { method: 'POST', token: t });
      const now = new Date().toISOString();
      setItems((prev) => prev.map((x) => (x.readAt ? x : { ...x, readAt: now })));
      bumpUnreadGlobals();
    } catch {
      /* ignore */
    } finally {
      setReadAllBusy(false);
    }
  }

  return (
    <AuthGate>
      <div className="theme-page-bg theme-text-primary min-h-[50dvh] w-full min-w-0 pb-28" dir="rtl">
        <header className="theme-panel-bg theme-border-soft sticky top-14 z-[12] w-full min-w-0 max-w-[100vw] overflow-x-hidden border-b backdrop-blur-md">
          <div className="mx-auto flex w-full min-w-0 max-w-lg items-center gap-2 px-3 py-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="theme-text-primary flex h-10 min-w-[2.5rem] shrink-0 items-center justify-center rounded-full text-sm font-extrabold transition hover:bg-[var(--surface-muted)] active:bg-[var(--surface-strong)]"
              aria-label="بازگشت"
            >
              <span className="text-lg leading-none" aria-hidden>
                ‹
              </span>
            </button>
            <h1 className="min-w-0 flex-1 truncate text-[1.1rem] font-extrabold">اعلان‌ها</h1>
            {!loading && !error && items.length > 0 && unreadCount > 0 ? (
              <button
                type="button"
                disabled={readAllBusy}
                onClick={() => void markAllRead()}
                className="text-[var(--accent-hover)] shrink-0 rounded-full px-2 py-1 text-[11px] font-extrabold hover:bg-[var(--accent-soft)] disabled:opacity-50"
              >
                {readAllBusy ? '…' : 'همه خوانده شد'}
              </button>
            ) : null}
          </div>
        </header>

        <main className="mx-auto w-full min-w-0 max-w-lg px-3 pt-4">
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-[4.75rem] animate-pulse rounded-2xl bg-[var(--surface-strong)] ring-1 ring-[var(--border-soft)]"
                />
              ))}
            </div>
          ) : error ? (
            <div className="theme-border-soft rounded-2xl border border-red-100 bg-red-50/90 px-4 py-6 text-center shadow-sm">
              <p className="text-sm font-semibold text-red-800">{error}</p>
              <button
                type="button"
                onClick={() => void load()}
                className="mt-4 rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-extrabold text-[var(--accent-contrast)]"
              >
                تلاش دوباره
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="theme-card-bg theme-border-soft rounded-2xl border px-6 py-12 text-center shadow-sm ring-1 ring-[var(--border-soft)]">
              <p className="text-base font-extrabold">هنوز اعلانی نیست</p>
              <p className="theme-text-secondary mt-2 text-[13px] leading-relaxed">
                پسند، پاسخ و دنبال‌کردن را اینجا می‌بینید.
              </p>
              <Link
                href="/home"
                className="mt-6 inline-block text-sm font-extrabold text-[var(--accent-hover)] underline-offset-2 hover:underline"
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
                const primary = primaryLine(n);
                const sub = secondaryLine(n, primary);
                return (
                  <li key={n.id}>
                    {showDayDivider ? (
                      <div className={`pb-1 ${i === 0 ? 'pt-0' : 'pt-4'}`} role="presentation">
                        <div className="theme-text-secondary text-center text-[11px] font-extrabold tracking-wide">
                          {dayDividerLabelFa(n.createdAt)}
                        </div>
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void markRead(n)}
                      className={[
                        'theme-border-soft w-full rounded-2xl border px-3 py-2.5 text-start shadow-sm transition active:scale-[0.99]',
                        unread
                          ? 'border-[var(--accent)]/35 bg-[var(--accent-soft)] ring-1 ring-[var(--accent-ring)]'
                          : 'bg-[var(--card-bg)] ring-1 ring-[var(--border-soft)] hover:bg-[var(--surface-muted)]',
                      ].join(' ')}
                    >
                      <div className="flex gap-3">
                        <div className="relative shrink-0">
                          {n.actor?.avatar ? (
                            <img
                              src={n.actor.avatar}
                              alt=""
                              className="h-11 w-11 rounded-full object-cover ring-2 ring-[var(--border-soft)]"
                            />
                          ) : (
                            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface-strong)] text-sm font-extrabold text-[var(--text-secondary)] ring-2 ring-[var(--border-soft)]">
                              {(n.actor?.name ?? n.title).trim().slice(0, 1) || '?'}
                            </div>
                          )}
                          {unread ? (
                            <span className="absolute -bottom-0.5 -end-0.5 h-2.5 w-2.5 rounded-full bg-[var(--accent)] ring-2 ring-[var(--card-bg)]" />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[14px] font-extrabold leading-snug">{primary}</p>
                            <time
                              className="theme-text-secondary shrink-0 text-[10px] font-semibold tabular-nums"
                              dateTime={n.createdAt}
                            >
                              {formatRelativeFa(n.createdAt)}
                            </time>
                          </div>
                          {sub ? (
                            <p className="theme-text-secondary mt-1 line-clamp-2 text-[12px] leading-relaxed">
                              {sub}
                            </p>
                          ) : null}
                          {n.actor?.username ? (
                            <p className="theme-text-secondary mt-1 text-[10px] font-medium" dir="ltr">
                              @{n.actor.username}
                            </p>
                          ) : null}
                        </div>
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

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AuthGate } from '@/components/AuthGate';
import { getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { formatAppDateTime } from '@/lib/locale-date';

type Analytics = {
  summary: {
    memberCount: number;
    totalPosts: number;
    postsLast7Days: number;
    latestPublishAt: string | null;
  };
  recentPosts: Array<{
    id: string;
    createdAt: string;
    reactionsCount: number;
    impressionCount: number;
    mediaType: string | null;
    messageType: string | null;
  }>;
};

export default function ChannelAnalyticsPage() {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : '';
  const [data, setData] = useState<Analytics | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token || !id) return;
    setErr(null);
    try {
      const res = await apiFetch<Analytics>(`channels/${encodeURIComponent(id)}/analytics`, { method: 'GET', token });
      setData(res);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'خطا');
      setData(null);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AuthGate>
      <main className="theme-page-bg min-h-screen px-3 py-4" dir="rtl">
        <div className="mx-auto max-w-3xl space-y-3">
          <Link href={`/channels/${encodeURIComponent(id)}`} className="inline-block text-xs font-bold text-[var(--accent-hover)]">بازگشت به کانال</Link>
          <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--card-bg)] p-4">
            <h1 className="text-sm font-black text-[var(--text-primary)]">آمار کانال</h1>
            {err ? <p className="mt-2 text-xs text-red-700">{err}</p> : null}
            {!data ? <p className="mt-2 text-xs text-[var(--text-secondary)]">در حال بارگذاری…</p> : (
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">کل پست‌ها: {data.summary.totalPosts}</div>
                <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">۷ روز اخیر: {data.summary.postsLast7Days}</div>
                <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">اعضا: {data.summary.memberCount}</div>
                <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">آخرین انتشار: {data.summary.latestPublishAt ? formatAppDateTime(data.summary.latestPublishAt) : '—'}</div>
              </div>
            )}
          </section>
          {data ? (
            <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--card-bg)] p-4">
              <h2 className="text-sm font-black text-[var(--text-primary)]">۱۰ پست اخیر</h2>
              <ul className="mt-3 space-y-2">
                {data.recentPosts.map((p) => (
                  <li key={p.id} className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3 text-xs">
                    <p>{formatAppDateTime(p.createdAt)}</p>
                    <p className="mt-1 text-[var(--text-secondary)]">نمایش تقریبی: {p.impressionCount} · واکنش: {p.reactionsCount} · رسانه: {p.mediaType || p.messageType || 'TEXT'}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </main>
    </AuthGate>
  );
}

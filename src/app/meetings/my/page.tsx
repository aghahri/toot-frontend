'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AuthGate } from '@/components/AuthGate';
import { formatAppDateTime } from '@/lib/locale-date';
import { fetchMyMeetings, type MeetingRow } from '@/lib/meetings';

function statusFa(status: string) {
  switch (status) {
    case 'SCHEDULED':
      return 'زمان‌بندی‌شده';
    case 'LIVE':
      return 'زنده';
    case 'ENDED':
      return 'پایان‌یافته';
    case 'CANCELED':
      return 'لغوشده';
    default:
      return status;
  }
}

export default function MyMeetingsPage() {
  const [rows, setRows] = useState<MeetingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchMyMeetings(60));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <AuthGate>
      <div className="mx-auto max-w-md px-4 pb-6 pt-2">
        <div className="mb-4 flex items-center justify-between gap-2">
          <Link
            href="/spaces/education"
            className="text-[12px] font-bold text-[var(--text-secondary)] hover:text-[var(--accent-hover)]"
          >
            ← فضای آموزش
          </Link>
        </div>

        <header className="mb-4 rounded-2xl border border-[var(--border-soft)] bg-[var(--card-bg)] px-4 py-3 ring-1 ring-[var(--border-soft)]">
          <h1 className="text-base font-black text-[var(--text-primary)]">جلسات من</h1>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">جلسه‌های ساخته‌شده توسط شما</p>
        </header>

        {error ? (
          <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-200">
            {error}
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-[var(--text-secondary)]">…</p>
        ) : rows.length ? (
          <ul className="space-y-2">
            {rows.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/meetings/${m.id}`}
                  className="block rounded-2xl border border-[var(--border-soft)] bg-[var(--card-bg)] p-3 ring-1 ring-[var(--border-soft)] hover:border-violet-400/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-extrabold text-[var(--text-primary)]">{m.title}</h2>
                      <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
                        {formatAppDateTime(m.startsAt)} · {m.durationMinutes} دقیقه
                      </p>
                      {m.chatMessages?.[0]?.text ? (
                        <p className="mt-1 truncate text-[11px] text-[var(--text-secondary)]">
                          آخرین پیام: {m.chatMessages[0].text}
                        </p>
                      ) : null}
                    </div>
                    <div className="shrink-0 space-y-1 text-left">
                      <span className="block rounded-full bg-[var(--surface-strong)] px-2 py-0.5 text-[10px] font-bold text-[var(--text-secondary)]">
                        {statusFa(m.status)}
                      </span>
                      {(m._count?.chatMessages ?? 0) > 0 ? (
                        <span className="block rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--accent-hover)]">
                          {m._count?.chatMessages} پیام
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-8 text-center">
            <p className="text-sm font-bold text-[var(--text-primary)]">هنوز جلسه‌ای ندارید</p>
            <Link href="/meetings/new" className="mt-3 inline-block text-xs font-extrabold text-violet-700 dark:text-violet-300">
              شروع جلسه جدید
            </Link>
          </div>
        )}
      </div>
    </AuthGate>
  );
}

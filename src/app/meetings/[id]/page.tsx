'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { AuthGate } from '@/components/AuthGate';
import { formatAppDateTime } from '@/lib/locale-date';
import {
  cancelMeeting,
  endMeeting,
  fetchMeeting,
  startMeeting,
  type MeetingDetail,
} from '@/lib/meetings';

function typeFa(t: string) {
  switch (t) {
    case 'EDUCATION':
      return 'آموزش';
    case 'BUSINESS':
      return 'کسب‌وکار';
    default:
      return 'عمومی';
  }
}

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

export default function MeetingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === 'string' ? params.id : '';

  const [m, setM] = useState<MeetingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const row = await fetchMeeting(id);
      setM(row);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا');
      setM(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const isHost = m?._meta?.isHost;
  const meetingLink =
    typeof window !== 'undefined' && id ? `${window.location.origin}/meetings/${encodeURIComponent(id)}` : '';

  async function copyLink() {
    if (!meetingLink) return;
    try {
      await navigator.clipboard.writeText(meetingLink);
      setShareMsg('لینک جلسه کپی شد.');
    } catch {
      setShareMsg('کپی لینک انجام نشد.');
    }
  }

  async function shareLink() {
    if (!meetingLink) return;
    const title = m?.title ? `جلسه: ${m.title}` : 'جلسه توت';
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({ title, text: 'برای ورود به جلسه از این لینک استفاده کنید.', url: meetingLink });
        setShareMsg('لینک جلسه ارسال شد.');
        return;
      } catch {
        // fall through to copy
      }
    }
    await copyLink();
  }

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا');
    } finally {
      setBusy(null);
    }
  }

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

        {loading ? <p className="text-sm text-[var(--text-secondary)]">…</p> : null}
        {error ? (
          <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-200">
            {error}
          </div>
        ) : null}

        {m ? (
          <>
            <div className="rounded-3xl border border-[var(--border-soft)] bg-[var(--card-bg)] p-4 ring-1 ring-[var(--border-soft)]">
              {m.educationLabel ? (
                <p className="text-[11px] font-bold text-violet-600 dark:text-violet-300">{m.educationLabel}</p>
              ) : null}
              <h1 className="mt-1 text-xl font-black text-[var(--text-primary)]">{m.title}</h1>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                میزبان: <span className="font-bold text-[var(--text-primary)]">{m.host.name}</span>
              </p>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                {formatAppDateTime(m.startsAt)} · {m.durationMinutes} دقیقه
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-[var(--surface-strong)] px-2 py-0.5 text-[11px] font-bold text-[var(--text-secondary)]">
                  {statusFa(m.status)}
                </span>
                <span className="rounded-full bg-[var(--surface-strong)] px-2 py-0.5 text-[11px] font-bold text-[var(--text-secondary)]">
                  {typeFa(m.meetingType)}
                </span>
                <span className="rounded-full bg-[var(--surface-strong)] px-2 py-0.5 text-[10px] font-mono text-[var(--text-secondary)]">
                  کد اتاق {m.roomCode}
                </span>
              </div>
              {m.description ? (
                <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-primary)]">{m.description}</p>
              ) : null}
            </div>

            <div className="mt-4 flex flex-col gap-2">
              {(m.status === 'SCHEDULED' || m.status === 'LIVE') && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => void copyLink()}
                    className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] py-2 text-xs font-extrabold text-[var(--text-primary)]"
                  >
                    کپی لینک جلسه
                  </button>
                  <button
                    type="button"
                    onClick={() => void shareLink()}
                    className="rounded-2xl border border-violet-500/50 bg-violet-500/10 py-2 text-xs font-extrabold text-violet-700 dark:text-violet-300"
                  >
                    اشتراک‌گذاری لینک
                  </button>
                </div>
              )}
              {shareMsg ? <p className="text-[11px] text-[var(--text-secondary)]">{shareMsg}</p> : null}
              {(m.status === 'SCHEDULED' || m.status === 'LIVE') && (
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => router.push(`/meetings/${m.id}/room`)}
                  className="w-full rounded-2xl bg-violet-700 py-3 text-sm font-extrabold text-white shadow-md hover:bg-violet-600 disabled:opacity-50"
                >
                  ورود به اتاق
                </button>
              )}

              {isHost && m.status === 'SCHEDULED' ? (
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => void run('start', () => startMeeting(m.id))}
                  className="w-full rounded-2xl border border-violet-500/50 bg-violet-500/10 py-3 text-sm font-extrabold text-violet-800 dark:text-violet-200"
                >
                  {busy === 'start' ? '…' : 'شروع جلسه (میزبان)'}
                </button>
              ) : null}

              {isHost && m.status === 'LIVE' ? (
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => void run('end', () => endMeeting(m.id))}
                  className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] py-3 text-sm font-extrabold text-[var(--text-primary)]"
                >
                  {busy === 'end' ? '…' : 'پایان جلسه'}
                </button>
              ) : null}

              {isHost && (m.status === 'SCHEDULED' || m.status === 'LIVE') ? (
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => void run('cancel', () => cancelMeeting(m.id))}
                  className="w-full rounded-2xl border border-red-500/30 py-3 text-sm font-extrabold text-red-700 dark:text-red-300"
                >
                  {busy === 'cancel' ? '…' : 'لغو جلسه'}
                </button>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </AuthGate>
  );
}

'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { AuthGate } from '@/components/AuthGate';
import { fetchJoinToken, fetchMeeting, type JoinTokenResponse, type MeetingDetail } from '@/lib/meetings';

export default function MeetingRoomPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === 'string' ? params.id : '';

  const [m, setM] = useState<MeetingDetail | null>(null);
  const [join, setJoin] = useState<JoinTokenResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const [detail, tok] = await Promise.all([fetchMeeting(id), fetchJoinToken(id)]);
      setM(detail);
      setJoin(tok);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا');
      setM(null);
      setJoin(null);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const participantCount = 1;

  return (
    <AuthGate>
      <div className="flex min-h-[calc(100vh-8rem)] flex-col bg-[var(--surface-strong)]">
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border-soft)] bg-[var(--card-bg)] px-3 py-2">
          <Link href={id ? `/meetings/${id}` : '/spaces/education'} className="text-[12px] font-bold text-[var(--text-secondary)]">
            ← جزئیات
          </Link>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-xs font-extrabold text-[var(--text-primary)]">{m?.title ?? 'اتاق جلسه'}</p>
            <p className="text-[10px] text-[var(--text-secondary)]">{participantCount} شرکت‌کننده</p>
          </div>
          <span className="w-10" aria-hidden />
        </header>

        {error ? (
          <div className="m-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-200">
            {error}
          </div>
        ) : null}

        <div className="flex flex-1 flex-col gap-3 p-3">
          <div className="aspect-video w-full overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-zinc-900 shadow-inner ring-1 ring-black/20">
            <div className="flex h-full items-center justify-center text-center text-sm text-zinc-400">
              <div>
                <p className="font-bold text-zinc-200">تصویر شما</p>
                <p className="mt-1 text-[11px] text-zinc-500">WebRTC در گام بعد؛ توکن و ICE از سرور آماده است.</p>
              </div>
            </div>
          </div>

          <div className="min-h-[120px] flex-1 rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--card-bg)] p-2 ring-1 ring-[var(--border-soft)]">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">سایر شرکت‌کنندگان</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex aspect-video items-center justify-center rounded-xl bg-[var(--surface-soft)] text-[10px] text-[var(--text-secondary)] ring-1 ring-[var(--border-soft)]"
                >
                  جای خالی {i}
                </div>
              ))}
            </div>
          </div>
        </div>

        {join && process.env.NODE_ENV === 'development' ? (
          <p className="px-3 pb-1 text-[9px] font-mono text-[var(--text-secondary)] opacity-70">
            dev: iceServers={join.iceServers.length} token len={join.token.length}
          </p>
        ) : null}

        <footer className="sticky bottom-0 z-10 border-t border-[var(--border-soft)] bg-[var(--card-bg)]/95 px-3 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-md items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setMicOn((v) => !v)}
              className={`flex h-12 w-12 items-center justify-center rounded-full text-lg shadow-md ${
                micOn ? 'bg-zinc-700 text-white' : 'bg-red-600 text-white'
              }`}
              aria-label="میکروفون"
            >
              {micOn ? '🎙' : '🔇'}
            </button>
            <button
              type="button"
              onClick={() => setCamOn((v) => !v)}
              className={`flex h-12 w-12 items-center justify-center rounded-full text-lg shadow-md ${
                camOn ? 'bg-zinc-700 text-white' : 'bg-zinc-600 text-white'
              }`}
              aria-label="دوربین"
            >
              {camOn ? '📹' : '🚫'}
            </button>
            <button
              type="button"
              onClick={() => router.push(id ? `/meetings/${id}` : '/spaces/education')}
              className="flex h-12 min-w-[4.5rem] items-center justify-center rounded-full bg-red-600 px-4 text-xs font-extrabold text-white shadow-md"
            >
              خروج
            </button>
          </div>
        </footer>
      </div>
    </AuthGate>
  );
}

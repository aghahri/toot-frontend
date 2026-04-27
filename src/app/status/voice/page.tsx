'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AuthGate } from '@/components/AuthGate';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { tinyHaptic } from '@/lib/haptic';

const MAX_SECONDS = 15;

type VoiceStatusResponse = {
  data: {
    id: string;
    mediaId: string;
    durationSec: number;
    caption: string | null;
    createdAt: string;
    media: {
      id: string;
      url: string;
      mimeType: string;
      durationMs: number | null;
      originalName: string | null;
      size: number;
      createdAt: string;
    };
  } | null;
};

function formatClock(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  return `00:${String(s).padStart(2, '0')}`;
}

export default function VoiceStatusPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recording, setRecording] = useState(false);
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [remainingSec, setRemainingSec] = useState(MAX_SECONDS);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recordedMime, setRecordedMime] = useState('audio/webm');
  const [recordedDurationSec, setRecordedDurationSec] = useState(0);
  const [currentStatus, setCurrentStatus] = useState<VoiceStatusResponse['data']>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startMsRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const ok =
      typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== 'undefined';
    setSupported(ok);
  }, []);

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [recordedUrl]);

  async function loadCurrentStatus() {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<VoiceStatusResponse>('voice-status/me', {
        method: 'GET',
        token,
      });
      setCurrentStatus(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در دریافت وضعیت');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCurrentStatus();
  }, []);

  async function startRecording() {
    if (!supported || recording) return;
    setError(null);
    setMessage(null);
    setRecordedBlob(null);
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
      setRecordedUrl(null);
    }
    setRemainingSec(MAX_SECONDS);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      startMsRef.current = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        if (tickRef.current) {
          clearInterval(tickRef.current);
          tickRef.current = null;
        }
        if (stopTimeoutRef.current) {
          clearTimeout(stopTimeoutRef.current);
          stopTimeoutRef.current = null;
        }
        const durationSec = Math.max(1, Math.min(MAX_SECONDS, Math.round((Date.now() - startMsRef.current) / 1000)));
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setRecordedBlob(blob);
        setRecordedUrl(url);
        setRecordedMime(recorder.mimeType || 'audio/webm');
        setRecordedDurationSec(durationSec);
        setRecording(false);
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };

      recorder.start(250);
      setRecording(true);
      tickRef.current = setInterval(() => {
        const elapsed = Math.round((Date.now() - startMsRef.current) / 1000);
        const left = Math.max(0, MAX_SECONDS - elapsed);
        setRemainingSec(left);
      }, 200);
      stopTimeoutRef.current = setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop();
      }, MAX_SECONDS * 1000);
    } catch {
      setError('ضبط صدا در این مرورگر پشتیبانی نمی‌شود.');
      setRecording(false);
    }
  }

  function stopRecording() {
    if (!recorderRef.current || recorderRef.current.state !== 'recording') return;
    recorderRef.current.stop();
  }

  async function publishStatus() {
    if (!recordedBlob || !recordedDurationSec) return;
    const token = getAccessToken();
    if (!token) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const file = new File([recordedBlob], `voice-status-${Date.now()}.webm`, {
        type: recordedMime || 'audio/webm',
      });
      const form = new FormData();
      form.append('file', file);
      form.append('durationMs', String(recordedDurationSec * 1000));
      const upload = await apiFetch<{ media: { id: string } }>('media/upload', {
        method: 'POST',
        token,
        body: form,
      });
      await apiFetch('voice-status', {
        method: 'POST',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaId: upload.media.id,
          durationSec: recordedDurationSec,
          caption: caption.trim() || undefined,
        }),
      });
      setMessage('وضعیت صوتی منتشر شد');
      setCaption('');
      setRecordedBlob(null);
      if (recordedUrl) {
        URL.revokeObjectURL(recordedUrl);
        setRecordedUrl(null);
      }
      setRecordedDurationSec(0);
      await loadCurrentStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'انتشار وضعیت ناموفق بود');
    } finally {
      setSaving(false);
    }
  }

  async function deleteStatus() {
    const token = getAccessToken();
    if (!token) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch('voice-status/me', {
        method: 'DELETE',
        token,
      });
      setMessage('وضعیت صوتی حذف شد');
      await loadCurrentStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'حذف وضعیت ناموفق بود');
    } finally {
      setSaving(false);
    }
  }

  const statusDayLabel = useMemo(() => {
    if (!currentStatus?.createdAt) return 'امروز';
    return 'امروز';
  }, [currentStatus?.createdAt]);

  return (
    <AuthGate>
      <main className="mx-auto min-h-[100dvh] w-full max-w-md bg-[var(--bg-page)] px-4 pb-24 pt-4 text-[var(--ink)]" dir="rtl">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-extrabold">وضعیت صوتی</h1>
          <Link href="/home" className="rounded-full bg-[var(--surface-2)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-2)]">
            بازگشت
          </Link>
        </div>
        <p className="text-sm text-[var(--ink-3)]">یک پیام صوتی کوتاه برای امروزت بگذار</p>

        {!supported ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
            ضبط صدا در این مرورگر پشتیبانی نمی‌شود.
          </div>
        ) : (
          <section className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">{recording ? 'در حال ضبط...' : 'ضبط وضعیت جدید'}</div>
              <div className="rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-xs font-bold tabular-nums">
                {formatClock(remainingSec)}
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              {!recording ? (
                <button
                  type="button"
                  onClick={() => {
                    tinyHaptic();
                    void startRecording();
                  }}
                  disabled={saving}
                  className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-bold text-[var(--accent-contrast)] disabled:opacity-50"
                >
                  شروع ضبط
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    tinyHaptic();
                    stopRecording();
                  }}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white"
                >
                  توقف
                </button>
              )}
            </div>

            {recordedUrl ? (
              <div className="mt-4 space-y-3">
                <audio src={recordedUrl} controls className="w-full rounded-xl bg-white" />
                <input
                  type="text"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="کپشن کوتاه (اختیاری)"
                  maxLength={160}
                  className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    tinyHaptic();
                    void publishStatus();
                  }}
                  disabled={saving}
                  className="w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  انتشار وضعیت صوتی
                </button>
              </div>
            ) : null}
          </section>
        )}

        <section className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm">
          <h2 className="text-sm font-bold">وضعیت فعلی من</h2>
          {loading ? (
            <p className="mt-2 text-sm text-[var(--ink-3)]">در حال بارگذاری...</p>
          ) : !currentStatus ? (
            <p className="mt-2 text-sm text-[var(--ink-3)]">فعلاً وضعیت صوتی فعالی نداری.</p>
          ) : (
            <div className="mt-3 space-y-2">
              <div className="text-xs text-[var(--ink-3)]">{statusDayLabel}</div>
              <audio src={currentStatus.media.url} controls className="w-full rounded-xl bg-white" />
              {currentStatus.caption ? <p className="text-sm text-[var(--ink-2)]">{currentStatus.caption}</p> : null}
              <button
                type="button"
                onClick={() => void deleteStatus()}
                disabled={saving}
                className="rounded-xl border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 disabled:opacity-50"
              >
                حذف وضعیت
              </button>
            </div>
          )}
        </section>

        {error ? <p className="mt-3 text-sm font-semibold text-red-600">{error}</p> : null}
        {message ? <p className="mt-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
      </main>
    </AuthGate>
  );
}

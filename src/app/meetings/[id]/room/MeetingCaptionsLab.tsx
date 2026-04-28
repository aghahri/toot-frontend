'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { useAppRealtime } from '@/context/AppRealtimeSocketContext';

type LiveCaption = {
  id: string;
  speakerLabel: string;
  faText: string;
  enText: string;
};

type Props = {
  socket: ReturnType<typeof useAppRealtime>['socket'];
  connected: boolean;
  meetingId: string;
};

const CAPTIONS_BATCH_WINDOW_MS = 9000;
const CAPTIONS_MAX_SESSION_MS = 2 * 60 * 1000;
const CAPTIONS_MAX_REQUESTS_PER_MINUTE = 5;

function MeetingCaptionsLabComponent({ socket, connected, meetingId }: Props) {
  const captionsLabEnabled = process.env.NEXT_PUBLIC_MEETING_CAPTIONS_ENABLED === 'true';
  const [enabled, setEnabled] = useState(false);
  const [caption, setCaption] = useState<LiveCaption | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderStreamRef = useRef<MediaStream | null>(null);
  const chunkSeqRef = useRef(0);
  const batchChunksRef = useRef<Blob[]>([]);
  const batchBytesRef = useRef(0);
  const batchTimerRef = useRef<number | null>(null);
  const batchInFlightRef = useRef(false);
  const sessionStartedAtRef = useRef<number | null>(null);
  const requestWindowRef = useRef<{ startedAt: number; count: number }>({ startedAt: 0, count: 0 });
  const pausedByVisibilityRef = useRef(false);
  const mountedRef = useRef(false);

  const logLab = (event: string, data?: Record<string, unknown>) => {
    const suffix = data ? ` ${JSON.stringify(data)}` : '';
    console.debug(`[captions-lab:${meetingId}] ${event}${suffix}`);
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!captionsLabEnabled) return;
    if (!enabled) {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      if (batchTimerRef.current !== null) {
        window.clearTimeout(batchTimerRef.current);
        batchTimerRef.current = null;
      }
      batchChunksRef.current = [];
      batchBytesRef.current = 0;
      batchInFlightRef.current = false;
      sessionStartedAtRef.current = null;
      requestWindowRef.current = { startedAt: 0, count: 0 };
      pausedByVisibilityRef.current = false;
      setCaptureError(null);
      setCaption(null);
      return;
    }
    if (!socket || !connected || !meetingId) return;

    const clearHideTimer = () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };

    const onMeetingCaption = (payload: {
      meetingId: string;
      id?: string;
      speakerLabel?: string;
      faText?: string;
      enText?: string;
    }) => {
      if (payload.meetingId !== meetingId) return;
      const faText = payload.faText?.trim();
      const enText = payload.enText?.trim();
      if (!faText || !enText) return;
      setCaption({
        id: payload.id || `${Date.now()}`,
        speakerLabel: payload.speakerLabel?.trim() || 'گوینده',
        faText,
        enText,
      });
      clearHideTimer();
      hideTimerRef.current = window.setTimeout(() => {
        setCaption(null);
        hideTimerRef.current = null;
      }, 4500);
    };

    const onMeetingCaptionClear = (payload: { meetingId: string }) => {
      if (payload.meetingId !== meetingId) return;
      clearHideTimer();
      setCaption(null);
    };

    socket.on('meeting_caption', onMeetingCaption);
    socket.on('meeting_caption_clear', onMeetingCaptionClear);

    return () => {
      clearHideTimer();
      socket.off('meeting_caption', onMeetingCaption);
      socket.off('meeting_caption_clear', onMeetingCaptionClear);
    };
  }, [captionsLabEnabled, connected, enabled, meetingId, socket]);

  useEffect(() => {
    if (!captionsLabEnabled || !enabled || !socket || !connected || !meetingId) return;

    let cancelled = false;
    let localRecorder: MediaRecorder | null = null;

    const clearBatchTimer = () => {
      if (batchTimerRef.current !== null) {
        window.clearTimeout(batchTimerRef.current);
        batchTimerRef.current = null;
      }
    };

    const resetBatch = () => {
      batchChunksRef.current = [];
      batchBytesRef.current = 0;
      clearBatchTimer();
    };

    const flushBatch = async (reason: string) => {
      if (cancelled || !socket || !connected || !meetingId) return;
      if (batchChunksRef.current.length === 0 || batchBytesRef.current <= 0) return;
      if (batchInFlightRef.current) {
        logLab('batch-skipped-inflight', { reason, chunks: batchChunksRef.current.length });
        resetBatch();
        return;
      }
      const now = Date.now();
      if (sessionStartedAtRef.current === null) sessionStartedAtRef.current = now;
      if (now - sessionStartedAtRef.current > CAPTIONS_MAX_SESSION_MS) {
        logLab('batch-stopped-session-limit', { reason });
        setCaptureError('جلسه آزمایشی زیرنویس به پایان رسید');
        setEnabled(false);
        resetBatch();
        return;
      }

      if (now - requestWindowRef.current.startedAt >= 60_000) {
        requestWindowRef.current = { startedAt: now, count: 0 };
      } else if (
        requestWindowRef.current.startedAt > 0 &&
        requestWindowRef.current.count >= CAPTIONS_MAX_REQUESTS_PER_MINUTE
      ) {
        logLab('batch-dropped-rate-limit', { reason, requests: requestWindowRef.current.count });
        resetBatch();
        return;
      }

      const mimeType = localRecorder?.mimeType || recorderRef.current?.mimeType || 'audio/webm';
      const payloadBlob = new Blob(batchChunksRef.current, { type: mimeType });
      if (payloadBlob.size <= 0) {
        resetBatch();
        return;
      }

      const seq = ++chunkSeqRef.current;
      const startedAt = performance.now();
      batchInFlightRef.current = true;
      resetBatch();
      requestWindowRef.current.count += 1;
      logLab('batch-sent', { seq, byteLength: payloadBlob.size, reason });
      try {
        const ab = await payloadBlob.arrayBuffer();
        if (cancelled || !socket || !connected || !meetingId) return;
        socket.emit('meeting_caption_chunk', {
          meetingId,
          seq,
          byteLength: payloadBlob.size,
          mimeType,
          audioChunk: new Uint8Array(ab),
        });
      } finally {
        batchInFlightRef.current = false;
        logLab('batch-send-finished', { seq, ms: Math.round(performance.now() - startedAt) });
      }
    };

    const scheduleBatchFlush = () => {
      if (batchTimerRef.current !== null) return;
      logLab('batch-started', { chunks: batchChunksRef.current.length, byteLength: batchBytesRef.current });
      batchTimerRef.current = window.setTimeout(() => {
        batchTimerRef.current = null;
        void flushBatch('timer');
      }, CAPTIONS_BATCH_WINDOW_MS);
    };

    const stopCapture = () => {
      clearBatchTimer();
      resetBatch();
      if (localRecorder && localRecorder.state !== 'inactive') {
        try {
          localRecorder.stop();
        } catch {
          // ignored
        }
      }
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try {
          recorderRef.current.stop();
        } catch {
          // ignored
        }
      }
      recorderRef.current = null;
      const stream = recorderStreamRef.current;
      recorderStreamRef.current = null;
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };

    const startCapture = async () => {
      try {
        setCaptureError(null);
        chunkSeqRef.current = 0;
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        recorderStreamRef.current = stream;
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : undefined;
        localRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        recorderRef.current = localRecorder;
        localRecorder.ondataavailable = (event: BlobEvent) => {
          if (cancelled || !socket || !connected || !meetingId) return;
          if (!event.data || event.data.size === 0) return;
          batchChunksRef.current.push(event.data);
          batchBytesRef.current += event.data.size;
          scheduleBatchFlush();
        };
        localRecorder.onstop = () => {
          void flushBatch('recorder-stop');
        };
        localRecorder.onerror = () => {
          setCaptureError('خطا در ضبط صدای زیرنویس');
          setEnabled(false);
        };
        localRecorder.start(1000);
      } catch (error) {
        setCaptureError('دسترسی میکروفون برای زیرنویس داده نشد');
        setEnabled(false);
        stopCapture();
      }
    };

    void startCapture();

    return () => {
      cancelled = true;
      stopCapture();
    };
  }, [captionsLabEnabled, connected, enabled, meetingId, socket]);

  useEffect(() => {
    if (!captionsLabEnabled || !enabled) return;
    if (connected) return;
    logLab('captions-stopped-socket-disconnected');
    setCaptureError('اتصال قطع شد؛ زیرنویس متوقف شد');
    setEnabled(false);
  }, [captionsLabEnabled, connected, enabled, meetingId]);

  useEffect(() => {
    if (!captionsLabEnabled || !enabled) return;
    const onVisibilityChange = () => {
      const rec = recorderRef.current;
      if (!rec) return;
      if (document.visibilityState === 'hidden' && rec.state === 'recording') {
        try {
          rec.pause();
          pausedByVisibilityRef.current = true;
          logLab('captions-paused-visibility-hidden');
        } catch {
          // ignored
        }
        return;
      }
      if (document.visibilityState === 'visible' && pausedByVisibilityRef.current && rec.state === 'paused') {
        try {
          rec.resume();
          pausedByVisibilityRef.current = false;
          logLab('captions-resumed-visibility-visible');
        } catch {
          // ignored
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [captionsLabEnabled, enabled, meetingId]);

  if (!captionsLabEnabled) return null;

  function triggerDemoCaptions() {
    if (!enabled || !socket || !meetingId) return;
    socket.emit('meeting_caption_trigger_demo', { meetingId });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setEnabled((prev) => !prev)}
        className={`flex h-12 min-w-[5.2rem] items-center justify-center rounded-full px-3 text-xs font-extrabold shadow-md ${
          enabled ? 'bg-emerald-600 text-white' : 'bg-[var(--surface-soft)] text-[var(--text-primary)]'
        }`}
      >
        زیرنویس آزمایشی
      </button>
      <button
        type="button"
        onClick={triggerDemoCaptions}
        disabled={!enabled}
        className="flex h-12 min-w-[4.2rem] items-center justify-center rounded-full bg-[var(--surface-soft)] px-3 text-xs font-extrabold text-[var(--text-primary)] shadow-md disabled:opacity-50"
      >
        دمو
      </button>
      <span className="text-[10px] font-bold text-[var(--text-secondary)]">نسخه آزمایشی؛ ممکن است کند باشد</span>
      {captureError ? <span className="text-[10px] font-bold text-amber-300">{captureError}</span> : null}
      {mountedRef.current && caption
        ? createPortal(
            <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex justify-center px-4">
              <div className="max-w-[42rem] rounded-xl bg-black/75 px-3 py-2 text-center text-white">
                <p className="text-[10px] font-bold text-emerald-200">{caption.speakerLabel}</p>
                <p className="text-sm font-extrabold leading-tight">{caption.faText}</p>
                <p className="mt-0.5 text-xs leading-tight text-zinc-200">{caption.enText}</p>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export default memo(MeetingCaptionsLabComponent);

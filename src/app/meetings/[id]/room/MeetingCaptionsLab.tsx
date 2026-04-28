'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { useAppRealtime } from '@/context/AppRealtimeSocketContext';

type LiveCaption = {
  id: string;
  speakerLabel: string;
  text: string;
  language: string;
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
  const segmentStopTimerRef = useRef<number | null>(null);
  const chunkSeqRef = useRef(0);
  const batchInFlightRef = useRef(false);
  const sessionStartedAtRef = useRef<number | null>(null);
  const requestWindowRef = useRef<{ startedAt: number; count: number }>({ startedAt: 0, count: 0 });
  const pausedByVisibilityRef = useRef(false);
  const mountedRef = useRef(false);

  const logLab = (event: string, data?: Record<string, unknown>) => {
    const suffix = data ? ` ${JSON.stringify(data)}` : '';
    console.debug(`[captions-lab:${meetingId}] ${event}${suffix}`);
  };

  const detectMimeFromBytes = (bytes: Uint8Array, fallback: string): string => {
    if (bytes.length >= 4) {
      // WebM / Matroska EBML
      if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return 'audio/webm';
      // OGG
      if (bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) return 'audio/ogg';
      // WAV
      if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return 'audio/wav';
      // MP4 family starts with size box then "ftyp" at 4..7
      if (
        bytes.length >= 8 &&
        bytes[4] === 0x66 &&
        bytes[5] === 0x74 &&
        bytes[6] === 0x79 &&
        bytes[7] === 0x70
      ) {
        return 'audio/mp4';
      }
    }
    return fallback;
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!captionsLabEnabled) return;
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
      text?: string;
      language?: string;
    }) => {
      if (payload.meetingId !== meetingId) return;
      const text = payload.text?.trim();
      if (!text) return;
      setCaption({
        id: payload.id || `${Date.now()}`,
        speakerLabel: payload.speakerLabel?.trim() || 'گوینده',
        text,
        language: (payload.language || '').trim().toLowerCase() || 'auto',
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
  }, [captionsLabEnabled, connected, meetingId, socket]);

  useEffect(() => {
    if (!captionsLabEnabled) return;
    if (!enabled) {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      if (segmentStopTimerRef.current !== null) {
        window.clearTimeout(segmentStopTimerRef.current);
        segmentStopTimerRef.current = null;
      }
      batchInFlightRef.current = false;
      sessionStartedAtRef.current = null;
      requestWindowRef.current = { startedAt: 0, count: 0 };
      pausedByVisibilityRef.current = false;
      setCaptureError(null);
      return;
    }
  }, [captionsLabEnabled, enabled]);

  useEffect(() => {
    if (!captionsLabEnabled || !enabled || !socket || !connected || !meetingId) return;

    let cancelled = false;
    let localRecorder: MediaRecorder | null = null;
    let segmentParts: Blob[] = [];

    const clearSegmentStopTimer = () => {
      if (segmentStopTimerRef.current !== null) {
        window.clearTimeout(segmentStopTimerRef.current);
        segmentStopTimerRef.current = null;
      }
    };

    const sendSegment = async (reason: string, mimeType: string, parts: Blob[]) => {
      if (cancelled || !socket || !connected || !meetingId) return;
      if (parts.length === 0) return;
      if (batchInFlightRef.current) {
        logLab('batch-skipped-inflight', { reason, parts: parts.length });
        return;
      }
      const now = Date.now();
      if (sessionStartedAtRef.current === null) sessionStartedAtRef.current = now;
      if (now - sessionStartedAtRef.current > CAPTIONS_MAX_SESSION_MS) {
        logLab('batch-stopped-session-limit', { reason });
        setCaptureError('جلسه آزمایشی زیرنویس به پایان رسید');
        setEnabled(false);
        return;
      }

      if (now - requestWindowRef.current.startedAt >= 60_000) {
        requestWindowRef.current = { startedAt: now, count: 0 };
      } else if (
        requestWindowRef.current.startedAt > 0 &&
        requestWindowRef.current.count >= CAPTIONS_MAX_REQUESTS_PER_MINUTE
      ) {
        logLab('batch-dropped-rate-limit', { reason, requests: requestWindowRef.current.count });
        return;
      }

      const payloadBlob = new Blob(parts, { type: mimeType || 'audio/webm' });
      if (payloadBlob.size <= 0) {
        return;
      }

      const seq = ++chunkSeqRef.current;
      const startedAt = performance.now();
      batchInFlightRef.current = true;
      requestWindowRef.current.count += 1;
      logLab('batch-sent', { seq, blobSize: payloadBlob.size, batchPartCount: parts.length, mimeType, reason });
      try {
        const ab = await payloadBlob.arrayBuffer();
        if (cancelled || !socket || !connected || !meetingId) return;
        const firstBytes = new Uint8Array(ab.slice(0, 4));
        const sniffBytes = new Uint8Array(ab.slice(0, 12));
        const detectedMimeType = detectMimeFromBytes(sniffBytes, mimeType || 'audio/webm');
        const firstBytesHex = Array.from(firstBytes)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
        socket.emit('meeting_caption_chunk', {
          meetingId,
          seq,
          byteLength: payloadBlob.size,
          mimeType: detectedMimeType,
          blobSize: payloadBlob.size,
          batchPartCount: parts.length,
          firstBytesHex,
          audioChunk: new Uint8Array(ab),
        });
      } finally {
        batchInFlightRef.current = false;
        logLab('batch-send-finished', { seq, ms: Math.round(performance.now() - startedAt) });
      }
    };

    const stopCurrentRecorder = () => {
      if (!localRecorder) return;
      if (localRecorder.state !== 'inactive') {
        try {
          localRecorder.stop();
        } catch {
          // ignored
        }
      }
    };

    const startSegmentSession = () => {
      if (cancelled || !enabled || !socket || !connected || !meetingId) return;
      if (batchInFlightRef.current) {
        logLab('batch-skipped-inflight', { reason: 'segment-start' });
        return;
      }
      if (sessionStartedAtRef.current === null) {
        sessionStartedAtRef.current = Date.now();
      }
      const now = Date.now();
      if (now - sessionStartedAtRef.current > CAPTIONS_MAX_SESSION_MS) {
        setCaptureError('جلسه آزمایشی زیرنویس به پایان رسید');
        setEnabled(false);
        return;
      }
      if (!localRecorder || localRecorder.state !== 'inactive') return;
      segmentParts = [];
      logLab('batch-started', { windowMs: CAPTIONS_BATCH_WINDOW_MS });
      try {
        localRecorder.start(1000);
      } catch {
        setCaptureError('شروع ضبط زیرنویس ناموفق بود');
        setEnabled(false);
        return;
      }
      clearSegmentStopTimer();
      segmentStopTimerRef.current = window.setTimeout(() => {
        stopCurrentRecorder();
      }, CAPTIONS_BATCH_WINDOW_MS);
    };

    const stopCapture = () => {
      clearSegmentStopTimer();
      stopCurrentRecorder();
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
        const finalMimeType = localRecorder.mimeType || mimeType || 'audio/webm';
        localRecorder.ondataavailable = (event: BlobEvent) => {
          if (cancelled) return;
          if (!event.data || event.data.size === 0) return;
          segmentParts.push(event.data);
        };
        localRecorder.onstop = () => {
          clearSegmentStopTimer();
          const parts = segmentParts;
          segmentParts = [];
          if (parts.length > 0) {
            void sendSegment('segment-stop', finalMimeType, parts);
          }
          if (!cancelled && enabled && connected) {
            window.setTimeout(() => {
              startSegmentSession();
            }, 60);
          }
        };
        localRecorder.onerror = () => {
          setCaptureError('خطا در ضبط صدای زیرنویس');
          setEnabled(false);
        };
        startSegmentSession();
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
        ارسال زیرنویس صدای من
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
                <p className="text-sm font-extrabold leading-tight">{caption.text}</p>
                <p className="mt-0.5 text-[10px] font-bold text-zinc-300">{caption.language.toUpperCase()}</p>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export default memo(MeetingCaptionsLabComponent);

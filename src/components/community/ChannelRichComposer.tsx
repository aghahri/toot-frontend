'use client';

import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { createLocationMetadata } from '@/lib/locationMetadata';
import { uploadFileToMediaId, uploadVoiceBlobWithXhr } from '@/lib/mediaUpload';

const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const MAX_VOICE_RECORD_SEC = 120;
const MIN_VOICE_RECORD_MS = 600;

type VoicePhase = 'idle' | 'recording' | 'sending';

type Props = {
  channelId: string;
  onSent: () => void;
  onError: (msg: string | null) => void;
  sending: boolean;
  setSending: (v: boolean) => void;
  id?: string;
  className?: string;
};

/**
 * Rich channel composer — same media/voice patterns as group/direct; gated by parent (canPost).
 */
export function ChannelRichComposer({
  channelId,
  onSent,
  onError,
  sending,
  setSending,
  id,
  className = '',
}: Props) {
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);

  const [voicePhase, setVoicePhase] = useState<VoicePhase>('idle');
  const [recordElapsedMs, setRecordElapsedMs] = useState(0);

  const fileRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordTickRef = useRef<number | null>(null);
  const recordStartedAtRef = useRef(0);
  const voiceCancelledRef = useRef(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function clearFile() {
    setFile(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (fileRef.current) fileRef.current.value = '';
    if (docRef.current) docRef.current.value = '';
  }

  const handlePickedFile = useCallback((next: File | null) => {
    if (!next) {
      clearFile();
      return;
    }
    const mime = next.type || '';
    const isVideo = mime.startsWith('video/');
    if (isVideo && next.size > MAX_VIDEO_BYTES) {
      onError('حجم ویدیو بیش از حد مجاز است');
      return;
    }
    setFile(next);
    if (mime.startsWith('image/') || mime.startsWith('video/')) {
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(next);
      });
    } else {
      setPreviewUrl(null);
    }
  }, [onError]);

  async function postPayload(body: Record<string, unknown>) {
    const token = getAccessToken();
    if (!token || !channelId) throw new Error('نشست نامعتبر است');
    await apiFetch(`channels/${encodeURIComponent(channelId)}/messages`, {
      method: 'POST',
      token,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (sending || voicePhase !== 'idle') return;
    const trimmed = text.trim();
    if (!trimmed && !file) return;

    const token = getAccessToken();
    if (!token) {
      onError('نشست نامعتبر است');
      return;
    }
    setSending(true);
    onError(null);
    setUploadProgress(file ? 0 : null);
    try {
      let mediaId: string | undefined;
      if (file) {
        mediaId = await uploadFileToMediaId(token, file);
        clearFile();
        setUploadProgress(null);
      }
      await postPayload({
        content: trimmed || undefined,
        mediaId,
      });
      setText('');
      onSent();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'ارسال نشد');
    } finally {
      setSending(false);
      setUploadProgress(null);
    }
  }

  async function sendVoice(blob: Blob, mime: string, durationMs: number) {
    const token = getAccessToken();
    if (!token || !channelId) return;
    setSending(true);
    setVoicePhase('sending');
    onError(null);
    setUploadProgress(0);
    try {
      const mediaId = await uploadVoiceBlobWithXhr(token, blob, mime, durationMs, (p) => setUploadProgress(p));
      await postPayload({ mediaId });
      onSent();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'ارسال صدا نشد');
    } finally {
      setSending(false);
      setUploadProgress(null);
      setVoicePhase('idle');
    }
  }

  function stopVoiceRecording() {
    if (recordTickRef.current != null) {
      window.clearInterval(recordTickRef.current);
      recordTickRef.current = null;
    }
    try {
      mediaRecorderRef.current?.stop();
    } catch {
      mediaRecorderRef.current = null;
    }
  }

  function cancelVoiceRecording() {
    if (voicePhase !== 'recording') return;
    voiceCancelledRef.current = true;
    stopVoiceRecording();
  }

  async function startVoiceRecording() {
    if (sending || voicePhase !== 'idle' || file) return;
    try {
      const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
      let mime = '';
      for (const c of candidates) {
        if (MediaRecorder.isTypeSupported(c)) {
          mime = c;
          break;
        }
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      voiceCancelledRef.current = false;
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      mediaRecorderRef.current = rec;
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (ev) => {
        if (ev.data.size) chunks.push(ev.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        if (voiceCancelledRef.current) {
          voiceCancelledRef.current = false;
          setVoicePhase('idle');
          return;
        }
        const dur = Math.max(0, Date.now() - recordStartedAtRef.current);
        if (dur < MIN_VOICE_RECORD_MS) {
          onError('پیام صوتی خیلی کوتاه است');
          setVoicePhase('idle');
          return;
        }
        const blob = new Blob(chunks, { type: rec.mimeType || mime || 'audio/webm' });
        const finalMime = blob.type || mime || 'audio/webm';
        void sendVoice(blob, finalMime, dur);
        setRecordElapsedMs(0);
      };

      recordStartedAtRef.current = Date.now();
      setVoicePhase('recording');
      rec.start(250);
      recordTickRef.current = window.setInterval(() => {
        const elapsed = Date.now() - recordStartedAtRef.current;
        setRecordElapsedMs(elapsed);
        if (elapsed >= MAX_VOICE_RECORD_SEC * 1000) {
          stopVoiceRecording();
        }
      }, 200);
    } catch {
      onError('اجازهٔ میکروفون داده نشد یا دستگاه در دسترس نیست');
      setVoicePhase('idle');
    }
  }

  async function sendLocation() {
    setAttachOpen(false);
    setSending(true);
    onError(null);
    try {
      const md = await createLocationMetadata();
      await postPayload({ messageType: 'LOCATION', metadata: md });
      onSent();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'خطا در مکان');
    } finally {
      setSending(false);
    }
  }

  async function sendContact() {
    setAttachOpen(false);
    const name = window.prompt('نام مخاطب:')?.trim() ?? '';
    if (!name) return;
    const phone = window.prompt('شماره تماس (اختیاری):')?.trim() ?? '';
    setSending(true);
    onError(null);
    try {
      await postPayload({
        messageType: 'CONTACT',
        metadata: { name, ...(phone ? { phone } : {}) },
      });
      onSent();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setSending(false);
    }
  }

  const busy = sending || voicePhase !== 'idle';

  return (
    <section
      id={id}
      className={`theme-card-bg theme-border-soft rounded-2xl border p-3 shadow-sm ${className}`.trim()}
      dir="rtl"
    >
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept="image/*,video/*"
        onChange={(e) => handlePickedFile(e.target.files?.[0] ?? null)}
      />
      <input
        ref={docRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.zip,.rar,.txt,.csv,application/pdf,application/zip,application/x-zip-compressed"
        onChange={(e) => handlePickedFile(e.target.files?.[0] ?? null)}
      />

      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[12px] font-extrabold text-[var(--text-primary)]">انتشار در کانال</h3>
        <span className="text-[10px] text-[var(--text-secondary)]">متن، رسانه، صدا، مکان و مخاطب</span>
      </div>

      {attachOpen ? (
        <div className="mb-2 overflow-hidden rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-[var(--text-secondary)]">پیوست</span>
            <button type="button" className="text-[10px] font-bold text-[var(--accent-hover)]" onClick={() => setAttachOpen(false)}>
              بستن
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              disabled={busy}
              className="rounded-lg border border-[var(--border-soft)] bg-[var(--card-bg)] py-2 text-[10px] font-bold disabled:opacity-40"
              onClick={() => {
                setAttachOpen(false);
                fileRef.current?.click();
              }}
            >
              گالری
            </button>
            <button
              type="button"
              disabled={busy}
              className="rounded-lg border border-[var(--border-soft)] bg-[var(--card-bg)] py-2 text-[10px] font-bold disabled:opacity-40"
              onClick={() => {
                setAttachOpen(false);
                docRef.current?.click();
              }}
            >
              سند
            </button>
            <button
              type="button"
              disabled={busy}
              className="rounded-lg border border-[var(--border-soft)] bg-[var(--card-bg)] py-2 text-[10px] font-bold disabled:opacity-40"
              onClick={() => void sendLocation()}
            >
              مکان
            </button>
            <button
              type="button"
              disabled={busy}
              className="rounded-lg border border-[var(--border-soft)] bg-[var(--card-bg)] py-2 text-[10px] font-bold disabled:opacity-40"
              onClick={() => void sendContact()}
            >
              مخاطب
            </button>
          </div>
        </div>
      ) : null}

      {previewUrl && file?.type.startsWith('image/') ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt="" className="mb-2 max-h-40 w-full rounded-lg object-contain" />
      ) : null}
      {previewUrl && file?.type.startsWith('video/') ? (
        <video src={previewUrl} className="mb-2 max-h-40 w-full rounded-lg bg-black" controls muted />
      ) : null}
      {file && !previewUrl ? (
        <p className="mb-2 truncate text-[11px] text-[var(--text-secondary)]">فایل: {file.name}</p>
      ) : null}

      {voicePhase === 'recording' ? (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-200/90 bg-red-50 px-3 py-2">
          <span className="text-xs font-semibold text-red-800">ضبط صدا…</span>
          <span className="tabular-nums text-xs text-red-700">{Math.ceil(recordElapsedMs / 1000)}ث</span>
          <div className="flex gap-2">
            <button type="button" className="text-xs font-bold text-emerald-800" onClick={() => stopVoiceRecording()}>
              پایان ضبط
            </button>
            <button type="button" className="text-xs font-bold text-red-800" onClick={() => cancelVoiceRecording()}>
              لغو
            </button>
          </div>
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="flex flex-col gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="متن انتشار…"
          rows={3}
          maxLength={10000}
          disabled={busy}
          className="theme-text-primary w-full resize-none rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-300/50 disabled:opacity-50"
        />

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy}
            title="پیوست"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-lg font-bold text-slate-700 shadow-sm disabled:opacity-40"
            onClick={() => setAttachOpen((v) => !v)}
          >
            +
          </button>
          <button
            type="button"
            disabled={busy || !!file}
            title="پیام صوتی"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-base shadow-sm disabled:opacity-40"
            onClick={() => void startVoiceRecording()}
          >
            🎙
          </button>
          <button
            type="submit"
            disabled={busy || (!text.trim() && !file)}
            className="ms-auto min-w-[5rem] rounded-xl bg-violet-700 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-violet-800 disabled:opacity-40"
          >
            {sending ? '…' : 'ارسال'}
          </button>
        </div>
      </form>

      {uploadProgress != null ? (
        <p className="mt-2 text-center text-[10px] text-[var(--text-secondary)]">آپلود: {uploadProgress}%</p>
      ) : null}
    </section>
  );
}

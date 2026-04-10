'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AuthGate } from '@/components/AuthGate';
import { getAccessToken } from '@/lib/auth';
import { apiFetch, getApiBaseUrl, getErrorMessageFromResponse } from '@/lib/api';
import { markDirectConversationRead } from '@/lib/mark-direct-read';
import { DIRECT_REACTION_EMOJIS, type DirectReactionSummary } from '@/lib/direct-reactions';
import { Card } from '@/components/ui/Card';
import { io } from 'socket.io-client';
import { FormEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

type MessageMedia = {
  id: string;
  type: string;
  url: string;
  mimeType: string;
  originalName: string | null;
  size: number;
  durationMs?: number | null;
  createdAt: string;
};

type ReplyToSummary = {
  id: string;
  text: string | null;
  senderId: string;
  mediaId: string | null;
  media?: { type?: string; mimeType?: string } | null;
  isDeleted?: boolean;
  deletedAt?: string | null;
  editedAt?: string | null;
  createdAt: string;
  sender: {
    id: string;
    name: string;
    avatar: string | null;
  };
};

const DIRECT_OLDER_PAGE_SIZE = 30;

function formatLastSeenFa(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const t = d.getTime();
  if (Number.isNaN(t)) return '';
  const sec = Math.round((Date.now() - t) / 1000);
  if (sec < 45) return 'همین الان';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} دقیقه پیش`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ساعت پیش`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} روز پیش`;
  return d.toLocaleDateString('fa-IR', { dateStyle: 'medium' });
}

type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  messageType?: string;
  metadata?: Record<string, unknown> | null;
  text: string | null;
  mediaId: string | null;
  isDeleted?: boolean;
  deletedAt?: string | null;
  editedAt?: string | null;
  deliveredAt?: string | null;
  seenAt?: string | null;
  createdAt: string;
  sender: {
    id: string;
    name: string;
    avatar: string | null;
  };
  media?: MessageMedia | null;
  replyToMessage?: ReplyToSummary | null;
  pending?: boolean;
  reactions?: DirectReactionSummary[];
};

function withDirectReactions(m: Message): Message {
  return { ...m, reactions: m.reactions ?? [] };
}

function isWindowNearBottom(thresholdPx: number): boolean {
  if (typeof window === 'undefined') return true;
  const el = document.documentElement;
  return window.innerHeight + window.scrollY >= el.scrollHeight - thresholdPx;
}

/** Uses scroll metrics from *before* the latest DOM reflow (see layoutScrollSnapshotRef). */
function wasPinnedToBottomSnapshot(
  snap: { scrollY: number; scrollHeight: number },
  thresholdPx: number,
): boolean {
  if (typeof window === 'undefined') return false;
  if (snap.scrollHeight <= 0) return false;
  return window.innerHeight + snap.scrollY >= snap.scrollHeight - thresholdPx;
}

function isVoiceMedia(m: { type?: string; mimeType?: string } | null | undefined): boolean {
  if (!m) return false;
  if (m.type === 'VOICE') return true;
  return (m.mimeType ?? '').toLowerCase().startsWith('audio/');
}

function formatVoiceClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

function replySnippetForMessage(msg: Message): string {
  if (msg.isDeleted) return 'این پیام حذف شده است';
  if (msg.messageType === 'LOCATION') return 'لوکیشن';
  if (msg.messageType === 'CONTACT') return 'مخاطب';
  if (msg.messageType === 'POLL') return 'نظرسنجی';
  if (msg.messageType === 'EVENT') return 'رویداد';
  const t = msg.text?.trim();
  if (t) return t.length > 100 ? `${t.slice(0, 100)}…` : t;
  if (msg.mediaId && msg.media && isVoiceMedia(msg.media)) return 'پیام صوتی';
  if (msg.mediaId) return 'رسانه';
  return 'پیام';
}

function isPureTextMessage(m: Message): boolean {
  if (m.isDeleted) return false;
  if (m.mediaId) return false;
  const mt = m.messageType;
  if (mt && mt !== 'TEXT') return false;
  return !!(m.text?.trim());
}

function ReplyQuoteBlock({
  reply,
  mine,
}: {
  reply: ReplyToSummary;
  mine: boolean;
}) {
  const isDeleted = !!reply.isDeleted;
  const safeText = reply.text ?? '';
  const body = isDeleted
    ? 'این پیام حذف شده است'
    : safeText.trim()
      ? safeText.length > 140
        ? `${safeText.slice(0, 140)}…`
        : safeText
      : reply.mediaId
        ? isVoiceMedia(reply.media)
          ? 'پیام صوتی'
          : 'رسانه'
        : '—';

  return (
    <div
      className={`mb-2 rounded-xl border-s-[3px] px-2.5 py-2 text-start text-[11px] leading-snug shadow-sm ${
        isDeleted ? 'border-s-slate-400/80' : 'border-s-sky-500'
      } ${mine ? 'bg-black/15 text-white/95' : 'bg-slate-100/90 text-slate-700 ring-1 ring-slate-200/60'} ${
        isDeleted ? 'opacity-75' : ''
      }`}
      dir="auto"
    >
      <div className="truncate text-[10px] font-semibold opacity-80">{reply.sender.name}</div>
      <div className="line-clamp-2 mt-0.5 opacity-90">{body}</div>
    </div>
  );
}

const MAX_VOICE_RECORD_SEC = 120;
const MIN_VOICE_RECORD_MS = 600;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const IMAGE_MAX_DIMENSION = 1600;
const IMAGE_JPEG_QUALITY = 0.82;
const IMAGE_WEBP_QUALITY = 0.8;

async function preprocessImageForUpload(input: File): Promise<File> {
  const mime = input.type.toLowerCase();
  if (!mime.startsWith('image/')) return input;
  if (mime === 'image/gif' || mime === 'image/svg+xml') return input;

  const url = URL.createObjectURL(input);
  try {
    let width = 0;
    let height = 0;
    let bitmap: ImageBitmap | null = null;

    if (typeof createImageBitmap !== 'undefined') {
      bitmap = await createImageBitmap(input);
      width = bitmap.width;
      height = bitmap.height;
    } else {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error('Image decode failed'));
        i.src = url;
      });
      width = img.naturalWidth;
      height = img.naturalHeight;
    }

    if (width <= 0 || height <= 0) return input;

    const ratio = Math.min(1, IMAGE_MAX_DIMENSION / Math.max(width, height));
    const targetW = Math.max(1, Math.round(width * ratio));
    const targetH = Math.max(1, Math.round(height * ratio));
    const shouldResize = targetW !== width || targetH !== height;

    if (!shouldResize && input.size <= 1_200_000) {
      bitmap?.close();
      return input;
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap?.close();
      return input;
    }

    if (bitmap) {
      ctx.drawImage(bitmap, 0, 0, targetW, targetH);
      bitmap.close();
    } else {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error('Image decode failed'));
        i.src = url;
      });
      ctx.drawImage(img, 0, 0, targetW, targetH);
    }

    const webpBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', IMAGE_WEBP_QUALITY),
    );
    const outBlob =
      webpBlob ??
      (await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', IMAGE_JPEG_QUALITY),
      ));

    if (!outBlob || outBlob.size >= input.size) {
      return input;
    }

    const ext = outBlob.type === 'image/webp' ? 'webp' : 'jpg';
    const base = input.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([outBlob], `${base}.${ext}`, {
      type: outBlob.type,
      lastModified: Date.now(),
    });
  } catch {
    return input;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function DirectVoiceBubble({
  media,
  mine,
  messageId,
  playingMessageId,
  setPlayingMessageId,
}: {
  media: MessageMedia;
  mine: boolean;
  messageId: string;
  playingMessageId: string | null;
  setPlayingMessageId: (id: string | null) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentMs, setCurrentMs] = useState(0);
  const [totalMs, setTotalMs] = useState(media.durationMs ?? 0);
  const [localPlaying, setLocalPlaying] = useState(false);

  useEffect(() => {
    setTotalMs(media.durationMs ?? 0);
  }, [media.durationMs, media.url, messageId]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (playingMessageId !== messageId && !a.paused) {
      a.pause();
    }
  }, [playingMessageId, messageId]);

  const barBg = mine ? 'bg-white/20' : 'bg-slate-200';
  const barFill = mine ? 'bg-white' : 'bg-emerald-500';

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (localPlaying) {
      a.pause();
      setPlayingMessageId(null);
      return;
    }
    setPlayingMessageId(messageId);
    void a.play().catch(() => {
      setPlayingMessageId(null);
      setLocalPlaying(false);
    });
  };

  return (
    <div className="mt-2 w-full min-w-[11rem] max-w-[16rem]">
      <audio
        ref={audioRef}
        src={media.url}
        preload="metadata"
        data-direct-voice=""
        className="hidden"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (!(media.durationMs && media.durationMs > 0) && d && !Number.isNaN(d)) {
            setTotalMs(Math.round(d * 1000));
          }
        }}
        onPlay={() => setLocalPlaying(true)}
        onPause={() => setLocalPlaying(false)}
        onEnded={() => {
          setLocalPlaying(false);
          setProgress(0);
          setCurrentMs(0);
          setPlayingMessageId(null);
        }}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          const d = el.duration;
          if (d && !Number.isNaN(d) && d > 0) {
            setProgress(el.currentTime / d);
            setCurrentMs(Math.floor(el.currentTime * 1000));
          }
        }}
      />
      <div className="flex items-center gap-2" dir="ltr">
        <button
          type="button"
          onClick={toggle}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition active:scale-95 ${
            mine ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-slate-200 text-slate-800 hover:bg-slate-300'
          }`}
          aria-label={localPlaying ? 'توقف' : 'پخش'}
        >
          {localPlaying ? '❚❚' : '▶'}
        </button>
        <div className={`min-w-0 flex-1 overflow-hidden rounded-full ${barBg} py-1.5`}>
          <div
            className={`h-1 rounded-full ${barFill} transition-[width] duration-150 ease-linear`}
            style={{ width: `${Math.min(100, progress * 100)}%` }}
          />
        </div>
        <span
          className={`shrink-0 tabular-nums text-[11px] font-medium ${
            mine ? 'text-white/80' : 'text-slate-500'
          }`}
        >
          {formatVoiceClock(currentMs)} / {formatVoiceClock(totalMs || 0)}
        </span>
      </div>
    </div>
  );
}

export default function DirectConversationPage() {
  const params = useParams();
  const conversationId = Array.isArray(params?.id) ? params.id[0] : params?.id ?? '';
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesRef = useRef<Message[]>([]);
  messagesRef.current = messages;
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);
  /** Last committed scrollY + scrollHeight (before the current paint grew the document). */
  const layoutScrollSnapshotRef = useRef({ scrollY: 0, scrollHeight: 0 });
  const wasLoadingRef = useRef(false);
  const awaitingFirstLoadScrollRef = useRef(true);
  const forceScrollAfterLoadRef = useRef(false);
  const prevMessageTailRef = useRef<{
    len: number;
    lastId: string;
    firstId: string;
  } | null>(null);
  const [hasMoreOlder, setHasMoreOlder] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const [peerPresence, setPeerPresence] = useState<{
    online: boolean;
    lastSeenAt: string | null;
  }>({ online: false, lastSeenAt: null });
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [replyDraft, setReplyDraft] = useState<{
    id: string;
    senderName: string;
    preview: string;
  } | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [openActionsMessageId, setOpenActionsMessageId] = useState<string | null>(null);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(() => new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [forwardBusy, setForwardBusy] = useState(false);
  const isSelectionMode = selectedMessageIds.size > 0;
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdGestureRef = useRef<{ x: number; y: number } | null>(null);
  const skipNextRowClickRef = useRef(false);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const isComposingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const documentInputRef = useRef<HTMLInputElement | null>(null);
  const [attachmentSheetOpen, setAttachmentSheetOpen] = useState(false);

  type VoicePhase = 'idle' | 'recording' | 'sending' | 'failed';
  const [voicePhase, setVoicePhase] = useState<VoicePhase>('idle');
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [voiceMime, setVoiceMime] = useState('');
  const [voicePreviewUrl, setVoicePreviewUrl] = useState<string | null>(null);
  const [voiceDurationMs, setVoiceDurationMs] = useState(0);
  const [recordElapsedMs, setRecordElapsedMs] = useState(0);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordChunksRef = useRef<BlobPart[]>([]);
  const recordMimeRef = useRef('');
  const recordTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordStartedAtRef = useRef(0);
  const voiceCancelledRef = useRef(false);

  const peerDisplay = useMemo(() => {
    const other = messages.find((m) => myUserId != null && m.senderId !== myUserId);
    if (other) {
      return { name: other.sender.name, avatar: other.sender.avatar };
    }
    return { name: 'مخاطب', avatar: null as string | null };
  }, [messages, myUserId]);

  const peerInitial = useMemo(() => {
    const t = peerDisplay.name.trim();
    if (!t) return '?';
    return t.slice(0, 1);
  }, [peerDisplay.name]);

  const headerStatusLine = useMemo(() => {
    if (otherTyping) {
      return { text: 'در حال تایپ…', className: 'font-semibold text-emerald-600' };
    }
    if (peerPresence.online) {
      return { text: 'آنلاین', className: 'font-semibold text-emerald-600' };
    }
    if (peerPresence.lastSeenAt) {
      return {
        text: `آخرین بازدید ${formatLastSeenFa(peerPresence.lastSeenAt)}`,
        className: 'text-stone-500',
      };
    }
    return { text: 'گفتگوی خصوصی', className: 'text-stone-500' };
  }, [otherTyping, peerPresence]);

  const canCopySelection = useMemo(() => {
    if (selectedMessageIds.size === 0) return false;
    const ordered = messages.filter((m) => selectedMessageIds.has(m.id));
    if (ordered.length !== selectedMessageIds.size) return false;
    return ordered.every(isPureTextMessage);
  }, [messages, selectedMessageIds]);

useEffect(() => {
  if (!file) {
    setPreviewUrl(null);
    return;
  }

  const objectUrl = URL.createObjectURL(file);
  setPreviewUrl(objectUrl);

  return () => {
    URL.revokeObjectURL(objectUrl);
  };
}, [file]);

function renderMessageStatus(msg: Message, mine: boolean) {
  if (!mine || msg.pending) return null;

  if (msg.seenAt) {
    return <span className="text-sky-400">✓✓</span>;
  }

  if (msg.deliveredAt) {
    return <span className="text-slate-400">✓✓</span>;
  }

  return <span className="text-slate-400">✓</span>;
}
function clearSelectedFile() {
  setFile(null);
  setPreviewUrl(null);
}

async function createLocationMetadata() {
  if (!navigator.geolocation) {
    throw new Error('Geolocation در این مرورگر پشتیبانی نمی‌شود');
  }
  const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 10000,
    });
  });
  const label = window.prompt('برچسب اختیاری مکان (مثلا خانه یا محل کار):')?.trim() ?? '';
  return {
    lat: Number(pos.coords.latitude.toFixed(6)),
    lng: Number(pos.coords.longitude.toFixed(6)),
    ...(label ? { label: label.slice(0, 120) } : {}),
  };
}

function handleFileSelection(next: File | null) {
  if (!next) {
    clearSelectedFile();
    return;
  }

  const mime = next.type || '';
  const isImage = mime.startsWith('image/');
  const isVideo = mime.startsWith('video/');
  const isDoc =
    mime === 'application/pdf' ||
    mime === 'application/zip' ||
    mime === 'application/x-zip-compressed' ||
    mime === 'application/msword' ||
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (!isImage && !isVideo && !isDoc) {
    setError('نوع فایل پشتیبانی نمی‌شود');
    clearSelectedFile();
    return;
  }

  if (isImage && next.size > MAX_IMAGE_BYTES) {
    setError('حجم تصویر از 20MB بیشتر است');
    clearSelectedFile();
    return;
  }
  if (isVideo && next.size > MAX_VIDEO_BYTES) {
    setError('حجم ویدیو از 100MB بیشتر است. در نسخه فعلی فشرده‌سازی ویدیو انجام نمی‌شود.');
    clearSelectedFile();
    return;
  }
  if (isDoc && next.size > MAX_IMAGE_BYTES) {
    setError('حجم فایل از 20MB بیشتر است');
    clearSelectedFile();
    return;
  }

  setError(null);
  setFile(next);
}

  function clearVoiceDraft() {
    voiceCancelledRef.current = true;
    mediaRecorderRef.current?.stop();
    if (recordTickRef.current) {
      clearInterval(recordTickRef.current);
      recordTickRef.current = null;
    }
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    mediaRecorderRef.current = null;
    recordChunksRef.current = [];
    setVoicePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setVoiceBlob(null);
    setVoiceMime('');
    setVoiceDurationMs(0);
    setRecordElapsedMs(0);
    setVoicePhase('idle');
    voiceCancelledRef.current = false;
  }

  function pickRecorderMime(): string {
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
    for (const m of candidates) {
      if (MediaRecorder.isTypeSupported(m)) return m;
    }
    return '';
  }

  async function startVoiceRecording() {
    if (editMode || sending || voicePhase !== 'idle') return;
    if (typeof MediaRecorder === 'undefined') {
      setError('ضبط صدا در این مرورگر پشتیبانی نمی‌شود');
      return;
    }
    setError(null);
    clearSelectedFile();
    if (fileInputRef.current) fileInputRef.current.value = '';
    clearVoiceDraft();

    const mime = pickRecorderMime();
    if (!mime) {
      setError('ضبط صدا در این مرورگر پشتیبانی نمی‌شود');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      recordChunksRef.current = [];
      recordMimeRef.current = mime;
      voiceCancelledRef.current = false;

      const rec = new MediaRecorder(stream, { mimeType: mime });
      mediaRecorderRef.current = rec;

      rec.ondataavailable = (e) => {
        if (e.data?.size) recordChunksRef.current.push(e.data);
      };

      rec.onstop = () => {
        mediaRecorderRef.current = null;
        if (recordTickRef.current) {
          clearInterval(recordTickRef.current);
          recordTickRef.current = null;
        }
        stream.getTracks().forEach((t) => t.stop());
        if (mediaStreamRef.current === stream) {
          mediaStreamRef.current = null;
        }

        if (voiceCancelledRef.current) {
          voiceCancelledRef.current = false;
          return;
        }

        const blob = new Blob(recordChunksRef.current, {
          type: recordMimeRef.current || mime,
        });
        recordChunksRef.current = [];

        if (blob.size < 1) {
          setVoicePhase('idle');
          setRecordElapsedMs(0);
          return;
        }

        const dur = Math.min(
          MAX_VOICE_RECORD_SEC * 1000,
          Date.now() - recordStartedAtRef.current,
        );
        if (dur < MIN_VOICE_RECORD_MS) {
          setVoicePhase('idle');
          setRecordElapsedMs(0);
          return;
        }

        const finalMime = blob.type || mime;
        setVoiceBlob(blob);
        setVoiceMime(finalMime);
        setVoiceDurationMs(dur);
        void autoSendVoiceMessage(blob, finalMime, dur).catch((e) => {
          setError(e instanceof Error ? e.message : 'خطا در ارسال پیام صوتی');
        });
        setRecordElapsedMs(0);
      };

      recordStartedAtRef.current = Date.now();
      setRecordElapsedMs(0);
      setVoicePhase('recording');
      rec.start(250);

      recordTickRef.current = setInterval(() => {
        const elapsed = Date.now() - recordStartedAtRef.current;
        setRecordElapsedMs(elapsed);
        if (elapsed >= MAX_VOICE_RECORD_SEC * 1000) {
          stopVoiceRecording();
        }
      }, 200);
    } catch {
      setError('اجازهٔ میکروفون داده نشد یا دستگاه در دسترس نیست');
      setVoicePhase('idle');
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
  }

  function stopVoiceRecording() {
    if (recordTickRef.current) {
      clearInterval(recordTickRef.current);
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

  function uploadVoiceBlob(
    token: string,
    blobArg?: Blob,
    mimeArg?: string,
    durationArg?: number,
  ): Promise<string | null> {
    const activeBlob = blobArg ?? voiceBlob;
    if (!activeBlob) return Promise.resolve(null);

    const activeMime = mimeArg ?? voiceMime;
    const activeDuration = durationArg ?? voiceDurationMs;
    const ext = activeMime.includes('webm') ? 'webm' : activeMime.includes('mp4') ? 'm4a' : 'webm';
    const form = new FormData();
    form.append('file', activeBlob, `voice.${ext}`);
    form.append('durationMs', String(Math.round(activeDuration)));

    const uploadUrl = `${getApiBaseUrl().replace(/\/+$/, '')}/media/upload`;

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', uploadUrl);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const percent = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(percent);
      };

      xhr.onload = () => {
        try {
          if (xhr.status < 200 || xhr.status >= 300) {
            let errMsg = 'خطا در آپلود صدا';
            try {
              const j = JSON.parse(xhr.responseText) as Record<string, unknown>;
              const m = j.message;
              if (typeof m === 'string') errMsg = m;
              else if (Array.isArray(m) && m.every((x) => typeof x === 'string')) {
                errMsg = m.join(' ');
              } else {
                const er = j.error;
                if (typeof er === 'string') errMsg = er;
              }
            } catch {
              /* ignore */
            }
            reject(new Error(errMsg));
            return;
          }
          const data = JSON.parse(xhr.responseText) as { media?: { id: string } };
          resolve(data.media?.id ?? null);
        } catch {
          reject(new Error('پاسخ آپلود معتبر نیست'));
        }
      };

      xhr.onerror = () => reject(new Error('خطا در ارتباط هنگام آپلود'));
      xhr.onabort = () => reject(new Error('آپلود لغو شد'));
      xhr.send(form);
    });
  }

  async function autoSendVoiceMessage(blob: Blob, mime: string, durationMs: number) {
    const token = getAccessToken();
    if (!token) throw new Error('نشست شما منقضی شده است');
    if (!conversationId) throw new Error('گفتگو معتبر نیست');

    setSending(true);
    setError(null);
    setUploadProgress(0);
    setVoicePhase('sending');

    try {
      const mediaId = await uploadVoiceBlob(token, blob, mime, durationMs);
      if (!mediaId) throw new Error('آپلود صدا انجام نشد');

      await apiFetch<Message>(`direct/conversations/${conversationId}/messages`, {
        method: 'POST',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaId,
          ...(replyDraft ? { replyToMessageId: replyDraft.id } : {}),
        }),
      });

      clearVoiceDraft();
      setReplyDraft(null);
      scrollThreadEnd('auto');
      socketRef.current?.emit('direct_typing', {
        conversationId,
        isTyping: false,
      });
    } catch (err) {
      setVoiceBlob(blob);
      setVoiceMime(mime);
      setVoiceDurationMs(durationMs);
      setVoicePreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
      setVoicePhase('failed');
      throw err;
    } finally {
      setSending(false);
      setUploadProgress(null);
    }
  }
function cancelEdit() {
  setEditMode(false);
  setEditingMessageId(null);
  setText('');
  socketRef.current?.emit('direct_typing', {
    conversationId,
    isTyping: false,
  });
}
function scrollThreadEnd(behavior: ScrollBehavior = 'auto') {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const root = document.documentElement;
      const y = root.scrollHeight - window.innerHeight;
      window.scrollTo({ top: Math.max(0, y), left: 0, behavior });
      layoutScrollSnapshotRef.current = {
        scrollY: window.scrollY,
        scrollHeight: document.documentElement.scrollHeight,
      };
    });
  });
}

  function scheduleLayoutScrollSnapshot() {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (typeof window === 'undefined') return;
        layoutScrollSnapshotRef.current = {
          scrollY: window.scrollY,
          scrollHeight: document.documentElement.scrollHeight,
        };
      });
    });
  }

  useEffect(() => {
    if (!conversationId) return;
    wasLoadingRef.current = false;
    awaitingFirstLoadScrollRef.current = true;
    forceScrollAfterLoadRef.current = false;
    prevMessageTailRef.current = null;
    layoutScrollSnapshotRef.current = { scrollY: 0, scrollHeight: 0 };
    setOpenActionsMessageId(null);
    setSelectedMessageIds(new Set());
    setHasMoreOlder(true);
    setPlayingMessageId(null);
    clearVoiceDraft();
  }, [conversationId]);

  useEffect(() => {
    return () => {
      voiceCancelledRef.current = true;
      if (recordTickRef.current) {
        clearInterval(recordTickRef.current);
        recordTickRef.current = null;
      }
      try {
        mediaRecorderRef.current?.stop();
      } catch {
        /* ignore */
      }
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!openActionsMessageId && selectedMessageIds.size === 0) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpenActionsMessageId(null);
      setSelectedMessageIds(new Set());
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [openActionsMessageId, selectedMessageIds.size]);

  useEffect(() => {
    if (!openActionsMessageId) return;

    const onPointerDown = (e: PointerEvent) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (!t.closest('[data-direct-msg-actions]')) setOpenActionsMessageId(null);
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [openActionsMessageId]);

  useEffect(() => {
    if (isSelectionMode) setAttachmentSheetOpen(false);
  }, [isSelectionMode]);

  useEffect(() => {
    return () => {
      if (holdTimerRef.current != null) {
        window.clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (loading) wasLoadingRef.current = true;
  }, [loading]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onScroll = () => {
      layoutScrollSnapshotRef.current = {
        scrollY: window.scrollY,
        scrollHeight: document.documentElement.scrollHeight,
      };
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useLayoutEffect(() => {
    if (!conversationId) return;
    if (loading) return;
    if (!wasLoadingRef.current && messages.length === 0) return;

    const tailId = messages[messages.length - 1]?.id ?? '';
    const headId = messages[0]?.id ?? '';

    if (forceScrollAfterLoadRef.current) {
      forceScrollAfterLoadRef.current = false;
      scrollThreadEnd('auto');
      prevMessageTailRef.current = {
        len: messages.length,
        lastId: tailId,
        firstId: headId,
      };
      return;
    }

    if (awaitingFirstLoadScrollRef.current) {
      awaitingFirstLoadScrollRef.current = false;
      scrollThreadEnd('auto');
      prevMessageTailRef.current = {
        len: messages.length,
        lastId: tailId,
        firstId: headId,
      };
      return;
    }

    const prev = prevMessageTailRef.current;
    prevMessageTailRef.current = {
      len: messages.length,
      lastId: tailId,
      firstId: headId,
    };
    if (!prev) {
      scheduleLayoutScrollSnapshot();
      return;
    }

    /** Only true when new row(s) were appended at the end (not prepend, delete, edit, or status-only). */
    const appendedAtTail =
      messages.length > prev.len &&
      tailId !== prev.lastId &&
      (headId === (prev.firstId ?? '') || prev.len === 0);

    if (!appendedAtTail) {
      scheduleLayoutScrollSnapshot();
      return;
    }

    const snap = layoutScrollSnapshotRef.current;
    const wasPinnedBeforeAppend =
      wasPinnedToBottomSnapshot(snap, 120) ||
      (snap.scrollHeight <= 0 && isWindowNearBottom(120)) ||
      prev.len === 0;

    if (wasPinnedBeforeAppend) {
      scrollThreadEnd('auto');
    } else {
      scheduleLayoutScrollSnapshot();
    }
  }, [loading, messages, conversationId]);

async function loadMessages() {
    const token = getAccessToken();
    if (!token || !conversationId) return;

    setLoading(true);
    setError(null);

    try {
      const me = await apiFetch<{ id: string; name: string }>('users/me', {
        method: 'GET',
        token,
      });
      setMyUserId(me.id);

      const data = await apiFetch<Message[]>(
        `direct/conversations/${conversationId}/messages`,
        {
          method: 'GET',
          token,
        },
      );

      setMessages(data.map(withDirectReactions));
      setHasMoreOlder(data.length >= 100);
await apiFetch(`direct/conversations/${conversationId}/seen`, {
  method: 'POST',
  token,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({}),
});    


} catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در دریافت پیام‌ها');
    } finally {
      setLoading(false);
    }
  }

  async function loadOlderMessages() {
    const token = getAccessToken();
    if (!token || !conversationId || messages.length === 0 || loadingOlder) return;

    const anchorId = messages[0].id;
    setLoadingOlder(true);
    setError(null);

    try {
      const older = await apiFetch<Message[]>(
        `direct/conversations/${conversationId}/messages?before=${encodeURIComponent(anchorId)}&limit=${DIRECT_OLDER_PAGE_SIZE}`,
        { method: 'GET', token },
      );

      if (older.length === 0) {
        setHasMoreOlder(false);
        return;
      }

      const yBefore =
        typeof document !== 'undefined'
          ? document.getElementById(`direct-msg-${anchorId}`)?.getBoundingClientRect().top
          : undefined;

      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const merged = [
          ...older.filter((m) => !seen.has(m.id)).map(withDirectReactions),
          ...prev,
        ];
        return merged;
      });

      if (older.length < DIRECT_OLDER_PAGE_SIZE) {
        setHasMoreOlder(false);
      }

      if (yBefore !== undefined) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const el = document.getElementById(`direct-msg-${anchorId}`);
            if (!el) return;
            const yAfter = el.getBoundingClientRect().top;
            window.scrollBy({ top: yAfter - yBefore, left: 0, behavior: 'auto' });
          });
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در بارگذاری پیام‌های قدیمی');
    } finally {
      setLoadingOlder(false);
    }
  }

  useEffect(() => {
    if (!conversationId) return;
    loadMessages();
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return;

    const markRead = () => {
      const token = getAccessToken();
      if (!token) return;
      void markDirectConversationRead(token, conversationId).catch(() => {});
    };

    markRead();

    const onVisibility = () => {
      if (document.visibilityState === 'visible') markRead();
    };

    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [conversationId]);

useEffect(() => {
  const token = getAccessToken();
  if (!token || !conversationId) return;

  setPeerPresence({ online: false, lastSeenAt: null });

  const socket = io(getApiBaseUrl().replace(/\/+$/, ''), {
    transports: ['websocket'],
    auth: { token },
  });

  socketRef.current = socket;

  const onDirectPresence = (payload: {
    conversationId: string;
    userId: string;
    online: boolean;
    lastSeenAt: string | null;
  }) => {
    if (payload.conversationId !== conversationId) return;
    if (myUserId && payload.userId === myUserId) return;
    setPeerPresence({
      online: payload.online,
      lastSeenAt: payload.lastSeenAt,
    });
  };

  socket.on('direct_presence', onDirectPresence);

  socket.on('connect', () => {
    socket.emit('join_direct', { conversationId });
  });

socket.on('direct_message', async (message: Message) => {
  if (message.conversationId !== conversationId) return;

  setMessages((prev) => {
    const exists = prev.some((m) => m.id === message.id);
    if (exists) return prev;
    return [...prev, withDirectReactions(message)];
  });

  // 👇 اینو اضافه کن (کلید حل مشکل)
  if (message.senderId !== myUserId) {
    try {
      await apiFetch(`direct/conversations/${conversationId}/seen`, {
        method: 'POST',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
    } catch (e) {
      console.error('seen error', e);
    }
  }
});
  socket.on(
    'direct_typing',
    (payload: { conversationId: string; userId: string; isTyping: boolean }) => {
      if (payload.conversationId !== conversationId) return;
      if (payload.userId === myUserId) return;

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

      if (payload.isTyping) {
        setOtherTyping(true);

        typingTimeoutRef.current = setTimeout(() => {
          setOtherTyping(false);
          typingTimeoutRef.current = null;
        }, 1500);
      } else {
        setOtherTyping(false);
      }
    },
  );
socket.on(
  'direct_message_delivered',
  (payload: {
    conversationId: string;
    updates: Array<{ id: string; deliveredAt: string | null; seenAt: string | null }>;
  }) => {
    if (payload.conversationId !== conversationId) return;

    setMessages((prev) =>
      prev.map((m) => {
        const update = payload.updates.find((u) => u.id === m.id);
        return update
          ? {
              ...m,
              deliveredAt: update.deliveredAt,
              seenAt: update.seenAt,
            }
          : m;
      }),
    );
  },
);

socket.on(
  'direct_message_seen',
  (payload: {
    conversationId: string;
    updates: Array<{ id: string; deliveredAt: string | null; seenAt: string | null }>;
  }) => {
    if (payload.conversationId !== conversationId) return;

    setMessages((prev) =>
      prev.map((m) => {
        const update = payload.updates.find((u) => u.id === m.id);
        return update
          ? {
              ...m,
              deliveredAt: update.deliveredAt,
              seenAt: update.seenAt,
            }
          : m;
      }),
    );
  },
);

socket.on(
  'direct_message_deleted',
  (payload: {
    conversationId: string;
    messageId: string;
    isDeleted: boolean;
    deletedAt: string | null;
    text: null;
    mediaId: null;
    media: null;
  }) => {
    if (payload.conversationId !== conversationId) return;

    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === payload.messageId) {
          return {
            ...m,
            isDeleted: payload.isDeleted,
            deletedAt: payload.deletedAt,
            text: null,
            mediaId: null,
            media: null,
            reactions: [],
          };
        }
        if (m.replyToMessage?.id === payload.messageId) {
          return {
            ...m,
            replyToMessage: m.replyToMessage
              ? {
                  ...m.replyToMessage,
                  isDeleted: payload.isDeleted,
                  deletedAt: payload.deletedAt,
                  text: null,
                  mediaId: null,
                  media: null,
                }
              : m.replyToMessage,
          };
        }
        return m;
      }),
    );
  },
);

socket.on(
  'direct_message_edited',
  (payload: {
    conversationId: string;
    messageId: string;
    text: string | null;
    editedAt: string | null;
  }) => {
    if (payload.conversationId !== conversationId) return;

    setMessages((prev) =>
      prev.map((m) => {
        if (m.id === payload.messageId) {
          return {
            ...m,
            text: payload.text,
            editedAt: payload.editedAt,
          };
        }
        if (m.replyToMessage?.id === payload.messageId) {
          return {
            ...m,
            replyToMessage: m.replyToMessage
              ? {
                  ...m.replyToMessage,
                  text: payload.text,
                  editedAt: payload.editedAt,
                }
              : m.replyToMessage,
          };
        }
        return m;
      }),
    );
  },
);

socket.on(
  'direct_message_updated',
  (payload: { conversationId: string; message: Message }) => {
    if (payload.conversationId !== conversationId) return;
    setMessages((prev) => prev.map((m) => (m.id === payload.message.id ? withDirectReactions(payload.message) : m)));
  },
);

  const onDirectReactions = (payload: {
    conversationId: string;
    messageId: string;
    reactions: DirectReactionSummary[];
  }) => {
    if (payload.conversationId !== conversationId) return;
    setMessages((prev) =>
      prev.map((m) => (m.id === payload.messageId ? { ...m, reactions: payload.reactions } : m)),
    );
  };
  socket.on('direct_message_reactions', onDirectReactions);

  return () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    socket.off('direct_presence', onDirectPresence);
    socket.off('direct_message_reactions', onDirectReactions);
    socket.off('direct_message_edited');
    socket.off('direct_message_deleted');
    socket.off('direct_message_updated');

    socket.emit('leave_direct', { conversationId });
socket.emit('direct_typing', {
  conversationId,
  isTyping: false,
});

    socket.disconnect();
    socketRef.current = null;
  };
}, [conversationId, myUserId]);
async function uploadSelectedFile(token: string): Promise<string | null> {
  if (!file) return null;

  const mime = file.type || '';
  const isVideo = mime.startsWith('video/');
  const isImage = mime.startsWith('image/');
  const isDoc =
    mime === 'application/pdf' ||
    mime === 'application/zip' ||
    mime === 'application/x-zip-compressed' ||
    mime === 'application/msword' ||
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  if (!isImage && !isVideo && !isDoc) {
    throw new Error('نوع فایل پشتیبانی نمی‌شود');
  }

  const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (file.size > maxBytes) {
    throw new Error(
      isVideo
        ? 'حجم ویدیو از 100MB بیشتر است. در نسخه فعلی فشرده‌سازی ویدیو انجام نمی‌شود.'
        : 'حجم تصویر از 20MB بیشتر است',
    );
  }

  const uploadFile = isImage ? await preprocessImageForUpload(file) : file;

  const form = new FormData();
  form.append('file', uploadFile);

  const uploadUrl = `${getApiBaseUrl().replace(/\/+$/, '')}/media/upload`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open('POST', uploadUrl);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const percent = Math.round((event.loaded / event.total) * 100);
      setUploadProgress(percent);
    };

    xhr.onload = () => {
      try {
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new Error('خطا در آپلود فایل'));
          return;
        }

        const data = JSON.parse(xhr.responseText) as {
          media?: { id: string };
        };

        resolve(data.media?.id ?? null);
      } catch {
        reject(new Error('پاسخ آپلود معتبر نیست'));
      }
    };

    xhr.onerror = () => {
      reject(new Error('خطا در ارتباط هنگام آپلود'));  };

    xhr.onabort = () => {
      reject(new Error('آپلود لغو شد'));
    };

    xhr.send(form);
  });
}

  async function onToggleReaction(messageId: string, emoji: string) {
    const token = getAccessToken();
    if (!token || !conversationId) return;
    setOpenActionsMessageId(null);
    setError(null);
    try {
      const data = await apiFetch<{ messageId: string; reactions: DirectReactionSummary[] }>(
        `direct/conversations/${conversationId}/messages/${messageId}/reactions/toggle`,
        {
          method: 'POST',
          token,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emoji }),
        },
      );
      setMessages((prev) =>
        prev.map((m) => (m.id === data.messageId ? { ...m, reactions: data.reactions } : m)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در واکنش');
    }
  }

  async function onDeleteMessage(messageId: string): Promise<boolean> {
    const token = getAccessToken();
    if (!token || !conversationId) return false;

    try {
      const updated = await apiFetch<Message>(
        `direct/conversations/${conversationId}/messages/${messageId}/delete`,
        {
          method: 'POST',
          token,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
      );

      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, ...updated } : m)));
      if (replyDraft?.id === messageId) setReplyDraft(null);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در حذف پیام');
      return false;
    }
  }

  function exitSelectionMode() {
    setSelectedMessageIds(new Set());
    setOpenActionsMessageId(null);
  }

  function toggleMessageInSelection(messageId: string) {
    setSelectedMessageIds((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  }

  function clearHoldTimer() {
    if (holdTimerRef.current != null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    holdGestureRef.current = null;
  }

  async function forwardSelectedMessages() {
    const ids = new Set(selectedMessageIds);
    if (ids.size === 0) return;
    const ordered = messagesRef.current.filter((m) => ids.has(m.id));
    const lines = ordered.map((m) =>
      m.isDeleted ? '[حذف شده]' : replySnippetForMessage(m),
    );
    const text = lines.join('\n');
    if (!text.trim()) return;

    setForwardBusy(true);
    setError(null);
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          await navigator.share({ text });
          return;
        } catch (e) {
          if ((e as Error).name === 'AbortError') return;
        }
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        setError('اشتراک‌گذاری در این مرورگر در دسترس نیست');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در فوروارد');
    } finally {
      setForwardBusy(false);
    }
  }

  async function copySelectedMessages() {
    if (!canCopySelection) return;
    const ids = new Set(selectedMessageIds);
    const ordered = messagesRef.current.filter((m) => ids.has(m.id));
    if (!ordered.every(isPureTextMessage)) return;
    const text = ordered.map((m) => (m.text ?? '').trim()).join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در کپی');
    }
  }

  async function bulkDeleteSelectedMessages() {
    const ids = [...selectedMessageIds];
    if (ids.length === 0) return;
    setBulkDeleting(true);
    setError(null);
    try {
      for (const id of ids) {
        const msg = messagesRef.current.find((m) => m.id === id);
        if (!msg || msg.isDeleted || msg.pending) continue;
        const ok = await onDeleteMessage(id);
        if (!ok) return;
      }
      exitSelectionMode();
    } finally {
      setBulkDeleting(false);
    }
  }

  async function onVotePoll(messageId: string, optionIndex: number) {
    const token = getAccessToken();
    if (!token || !conversationId) return;
    try {
      const updated = await apiFetch<Message>(
        `direct/conversations/${conversationId}/messages/${messageId}/poll/vote`,
        {
          method: 'POST',
          token,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ optionIndex }),
        },
      );
      setMessages((prev) => prev.map((m) => (m.id === updated.id ? withDirectReactions(updated) : m)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در رای‌گیری');
    }
  }

  async function sendStructuredMessage(
    messageType: 'LOCATION' | 'CONTACT' | 'POLL' | 'EVENT',
    metadata: Record<string, unknown>,
    textOverride?: string,
  ) {
    const token = getAccessToken();
    if (!token || !conversationId) return;
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      await apiFetch<Message>(`direct/conversations/${conversationId}/messages`, {
        method: 'POST',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageType,
          metadata,
          text: textOverride?.trim() || undefined,
          ...(replyDraft ? { replyToMessageId: replyDraft.id } : {}),
        }),
      });
      setReplyDraft(null);
      scrollThreadEnd('auto');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در ارسال');
    } finally {
      setSending(false);
    }
  }

  async function onSend(e: FormEvent) {
    e.preventDefault();
    if (isSelectionMode) return;
    const token = getAccessToken();
    if (!token) return;

    const trimmed = text.trim();

    if (editMode && editingMessageId) {
      if (!trimmed) return;

      setSending(true);
      setError(null);
      try {
        const updated = await apiFetch<Message>(
          `direct/conversations/${conversationId}/messages/${editingMessageId}`,
          {
            method: 'PATCH',
            token,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: trimmed }),
          },
        );

        setMessages((prev) =>
          prev.map((m) => (m.id === editingMessageId ? { ...m, ...updated } : m)),
        );
        setEditMode(false);
        setEditingMessageId(null);
        setText('');
        socketRef.current?.emit('direct_typing', {
          conversationId,
          isTyping: false,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'خطا در ویرایش پیام');
      } finally {
        setSending(false);
      }
      return;
    }

    if (!trimmed && !file) return;

    setSending(true);
    setError(null);
    setUploadProgress(file ? 0 : null);

    try {
      let mediaId: string | null = null;
      mediaId = await uploadSelectedFile(token);

      await apiFetch<Message>(`direct/conversations/${conversationId}/messages`, {
        method: 'POST',
        token,
        headers: { 'Content-Type': 'application/json' },
        // Keep direct payload shape backward compatible and only add messageType when needed.
        body: JSON.stringify({
          text: trimmed || undefined,
          mediaId: mediaId || undefined,
          ...(mediaId
            ? {
                messageType: file?.type?.startsWith('video/')
                  ? 'MEDIA'
                  : file?.type?.startsWith('image/')
                    ? 'MEDIA'
                    : 'DOCUMENT',
              }
            : {}),
          ...(replyDraft ? { replyToMessageId: replyDraft.id } : {}),
        }),
      });

      setText('');
      setFile(null);
      setPreviewUrl(null);
      clearVoiceDraft();
      setReplyDraft(null);
      scrollThreadEnd('auto');
socketRef.current?.emit('direct_typing', {
  conversationId,
  isTyping: false,
});    
} catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در ارسال پیام');
    } finally {
      setSending(false);
      setUploadProgress(null);
    
    }
  }

  return (
    <AuthGate>
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col bg-stone-100">
        <header
          className="sticky top-0 z-30 border-b border-stone-200/90 bg-[#f8f8f8] shadow-[0_1px_0_rgba(0,0,0,0.04)] backdrop-blur-md"
          dir="rtl"
        >
          {isSelectionMode ? (
            <div className="space-y-2 px-3 py-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={exitSelectionMode}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100 active:bg-slate-200"
                  aria-label="لغو انتخاب"
                >
                  <span className="text-xl font-semibold leading-none text-slate-800" aria-hidden>
                    ›
                  </span>
                </button>
                <div className="min-w-0 flex-1 text-center">
                  <div className="text-[15px] font-bold text-stone-900">
                    {selectedMessageIds.size} انتخاب‌شده
                  </div>
                </div>
                <div className="h-10 w-10 shrink-0" aria-hidden />
              </div>
              <div className="flex flex-wrap items-center justify-center gap-1.5 pb-0.5">
                <button
                  type="button"
                  disabled={forwardBusy || selectedMessageIds.size === 0}
                  onClick={() => void forwardSelectedMessages()}
                  className="rounded-full bg-slate-900 px-3 py-2 text-[11px] font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  فوروارد
                </button>
                <button
                  type="button"
                  disabled={bulkDeleting || selectedMessageIds.size === 0}
                  onClick={() => void bulkDeleteSelectedMessages()}
                  className="rounded-full border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  حذف برای من
                </button>
                <button
                  type="button"
                  disabled={!canCopySelection}
                  onClick={() => void copySelectedMessages()}
                  className="rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  کپی
                </button>
                <button
                  type="button"
                  onClick={exitSelectionMode}
                  className="rounded-full border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  لغو
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 px-3 py-2">
              <Link
                href="/direct"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100 active:bg-slate-200"
                aria-label="بازگشت"
              >
                <span className="text-xl font-semibold leading-none text-slate-800" aria-hidden>
                  ›
                </span>
              </Link>

              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-stone-200 ring-2 ring-white">
                {peerDisplay.avatar ? (
                  <img
                    src={peerDisplay.avatar}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-sm font-bold text-slate-600">
                    {peerInitial}
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1 text-right">
                <h1 className="truncate text-[16px] font-bold leading-tight text-stone-900">
                  {peerDisplay.name}
                </h1>
                <p className={`mt-0.5 truncate text-[11px] ${headerStatusLine.className}`}>
                  {headerStatusLine.text}
                </p>
              </div>

              <button
                type="button"
                title="رفرش پیام‌ها"
                onClick={() => {
                  forceScrollAfterLoadRef.current = true;
                  void loadMessages();
                }}
                disabled={loading}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
              >
                <span className={`text-lg ${loading ? 'animate-pulse' : ''}`} aria-hidden>
                  ↻
                </span>
              </button>
            </div>
          )}
        </header>

        {error ? (
          <div className="px-3 pt-3">
            <Card>
              <div className="text-sm font-semibold text-red-600">{error}</div>
            </Card>
          </div>
        ) : null}

        <div className="flex-1 space-y-2 px-2.5 py-2 sm:px-3">
          {loading ? (
            <Card>
              <div className="text-sm text-slate-700">در حال دریافت پیام‌ها...</div>
            </Card>
          ) : messages.length === 0 ? (
            <Card>
              <div className="text-sm text-slate-700">هنوز پیامی در این گفتگو نیست.</div>
            </Card>
          ) : (
            <>
              {hasMoreOlder && messages.length > 0 ? (
                <div className="flex justify-center pb-2" dir="rtl">
                  <button
                    type="button"
                    disabled={loadingOlder}
                    onClick={() => void loadOlderMessages()}
                    className="rounded-full border border-slate-200/90 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loadingOlder ? 'در حال بارگذاری…' : 'پیام‌های قدیمی‌تر'}
                  </button>
                </div>
              ) : null}
              {messages.map((msg) => {
                const mine = msg.senderId === myUserId;
                const deleted = !!msg.isDeleted;
                const media = deleted ? null : msg.media;
                const timeShort = new Date(msg.createdAt).toLocaleTimeString('fa-IR', {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                const rowSelected = selectedMessageIds.has(msg.id);

                return (
                  <div
                    key={msg.id}
                    id={`direct-msg-${msg.id}`}
                    className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                    onContextMenu={(e) => {
                      const t = e.target;
                      if (t instanceof Element && t.closest('a[href], [data-direct-msg-actions]')) return;
                      e.preventDefault();
                    }}
                    onPointerDown={(e) => {
                      if (e.button !== 0) return;
                      if (editMode || isSelectionMode) return;
                      const t = e.target as HTMLElement;
                      if (
                        t.closest(
                          'button, a, [role="menu"], video, audio, textarea, input, [data-direct-msg-actions]',
                        )
                      ) {
                        return;
                      }
                      clearHoldTimer();
                      holdGestureRef.current = { x: e.clientX, y: e.clientY };
                      holdTimerRef.current = window.setTimeout(() => {
                        holdTimerRef.current = null;
                        holdGestureRef.current = null;
                        skipNextRowClickRef.current = true;
                        setSelectedMessageIds(new Set([msg.id]));
                        setOpenActionsMessageId(null);
                      }, 480);
                    }}
                    onPointerMove={(e) => {
                      if (holdTimerRef.current == null || !holdGestureRef.current) return;
                      const dx = e.clientX - holdGestureRef.current.x;
                      const dy = e.clientY - holdGestureRef.current.y;
                      if (dx * dx + dy * dy > 144) clearHoldTimer();
                    }}
                    onPointerUp={clearHoldTimer}
                    onPointerCancel={clearHoldTimer}
                    onPointerLeave={(e) => {
                      if (e.pointerType === 'mouse') clearHoldTimer();
                    }}
                    onClick={(e) => {
                      if (skipNextRowClickRef.current) {
                        skipNextRowClickRef.current = false;
                        return;
                      }
                      if (!isSelectionMode) return;
                      const el = e.target as HTMLElement;
                      if (
                        el.closest(
                          'button, a, [role="menu"], video, audio, textarea, input, [data-direct-msg-actions]',
                        )
                      ) {
                        return;
                      }
                      toggleMessageInSelection(msg.id);
                    }}
                  >
                    <div
                      className={`relative max-w-[88%] rounded-[1.15rem] px-3.5 py-2.5 shadow-sm ${
                        deleted
                          ? mine
                            ? rowSelected
                              ? 'bg-slate-800/75 text-white/85 ring-2 ring-sky-400 ring-offset-2 ring-offset-stone-100'
                              : 'bg-slate-800/75 text-white/85 ring-1 ring-white/10'
                            : rowSelected
                              ? 'bg-slate-200/60 text-slate-600 ring-2 ring-sky-500 ring-offset-2 ring-offset-stone-100'
                              : 'bg-slate-200/60 text-slate-600 ring-1 ring-slate-300/50'
                          : mine
                            ? rowSelected
                              ? 'bg-slate-900 text-white ring-2 ring-sky-400 ring-offset-2 ring-offset-stone-100'
                              : 'bg-slate-900 text-white ring-1 ring-slate-800/40'
                            : rowSelected
                              ? 'bg-white text-slate-900 ring-2 ring-sky-500 ring-offset-2 ring-offset-stone-100'
                              : 'bg-white text-slate-900 ring-1 ring-slate-200/80'
                      }`}
                    >
                      <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px]">
                        <span
                          className={`min-w-0 truncate font-medium ${
                            mine ? 'text-white/75' : 'text-slate-500'
                          }`}
                        >
                          {msg.sender.name}
                        </span>
                        {!msg.isDeleted && !isSelectionMode ? (
                          <div className="relative shrink-0" data-direct-msg-actions>
                            <button
                              type="button"
                              aria-haspopup="menu"
                              aria-expanded={openActionsMessageId === msg.id}
                              aria-label="اقدامات پیام"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenActionsMessageId((id) => (id === msg.id ? null : msg.id));
                              }}
                              className={`flex h-9 min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-lg leading-none transition ${
                                mine
                                  ? 'text-white/80 hover:bg-white/15 active:bg-white/20'
                                  : 'text-slate-500 hover:bg-slate-100 active:bg-slate-200'
                              }`}
                            >
                              <span className="select-none" aria-hidden>
                                ⋮
                              </span>
                            </button>
                            {openActionsMessageId === msg.id ? (
                              <div
                                role="menu"
                                className="absolute right-0 top-full z-40 mt-1 min-w-[10.5rem] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-slate-200/90 bg-white py-1 shadow-lg ring-1 ring-slate-900/5"
                                dir="rtl"
                              >
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="flex w-full px-4 py-3 text-right text-sm font-medium text-slate-800 transition hover:bg-slate-100 active:bg-slate-200"
                                  onClick={() => {
                                    setReplyDraft({
                                      id: msg.id,
                                      senderName: msg.sender.name,
                                      preview: replySnippetForMessage(msg),
                                    });
                                    setOpenActionsMessageId(null);
                                  }}
                                >
                                  پاسخ
                                </button>
                                <div className="border-t border-slate-100 px-1 py-2">
                                  <div className="px-3 pb-1 text-[10px] font-semibold text-slate-500">
                                    واکنش
                                  </div>
                                  <div className="flex flex-wrap justify-center gap-0.5 px-1" dir="ltr">
                                    {DIRECT_REACTION_EMOJIS.map((e) => (
                                      <button
                                        key={e}
                                        type="button"
                                        role="menuitem"
                                        className="flex h-10 min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-xl transition hover:bg-slate-100 active:scale-95 active:bg-slate-200"
                                        onClick={() => void onToggleReaction(msg.id, e)}
                                      >
                                        {e}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                {mine ? (
                                  <>
                                    <button
                                      type="button"
                                      role="menuitem"
                                      className="flex w-full px-4 py-3 text-right text-sm font-medium text-slate-800 transition hover:bg-slate-100 active:bg-slate-200"
                                      onClick={() => {
                                        setEditMode(true);
                                        setEditingMessageId(msg.id);
                                        setText(msg.text ?? '');
                                        setReplyDraft(null);
                                        setFile(null);
                                        setPreviewUrl(null);
                                        clearVoiceDraft();
                                        setOpenActionsMessageId(null);
                                      }}
                                    >
                                      ویرایش
                                    </button>
                                    {!deleted ? (
                                      <button
                                        type="button"
                                        role="menuitem"
                                        className="flex w-full px-4 py-3 text-right text-sm font-medium text-red-600 transition hover:bg-red-50 active:bg-red-100"
                                        onClick={() => {
                                          setOpenActionsMessageId(null);
                                          void onDeleteMessage(msg.id);
                                        }}
                                      >
                                        حذف
                                      </button>
                                    ) : null}
                                  </>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>

                      {msg.replyToMessage ? (
                        <ReplyQuoteBlock reply={msg.replyToMessage} mine={mine} />
                      ) : null}

                      {media ? (
                        isVoiceMedia(media) ? (
                          <DirectVoiceBubble
                            media={media}
                            mine={mine}
                            messageId={msg.id}
                            playingMessageId={playingMessageId}
                            setPlayingMessageId={setPlayingMessageId}
                          />
                        ) : media.type === 'VIDEO' || media.mimeType?.startsWith('video/') ? (
                          <video
                            src={media.url}
                            controls
                            className="mb-2 max-h-72 w-full rounded-xl bg-black shadow-inner"
                          />
                        ) : media.mimeType?.startsWith('image/') ? (
                          <img
                            src={media.url}
                            alt={media.originalName || 'message media'}
                            className="mb-2 max-h-72 w-full rounded-xl bg-white object-contain shadow-inner"
                          />
                        ) : (
                          <a
                            href={media.url}
                            target="_blank"
                            rel="noreferrer"
                            className="mb-2 block rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700"
                          >
                            📄 {media.originalName || 'Document'}
                          </a>
                        )
                      ) : null}

                      {deleted ? (
                        <div className="text-sm font-medium italic opacity-80">
                          این پیام حذف شده است
                        </div>
                      ) : msg.messageType === 'LOCATION' && msg.metadata ? (
                        <div className="mt-1 rounded-xl border border-sky-200/80 bg-sky-50 p-2 text-xs text-sky-900">
                          <div>📍 لوکیشن</div>
                          <div className="mt-1 opacity-80">
                            {typeof msg.metadata.label === 'string' ? msg.metadata.label : ''}
                          </div>
                          {typeof msg.metadata.lat === 'number' && typeof msg.metadata.lng === 'number' ? (
                            <a
                              href={`https://maps.google.com/?q=${msg.metadata.lat},${msg.metadata.lng}`}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1 inline-block text-[11px] font-semibold text-sky-700 underline"
                            >
                              باز کردن در نقشه
                            </a>
                          ) : null}
                        </div>
                      ) : msg.messageType === 'CONTACT' && msg.metadata ? (
                        <div className="mt-1 rounded-xl border border-violet-200/80 bg-violet-50 p-2 text-xs text-violet-900">
                          <div>👤 {String(msg.metadata.name ?? 'Contact')}</div>
                          {msg.metadata.phone ? <div className="mt-1 opacity-80">{String(msg.metadata.phone)}</div> : null}
                        </div>
                      ) : msg.messageType === 'EVENT' && msg.metadata ? (
                        <div className="mt-1 rounded-xl border border-amber-200/80 bg-amber-50 p-2 text-xs text-amber-900">
                          <div>📅 {String(msg.metadata.title ?? 'Event')}</div>
                          <div className="mt-1">{String(msg.metadata.dateTime ?? '')}</div>
                          {msg.metadata.location ? <div className="mt-1 opacity-80">{String(msg.metadata.location)}</div> : null}
                        </div>
                      ) : msg.messageType === 'POLL' && msg.metadata ? (
                        <div className="mt-1 rounded-xl border border-emerald-200/80 bg-emerald-50 p-2 text-xs text-emerald-900">
                          <div className="font-semibold">🗳️ {String(msg.metadata.question ?? 'Poll')}</div>
                          <div className="mt-2 space-y-1">
                            {(Array.isArray(msg.metadata.options) ? msg.metadata.options : []).map((o, idx) => {
                              const row = (o ?? {}) as Record<string, unknown>;
                              return (
                                <button
                                  key={`${msg.id}-poll-${idx}`}
                                  type="button"
                                  onClick={() => void onVotePoll(msg.id, idx)}
                                  className="flex w-full items-center justify-between rounded-lg border border-emerald-200 bg-white px-2 py-1 text-start transition hover:bg-emerald-100"
                                >
                                  <span>{String(row.label ?? `گزینه ${idx + 1}`)}</span>
                                  <span className="text-[10px] opacity-70">{Number(row.votes ?? 0)}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : msg.text ? (
                        <div className="whitespace-pre-wrap text-[15px] leading-relaxed">{msg.text}</div>
                      ) : null}

                      <div
                        className={`mt-2 flex flex-wrap items-center justify-end gap-x-2 gap-y-0.5 text-[10px] leading-none ${
                          deleted
                            ? mine
                              ? 'text-white/45'
                              : 'text-slate-500'
                            : mine
                              ? 'text-white/50'
                              : 'text-slate-400'
                        }`}
                        dir="rtl"
                      >
                        <span className="tabular-nums">{timeShort}</span>
                        {msg.editedAt ? (
                          <span className="opacity-80">ویرایش شده</span>
                        ) : null}
                        {renderMessageStatus(msg, mine)}
                      </div>

                      {!deleted && (msg.reactions?.length ?? 0) > 0 ? (
                        <div className="mt-1.5 flex flex-wrap gap-1" dir="ltr">
                          {(msg.reactions ?? []).map((r) => {
                            const self = myUserId != null && r.userIds.includes(myUserId);
                            return (
                              <button
                                key={r.emoji}
                                type="button"
                                title={self ? 'حذف واکنش' : 'واکنش'}
                                onClick={() => void onToggleReaction(msg.id, r.emoji)}
                                className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[13px] leading-none transition active:scale-95 ${
                                  mine
                                    ? self
                                      ? 'bg-white/25 text-white ring-1 ring-white/40'
                                      : 'bg-white/12 text-white/90'
                                    : self
                                      ? 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200'
                                      : 'bg-slate-100/90 text-slate-700 ring-1 ring-slate-200/80'
                                }`}
                              >
                                <span>{r.emoji}</span>
                                {r.userIds.length > 1 ? (
                                  <span className="text-[10px] font-bold tabular-nums opacity-90">
                                    {r.userIds.length}
                                  </span>
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}

            </>
          )}
        </div>

        <div className="sticky bottom-0 z-20 border-t border-stone-200/90 bg-[#f6f6f6]/98 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-2px_12px_rgba(0,0,0,0.05)] backdrop-blur-md">
          <form onSubmit={onSend} className="space-y-2.5" dir="rtl">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              disabled={sending || editMode || voicePhase !== 'idle' || isSelectionMode}
              className="sr-only"
              onChange={(e) => {
                clearVoiceDraft();
                handleFileSelection(e.target.files?.[0] ?? null);
              }}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*,video/*"
              capture="environment"
              disabled={sending || editMode || voicePhase !== 'idle' || isSelectionMode}
              className="sr-only"
              onChange={(e) => {
                clearVoiceDraft();
                handleFileSelection(e.target.files?.[0] ?? null);
              }}
            />
            <input
              ref={documentInputRef}
              type="file"
              accept=".pdf,.zip,.doc,.docx,application/pdf,application/zip,application/x-zip-compressed,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              disabled={sending || editMode || voicePhase !== 'idle' || isSelectionMode}
              className="sr-only"
              onChange={(e) => {
                clearVoiceDraft();
                handleFileSelection(e.target.files?.[0] ?? null);
              }}
            />

            {editMode && editingMessageId ? (
              <div className="flex items-start gap-2 rounded-2xl border border-amber-200/90 bg-amber-50/95 px-3 py-2.5 shadow-sm ring-1 ring-amber-100">
                <div className="min-w-0 flex-1 text-right">
                  <div className="text-[11px] font-bold text-amber-900">ویرایش پیام</div>
                  <div className="mt-0.5 truncate text-xs text-amber-800/90">
                    متن را اصلاح کنید و ذخیره را بزنید.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="shrink-0 rounded-xl border border-amber-300/80 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 shadow-sm transition hover:bg-amber-50"
                >
                  لغو ویرایش
                </button>
              </div>
            ) : replyDraft ? (
              <div className="flex items-start gap-2 rounded-2xl border border-slate-200/90 bg-slate-50 px-3 py-2.5 shadow-sm ring-1 ring-slate-200/60">
                <div className="min-w-0 flex-1 text-right">
                  <div className="text-[10px] font-bold text-sky-600">پاسخ به {replyDraft.senderName}</div>
                  <div className="mt-0.5 truncate text-sm text-slate-800">{replyDraft.preview}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyDraft(null)}
                  className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
                >
                  لغو
                </button>
              </div>
            ) : null}

            {attachmentSheetOpen ? (
              <div className="grid grid-cols-4 gap-2 rounded-2xl border border-slate-200/90 bg-white p-2 shadow-sm">
                {[
                  { key: 'photos', label: 'Photos' },
                  { key: 'camera', label: 'Camera' },
                  { key: 'location', label: 'Location' },
                  { key: 'contact', label: 'Contact' },
                  { key: 'document', label: 'Document' },
                  { key: 'poll', label: 'Poll' },
                  { key: 'event', label: 'Event' },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    disabled={sending || editMode || isSelectionMode}
                    className="rounded-xl border border-slate-200 px-2 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
                    onClick={async () => {
                      setAttachmentSheetOpen(false);
                      if (item.key === 'photos') {
                        fileInputRef.current?.click();
                        return;
                      }
                      if (item.key === 'camera') {
                        cameraInputRef.current?.click();
                        return;
                      }
                      if (item.key === 'document') {
                        documentInputRef.current?.click();
                        return;
                      }
                      if (item.key === 'location') {
                        try {
                          const md = await createLocationMetadata();
                          await sendStructuredMessage('LOCATION', md);
                        } catch (e) {
                          setError(e instanceof Error ? e.message : 'خطا در دریافت مکان');
                        }
                        return;
                      }
                      if (item.key === 'contact') {
                        const name = window.prompt('نام مخاطب:')?.trim() ?? '';
                        if (!name) return;
                        const phone = window.prompt('شماره تماس (اختیاری):')?.trim() ?? '';
                        await sendStructuredMessage('CONTACT', { name, ...(phone ? { phone } : {}) });
                        return;
                      }
                      if (item.key === 'poll') {
                        const question = window.prompt('سوال نظرسنجی:')?.trim() ?? '';
                        if (!question) return;
                        const raw = window
                          .prompt('گزینه‌ها را با | جدا کنید (حداقل 2 گزینه):')
                          ?.split('|')
                          .map((x) => x.trim())
                          .filter(Boolean);
                        if (!raw || raw.length < 2) {
                          setError('حداقل دو گزینه لازم است');
                          return;
                        }
                        await sendStructuredMessage('POLL', { question, options: raw.slice(0, 8) });
                        return;
                      }
                      if (item.key === 'event') {
                        const title = window.prompt('عنوان رویداد:')?.trim() ?? '';
                        if (!title) return;
                        const dateTime = window.prompt('تاریخ/زمان (مثلا 2026-05-15 18:00):')?.trim() ?? '';
                        if (!dateTime) return;
                        const location = window.prompt('مکان (اختیاری):')?.trim() ?? '';
                        const description = window.prompt('توضیح (اختیاری):')?.trim() ?? '';
                        await sendStructuredMessage('EVENT', {
                          title,
                          dateTime,
                          ...(location ? { location } : {}),
                          ...(description ? { description } : {}),
                        });
                      }
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="flex items-end gap-2">
              <button
                type="button"
                disabled={sending || editMode || isSelectionMode}
                title="Attachment"
                onClick={() => setAttachmentSheetOpen((v) => !v)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200/90 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="text-xl font-bold leading-none">+</span>
              </button>

              {editMode ? null : voicePhase === 'recording' ? (
                <div
                  className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-2xl border border-red-200/90 bg-red-50 px-3 py-2 shadow-sm"
                  dir="rtl"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5 shrink-0">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                    </span>
                    <span className="text-xs font-semibold text-red-800">در حال ضبط</span>
                    <span className="tabular-nums text-xs text-red-700">
                      {formatVoiceClock(recordElapsedMs)}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => cancelVoiceRecording()}
                      className="rounded-xl border border-red-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-red-700 shadow-sm transition hover:bg-red-50"
                    >
                      لغو
                    </button>
                    <button
                      type="button"
                      onClick={() => stopVoiceRecording()}
                      className="rounded-xl bg-red-600 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-red-700"
                    >
                      توقف
                    </button>
                  </div>
                </div>
              ) : voicePhase === 'sending' ? (
                <div
                  className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-2xl border border-emerald-200/90 bg-emerald-50 px-3 py-2 shadow-sm"
                  dir="rtl"
                >
                  <div className="text-xs font-semibold text-emerald-800">در حال ارسال پیام صوتی…</div>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-300 border-t-emerald-700" />
                </div>
              ) : (
                <button
                  type="button"
                  disabled={sending || !!file || voicePhase !== 'idle' || isSelectionMode}
                  title="پیام صوتی"
                  onClick={() => void startVoiceRecording()}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200/90 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden
                  >
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z" />
                  </svg>
                </button>
              )}

              <button
                type="button"
                disabled={sending || editMode || voicePhase !== 'idle' || isSelectionMode}
                title="Camera"
                onClick={() => cameraInputRef.current?.click()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200/90 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="text-lg" aria-hidden>
                  📷
                </span>
              </button>

              <textarea
                value={text}
                onCompositionStart={() => {
                  isComposingRef.current = true;
                }}
                onCompositionEnd={() => {
                  isComposingRef.current = false;
                }}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return;
                  if (e.shiftKey) return;
                  const native = e.nativeEvent as KeyboardEvent;
                  if (isComposingRef.current || native.isComposing || native.keyCode === 229) return;
                  const trimmed = text.trim();
                  if (
                    !trimmed ||
                    sending ||
                    editMode ||
                    isSelectionMode ||
                    voicePhase === 'recording' ||
                    voicePhase === 'sending'
                  ) {
                    e.preventDefault();
                    return;
                  }
                  e.preventDefault();
                  const form = e.currentTarget.closest('form');
                  if (form) {
                    form.requestSubmit();
                  }
                }}
                onChange={(e) => {
                  const value = e.target.value;
                  setText(value);

                  socketRef.current?.emit('direct_typing', {
                    conversationId,
                    isTyping: value.trim().length > 0,
                  });
                }}
                onBlur={() => {
                  socketRef.current?.emit('direct_typing', {
                    conversationId,
                    isTyping: false,
                  });
                }}
                placeholder="پیام…"
                rows={1}
                disabled={sending || voicePhase === 'recording' || isSelectionMode}
                className="min-h-[2.75rem] max-h-32 min-w-0 flex-1 resize-none rounded-2xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-[15px] leading-normal text-slate-900 shadow-sm outline-none ring-0 transition placeholder:text-slate-400 focus:border-sky-400/60 focus:ring-2 focus:ring-sky-100"
              />

              <button
                type="submit"
                disabled={
                  sending || voicePhase === 'recording' || voicePhase === 'sending' || isSelectionMode
                }
                className="inline-flex h-11 min-w-[4.5rem] shrink-0 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? (
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                    aria-label={editMode ? 'در حال ذخیره' : 'در حال ارسال'}
                  />
                ) : (
                  <span>{editMode ? 'ذخیره' : 'ارسال'}</span>
                )}
              </button>
            </div>

            {voicePhase === 'failed' && voiceBlob ? (
              <div className="space-y-2 rounded-2xl border border-red-200/90 bg-red-50/80 px-3 py-2.5 shadow-sm ring-1 ring-red-100/80">
                <div className="text-[11px] font-bold text-red-800">ارسال پیام صوتی ناموفق بود</div>
                {voicePreviewUrl ? (
                  <audio
                    src={voicePreviewUrl}
                    controls
                    preload="metadata"
                    className="w-full rounded-xl bg-white"
                  />
                ) : null}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void autoSendVoiceMessage(voiceBlob, voiceMime, voiceDurationMs).catch((e) => {
                      setError(e instanceof Error ? e.message : 'خطا در ارسال پیام صوتی');
                    })}
                    className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700"
                  >
                    تلاش دوباره
                  </button>
                  <button
                    type="button"
                    onClick={() => clearVoiceDraft()}
                    className="rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 shadow-sm transition hover:bg-red-50"
                  >
                    حذف ضبط
                  </button>
                </div>
              </div>
            ) : null}

            {file ? (
              <div className="space-y-3">
                <div className="text-xs text-slate-600">
                  فایل انتخاب شده: <span className="font-semibold">{file.name}</span>
                </div>

                {previewUrl ? (
                  file.type.startsWith('video/') ? (
                    <video
                      src={previewUrl}
                      controls
                      className="max-h-72 w-full rounded-2xl border border-slate-200 bg-black"
                    />
                  ) : (
                    <img
                      src={previewUrl}
                      alt={file.name}
                      className="max-h-72 w-full rounded-2xl border border-slate-200 bg-white object-contain"
                    />
                  )
                ) : null}

                <button
                  type="button"
                  onClick={clearSelectedFile}
                  className="rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-600"
                >
                  حذف فایل انتخاب‌شده
                </button>
              </div>
            ) : null}

{uploadProgress !== null ? (
  <div className="space-y-2">
    <div className="text-xs font-semibold text-slate-700">
      در حال آپلود: {uploadProgress}%
    </div>
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
      <div
        className="h-full rounded-full bg-slate-900 transition-all"
        style={{ width: `${uploadProgress}%` }}
      />
    </div>
  </div>
) : null}

            </form>
        </div>
        <div ref={threadEndRef} className="h-px w-full shrink-0" aria-hidden />
      </main>
    </AuthGate>
  );
}


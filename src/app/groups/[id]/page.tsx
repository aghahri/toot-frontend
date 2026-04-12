'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  FormEvent,
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { io } from 'socket.io-client';
import { AuthGate } from '@/components/AuthGate';
import { getAccessToken } from '@/lib/auth';
import { apiFetch, getApiBaseUrl, getErrorMessageFromResponse } from '@/lib/api';
import { markGroupConversationRead } from '@/lib/mark-group-read';
import { DIRECT_REACTION_EMOJIS } from '@/lib/direct-reactions';
import { clearGroupDraft, getGroupDraft, setGroupDraft } from '@/lib/group-drafts';
import { ReplyQuoteBlock, groupReplyToModel } from '@/components/chat/ReplyQuoteBlock';
import { VoiceMessageBubble } from '@/components/chat/VoiceMessageBubble';
import { ForwardPickerSheet } from '@/components/chat/ForwardPickerSheet';
import { loadForwardPickTargets, type ForwardPickTarget } from '@/lib/chat-forward';
import { isVoiceMedia, formatVoiceClock } from '@/lib/chat-media';
import { calendarDayKey, dayDividerLabelFa } from '@/lib/chat-dates';
import { formatFileSize } from '@/lib/format-file-size';
import { Card } from '@/components/ui/Card';

const PAGE_SIZE = 40;
const MAX_VOICE_RECORD_SEC = 120;
const MIN_VOICE_RECORD_MS = 600;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

type ReplyTo = {
  id: string;
  senderId: string;
  content: string | null;
  createdAt: string;
  deletedAt?: string | null;
  isEdited: boolean;
  sender: { id: string; name: string; avatar: string | null } | null;
};

type GroupMessage = {
  id: string;
  groupId: string;
  senderId: string;
  content: string | null;
  deletedAt?: string | null;
  isEdited?: boolean;
  createdAt: string;
  sender: { id: string; name: string; avatar: string | null };
  media: {
    id: string;
    type: string;
    url: string;
    mimeType: string;
    originalName: string | null;
    size?: number;
    durationMs?: number | null;
  } | null;
  replyTo: ReplyTo | null;
  reactions: { emoji: string; count: number; reactedByMe: boolean }[];
};

function isPureTextGroupMessage(m: GroupMessage): boolean {
  if (m.deletedAt) return false;
  if (m.media) return false;
  return !!m.content?.trim();
}

function replySnippetGroup(msg: GroupMessage): string {
  if (msg.deletedAt) return 'این پیام حذف شده است';
  const t = msg.content?.trim();
  if (t) return t.length > 100 ? `${t.slice(0, 100)}…` : t;
  if (msg.media && isVoiceMedia(msg.media)) return 'پیام صوتی';
  if (msg.media) return 'رسانه';
  return 'پیام';
}

export default function GroupThreadPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = typeof params?.id === 'string' ? params.id : '';

  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('');
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<GroupMessage | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [lastReadMessageId, setLastReadMessageId] = useState<string | null>(null);
  const [pinned, setPinned] = useState<GroupMessage | null>(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchHits, setSearchHits] = useState<GroupMessage[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchHighlightIndex, setSearchHighlightIndex] = useState(0);
  const [attachmentSheetOpen, setAttachmentSheetOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  type VoicePhase = 'idle' | 'recording' | 'sending' | 'failed';
  const [voicePhase, setVoicePhase] = useState<VoicePhase>('idle');
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [voiceMime, setVoiceMime] = useState('');
  const [voicePreviewUrl, setVoicePreviewUrl] = useState<string | null>(null);
  const [voiceDurationMs, setVoiceDurationMs] = useState(0);
  const [recordElapsedMs, setRecordElapsedMs] = useState(0);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(() => new Set());
  const isSelectionMode = selectedMessageIds.size > 0;
  const [openActionsMessageId, setOpenActionsMessageId] = useState<string | null>(null);
  const [forwardPickerOpen, setForwardPickerOpen] = useState(false);
  const [forwardPickLoading, setForwardPickLoading] = useState(false);
  const [forwardPickError, setForwardPickError] = useState<string | null>(null);
  const [forwardPickItems, setForwardPickItems] = useState<ForwardPickTarget[]>([]);
  const [forwardPickSubmitting, setForwardPickSubmitting] = useState(false);
  const [pinSubmitting, setPinSubmitting] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [flashMessageId, setFlashMessageId] = useState<string | null>(null);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);

  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const typingTimerRef = useRef<number | null>(null);
  const draftTimerRef = useRef<number | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const documentInputRef = useRef<HTMLInputElement | null>(null);
  const groupComposeTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isComposingRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordChunksRef = useRef<BlobPart[]>([]);
  const recordMimeRef = useRef('');
  const recordTickRef = useRef<number | null>(null);
  const recordStartedAtRef = useRef(0);
  const voiceCancelledRef = useRef(false);
  const messagesRef = useRef<GroupMessage[]>([]);
  messagesRef.current = messages;
  const forwardIdsOverrideRef = useRef<string[] | null>(null);
  const wasSelectionModeRef = useRef(false);
  const holdTimerRef = useRef<number | null>(null);
  const holdGestureRef = useRef<{ x: number; y: number } | null>(null);
  const skipNextRowClickRef = useRef(false);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
  };

  function scrollToMessageAndFlash(messageId: string) {
    const el = document.getElementById(`group-msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setFlashMessageId(messageId);
      window.setTimeout(() => {
        setFlashMessageId((id) => (id === messageId ? null : id));
      }, 1400);
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

  const loadOlder = useCallback(async () => {
    const token = getAccessToken();
    if (!token || !groupId || loadingOlder || !hasMore) return;
    setLoadingOlder(true);
    try {
      const nextOff = offset + PAGE_SIZE;
      const res = await apiFetch<{ data: GroupMessage[]; meta: { hasMore: boolean } }>(
        `groups/${groupId}/messages?offset=${nextOff}&limit=${PAGE_SIZE}`,
        { method: 'GET', token },
      );
      const older = res.data ?? [];
      if (older.length === 0) {
        setHasMore(false);
        return;
      }
      setMessages((prev) => [...older, ...prev]);
      setOffset(nextOff);
      setHasMore(res.meta?.hasMore ?? false);
    } catch {
      /* ignore */
    } finally {
      setLoadingOlder(false);
    }
  }, [groupId, hasMore, loadingOlder, offset]);

  useEffect(() => {
    if (!groupId) return;
    const token = getAccessToken();
    if (!token) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const [me, grp, pack, self, pin] = await Promise.all([
          apiFetch<{ id: string }>('users/me', { method: 'GET', token }),
          apiFetch<{ name: string; memberCount?: number }>(`groups/${groupId}`, { method: 'GET', token }),
          apiFetch<{ data: GroupMessage[]; meta: { hasMore: boolean; total: number } }>(
            `groups/${groupId}/messages?offset=0&limit=${PAGE_SIZE}`,
            { method: 'GET', token },
          ),
          apiFetch<{ lastReadMessageId: string | null }>(`groups/${groupId}/participant-self`, {
            method: 'GET',
            token,
          }),
          apiFetch<{ message: GroupMessage | null }>(`groups/${groupId}/pinned-message`, {
            method: 'GET',
            token,
          }),
        ]);
        if (cancelled) return;
        setMyUserId(me.id);
        setGroupName(grp.name);
        setMemberCount(grp.memberCount ?? null);
        setMessages(pack.data ?? []);
        setOffset(0);
        setHasMore(pack.meta?.hasMore ?? false);
        setLastReadMessageId(self.lastReadMessageId ?? null);
        setPinned(pin.message ?? null);
        setText(getGroupDraft(groupId));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'خطا');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  useLayoutEffect(() => {
    if (!loading && messages.length > 0) scrollToBottom();
  }, [loading, groupId]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!replyTo) return;
    const id = requestAnimationFrame(() => {
      groupComposeTextareaRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [replyTo]);

  useEffect(() => {
    if (isSelectionMode) setAttachmentSheetOpen(false);
  }, [isSelectionMode]);

  useEffect(() => {
    if (!groupId) return;
    const token = getAccessToken();
    if (!token) return;
    const mark = () => {
      void markGroupConversationRead(token, groupId).catch(() => {});
    };
    mark();
    const onVis = () => {
      if (document.visibilityState === 'visible') mark();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [groupId]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token || !groupId || !myUserId) return;
    const socket = io(getApiBaseUrl().replace(/\/+$/, ''), {
      transports: ['websocket'],
      auth: { token },
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_group', { groupId });
    });

    socket.on('group_message', (msg: GroupMessage) => {
      if (msg.groupId !== groupId) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      scrollToBottom();
    });

    socket.on(
      'group_message_edited',
      (p: { groupId: string; messageId: string; content: string | null; isEdited: boolean }) => {
        if (p.groupId !== groupId) return;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === p.messageId ? { ...m, content: p.content, isEdited: p.isEdited } : m,
          ),
        );
      },
    );

    socket.on(
      'group_message_deleted',
      (p: { groupId: string; messageId: string; content: null; deletedAt: string | null; media: null }) => {
        if (p.groupId !== groupId) return;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === p.messageId
              ? { ...m, content: null, deletedAt: p.deletedAt, media: null }
              : m,
          ),
        );
        setPinned((pin) => (pin?.id === p.messageId ? null : pin));
      },
    );

    socket.on(
      'message_reaction_added',
      (p: { groupId: string; messageId: string; reactions: GroupMessage['reactions'] }) => {
        if (p.groupId !== groupId) return;
        setMessages((prev) =>
          prev.map((m) => (m.id === p.messageId ? { ...m, reactions: p.reactions ?? [] } : m)),
        );
      },
    );

    socket.on(
      'group_pinned_message_updated',
      (p: { groupId: string; pinnedMessage: GroupMessage | null }) => {
        if (p.groupId !== groupId) return;
        setPinned(p.pinnedMessage ?? null);
      },
    );

    socket.on('group_typing', (p: { groupId: string; userId: string; isTyping: boolean }) => {
      if (p.groupId !== groupId || p.userId === myUserId) return;
      if (typingTimerRef.current != null) window.clearTimeout(typingTimerRef.current);
      if (p.isTyping) {
        setOtherTyping(true);
        typingTimerRef.current = window.setTimeout(() => {
          setOtherTyping(false);
          typingTimerRef.current = null;
        }, 2000);
      } else {
        setOtherTyping(false);
      }
    });

    return () => {
      if (typingTimerRef.current != null) window.clearTimeout(typingTimerRef.current);
      socket.emit('leave_group', { groupId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [groupId, myUserId]);

  const groupInitial = useMemo(() => {
    const t = groupName.trim();
    if (!t) return 'گ';
    return t.slice(0, 1);
  }, [groupName]);

  const reloadMessages = useCallback(async () => {
    const token = getAccessToken();
    if (!token || !groupId) return;
    setLoading(true);
    setError(null);
    try {
      const [pack, self, pin] = await Promise.all([
        apiFetch<{ data: GroupMessage[]; meta: { hasMore: boolean; total: number } }>(
          `groups/${groupId}/messages?offset=0&limit=${PAGE_SIZE}`,
          { method: 'GET', token },
        ),
        apiFetch<{ lastReadMessageId: string | null }>(`groups/${groupId}/participant-self`, {
          method: 'GET',
          token,
        }),
        apiFetch<{ message: GroupMessage | null }>(`groups/${groupId}/pinned-message`, {
          method: 'GET',
          token,
        }),
      ]);
      setMessages(pack.data ?? []);
      setOffset(0);
      setHasMore(pack.meta?.hasMore ?? false);
      setLastReadMessageId(self.lastReadMessageId ?? null);
      setPinned(pin.message ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    const was = wasSelectionModeRef.current;
    wasSelectionModeRef.current = isSelectionMode;
    if (was && !isSelectionMode && !forwardPickSubmitting) {
      forwardIdsOverrideRef.current = null;
      setForwardPickerOpen(false);
      setForwardPickError(null);
      setForwardPickItems([]);
    }
  }, [isSelectionMode, forwardPickSubmitting]);

  useEffect(() => {
    if (!openActionsMessageId) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (!t.closest('[data-group-msg-actions]')) setOpenActionsMessageId(null);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [openActionsMessageId]);

  useEffect(() => {
    if (!forwardPickerOpen && !searchOpen && !openActionsMessageId && selectedMessageIds.size === 0) {
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (forwardPickerOpen && !forwardPickSubmitting) {
        forwardIdsOverrideRef.current = null;
        setForwardPickerOpen(false);
        setForwardPickError(null);
        setForwardPickItems([]);
        return;
      }
      if (searchOpen) {
        setSearchOpen(false);
        return;
      }
      setOpenActionsMessageId(null);
      setSelectedMessageIds(new Set());
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [
    forwardPickerOpen,
    forwardPickSubmitting,
    searchOpen,
    openActionsMessageId,
    selectedMessageIds.size,
  ]);

  function clearSelectedFile() {
    setFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (documentInputRef.current) documentInputRef.current.value = '';
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
      setError('حجم ویدیو از 100MB بیشتر است.');
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
    if (recordTickRef.current != null) {
      window.clearInterval(recordTickRef.current);
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
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return m;
    }
    return '';
  }

  async function startVoiceRecording() {
    if (editingId || sending || voicePhase !== 'idle') return;
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
        if (recordTickRef.current != null) {
          window.clearInterval(recordTickRef.current);
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

      recordTickRef.current = window.setInterval(() => {
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
    if (!groupId) throw new Error('گروه معتبر نیست');

    setSending(true);
    setError(null);
    setUploadProgress(0);
    setVoicePhase('sending');

    try {
      const mediaId = await uploadVoiceBlob(token, blob, mime, durationMs);
      if (!mediaId) throw new Error('آپلود صدا انجام نشد');

      await apiFetch(`groups/${groupId}/messages`, {
        method: 'POST',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaId,
          replyToMessageId: replyTo?.id,
        }),
      });

      clearVoiceDraft();
      setReplyTo(null);
      scrollToBottom();
      socketRef.current?.emit('group_typing', { groupId, isTyping: false });
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

  async function uploadMedia(token: string, f: File): Promise<string> {
    const uploadUrl = `${getApiBaseUrl().replace(/\/+$/, '')}/media/upload`;
    const form = new FormData();
    form.append('file', f);
    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!res.ok) throw new Error(await getErrorMessageFromResponse(res));
    const data = (await res.json()) as { media?: { id: string } };
    if (!data.media?.id) throw new Error('آپلود ناقص بود');
    return data.media.id;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (isSelectionMode) return;
    const token = getAccessToken();
    if (!token || !groupId || sending) return;
    if (voicePhase === 'recording' || voicePhase === 'sending') return;

    const trimmed = text.trim();
    const pickedFile = file;

    if (editingId) {
      if (!trimmed) return;
      setSending(true);
      try {
        await apiFetch(`messages/group/${editingId}`, {
          method: 'PATCH',
          token,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: trimmed }),
        });
        setEditingId(null);
        setText(getGroupDraft(groupId));
        setReplyTo(null);
        clearSelectedFile();
        clearVoiceDraft();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'خطا');
      } finally {
        setSending(false);
      }
      return;
    }

    if (!trimmed && !pickedFile) return;

    setSending(true);
    setError(null);
    try {
      let mediaId: string | undefined;
      if (pickedFile) {
        mediaId = await uploadMedia(token, pickedFile);
        clearSelectedFile();
      }
      await apiFetch(`groups/${groupId}/messages`, {
        method: 'POST',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: trimmed || undefined,
          mediaId,
          replyToMessageId: replyTo?.id,
        }),
      });
      setText('');
      clearGroupDraft(groupId);
      setReplyTo(null);
      scrollToBottom();
      socketRef.current?.emit('group_typing', { groupId, isTyping: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا');
    } finally {
      setSending(false);
    }
  }

  async function toggleReaction(msg: GroupMessage, emoji: string) {
    const token = getAccessToken();
    if (!token) return;
    const row = msg.reactions?.find((r) => r.emoji === emoji);
    const reacted = !!row?.reactedByMe;
    try {
      if (reacted) {
        await apiFetch(`messages/group/${msg.id}/reactions/${encodeURIComponent(emoji)}`, {
          method: 'DELETE',
          token,
        });
      } else {
        await apiFetch(`messages/group/${msg.id}/reactions`, {
          method: 'POST',
          token,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emoji }),
        });
      }
    } catch {
      /* ignore */
    }
  }

  async function pinMessageOnServer(messageId: string | null) {
    const token = getAccessToken();
    if (!token || !groupId) return;
    setPinSubmitting(true);
    try {
      await apiFetch(`groups/${groupId}/pin`, {
        method: 'POST',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId }),
      });
      if (!messageId) {
        setPinned(null);
      } else {
        const row = messagesRef.current.find((x) => x.id === messageId);
        if (row) setPinned(row);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در سنجاق');
    } finally {
      setPinSubmitting(false);
    }
  }

  async function softDeleteGroupMessageClient(messageId: string): Promise<boolean> {
    const token = getAccessToken();
    if (!token) return false;
    try {
      await apiFetch(`messages/group/${messageId}`, { method: 'DELETE', token });
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, content: null, deletedAt: new Date().toISOString(), media: null }
            : m,
        ),
      );
      setPinned((p) => (p?.id === messageId ? null : p));
      return true;
    } catch {
      return false;
    }
  }

  async function openForwardPicker(overrideSelection?: Set<string>) {
    if (forwardPickerOpen) return;
    if (overrideSelection && overrideSelection.size > 0) {
      forwardIdsOverrideRef.current = [...overrideSelection];
    } else {
      forwardIdsOverrideRef.current = null;
      if (selectedMessageIds.size === 0) return;
    }
    setForwardPickerOpen(true);
    setForwardPickError(null);
    setForwardPickLoading(true);
    setForwardPickItems([]);
    const token = getAccessToken();
    if (!token) {
      setForwardPickLoading(false);
      setForwardPickError('ابتدا وارد شوید');
      return;
    }
    try {
      const targets = await loadForwardPickTargets(token, myUserId, null, groupId);
      setForwardPickItems(targets);
    } catch (e) {
      setForwardPickError(e instanceof Error ? e.message : 'خطا در دریافت گفتگوها');
    } finally {
      setForwardPickLoading(false);
    }
  }

  function dismissForwardPicker() {
    if (forwardPickSubmitting) return;
    forwardIdsOverrideRef.current = null;
    setForwardPickerOpen(false);
    setForwardPickError(null);
    setForwardPickItems([]);
  }

  async function confirmForwardTo(target: ForwardPickTarget) {
    if (forwardPickSubmitting) return;
    const token = getAccessToken();
    if (!token || !groupId) return;
    const fromOverride = forwardIdsOverrideRef.current;
    const orderedIds =
      fromOverride && fromOverride.length > 0
        ? fromOverride.filter((id) => {
            const m = messagesRef.current.find((x) => x.id === id);
            return m && !m.deletedAt;
          })
        : messagesRef.current
            .filter((m) => selectedMessageIds.has(m.id) && !m.deletedAt)
            .map((m) => m.id);
    forwardIdsOverrideRef.current = null;
    if (orderedIds.length === 0) {
      setForwardPickError('پیامی برای ارسال نیست');
      return;
    }
    setForwardPickSubmitting(true);
    setForwardPickError(null);
    setError(null);
    try {
      const body =
        target.kind === 'direct'
          ? { targetConversationId: target.id, messageIds: orderedIds }
          : { targetGroupId: target.id, messageIds: orderedIds };
      await apiFetch<{ forwarded: number }>(`groups/${groupId}/messages/forward`, {
        method: 'POST',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setForwardPickerOpen(false);
      setForwardPickError(null);
      setForwardPickItems([]);
      exitSelectionMode();
      if (target.kind === 'direct') {
        router.push(`/direct/${target.id}`);
      } else {
        router.push(`/groups/${target.id}`);
      }
    } catch (e) {
      setForwardPickError(e instanceof Error ? e.message : 'خطا در فوروارد');
    } finally {
      setForwardPickSubmitting(false);
    }
  }

  const canCopySelection =
    selectedMessageIds.size > 0 &&
    [...selectedMessageIds].every((id) => {
      const m = messagesRef.current.find((x) => x.id === id);
      return m && isPureTextGroupMessage(m);
    });

  async function copySelectedMessages() {
    if (!canCopySelection) return;
    const ids = new Set(selectedMessageIds);
    const ordered = messagesRef.current.filter((m) => ids.has(m.id));
    const text = ordered.map((m) => (m.content ?? '').trim()).join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در کپی');
    }
  }

  async function bulkDeleteSelectedMessages() {
    if (selectedMessageIds.size === 0) return;
    setBulkDeleting(true);
    try {
      for (const id of [...selectedMessageIds]) {
        await softDeleteGroupMessageClient(id);
      }
      exitSelectionMode();
    } finally {
      setBulkDeleting(false);
    }
  }

  async function runSearch() {
    const token = getAccessToken();
    if (!token || !groupId || !searchQ.trim()) return;
    setSearchLoading(true);
    try {
      const hits = await apiFetch<GroupMessage[]>(
        `groups/${groupId}/messages/search?q=${encodeURIComponent(searchQ.trim())}&limit=30`,
        { method: 'GET', token },
      );
      const list = Array.isArray(hits) ? hits : [];
      setSearchHits(list);
      setSearchHighlightIndex(0);
    } catch {
      setSearchHits([]);
      setSearchHighlightIndex(0);
    } finally {
      setSearchLoading(false);
    }
  }

  function jumpToSearchHit(delta: number) {
    if (searchHits.length === 0) return;
    let i = searchHighlightIndex + delta;
    if (i < 0) i = searchHits.length - 1;
    if (i >= searchHits.length) i = 0;
    setSearchHighlightIndex(i);
    const hit = searchHits[i];
    if (hit) scrollToMessageAndFlash(hit.id);
  }

  const readAnchorIndex = useMemo(() => {
    if (!lastReadMessageId) return -1;
    return messages.findIndex((m) => m.id === lastReadMessageId);
  }, [messages, lastReadMessageId]);

  const pinnedOk = pinned && !pinned.deletedAt;

  return (
    <AuthGate>
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col bg-[#e5ddd5] bg-[linear-gradient(180deg,rgba(255,255,255,0.5)_0%,rgba(255,255,255,0)_28%)]">
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
                  disabled={selectedMessageIds.size === 0}
                  onClick={() => void openForwardPicker()}
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
                href="/groups"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100 active:bg-slate-200"
                aria-label="بازگشت"
              >
                <span className="text-xl font-semibold leading-none text-slate-800" aria-hidden>
                  ›
                </span>
              </Link>

              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-stone-200 ring-2 ring-white">
                <span className="flex h-full w-full items-center justify-center text-sm font-bold text-slate-600">
                  {groupInitial}
                </span>
              </div>

              <Link href={`/groups/${groupId}/info`} className="min-w-0 flex-1 text-right">
                <h1 className="truncate text-[16px] font-bold leading-tight text-stone-900">
                  {groupName || 'گروه'}
                </h1>
                <p
                  className={`mt-0.5 truncate text-[11px] ${
                    otherTyping ? 'font-semibold text-emerald-600' : 'text-stone-500'
                  }`}
                >
                  {otherTyping
                    ? 'در حال تایپ…'
                    : memberCount != null
                      ? `${memberCount} عضو`
                      : 'گفتگوی گروه'}
                </p>
              </Link>

              <button
                type="button"
                title="جستجو در گفتگو"
                onClick={() => {
                  setSearchOpen(true);
                  setSearchQ('');
                  setSearchHits([]);
                  setSearchHighlightIndex(0);
                }}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100"
              >
                <span className="text-base" aria-hidden>
                  🔍
                </span>
              </button>
              <button
                type="button"
                title="رفرش پیام‌ها"
                onClick={() => void reloadMessages()}
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

        {pinnedOk ? (
          <div
            dir="rtl"
            className="sticky top-[3.25rem] z-20 flex w-full items-center gap-1 border-b border-amber-200/80 bg-amber-50/95 px-2 py-2 text-start text-xs font-semibold text-amber-950 shadow-sm backdrop-blur-sm"
          >
            <button
              type="button"
              onClick={() => {
                if (pinned) scrollToMessageAndFlash(pinned.id);
              }}
              className="flex min-w-0 flex-1 items-center gap-2 text-start"
            >
              <span className="shrink-0 text-amber-600" aria-hidden>
                📌
              </span>
              <span className="min-w-0 truncate">
                {pinned ? replySnippetGroup(pinned) : ''}
              </span>
            </button>
            <button
              type="button"
              title="برداشتن سنجاق"
              disabled={pinSubmitting}
              onClick={() => void pinMessageOnServer(null)}
              className="shrink-0 rounded-full px-2 py-1 text-[11px] font-bold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              ✕
            </button>
          </div>
        ) : null}

        {error ? (
          <div className="px-3 pt-3">
            <Card>
              <div className="text-sm font-semibold text-red-600">{error}</div>
            </Card>
          </div>
        ) : null}

        <div className="flex-1 space-y-2.5 px-2.5 py-3 sm:px-3">
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
              {hasMore ? (
                <div className="flex justify-center pb-2" dir="rtl">
                  <button
                    type="button"
                    disabled={loadingOlder}
                    onClick={() => void loadOlder()}
                    className="rounded-full border border-slate-200/90 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loadingOlder ? 'در حال بارگذاری…' : 'پیام‌های قدیمی‌تر'}
                  </button>
                </div>
              ) : null}
            {messages.map((m, i) => {
              const mine = myUserId != null && m.senderId === myUserId;
              const deleted = !!m.deletedAt;
              const media = deleted ? null : m.media;
              const timeShort = new Date(m.createdAt).toLocaleTimeString('fa-IR', {
                hour: '2-digit',
                minute: '2-digit',
              });
              const rowSelected = selectedMessageIds.has(m.id);
              const prevMsg = i > 0 ? messages[i - 1] : null;
              const showDayDivider =
                !prevMsg || calendarDayKey(prevMsg.createdAt) !== calendarDayKey(m.createdAt);
              const showUnreadDivider =
                readAnchorIndex >= 0 && i === readAnchorIndex + 1 && !!lastReadMessageId;

              return (
                <Fragment key={m.id}>
                  {showDayDivider ? (
                    <div className="flex justify-center py-2">
                      <span className="rounded-full bg-white/85 px-3 py-1 text-[11px] font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200/70">
                        {dayDividerLabelFa(m.createdAt)}
                      </span>
                    </div>
                  ) : null}
                  {showUnreadDivider ? (
                    <div className="flex justify-center py-2">
                      <span className="rounded-full bg-sky-600 px-3 py-1 text-[10px] font-bold text-white shadow-md">
                        پیام‌های خوانده‌نشده
                      </span>
                    </div>
                  ) : null}
                  <div
                    id={`group-msg-${m.id}`}
                    className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                    onContextMenu={(e) => {
                      const t = e.target;
                      if (t instanceof Element && t.closest('a[href], [data-group-msg-actions]')) return;
                      e.preventDefault();
                    }}
                    onPointerDown={(e) => {
                      if (e.button !== 0) return;
                      if (editingId || isSelectionMode) return;
                      const t = e.target as HTMLElement;
                      if (
                        t.closest(
                          'button, a, [role="menu"], video, audio, textarea, input, [data-group-msg-actions]',
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
                        setSelectedMessageIds(new Set([m.id]));
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
                          'button, a, [role="menu"], video, audio, textarea, input, [data-group-msg-actions]',
                        )
                      ) {
                        return;
                      }
                      toggleMessageInSelection(m.id);
                    }}
                  >
                    <div
                      className={`relative max-w-[88%] rounded-[1.15rem] px-3.5 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.06)] ${
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
                      } ${
                        flashMessageId === m.id
                          ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-[#e5ddd5]'
                          : ''
                      }`}
                    >
                      <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px]">
                        <span
                          className={`min-w-0 truncate font-medium ${
                            mine ? 'text-white/75' : 'text-slate-500'
                          }`}
                        >
                          {m.sender.name}
                        </span>
                        {!deleted && !isSelectionMode ? (
                          <div className="relative shrink-0" data-group-msg-actions>
                            <button
                              type="button"
                              aria-haspopup="menu"
                              aria-expanded={openActionsMessageId === m.id}
                              aria-label="اقدامات پیام"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenActionsMessageId((id) => (id === m.id ? null : m.id));
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
                            {openActionsMessageId === m.id ? (
                              <div
                                role="menu"
                                className={`absolute top-full z-[45] mt-1 min-w-[11.5rem] max-w-[min(18rem,calc(100vw-1.5rem))] overflow-visible rounded-2xl border border-slate-200/90 bg-white py-2 shadow-2xl ring-1 ring-slate-900/[0.06] ${
                                  mine ? 'end-0' : 'start-0'
                                }`}
                                dir="rtl"
                              >
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="flex w-full min-h-[44px] items-center px-4 py-2.5 text-right text-[13px] font-semibold text-slate-800 transition hover:bg-slate-50 active:bg-slate-100"
                                  onClick={() => {
                                    setReplyTo(m);
                                    setOpenActionsMessageId(null);
                                  }}
                                >
                                  پاسخ
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="flex w-full min-h-[44px] items-center px-4 py-2.5 text-right text-[13px] font-semibold text-slate-800 transition hover:bg-slate-50 active:bg-slate-100"
                                  onClick={() => {
                                    setOpenActionsMessageId(null);
                                    void openForwardPicker(new Set([m.id]));
                                  }}
                                >
                                  فوروارد
                                </button>
                                {isPureTextGroupMessage(m) ? (
                                  <button
                                    type="button"
                                    role="menuitem"
                                    className="flex w-full min-h-[44px] items-center px-4 py-2.5 text-right text-[13px] font-semibold text-slate-800 transition hover:bg-slate-50 active:bg-slate-100"
                                    onClick={() => {
                                      setOpenActionsMessageId(null);
                                      void navigator.clipboard.writeText((m.content ?? '').trim());
                                    }}
                                  >
                                    کپی
                                  </button>
                                ) : null}
                                <div className="my-1 border-t border-slate-100" role="separator" aria-hidden />
                                <button
                                  type="button"
                                  role="menuitem"
                                  disabled={pinSubmitting}
                                  className="flex w-full min-h-[44px] items-center gap-2 px-4 py-2.5 text-right text-[13px] font-semibold text-slate-800 transition hover:bg-slate-50 active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                                  onClick={() =>
                                    void pinMessageOnServer(pinned?.id === m.id ? null : m.id)
                                  }
                                >
                                  <span className="shrink-0 text-base" aria-hidden>
                                    📌
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    {pinned?.id === m.id ? 'برداشتن سنجاق' : 'سنجاق در گفتگو'}
                                  </span>
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
                                        onClick={() => {
                                          setOpenActionsMessageId(null);
                                          void toggleReaction(m, e);
                                        }}
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
                                      className="flex w-full min-h-[44px] items-center px-4 py-2.5 text-right text-[13px] font-semibold text-slate-800 transition hover:bg-slate-50 active:bg-slate-100"
                                      onClick={() => {
                                        setEditingId(m.id);
                                        setText(m.content ?? '');
                                        setReplyTo(null);
                                        clearSelectedFile();
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
                                        className="flex w-full min-h-[44px] items-center px-4 py-2.5 text-right text-[13px] font-semibold text-red-600 transition hover:bg-red-50 active:bg-red-100"
                                        onClick={() => {
                                          setOpenActionsMessageId(null);
                                          void softDeleteGroupMessageClient(m.id);
                                        }}
                                      >
                                        حذف
                                      </button>
                                    ) : null}
                                  </>
                                ) : null}
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="flex w-full min-h-[44px] items-center px-4 py-2.5 text-right text-[13px] font-semibold text-slate-800 transition hover:bg-slate-50 active:bg-slate-100"
                                  onClick={() => {
                                    setOpenActionsMessageId(null);
                                    setSelectedMessageIds(new Set([m.id]));
                                  }}
                                >
                                  انتخاب
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>

                      {m.replyTo ? (
                        <ReplyQuoteBlock
                          model={groupReplyToModel(m.replyTo)}
                          mine={mine}
                          onNavigate={scrollToMessageAndFlash}
                        />
                      ) : null}

                      {!deleted && media ? (
                        isVoiceMedia(media) ? (
                          <VoiceMessageBubble
                            media={media}
                            mine={mine}
                            messageId={m.id}
                            playingMessageId={playingMessageId}
                            setPlayingMessageId={setPlayingMessageId}
                          />
                        ) : media.mimeType?.startsWith('video/') || media.type === 'VIDEO' ? (
                          <video
                            src={media.url}
                            controls
                            className="mb-2 max-h-72 w-full rounded-xl bg-black shadow-inner"
                          />
                        ) : media.mimeType?.startsWith('image/') || media.type === 'IMAGE' ? (
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
                            className="mb-2 flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200/90 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-800 shadow-sm transition hover:bg-slate-100"
                          >
                            <span className="text-lg" aria-hidden>
                              📄
                            </span>
                            <span className="min-w-0 flex-1 truncate">
                              {media.originalName || 'فایل پیوست'}
                            </span>
                            <span className="shrink-0 text-[10px] font-bold text-sky-700">باز کردن</span>
                          </a>
                        )
                      ) : null}

                      {deleted ? (
                        <div className="text-sm font-medium italic opacity-80">این پیام حذف شده است</div>
                      ) : m.content ? (
                        <div className="whitespace-pre-wrap text-[15px] leading-relaxed">{m.content}</div>
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
                        {m.isEdited ? <span className="opacity-80">ویرایش شده</span> : null}
                      </div>

                      {!deleted && (m.reactions?.length ?? 0) > 0 ? (
                        <div className="mt-1.5 flex flex-wrap gap-1" dir="ltr">
                          {(m.reactions ?? []).map((r) => (
                            <button
                              key={r.emoji}
                              type="button"
                              title={r.reactedByMe ? 'حذف واکنش' : 'واکنش'}
                              onClick={() => void toggleReaction(m, r.emoji)}
                              className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[13px] leading-none transition active:scale-95 ${
                                mine
                                  ? r.reactedByMe
                                    ? 'bg-white/25 text-white ring-1 ring-white/40'
                                    : 'bg-white/12 text-white/90'
                                  : r.reactedByMe
                                    ? 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200'
                                    : 'bg-slate-100/90 text-slate-700 ring-1 ring-slate-200/80'
                              }`}
                            >
                              <span>{r.emoji}</span>
                              {r.count > 1 ? (
                                <span className="text-[10px] font-bold tabular-nums opacity-90">
                                  {r.count}
                                </span>
                              ) : null}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </Fragment>
              );
            })}
            </>
          )}
        </div>

        <div
          className={`sticky bottom-0 z-20 border-t border-stone-200/90 bg-[#f6f6f6]/98 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-2px_12px_rgba(0,0,0,0.05)] backdrop-blur-md ${
            isSelectionMode ? 'pointer-events-none opacity-50' : ''
          }`}
        >
          <form onSubmit={onSubmit} className="w-full min-w-0 space-y-2" dir="rtl">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              disabled={sending || !!editingId || voicePhase !== 'idle' || isSelectionMode}
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
              disabled={sending || !!editingId || voicePhase !== 'idle' || isSelectionMode}
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
              disabled={sending || !!editingId || voicePhase !== 'idle' || isSelectionMode}
              className="sr-only"
              onChange={(e) => {
                clearVoiceDraft();
                handleFileSelection(e.target.files?.[0] ?? null);
              }}
            />

            {editingId ? (
              <div className="flex items-start gap-2 rounded-2xl border border-amber-200/90 bg-amber-50/95 px-3 py-2.5 shadow-sm ring-1 ring-amber-100">
                <div className="min-w-0 flex-1 text-right">
                  <div className="text-[11px] font-bold text-amber-900">ویرایش پیام</div>
                  <div className="mt-0.5 truncate text-xs text-amber-800/90">
                    متن را اصلاح کنید و ذخیره را بزنید.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setText(getGroupDraft(groupId));
                    socketRef.current?.emit('group_typing', { groupId, isTyping: false });
                  }}
                  className="shrink-0 rounded-xl border border-amber-300/80 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 shadow-sm transition hover:bg-amber-50"
                >
                  لغو ویرایش
                </button>
              </div>
            ) : replyTo ? (
              <div className="flex items-start gap-2 rounded-xl border-s-4 border-s-sky-500 border-y border-e border-slate-200/90 bg-white px-2.5 py-2 shadow-sm ring-1 ring-slate-200/50">
                <div className="min-w-0 flex-1 text-right">
                  <div className="text-[9px] font-extrabold tracking-wide text-sky-700">
                    پاسخ به {replyTo.sender.name}
                  </div>
                  <div className="mt-0.5 truncate text-[13px] font-medium text-slate-800">
                    {replySnippetGroup(replyTo)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyTo(null)}
                  className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 transition hover:bg-slate-100"
                >
                  لغو
                </button>
              </div>
            ) : null}

            {attachmentSheetOpen ? (
              <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-3 shadow-sm ring-1 ring-slate-100/80">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-extrabold text-slate-500">پیوست تصویر، ویدیو یا سند</span>
                  <button
                    type="button"
                    className="text-[11px] font-bold text-sky-700 hover:underline"
                    onClick={() => setAttachmentSheetOpen(false)}
                  >
                    بستن
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'photos', label: 'گالری' },
                  { key: 'camera', label: 'دوربین' },
                  { key: 'document', label: 'سند' },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    disabled={sending || !!editingId || isSelectionMode}
                    className="flex min-h-[48px] items-center justify-center rounded-xl border border-slate-200/90 bg-slate-50/50 px-2 py-2 text-center text-[12px] font-extrabold text-slate-800 transition hover:bg-emerald-50 hover:border-emerald-200/80 disabled:cursor-not-allowed disabled:opacity-40"
                    onClick={() => {
                      setAttachmentSheetOpen(false);
                      if (item.key === 'photos') {
                        fileInputRef.current?.click();
                        return;
                      }
                      if (item.key === 'camera') {
                        cameraInputRef.current?.click();
                        return;
                      }
                      documentInputRef.current?.click();
                    }}
                  >
                    {item.label}
                  </button>
                ))}
                </div>
              </div>
            ) : null}

            <div className="flex items-end gap-1.5 sm:gap-2">
              <button
                type="button"
                disabled={sending || !!editingId || isSelectionMode}
                title="پیوست"
                aria-label="پیوست"
                aria-expanded={attachmentSheetOpen}
                onClick={() => setAttachmentSheetOpen((v) => !v)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:h-11 sm:w-11 sm:rounded-2xl"
              >
                <span className="text-xl font-bold leading-none">+</span>
              </button>

              {editingId ? null : voicePhase === 'recording' ? (
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
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:h-11 sm:w-11 sm:rounded-2xl"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z" />
                  </svg>
                </button>
              )}

              <button
                type="button"
                disabled={sending || !!editingId || voicePhase !== 'idle' || isSelectionMode}
                title="دوربین"
                onClick={() => cameraInputRef.current?.click()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:h-11 sm:w-11 sm:rounded-2xl"
              >
                <span className="text-lg" aria-hidden>
                  📷
                </span>
              </button>

              <textarea
                ref={groupComposeTextareaRef}
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
                    !!editingId ||
                    isSelectionMode ||
                    voicePhase === 'recording' ||
                    voicePhase === 'sending'
                  ) {
                    e.preventDefault();
                    return;
                  }
                  e.preventDefault();
                  const form = e.currentTarget.closest('form');
                  if (form) form.requestSubmit();
                }}
                onChange={(e) => {
                  const value = e.target.value;
                  setText(value);
                  if (!editingId) {
                    if (draftTimerRef.current != null) window.clearTimeout(draftTimerRef.current);
                    draftTimerRef.current = window.setTimeout(() => {
                      setGroupDraft(groupId, value);
                      draftTimerRef.current = null;
                    }, 220);
                  }
                  socketRef.current?.emit('group_typing', {
                    groupId,
                    isTyping: value.trim().length > 0,
                  });
                }}
                onBlur={(e) => {
                  if (!editingId) {
                    if (draftTimerRef.current != null) {
                      window.clearTimeout(draftTimerRef.current);
                      draftTimerRef.current = null;
                    }
                    setGroupDraft(groupId, e.target.value);
                  }
                  socketRef.current?.emit('group_typing', { groupId, isTyping: false });
                }}
                placeholder="پیام…"
                rows={1}
                disabled={sending || voicePhase === 'recording' || isSelectionMode}
                className="min-h-[2.625rem] max-h-32 min-w-0 flex-1 resize-none rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-[15px] leading-normal text-slate-900 shadow-sm outline-none ring-0 transition placeholder:text-slate-400 focus:border-sky-400/60 focus:ring-2 focus:ring-sky-100 sm:min-h-[2.75rem] sm:rounded-2xl sm:px-3.5 sm:py-2.5"
              />

              <button
                type="submit"
                disabled={
                  sending || voicePhase === 'recording' || voicePhase === 'sending' || isSelectionMode
                }
                aria-busy={sending}
                className="inline-flex h-10 min-w-[4.25rem] shrink-0 items-center justify-center rounded-xl bg-slate-900 px-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 sm:h-11 sm:min-w-[4.5rem] sm:rounded-2xl sm:px-4"
              >
                {sending ? (
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                    aria-label={editingId ? 'در حال ذخیره' : 'در حال ارسال'}
                  />
                ) : (
                  <span>{editingId ? 'ذخیره' : 'ارسال'}</span>
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
                    onClick={() =>
                      void autoSendVoiceMessage(voiceBlob, voiceMime, voiceDurationMs).catch((e) => {
                        setError(e instanceof Error ? e.message : 'خطا در ارسال پیام صوتی');
                      })
                    }
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
              <div className="space-y-3 rounded-2xl border border-slate-200/90 bg-slate-50/90 p-3 shadow-sm ring-1 ring-slate-100/80">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                    پیش‌نمایش قبل از ارسال
                  </span>
                  <button
                    type="button"
                    onClick={() => clearSelectedFile()}
                    className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-extrabold text-red-700 transition hover:bg-red-50"
                  >
                    حذف
                  </button>
                </div>
                {file.type.startsWith('image/') && previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={file.name}
                    className="max-h-72 w-full rounded-xl border border-slate-200/90 bg-white object-contain shadow-inner"
                  />
                ) : file.type.startsWith('video/') && previewUrl ? (
                  <video
                    src={previewUrl}
                    controls
                    className="max-h-72 w-full rounded-xl border border-slate-200/90 bg-black object-contain shadow-inner"
                  />
                ) : (
                  <div className="flex items-center gap-3 rounded-xl border border-slate-200/90 bg-white px-3 py-3 shadow-sm">
                    <span className="text-2xl opacity-90" aria-hidden>
                      📎
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold text-slate-900">{file.name}</div>
                      <div className="mt-0.5 text-[11px] font-medium text-slate-500">
                        {formatFileSize(file.size)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {uploadProgress !== null ? (
              <div className="space-y-2 rounded-2xl border border-emerald-200/80 bg-emerald-50/90 px-3 py-3 ring-1 ring-emerald-100/60">
                <div className="text-[12px] font-extrabold text-emerald-950">در حال آپلود… {uploadProgress}٪</div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-emerald-200/60">
                  <div
                    className="h-full rounded-full bg-emerald-600 transition-[width] duration-150"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            ) : null}
          </form>
        </div>
        <div ref={bottomRef} className="h-px w-full shrink-0" aria-hidden />

        <ForwardPickerSheet
          open={forwardPickerOpen}
          loading={forwardPickLoading}
          error={forwardPickError}
          submitting={forwardPickSubmitting}
          items={forwardPickItems}
          onDismiss={() => dismissForwardPicker()}
          onPick={(t) => void confirmForwardTo(t)}
        />

        {searchOpen ? (
          <div
            className="fixed inset-0 z-[60] flex items-start justify-center bg-black/45 p-3 pt-16 backdrop-blur-[1px] sm:items-center sm:pt-3"
            role="presentation"
            onClick={() => setSearchOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="group-search-title"
              className="w-full max-w-md overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-2xl"
              dir="rtl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="border-b border-stone-200/80 px-3 py-2">
                <h2 id="group-search-title" className="text-sm font-bold text-stone-900">
                  جستجو در گفتگو
                </h2>
                <div className="mt-2 flex gap-2">
                  <input
                    value={searchQ}
                    onChange={(e) => setSearchQ(e.target.value)}
                    placeholder="متن…"
                    className="min-w-0 flex-1 rounded-xl border border-stone-200 px-3 py-2 text-sm outline-none focus:border-sky-400"
                    dir="rtl"
                  />
                  <button
                    type="button"
                    onClick={() => void runSearch()}
                    disabled={searchLoading}
                    className="shrink-0 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
                  >
                    جستجو
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500">
                    {searchHits.length > 0
                      ? `${searchHighlightIndex + 1} / ${searchHits.length}`
                      : '—'}
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      disabled={searchHits.length === 0}
                      onClick={() => jumpToSearchHit(-1)}
                      className="rounded-lg border border-stone-200 px-2 py-1 text-[11px] font-semibold disabled:opacity-40"
                    >
                      قبلی
                    </button>
                    <button
                      type="button"
                      disabled={searchHits.length === 0}
                      onClick={() => jumpToSearchHit(1)}
                      className="rounded-lg border border-stone-200 px-2 py-1 text-[11px] font-semibold disabled:opacity-40"
                    >
                      بعدی
                    </button>
                  </div>
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto px-2 py-2 text-sm">
                {searchLoading ? (
                  <div className="py-8 text-center text-slate-500">در حال جستجو…</div>
                ) : searchHits.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-500">نتیجه‌ای نیست</div>
                ) : (
                  searchHits.map((m, idx) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setSearchHighlightIndex(idx);
                        scrollToMessageAndFlash(m.id);
                      }}
                      className={`mb-1 w-full rounded-lg border px-2 py-2 text-right text-xs ${
                        idx === searchHighlightIndex
                          ? 'border-sky-400 bg-sky-50'
                          : 'border-transparent hover:bg-stone-50'
                      }`}
                    >
                      <span className="line-clamp-2 font-medium text-stone-800">
                        {(m.content ?? '').trim() || '—'}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </AuthGate>
  );
}

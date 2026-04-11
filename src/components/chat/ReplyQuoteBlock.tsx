'use client';

export type ReplyQuoteMedia = {
  id: string;
  type: string;
  url: string;
  mimeType: string;
  originalName: string | null;
  size: number;
  durationMs?: number | null;
  createdAt: string;
};

export type ReplyToSummary = {
  id: string;
  text: string | null;
  senderId: string;
  mediaId: string | null;
  messageType?: string;
  metadata?: Record<string, unknown> | null;
  media?: ReplyQuoteMedia | { type?: string; mimeType?: string } | null;
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

export type ChatReplyQuoteModel = {
  id: string;
  senderName: string;
  isDeleted: boolean;
  body: string;
  thumbUrl: string | null;
};

import { isVoiceMedia } from '@/lib/chat-media';

function replyPreviewLabelFromReply(reply: ReplyToSummary): { body: string; thumbUrl: string | null } {
  if (reply.isDeleted) return { body: 'این پیام حذف شده است', thumbUrl: null };
  const mt = reply.messageType;
  if (mt === 'LOCATION') return { body: '📍 موقعیت مکانی', thumbUrl: null };
  if (mt === 'CONTACT') {
    const name = reply.metadata && typeof reply.metadata.name === 'string' ? reply.metadata.name : 'مخاطب';
    return { body: `👤 ${name}`, thumbUrl: null };
  }
  if (mt === 'POLL') {
    const q =
      reply.metadata && typeof reply.metadata.question === 'string' ? reply.metadata.question : 'نظرسنجی';
    return { body: `🗳️ ${q.length > 80 ? `${q.slice(0, 80)}…` : q}`, thumbUrl: null };
  }
  if (mt === 'EVENT') {
    const t = reply.metadata && typeof reply.metadata.title === 'string' ? reply.metadata.title : 'رویداد';
    return { body: `📅 ${t.length > 80 ? `${t.slice(0, 80)}…` : t}`, thumbUrl: null };
  }
  const safeText = reply.text ?? '';
  if (safeText.trim()) {
    const t = safeText.trim();
    return {
      body: t.length > 140 ? `${t.slice(0, 140)}…` : t,
      thumbUrl: null,
    };
  }
  if (reply.mediaId && reply.media) {
    const m = reply.media as ReplyQuoteMedia & { type?: string; mimeType?: string };
    if (isVoiceMedia(m)) return { body: '🔊 پیام صوتی', thumbUrl: null };
    if (
      m.type === 'FILE' ||
      (m.mimeType && !m.mimeType.startsWith('image/') && !m.mimeType.startsWith('video/'))
    ) {
      const fn = m.originalName?.trim() || 'سند';
      return { body: `📄 ${fn}`, thumbUrl: null };
    }
    if (m.mimeType?.startsWith('video/') || m.type === 'VIDEO') {
      return { body: '🎬 ویدیو', thumbUrl: m.url ?? null };
    }
    if (m.mimeType?.startsWith('image/') || m.type === 'IMAGE') {
      return { body: '🖼 عکس', thumbUrl: m.url ?? null };
    }
    return { body: 'رسانه', thumbUrl: m.url && m.mimeType?.startsWith('image/') ? m.url : null };
  }
  return { body: '—', thumbUrl: null };
}

export function directReplyToModel(reply: ReplyToSummary): ChatReplyQuoteModel {
  const { body, thumbUrl } = replyPreviewLabelFromReply(reply);
  return {
    id: reply.id,
    senderName: reply.sender.name,
    isDeleted: !!reply.isDeleted,
    body,
    thumbUrl,
  };
}

export type GroupReplyPayload = {
  id: string;
  content: string | null;
  deletedAt?: string | null;
  sender: { id: string; name: string; avatar: string | null } | null;
};

export function groupReplyToModel(reply: GroupReplyPayload): ChatReplyQuoteModel {
  const del = !!reply.deletedAt;
  const body = del ? 'این پیام حذف شده است' : (reply.content ?? '').trim() || '—';
  return {
    id: reply.id,
    senderName: reply.sender?.name ?? 'کاربر',
    isDeleted: del,
    body,
    thumbUrl: null,
  };
}

export function ReplyQuoteBlock({
  model,
  mine,
  onNavigate,
}: {
  model: ChatReplyQuoteModel;
  mine: boolean;
  onNavigate?: (messageId: string) => void;
}) {
  const isDeleted = model.isDeleted;

  return (
    <button
      type="button"
      disabled={isDeleted || !onNavigate}
      onClick={(e) => {
        e.stopPropagation();
        if (!isDeleted && onNavigate) onNavigate(model.id);
      }}
      className={`mb-2 w-full rounded-xl border-s-[3px] px-2.5 py-2 text-start text-[11px] leading-snug shadow-sm transition ${
        isDeleted ? 'border-s-slate-400/80' : 'border-s-sky-500'
      } ${mine ? 'bg-black/15 text-white/95' : 'bg-slate-100/90 text-slate-700 ring-1 ring-slate-200/60'} ${
        isDeleted ? 'cursor-default opacity-75' : onNavigate ? 'cursor-pointer hover:opacity-95 active:scale-[0.99]' : ''
      }`}
      dir="auto"
    >
      <div className="truncate text-[10px] font-semibold opacity-80">{model.senderName}</div>
      <div className="mt-0.5 flex items-start gap-2">
        {model.thumbUrl ? (
          <img
            src={model.thumbUrl}
            alt=""
            className="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-black/10"
          />
        ) : null}
        <div className="line-clamp-2 min-w-0 flex-1 opacity-90">{model.body}</div>
      </div>
    </button>
  );
}

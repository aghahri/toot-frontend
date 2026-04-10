import type { DirectConversationRowMessage } from '@/components/direct/DirectConversationRow';

function isListVoiceMedia(m: { type?: string; mimeType?: string } | null | undefined): boolean {
  if (!m) return false;
  if (m.type === 'VOICE') return true;
  return (m.mimeType ?? '').toLowerCase().startsWith('audio/');
}

type ListMsg = DirectConversationRowMessage & {
  messageType?: string;
  metadata?: Record<string, unknown> | null;
  isDeleted?: boolean;
};

/** Single-line preview for the direct inbox (matches server-sanitized last message). */
export function listPreviewForLastMessage(lastMessage: ListMsg, myUserId: string | null): string {
  if (lastMessage.isDeleted) {
    return myUserId && lastMessage.sender?.id === myUserId ? 'شما: پیام حذف شد' : 'پیام حذف شد';
  }

  const mt = lastMessage.messageType;
  let body: string;

  if (mt === 'LOCATION') {
    body = 'موقعیت مکانی';
  } else if (mt === 'CONTACT') {
    body = 'مخاطب';
  } else if (mt === 'POLL') {
    const q =
      lastMessage.metadata && typeof lastMessage.metadata.question === 'string'
        ? lastMessage.metadata.question.trim()
        : '';
    body = q ? (q.length > 120 ? `${q.slice(0, 120)}…` : q) : 'نظرسنجی';
  } else if (mt === 'EVENT') {
    const t =
      lastMessage.metadata && typeof lastMessage.metadata.title === 'string'
        ? lastMessage.metadata.title.trim()
        : '';
    body = t ? (t.length > 120 ? `${t.slice(0, 120)}…` : t) : 'رویداد';
  } else if (mt === 'DOCUMENT') {
    const fn =
      lastMessage.media && typeof lastMessage.media.originalName === 'string'
        ? lastMessage.media.originalName.trim()
        : '';
    body = fn || 'سند';
  } else if (lastMessage.media && isListVoiceMedia(lastMessage.media)) {
    body = 'پیام صوتی';
  } else if (lastMessage.mediaId && lastMessage.media) {
    const m = lastMessage.media;
    if (m.mimeType?.startsWith('image/') || m.type === 'IMAGE') body = 'عکس';
    else if (m.mimeType?.startsWith('video/') || m.type === 'VIDEO') body = 'ویدیو';
    else if (m.type === 'FILE' || mt === 'MEDIA') body = m.originalName?.trim() || 'سند';
    else body = 'سند';
  } else if (lastMessage.mediaId) {
    body = 'سند';
  } else {
    const t = (lastMessage.text ?? '').trim();
    if (t) body = t.length > 120 ? `${t.slice(0, 120)}…` : t;
    else body = 'هنوز پیامی ارسال نشده';
  }

  if (myUserId && lastMessage.sender?.id === myUserId) {
    return `شما: ${body}`;
  }
  return body;
}

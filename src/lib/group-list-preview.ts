/** Latest-row preview for group inbox (includes sender name when not from viewer). */
export function groupListPreview(
  lastMessage: {
    sender?: { id: string; name?: string };
    content?: string | null;
    deletedAt?: string | null;
    media?: { type?: string; mimeType?: string; originalName?: string | null } | null;
  } | null,
  myUserId: string | null,
): string {
  if (!lastMessage) return 'هنوز پیامی نیست';
  const mine = !!(myUserId && lastMessage.sender?.id === myUserId);
  const senderLabel = mine ? 'شما' : (lastMessage.sender?.name ?? 'کاربر').trim() || 'کاربر';
  if (lastMessage.deletedAt != null || (lastMessage.content == null && !lastMessage.media)) {
    return `${senderLabel}: پیام حذف شد`;
  }
  const t = (lastMessage.content ?? '').trim();
  if (t) {
    const clip = t.length > 100 ? `${t.slice(0, 100)}…` : t;
    return `${senderLabel}: ${clip}`;
  }
  if (lastMessage.media) {
    const m = lastMessage.media;
    if (m.type === 'VOICE' || (m.mimeType ?? '').toLowerCase().startsWith('audio/')) {
      return `${senderLabel}: پیام صوتی`;
    }
    if (m.mimeType?.startsWith('image/') || m.type === 'IMAGE') return `${senderLabel}: عکس`;
    if (m.mimeType?.startsWith('video/') || m.type === 'VIDEO') return `${senderLabel}: ویدیو`;
    return `${senderLabel}: ${m.originalName?.trim() || 'سند'}`;
  }
  return `${senderLabel}: پیام`;
}

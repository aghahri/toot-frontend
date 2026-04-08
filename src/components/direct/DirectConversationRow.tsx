'use client';

import Link from 'next/link';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0].slice(0, 1) + parts[parts.length - 1].slice(0, 1)).toUpperCase();
}

function formatShortTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

/** Optional delivery fields if API includes them on message objects. */
function OutgoingStatus({
  isOutgoing,
  deliveredAt,
  seenAt,
}: {
  isOutgoing: boolean;
  deliveredAt?: string | null;
  seenAt?: string | null;
}) {
  if (!isOutgoing) return null;
  if (seenAt) {
    return <span className="text-sky-500" aria-label="خوانده شد">✓✓</span>;
  }
  if (deliveredAt) {
    return <span className="text-slate-400" aria-label="تحویل داده شد">✓✓</span>;
  }
  return <span className="text-slate-400" aria-label="ارسال شد">✓</span>;
}

export type DirectConversationRowMessage = {
  id: string;
  text: string;
  createdAt: string;
  sender: { id: string; name: string; avatar: string | null };
  deliveredAt?: string | null;
  seenAt?: string | null;
};

type Props = {
  href: string;
  peerName: string;
  peerAvatarUrl: string | null;
  peerId: string;
  preview: string;
  /** ISO time for the preview line (message time preferred). */
  previewTimeIso: string | null;
  myUserId: string | null;
  lastMessage: DirectConversationRowMessage | undefined;
};

export function DirectConversationRow({
  href,
  peerName,
  peerAvatarUrl,
  peerId,
  preview,
  previewTimeIso,
  myUserId,
  lastMessage,
}: Props) {
  const label = peerName || 'کاربر';
  const timeLabel = previewTimeIso ? formatShortTime(previewTimeIso) : '';
  const outgoing = !!(lastMessage && myUserId && lastMessage.sender.id === myUserId);

  return (
    <Link
      href={href}
      className="block rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition-colors active:bg-slate-50 min-[480px]:p-3.5"
    >
      <div className="flex items-start gap-3">
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-slate-200">
          {peerAvatarUrl ? (
            <img src={peerAvatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-sm font-extrabold text-slate-600">
              {initials(label)}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <div className="min-w-0 truncate text-base font-extrabold text-slate-900">{label}</div>
            {timeLabel ? (
              <time
                dateTime={previewTimeIso ?? undefined}
                className="shrink-0 text-[11px] font-medium text-slate-500 tabular-nums"
              >
                {timeLabel}
              </time>
            ) : null}
          </div>
          <div className="mt-0.5 truncate text-[11px] text-slate-400" title={peerId}>
            {peerId}
          </div>
          <div className="mt-2 flex items-end justify-between gap-2">
            <p className="line-clamp-2 min-h-[2.5rem] flex-1 text-sm leading-snug text-slate-700">
              {preview}
            </p>
            <span className="shrink-0 pb-0.5 text-xs">
              <OutgoingStatus
                isOutgoing={outgoing}
                deliveredAt={lastMessage?.deliveredAt}
                seenAt={lastMessage?.seenAt}
              />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

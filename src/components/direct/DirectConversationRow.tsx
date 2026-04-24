'use client';

import Link from 'next/link';
import { formatTimeFa, toFaDigits } from '@/lib/format';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0].slice(0, 1) + parts[parts.length - 1].slice(0, 1)).toUpperCase();
}

const formatShortTime = formatTimeFa;

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
    return (
      <span className="text-[var(--accent)]" aria-label="خوانده شد">
        ✓✓
      </span>
    );
  }
  if (deliveredAt) {
    return (
      <span className="text-[var(--ink-4)]" aria-label="تحویل داده شد">
        ✓✓
      </span>
    );
  }
  return (
    <span className="text-[var(--ink-4)]" aria-label="ارسال شد">
      ✓
    </span>
  );
}

export type DirectConversationRowMessage = {
  id: string;
  text: string | null;
  createdAt: string;
  sender: { id: string; name: string; avatar: string | null };
  deliveredAt?: string | null;
  seenAt?: string | null;
  mediaId?: string | null;
  media?: { type?: string; mimeType?: string; originalName?: string | null } | null;
  messageType?: string;
  metadata?: Record<string, unknown> | null;
  isDeleted?: boolean;
  editedAt?: string | null;
  deletedAt?: string | null;
};

export type DirectRowPreviewVariant = 'default' | 'typing' | 'draft';

type Props = {
  href: string;
  peerName: string;
  peerAvatarUrl: string | null;
  /** Subtitle under the name (e.g. @username · masked phone) — not an internal id. */
  peerSubtitle: string;
  preview: string;
  previewVariant?: DirectRowPreviewVariant;
  /** ISO time for the preview line (message time preferred). */
  previewTimeIso: string | null;
  myUserId: string | null;
  lastMessage: DirectConversationRowMessage | undefined;
  /** From GET direct/conversations when the API includes unread metadata. */
  unreadCount?: number;
  /** In-memory online flag from server; list may be stale until refresh. */
  peerOnline?: boolean;
  inboxPinned?: boolean;
  inboxArchived?: boolean;
  inboxMuted?: boolean;
  /** Bold title + preview when there are unread messages. */
  unreadEmphasis?: boolean;
  menuOpen?: boolean;
  onMenuToggle?: () => void;
  onPin?: () => void;
  onArchiveToggle?: () => void;
  onMuteToggle?: () => void;
  nameBadge?: { label: string; className: string };
};

export function DirectConversationRow({
  href,
  peerName,
  peerAvatarUrl,
  peerSubtitle,
  preview,
  previewVariant = 'default',
  previewTimeIso,
  myUserId,
  lastMessage,
  unreadCount = 0,
  peerOnline = false,
  inboxPinned = false,
  inboxArchived = false,
  inboxMuted = false,
  unreadEmphasis = false,
  menuOpen = false,
  onMenuToggle,
  onPin,
  onArchiveToggle,
  onMuteToggle,
  nameBadge,
}: Props) {
  const label = peerName || 'کاربر';
  const timeLabel = previewTimeIso ? formatShortTime(previewTimeIso) : '';
  const outgoing = !!(lastMessage && myUserId && lastMessage.sender.id === myUserId);
  const unread = typeof unreadCount === 'number' && unreadCount > 0 ? unreadCount : 0;

  const previewClass =
    previewVariant === 'typing'
      ? 'text-[var(--success)]'
      : previewVariant === 'draft'
        ? 'text-[var(--danger)]'
        : unreadEmphasis
          ? 'font-semibold text-[var(--ink-2)]'
          : 'text-[var(--ink-3)]';

  const titleClass = unreadEmphasis ? 'font-bold text-[var(--ink)]' : 'font-semibold text-[var(--ink)]';

  return (
    <div
      className={`relative flex transition-colors active:bg-[var(--surface-2)] min-[480px]:hover:bg-[var(--surface-2)]/70 ${
        unreadEmphasis ? 'bg-[var(--accent-soft)]/35' : 'bg-[var(--surface)]'
      }`}
    >
      <Link href={href} className="min-w-0 flex-1 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-[var(--surface-2)] ring-1 ring-[var(--line)]">
            {peerAvatarUrl ? (
              <img src={peerAvatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-sm font-bold text-[var(--ink-2)]">
                {initials(label)}
              </span>
            )}
            {peerOnline ? (
              <span
                className="absolute bottom-0 left-0 z-[1] h-3 w-3 rounded-full border-[2px] border-[var(--surface)] bg-[var(--success)] shadow-sm"
                title="آنلاین"
                aria-hidden
              />
            ) : null}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-1">
                {inboxPinned ? (
                  <span className="shrink-0 text-[12px] text-[var(--warning)]" title="سنجاق‌شده" aria-hidden>
                    📌
                  </span>
                ) : null}
                <div className={`min-w-0 truncate text-[13px] leading-tight ${titleClass}`}>{label}</div>
                {nameBadge ? (
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${nameBadge.className}`}>
                    {nameBadge.label}
                  </span>
                ) : null}
                {inboxMuted ? (
                  <span className="shrink-0 text-[12px] text-[var(--ink-4)]" title="بی‌صدا" aria-hidden>
                    🔕
                  </span>
                ) : null}
              </div>
              {timeLabel ? (
                <time
                  dateTime={previewTimeIso ?? undefined}
                  className={`shrink-0 text-[11px] tabular-nums ${
                    unread > 0 ? 'font-bold text-[var(--accent)]' : 'font-medium text-[var(--ink-3)]'
                  }`}
                >
                  {timeLabel}
                </time>
              ) : null}
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <p className={`line-clamp-1 flex-1 text-[12px] leading-snug ${previewClass}`}>
                {preview}
              </p>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="text-[11px]">
                  <OutgoingStatus
                    isOutgoing={outgoing && previewVariant === 'default'}
                    deliveredAt={lastMessage?.deliveredAt}
                    seenAt={lastMessage?.seenAt}
                  />
                </span>
                {unread > 0 ? (
                  <span
                    className="inline-flex min-h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-[var(--accent)] px-1.5 text-[11px] font-bold text-[var(--accent-contrast)] tabular-nums"
                    aria-label={`${unread} پیام خوانده‌نشده`}
                  >
                    {unread > 99 ? toFaDigits('99+') : toFaDigits(unread)}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </Link>

      {onMenuToggle && onPin && onArchiveToggle && onMuteToggle ? (
        <div
          className="relative flex shrink-0 flex-col items-center border-r border-transparent pt-2 pr-1"
          data-direct-inbox-menu
        >
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onMenuToggle();
            }}
            className="flex h-10 w-9 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-100"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label="منوی گفتگو"
          >
            ⋮
          </button>
          {menuOpen ? (
            <div
              className="absolute left-0 top-11 z-20 min-w-[10.5rem] rounded-xl border border-stone-200 bg-white py-1 shadow-lg"
              role="menu"
              dir="rtl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-2.5 text-right text-sm font-semibold text-stone-800 hover:bg-stone-50"
                onClick={() => {
                  onPin();
                  onMenuToggle();
                }}
              >
                {inboxPinned ? 'برداشتن سنجاق' : 'سنجاق به بالا'}
              </button>
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-2.5 text-right text-sm font-semibold text-stone-800 hover:bg-stone-50"
                onClick={() => {
                  onArchiveToggle();
                  onMenuToggle();
                }}
              >
                {inboxArchived ? 'خارج کردن از بایگانی' : 'بایگانی'}
              </button>
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-2.5 text-right text-sm font-semibold text-stone-800 hover:bg-stone-50"
                onClick={() => {
                  onMuteToggle();
                  onMenuToggle();
                }}
              >
                {inboxMuted ? 'لغو بی‌صدا' : 'بی‌صدا کردن'}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

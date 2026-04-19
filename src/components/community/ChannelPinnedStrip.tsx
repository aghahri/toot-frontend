'use client';

import type { ChannelMsg } from './channelTypes';

function snippet(m: ChannelMsg): string {
  const t = m.content?.trim();
  if (t) return t.length > 72 ? `${t.slice(0, 72)}…` : t;
  if (m.media) return 'رسانه';
  return 'انتشار سنجاق‌شده';
}

type Props = {
  message: ChannelMsg;
  onOpenTools?: () => void;
};

/**
 * Compact persistent pinned bar — fixed above the scrolling timeline (Telegram-style).
 */
export function ChannelPinnedStrip({ message, onOpenTools }: Props) {
  return (
    <div
      className="flex shrink-0 items-center gap-2 border-b border-amber-200/85 bg-amber-50/95 px-2.5 py-2 shadow-[0_1px_0_rgba(0,0,0,0.04)] backdrop-blur-sm"
      role="region"
      aria-label="پست سنجاق‌شده"
    >
      <span className="shrink-0 text-base leading-none text-amber-700" aria-hidden>
        📌
      </span>
      <button
        type="button"
        className="min-w-0 flex-1 truncate text-right text-[12px] font-semibold leading-snug text-amber-950"
        onClick={() =>
          document.getElementById(`channel-msg-${message.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      >
        {snippet(message)}
      </button>
      {onOpenTools ? (
        <button
          type="button"
          onClick={onOpenTools}
          className="shrink-0 rounded-full px-2 py-1 text-[10px] font-bold text-[var(--accent-hover)] hover:bg-amber-100/80"
        >
          مدیریت
        </button>
      ) : null}
    </div>
  );
}

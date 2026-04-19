'use client';

import type { ChannelMsg } from './channelTypes';

export type { ChannelMsg } from './channelTypes';

function isImageMedia(m: ChannelMsg['media']): boolean {
  if (!m?.mimeType) return false;
  return m.mimeType.startsWith('image/');
}

type Props = {
  message: ChannelMsg;
  /** timeline = full feed card; featured = compact highlight */
  variant?: 'timeline' | 'featured';
  /** Show “broadcast” label — distinguishes from group chat */
  broadcastLabel?: string;
};

/** Publication-styled post — not a chat bubble */
export function ChannelPublicationCard({
  message: m,
  variant = 'timeline',
  broadcastLabel = 'انتشار',
}: Props) {
  const isFeatured = variant === 'featured';
  const pad = isFeatured ? 'px-4 py-3.5' : 'px-4 py-4';
  const gap = isFeatured ? 'space-y-2' : 'space-y-3';

  return (
    <article
      className={`relative overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--card-bg)] ${
        isFeatured ? 'ring-2 ring-amber-400/25 shadow-lg' : 'shadow-[0_2px_12px_rgba(0,0,0,0.06)]'
      }`}
    >
      <div className="pointer-events-none absolute inset-y-3 right-0 w-1 rounded-l bg-gradient-to-b from-amber-500/90 via-violet-500/80 to-indigo-600/70" />
      <div className={`${pad} pl-3`}>
        <header className={`flex flex-wrap items-start justify-between gap-2 ${gap}`}>
          <div className="min-w-0 flex-1 text-right">
            <p className="text-[10px] font-black tracking-wide text-amber-800/90">{broadcastLabel}</p>
            <p className="theme-text-primary mt-1 line-clamp-2 text-[15px] font-bold leading-snug">{m.sender.name}</p>
          </div>
          <time
            className="shrink-0 rounded-lg bg-[var(--surface-soft)] px-2 py-1 text-[10px] tabular-nums text-[var(--text-secondary)]"
            dateTime={m.createdAt}
            dir="ltr"
          >
            {fmtShort(m.createdAt)}
          </time>
        </header>

        {m.media?.url && isImageMedia(m.media) ? (
          <a href={m.media.url} target="_blank" rel="noreferrer" className="mt-3 block overflow-hidden rounded-xl bg-black/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={m.media.url}
              alt=""
              className="max-h-[min(52vw,280px)] w-full object-cover"
            />
          </a>
        ) : null}

        {m.content?.trim() ? (
          <p
            className={`theme-text-primary whitespace-pre-wrap text-[15px] leading-[1.7] ${
              m.media?.url && isImageMedia(m.media) ? 'mt-3' : 'mt-3'
            }`}
          >
            {m.content}
          </p>
        ) : null}

        {m.media?.url && !isImageMedia(m.media) ? (
          <a
            href={m.media.url}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-[13px] font-bold text-[var(--accent-hover)]"
          >
            <span aria-hidden>📎</span>
            دانلود یا باز کردن پیوست
          </a>
        ) : null}

        {!m.content?.trim() && !m.media?.url ? (
          <p className="theme-text-secondary mt-2 text-[12px]">(بدون محتوا)</p>
        ) : null}
      </div>
    </article>
  );
}

function fmtShort(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fa-IR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

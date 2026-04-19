'use client';

import type { ChannelMsg } from './channelTypes';

export type { ChannelMsg } from './channelTypes';

import { isVoiceMedia } from '@/lib/chat-media';

function isImageMedia(m: ChannelMsg['media']): boolean {
  if (!m) return false;
  if (m.mimeType?.startsWith('image/')) return true;
  return m.type === 'IMAGE';
}

type Props = {
  message: ChannelMsg;
  variant?: 'timeline' | 'featured';
  broadcastLabel?: string;
  pinActionLabel?: string;
  onPinAction?: (message: ChannelMsg) => void;
  pinActionDisabled?: boolean;
};

/** Publication-styled post — not a chat bubble */
export function ChannelPublicationCard({
  message: m,
  variant = 'timeline',
  broadcastLabel = 'انتشار',
  pinActionLabel,
  onPinAction,
  pinActionDisabled,
}: Props) {
  const isFeatured = variant === 'featured';
  const pad = isFeatured ? 'px-4 py-3.5' : 'px-4 py-4';
  const media = m.media;

  const loc = m.messageType === 'LOCATION' && m.metadata ? (m.metadata as Record<string, unknown>) : null;
  const contact = m.messageType === 'CONTACT' && m.metadata ? (m.metadata as Record<string, unknown>) : null;

  return (
    <article
      className={`relative overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--card-bg)] ${
        isFeatured ? 'ring-2 ring-amber-400/25 shadow-lg' : 'shadow-[0_2px_12px_rgba(0,0,0,0.06)]'
      }`}
    >
      <div className="pointer-events-none absolute inset-y-3 right-0 w-1 rounded-l bg-gradient-to-b from-amber-500/90 via-violet-500/80 to-indigo-600/70" />
      <div className={`${pad} pl-3`}>
        <header className="flex flex-wrap items-start justify-between gap-2">
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
          {pinActionLabel && onPinAction ? (
            <button
              type="button"
              disabled={pinActionDisabled}
              onClick={() => onPinAction(m)}
              className="shrink-0 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-soft)] px-2 py-1 text-[10px] font-bold text-[var(--accent-hover)] disabled:opacity-50"
            >
              {pinActionLabel}
            </button>
          ) : null}
        </header>

        {loc && typeof loc.lat === 'number' && typeof loc.lng === 'number' ? (
          <div className="mt-3 rounded-xl border border-sky-200/80 bg-sky-50/90 p-3 text-sky-950">
            <p className="text-[11px] font-extrabold">📍 مکان</p>
            {typeof loc.label === 'string' && loc.label ? (
              <p className="mt-1 text-[13px] font-medium">{loc.label}</p>
            ) : null}
            <a
              href={`https://maps.google.com/?q=${loc.lat},${loc.lng}`}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-[12px] font-bold text-sky-800 underline"
            >
              باز کردن در نقشه
            </a>
          </div>
        ) : null}

        {contact && typeof contact.name === 'string' ? (
          <div className="mt-3 rounded-xl border border-violet-200/80 bg-violet-50/90 p-3 text-violet-950">
            <p className="text-[11px] font-extrabold">👤 مخاطب</p>
            <p className="mt-1 text-[14px] font-bold">{contact.name}</p>
            {contact.phone ? <p className="mt-1 text-[13px] opacity-90">{String(contact.phone)}</p> : null}
          </div>
        ) : null}

        {!loc && !contact && media?.url && isVoiceMedia(media) ? (
          <div className="mt-3 w-full min-w-0">
            <audio src={media.url} controls className="w-full max-w-full rounded-xl" preload="metadata" />
            {media.durationMs ? (
              <p className="mt-1 text-[10px] text-[var(--text-secondary)]">مدت: {Math.round(media.durationMs / 1000)} ثانیه</p>
            ) : null}
          </div>
        ) : null}

        {!loc && !contact && media?.url && !isVoiceMedia(media) && (media.mimeType?.startsWith('video/') || media.type === 'VIDEO') ? (
          <video src={media.url} controls className="mt-3 max-h-[min(52vw,280px)] w-full rounded-xl bg-black shadow-inner" />
        ) : null}

        {!loc && !contact && media?.url && !isVoiceMedia(media) && isImageMedia(media) ? (
          <a href={media.url} target="_blank" rel="noreferrer" className="mt-3 block overflow-hidden rounded-xl bg-black/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={media.url} alt="" className="max-h-[min(52vw,280px)] w-full object-cover" />
          </a>
        ) : null}

        {!loc && !contact && media?.url && !isVoiceMedia(media) && !isImageMedia(media) && !(media.mimeType?.startsWith('video/') || media.type === 'VIDEO') ? (
          <a
            href={media.url}
            target="_blank"
            rel="noreferrer"
            className="mt-3 flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2.5 text-[13px] font-bold text-[var(--accent-hover)]"
          >
            <span aria-hidden>📄</span>
            <span className="min-w-0 flex-1 truncate">{media.originalName || 'فایل پیوست'}</span>
            <span className="shrink-0 text-[10px]">باز کردن</span>
          </a>
        ) : null}

        {m.content?.trim() ? (
          <p className="theme-text-primary mt-3 whitespace-pre-wrap text-[15px] leading-[1.7]">{m.content}</p>
        ) : null}

        {!loc && !contact && !m.content?.trim() && !media?.url ? (
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

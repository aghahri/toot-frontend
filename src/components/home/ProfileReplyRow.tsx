'use client';

import Link from 'next/link';
import { renderPostTextWithLinks } from './render-post-text';
import type { ProfileReplyFeedRow } from './feed-types';

function formatShortTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('fa-IR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function truncateParentText(text: string, max = 140): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

type ProfileReplyRowProps = {
  row: ProfileReplyFeedRow;
  onOpenThread: (parentPostId: string) => void;
};

export function ProfileReplyRow({ row, onOpenThread }: ProfileReplyRowProps) {
  const { reply, parentPost } = row;
  const parentAuthor = parentPost.user;
  const handle = parentAuthor.username?.trim() || '';

  return (
    <article
      className="theme-card-bg border-b border-[var(--border-soft)] px-4 py-3.5 transition hover:bg-[var(--surface-soft)]"
      dir="rtl"
    >
      <div className="mb-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-[12px] leading-snug text-[var(--text-secondary)]">
        <span className="font-bold text-[var(--text-primary)]">در پاسخ به</span>{' '}
        {parentAuthor.id ? (
          <Link
            href={`/profile/${parentAuthor.id}`}
            className="font-semibold text-[var(--accent-hover)] underline-offset-2 hover:underline"
            prefetch={false}
          >
            {parentAuthor.name.trim()}
            {handle ? ` · @${handle}` : ''}
          </Link>
        ) : (
          <span className="font-semibold">{parentAuthor.name.trim()}</span>
        )}
        <p className="mt-1.5 whitespace-pre-wrap break-words text-[var(--text-secondary)]">
          {truncateParentText(parentPost.text)}
        </p>
      </div>
      <div className="text-[15px] leading-relaxed text-[var(--text-primary)]">
        {renderPostTextWithLinks(reply.text)}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <time className="text-[11px] font-semibold text-[var(--text-secondary)]" dateTime={reply.createdAt}>
          {formatShortTime(reply.createdAt)}
        </time>
        <button
          type="button"
          onClick={() => onOpenThread(parentPost.id)}
          className="rounded-full border border-[var(--border-soft)] bg-[var(--card-bg)] px-3 py-1.5 text-[11px] font-extrabold text-[var(--accent-hover)] shadow-sm transition hover:bg-[var(--accent-soft)]"
        >
          مشاهدهٔ گفتگو
        </button>
      </div>
    </article>
  );
}

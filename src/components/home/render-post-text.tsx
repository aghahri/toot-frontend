'use client';

import Link from 'next/link';
import { Fragment } from 'react';
import { MENTION_SPLIT_RE } from '@/lib/mention-utils';
import { MentionLink } from './MentionLink';

function renderHashtagLineSegment(segment: string, keyPrefix: string) {
  const parts = segment.split(/(#[\p{L}\p{N}_]+)/gu);
  return parts.map((part, idx) => {
    if (/^#[\p{L}\p{N}_]+$/u.test(part)) {
      return (
        <Link
          key={`${keyPrefix}-h-${idx}`}
          href={`/search?q=${encodeURIComponent(part)}`}
          className="font-semibold text-[var(--accent-hover)] hover:underline"
          prefetch={false}
        >
          {part}
        </Link>
      );
    }
    return <Fragment key={`${keyPrefix}-t-${idx}`}>{part}</Fragment>;
  });
}

function renderMentionLineSegment(segment: string, keyPrefix: string) {
  const parts = segment.split(MENTION_SPLIT_RE);
  return parts.map((part, idx) => {
    if (/^@[a-zA-Z0-9_]{3,30}$/.test(part)) {
      const handle = part.slice(1);
      return <MentionLink key={`${keyPrefix}-m-${idx}`} username={handle} />;
    }
    return <Fragment key={`${keyPrefix}-p-${idx}`}>{renderHashtagLineSegment(part, `${keyPrefix}-${idx}`)}</Fragment>;
  });
}

/** Plain post/reply body: hashtags + @mentions (plain storage, theme-aware). */
export function renderPostTextWithLinks(text: string) {
  const lines = (text ?? '').split('\n');
  return lines.map((line, lineIndex) => (
    <Fragment key={`ln-${lineIndex}`}>
      {renderMentionLineSegment(line, `l${lineIndex}`)}
      {lineIndex < lines.length - 1 ? '\n' : null}
    </Fragment>
  ));
}

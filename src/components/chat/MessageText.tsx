'use client';

import { Fragment } from 'react';

type Props = {
  text: string;
  className?: string;
  linkClassName?: string;
};

const URL_RE = /((?:https?:\/\/|www\.)[^\s<]+)/gi;

function normalizeHref(raw: string) {
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

export function MessageText({ text, className, linkClassName }: Props) {
  const chunks: Array<{ type: 'text' | 'link'; value: string }> = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) chunks.push({ type: 'text', value: text.slice(last, idx) });
    chunks.push({ type: 'link', value: m[0] });
    last = idx + m[0].length;
  }
  if (last < text.length) chunks.push({ type: 'text', value: text.slice(last) });
  if (chunks.length === 0) chunks.push({ type: 'text', value: text });

  return (
    <div className={className ?? 'whitespace-pre-wrap break-words [overflow-wrap:anywhere]'}>
      {chunks.map((c, i) =>
        c.type === 'link' ? (
          <a
            key={`lnk-${i}-${c.value}`}
            href={normalizeHref(c.value)}
            target="_blank"
            rel="noreferrer noopener"
            className={
              linkClassName ??
              'underline decoration-current/60 underline-offset-2 text-sky-600 dark:text-sky-300 break-words [overflow-wrap:anywhere]'
            }
          >
            {c.value}
          </a>
        ) : (
          <Fragment key={`txt-${i}`}>{c.value}</Fragment>
        ),
      )}
    </div>
  );
}

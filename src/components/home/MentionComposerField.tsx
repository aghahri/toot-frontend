'use client';

import type { KeyboardEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { getActiveMentionQuery } from '@/lib/mention-utils';

type SearchRow = { id: string; username: string; name: string };

type MentionComposerFieldProps = {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  rows?: number;
  className?: string;
};

export function MentionComposerField({
  value,
  onChange,
  disabled,
  placeholder,
  rows = 4,
  className,
}: MentionComposerFieldProps) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [caret, setCaret] = useState(0);
  const [hits, setHits] = useState<SearchRow[]>([]);
  const [pickIdx, setPickIdx] = useState(0);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mention = useMemo(() => getActiveMentionQuery(value, caret), [value, caret]);

  useEffect(() => {
    if (debRef.current) clearTimeout(debRef.current);
    if (!mention || mention.query.length < 2) {
      setHits([]);
      return;
    }
    debRef.current = setTimeout(() => {
      void (async () => {
        const t = getAccessToken();
        if (!t) return;
        try {
          const rows = await apiFetch<SearchRow[]>(
            `users/search?q=${encodeURIComponent(mention.query)}&limit=8`,
            { method: 'GET', token: t },
          );
          const q = mention.query.toLowerCase();
          const sorted = [...(rows ?? [])].sort((a, b) => {
            const ae = a.username.toLowerCase() === q ? 0 : 1;
            const be = b.username.toLowerCase() === q ? 0 : 1;
            if (ae !== be) return ae - be;
            return a.username.localeCompare(b.username);
          });
          setHits(sorted);
          setPickIdx(0);
        } catch {
          setHits([]);
        }
      })();
    }, 200);
    return () => {
      if (debRef.current) clearTimeout(debRef.current);
    };
  }, [mention]);

  const open = !!mention && mention.query.length >= 2 && hits.length > 0;

  const applyPick = useCallback(
    (row: SearchRow) => {
      if (!mention) return;
      const un = row.username.toLowerCase();
      const next = `${value.slice(0, mention.start)}@${un}${value.slice(caret)}`;
      onChange(next);
      setHits([]);
      const pos = mention.start + 1 + un.length;
      requestAnimationFrame(() => {
        const el = taRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(pos, pos);
        setCaret(pos);
      });
    },
    [mention, value, caret, onChange],
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (!open) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setPickIdx((i) => Math.min(hits.length - 1, i + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setPickIdx((i) => Math.max(0, i - 1));
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const row = hits[pickIdx];
        if (row) applyPick(row);
      } else if (e.key === 'Escape') {
        setHits([]);
      }
    },
    [open, hits, pickIdx, applyPick],
  );

  return (
    <div className="relative min-w-0">
      <textarea
        ref={taRef}
        value={value}
        disabled={!!disabled}
        placeholder={placeholder}
        rows={rows}
        onKeyDown={onKeyDown}
        onChange={(e) => {
          onChange(e.target.value);
          setCaret(e.target.selectionStart ?? e.target.value.length);
        }}
        onSelect={(e) => {
          const t = e.target as HTMLTextAreaElement;
          setCaret(t.selectionStart ?? 0);
        }}
        onClick={(e) => {
          const t = e.target as HTMLTextAreaElement;
          setCaret(t.selectionStart ?? 0);
        }}
        className={className}
      />
      {open ? (
        <ul
          className="theme-card-bg theme-border-soft absolute z-20 mt-1 max-h-40 min-w-[11rem] max-w-full overflow-y-auto rounded-xl border py-1 shadow-md end-0"
          role="listbox"
        >
          {hits.map((row, i) => (
            <li key={row.id}>
              <button
                type="button"
                role="option"
                aria-selected={i === pickIdx}
                className={`flex w-full min-w-0 items-center gap-2 px-3 py-2 text-start text-sm transition ${
                  i === pickIdx ? 'bg-[var(--accent-soft)]' : 'hover:bg-[var(--surface-muted)]'
                }`}
                onMouseDown={(ev) => {
                  ev.preventDefault();
                  applyPick(row);
                }}
              >
                <span className="min-w-0 flex-1 truncate font-bold text-[var(--text-primary)]">{row.name}</span>
                <span className="shrink-0 text-xs text-[var(--text-secondary)]" dir="ltr">
                  @{row.username}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

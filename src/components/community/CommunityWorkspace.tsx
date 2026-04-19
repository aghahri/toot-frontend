'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

/** Same outer shell family as group thread: full-height column workspace. */
export function CommunityWorkspaceShell({
  children,
  withWorkspaceGradient = false,
}: {
  children: ReactNode;
  /** Match group thread subtle gradient for “same family” feel */
  withWorkspaceGradient?: boolean;
}) {
  return (
    <main
      className={`theme-page-bg theme-text-primary mx-auto flex min-h-[100dvh] w-full max-w-md flex-col ${
        withWorkspaceGradient ? 'bg-[linear-gradient(180deg,var(--surface-soft)_0%,var(--page-bg)_28%)]' : ''
      }`}
      dir="rtl"
    >
      {children}
    </main>
  );
}

/** Sticky top bar — same structure as `groups/[id]` header (non-selection). */
export function CommunityWorkspaceHeaderBar({ children }: { children: ReactNode }) {
  return (
    <header
      className="theme-panel-bg theme-border-soft sticky top-0 z-30 border-b shadow-[0_1px_0_rgba(0,0,0,0.04)] backdrop-blur-md"
      dir="rtl"
    >
      <div className="flex flex-wrap items-center gap-1.5 px-2.5 py-1.5 sm:gap-2">{children}</div>
    </header>
  );
}

export function CommunityBackButton({
  href,
  onClick,
  ariaLabel = 'بازگشت',
}: {
  href?: string;
  onClick?: () => void;
  ariaLabel?: string;
}) {
  const className =
    'theme-text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition hover:bg-[var(--surface-soft)] active:bg-[var(--surface-strong)]';
  if (href) {
    return (
      <Link href={href} className={className} aria-label={ariaLabel}>
        <span className="text-xl font-semibold leading-none text-slate-800" aria-hidden>
          ›
        </span>
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className} aria-label={ariaLabel}>
      <span className="text-xl font-semibold leading-none text-slate-800" aria-hidden>
        ›
      </span>
    </button>
  );
}

export function CommunityAvatarInitial({ letter, label }: { letter: string; label?: string }) {
  const ch = letter.trim().slice(0, 1) || '؟';
  return (
    <div
      className="theme-surface-strong relative h-9 w-9 shrink-0 overflow-hidden rounded-full ring-2 ring-white/70"
      title={label}
      aria-hidden={!label}
    >
      <span className="flex h-full w-full items-center justify-center text-sm font-bold text-slate-600">{ch}</span>
    </div>
  );
}

/** One-tap community tools — same affordance as group header. */
export function CommunityToolsTrigger({
  onClick,
  disabled,
  title = 'ابزارهای جامعه',
}: {
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="flex h-9 shrink-0 items-center gap-1 rounded-full border border-slate-200/90 bg-white px-2.5 py-1 text-[11px] font-extrabold text-slate-700 shadow-sm transition hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50"
    >
      <span aria-hidden>🧰</span>
      <span className="max-[380px]:hidden">ابزارها</span>
    </button>
  );
}

/** Framed message list region — aligns channel timeline shell with group message area. */
export function CommunityTimelineFrame({
  title,
  children,
  className = '',
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`theme-panel-bg theme-border-soft mt-3 flex min-h-0 flex-1 flex-col rounded-2xl border p-3 ${className}`}
    >
      <h2 className="theme-text-secondary px-1 text-xs font-extrabold">{title}</h2>
      {children}
    </section>
  );
}

/** Read-only / no-post permission — same card family as composer, policy-driven copy only. */
export function CommunityReadOnlyComposerBar({ children }: { children: ReactNode }) {
  return (
    <section
      className="theme-card-bg theme-border-soft mt-3 rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--surface-soft)]/90 p-3 text-center shadow-sm"
      dir="rtl"
    >
      <p className="text-[11px] font-medium leading-relaxed text-[var(--text-secondary)]">{children}</p>
    </section>
  );
}

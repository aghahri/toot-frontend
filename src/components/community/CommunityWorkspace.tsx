'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * - Default: document-height column (e.g. group thread).
 * - `fixedWorkspace`: viewport-locked column so only inner regions scroll (channel workspace).
 */
export function CommunityWorkspaceShell({
  children,
  withWorkspaceGradient = false,
  fixedWorkspace = false,
}: {
  children: ReactNode;
  /** Match group thread subtle gradient for “same family” feel */
  withWorkspaceGradient?: boolean;
  /** Fill a fixed parent (navbar → bottom nav); flex column + inner scroll region + composer. */
  fixedWorkspace?: boolean;
}) {
  return (
    <main
      className={`theme-page-bg theme-text-primary mx-auto flex w-full max-w-md flex-col ${
        fixedWorkspace ? 'h-full min-h-0 flex-1 overflow-hidden' : 'min-h-[100dvh]'
      } ${withWorkspaceGradient ? 'bg-[linear-gradient(180deg,var(--surface-soft)_0%,var(--page-bg)_28%)]' : ''}`}
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

export function CommunityAvatarInitial({
  letter,
  label,
  size = 'md',
}: {
  letter: string;
  label?: string;
  /** md = 36px, lg = 44px, xl = 64px (channel hero — broadcast identity) */
  size?: 'md' | 'lg' | 'xl';
}) {
  const ch = letter.trim().slice(0, 1) || '؟';
  const box =
    size === 'xl' ? 'h-16 w-16 ring-[3px]' : size === 'lg' ? 'h-11 w-11 ring-[2.5px]' : 'h-9 w-9 ring-2';
  const text = size === 'xl' ? 'text-2xl' : size === 'lg' ? 'text-base' : 'text-sm';
  return (
    <div
      className={`theme-surface-strong relative ${box} shrink-0 overflow-hidden rounded-full ring-white/70`}
      title={label}
      aria-hidden={!label}
    >
      <span className={`flex h-full w-full items-center justify-center font-bold text-slate-600 ${text}`}>{ch}</span>
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
  subtitle,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`theme-panel-bg theme-border-soft mt-3 flex flex-col rounded-2xl border p-3 ${className}`}
    >
      <div className="px-1">
        <h2 className="theme-text-secondary text-xs font-extrabold">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-[10px] leading-snug text-[var(--text-secondary)]/90">{subtitle}</p> : null}
      </div>
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

'use client';

/**
 * Shared text composer shell for community workspaces (group/channel policy alignment).
 * Group keeps its full composer (voice, files, reactions); channel uses this for text-only v1.
 * Branch behavior via props—same look, different permissions copy.
 */
type Props = {
  title?: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  sending: boolean;
  /** When false, submit button stays disabled regardless of draft. */
  canSubmit?: boolean;
  error?: string | null;
  placeholder?: string;
  submitLabel?: string;
  sendingLabel?: string;
  /** e.g. posting mode or “فقط مدیران…” */
  hint?: string | null;
  maxLength?: number;
  rows?: number;
};

export function CommunityTextComposer({
  title = 'ارسال پیام',
  value,
  onChange,
  onSubmit,
  sending,
  canSubmit = true,
  error,
  placeholder = 'پیام خود را بنویسید…',
  submitLabel = 'ارسال',
  sendingLabel = 'در حال ارسال…',
  hint,
  maxLength = 10000,
  rows = 3,
}: Props) {
  const allow = canSubmit && !!value.trim() && !sending;

  return (
    <section className="theme-card-bg theme-border-soft mt-4 rounded-2xl border p-3 shadow-sm" dir="rtl">
      <h2 className="theme-text-secondary mb-2 text-xs font-extrabold">{title}</h2>
      {hint ? <p className="theme-text-secondary mb-2 text-[11px] leading-snug">{hint}</p> : null}
      {error ? <p className="mb-2 text-xs font-semibold text-red-600">{error}</p> : null}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        className="theme-text-primary w-full resize-none rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
      />
      <button
        type="button"
        disabled={!allow}
        onClick={() => onSubmit()}
        className="mt-2 w-full rounded-xl bg-[var(--accent)] py-2.5 text-sm font-extrabold text-[var(--accent-contrast)] disabled:opacity-50"
      >
        {sending ? sendingLabel : submitLabel}
      </button>
    </section>
  );
}

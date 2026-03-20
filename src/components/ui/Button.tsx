import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

type Props = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    loading?: boolean;
  }
>;

export function Button({ loading, disabled, children, ...rest }: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={[
        'w-full rounded-xl px-4 py-3 text-base font-semibold',
        'bg-slate-900 text-white',
        'disabled:opacity-50 disabled:cursor-not-allowed',
      ].join(' ')}
    >
      <span className="inline-flex items-center justify-center gap-2">
        {loading ? (
          <span
            aria-hidden
            className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
          />
        ) : null}
        {children}
      </span>
    </button>
  );
}


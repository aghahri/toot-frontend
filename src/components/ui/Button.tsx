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
      {loading ? '...' : children}
    </button>
  );
}


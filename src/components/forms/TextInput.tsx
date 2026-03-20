import type { InputHTMLAttributes } from 'react';

type Props = {
  label?: string;
  error?: string;
} & InputHTMLAttributes<HTMLInputElement>;

export function TextInput({ label, error, ...rest }: Props) {
  return (
    <label className="block">
      {label ? <div className="mb-1 text-sm font-semibold text-slate-700">{label}</div> : null}
      <input
        {...rest}
        className={[
          'w-full rounded-xl border px-4 py-3 text-base outline-none',
          'border-slate-200 bg-white focus:border-slate-400',
          error ? 'border-red-400' : '',
        ].join(' ')}
      />
      {error ? <div className="mt-1 text-xs text-red-600">{error}</div> : null}
    </label>
  );
}


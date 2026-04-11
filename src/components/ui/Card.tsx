import type { PropsWithChildren } from 'react';

type CardProps = PropsWithChildren<{
  className?: string;
}>;

export function Card({ children, className }: CardProps) {
  return (
    <div
      className={['rounded-2xl border border-slate-200 bg-white p-4 shadow-sm', className]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}


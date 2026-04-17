import type { PropsWithChildren } from 'react';

type CardProps = PropsWithChildren<{
  className?: string;
}>;

export function Card({ children, className }: CardProps) {
  return (
    <div
      className={['theme-card-bg theme-border-soft rounded-2xl border p-4 shadow-sm', className]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}


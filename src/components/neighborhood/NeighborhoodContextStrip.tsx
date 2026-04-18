import type { ReactNode } from 'react';

export type NetworkRole = 'NETWORK_ADMIN' | 'MEMBER' | null | undefined;

export function networkRoleBadgeFa(role: NetworkRole, mode: 'forms' | 'general' = 'general'): string {
  if (role === 'NETWORK_ADMIN') return 'شما ادمین این شبکه محله هستید.';
  if (role === 'MEMBER') {
    if (mode === 'forms') return 'شما عضو این شبکه هستید (ادمین شبکه نیستید).';
    return 'شما عضو این شبکه هستید — می‌توانید در همین بخش محله مشارکت کنید.';
  }
  return 'نقش شما در این شبکه مشخص نیست؛ در صورت تازه‌پیوستن، صفحه را تازه کنید.';
}

type ContextProps = {
  networkName: string;
  role: NetworkRole;
  /** forms: emphasize admin vs member for فرم management copy */
  mode?: 'forms' | 'general';
  /** Extra lines specific to the page (e.g. forms vs polls) */
  children?: ReactNode;
};

/** Selected neighborhood network + role from GET /networks (myRole). */
export function NeighborhoodNetworkContext({ networkName, role, mode = 'general', children }: ContextProps) {
  return (
    <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2.5 ring-1 ring-[var(--border-soft)]">
      <p className="text-xs font-black text-[var(--text-primary)]">شبکه فعال: {networkName}</p>
      <p className="mt-1 text-[10px] leading-relaxed text-[var(--text-secondary)]">{networkRoleBadgeFa(role, mode)}</p>
      {children}
    </div>
  );
}

type VisibilityProps = {
  networkName: string;
  topic: 'polls' | 'bulletin' | 'showcase';
};

const VISIBILITY: Record<VisibilityProps['topic'], string> = {
  polls:
    'محتوا به همین شبکه وصل است. فقط اعضای این شبکه این فهرست را در بخش محله می‌بینند؛ در فید خانه نمایش داده نمی‌شود.',
  bulletin:
    'اعلان‌ها به همین شبکه وصل‌اند. فقط اعضای این شبکه در همین صفحه می‌بینند؛ فید عمومی نیست.',
  showcase:
    'معرفی‌ها به همین شبکه وصل‌اند. فقط اعضای این شبکه در همین صفحه می‌بینند؛ بازار جداگانه نیست.',
};

export function NeighborhoodVisibilityNote({ networkName, topic }: VisibilityProps) {
  return (
    <p className="rounded-xl bg-[var(--card-bg)] px-2.5 py-2 text-[10px] leading-relaxed text-[var(--text-secondary)] ring-1 ring-[var(--border-soft)]">
      <span className="font-bold text-[var(--text-primary)]">«{networkName}»</span> — {VISIBILITY[topic]}
    </p>
  );
}

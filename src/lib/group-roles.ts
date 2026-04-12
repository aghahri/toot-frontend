/** Backend GroupMemberRole (+ legacy GROUP_ADMIN from older clients). */
export function groupRoleLabelFa(role: string | null | undefined): string {
  switch (role) {
    case 'OWNER':
      return 'مالک';
    case 'ADMIN':
    case 'GROUP_ADMIN':
      return 'مدیر';
    case 'MEMBER':
    default:
      return 'عضو';
  }
}

/** Tailwind classes for role pills (WhatsApp-like clarity). */
export function groupRoleBadgeClasses(role: string | null | undefined): string {
  switch (role) {
    case 'OWNER':
      return 'bg-amber-100 text-amber-950 ring-1 ring-amber-200/90';
    case 'ADMIN':
    case 'GROUP_ADMIN':
      return 'bg-sky-100 text-sky-950 ring-1 ring-sky-200/90';
    case 'MEMBER':
    default:
      return 'bg-stone-100 text-stone-700 ring-1 ring-stone-200/80';
  }
}

export function isGroupManagerRole(role: string | null | undefined): boolean {
  return role === 'OWNER' || role === 'ADMIN' || role === 'GROUP_ADMIN';
}

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

export function isGroupManagerRole(role: string | null | undefined): boolean {
  return role === 'OWNER' || role === 'ADMIN' || role === 'GROUP_ADMIN';
}

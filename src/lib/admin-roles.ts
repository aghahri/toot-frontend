/** Must match backend `ADMIN_ASSIGNABLE_ROLES` (Prisma GlobalRole string values). */
export const ADMIN_ASSIGNABLE_ROLES = [
  'USER',
  'SUPPORT_ADMIN',
  'SHOWCASE_ADMIN',
  'GEOGRAPHY_ADMIN',
  'MODERATION_ADMIN',
  'SUPER_ADMIN',
] as const;

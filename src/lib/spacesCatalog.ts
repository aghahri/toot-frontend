/** v1 space keys — must match backend GroupSpaceCategory and discover routes. */
export const SPACE_KEYS = [
  'PUBLIC_GENERAL',
  'NEIGHBORHOOD',
  'EDUCATION',
  'SPORT',
  'TECH',
] as const;

export type SpaceKey = (typeof SPACE_KEYS)[number];

export function isSpaceKey(value: string): value is SpaceKey {
  return (SPACE_KEYS as readonly string[]).includes(value);
}

export const SPACE_CARD_META: Record<
  SpaceKey,
  { title: string; subtitle: string; gradient: string; ring: string }
> = {
  PUBLIC_GENERAL: {
    title: 'فضاهای عمومی',
    subtitle: 'دسترسی همگانی',
    gradient: 'from-slate-600 via-slate-700 to-zinc-900',
    ring: 'ring-slate-300/50',
  },
  NEIGHBORHOOD: {
    title: 'فضای محله',
    subtitle: 'همسایگی و محله',
    gradient: 'from-emerald-600 via-teal-600 to-cyan-800',
    ring: 'ring-emerald-200/60',
  },
  EDUCATION: {
    title: 'فضای آموزش',
    subtitle: 'یادگیری و مهارت',
    gradient: 'from-indigo-600 via-violet-600 to-purple-900',
    ring: 'ring-violet-200/55',
  },
  SPORT: {
    title: 'فضای ورزش',
    subtitle: 'تحرک و سلامت',
    gradient: 'from-orange-500 via-rose-600 to-red-800',
    ring: 'ring-orange-200/55',
  },
  TECH: {
    title: 'فضای تکنولوژی',
    subtitle: 'فناوری و ابزار',
    gradient: 'from-sky-600 via-blue-700 to-slate-900',
    ring: 'ring-sky-200/60',
  },
};

export type SpaceSummaryRow = {
  category: SpaceKey;
  groups: number;
  networks: number;
  channels: number;
};

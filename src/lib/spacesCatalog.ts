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
    title: 'کسب‌وکار',
    subtitle: 'شبکه و همکاری حرفه‌ای',
    gradient: 'from-slate-600 via-slate-700 to-zinc-900',
    ring: 'ring-slate-300/50',
  },
  NEIGHBORHOOD: {
    title: 'محله',
    subtitle: 'زندگی و همسایگی محلی',
    gradient: 'from-emerald-600 via-teal-600 to-cyan-800',
    ring: 'ring-emerald-200/60',
  },
  EDUCATION: {
    title: 'آموزش',
    subtitle: 'یادگیری و مهارت',
    gradient: 'from-indigo-600 via-violet-600 to-purple-900',
    ring: 'ring-violet-200/55',
  },
  SPORT: {
    title: 'ورزش',
    subtitle: 'تیم، هواداری و تمرین',
    gradient: 'from-orange-500 via-rose-600 to-red-800',
    ring: 'ring-orange-200/55',
  },
  TECH: {
    title: 'گیمینگ',
    subtitle: 'کلن، اسکاد و جامعه بازی',
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

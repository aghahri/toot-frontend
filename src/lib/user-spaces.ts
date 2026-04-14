export const USER_SPACE_KEYS = [
  'neighborhood',
  'education',
  'sports',
  'culture',
  'business',
  'technology',
  'family',
  'health',
  'gaming',
  'university',
] as const;

export type UserSpaceKey = (typeof USER_SPACE_KEYS)[number];

export const USER_SPACE_META: Record<
  UserSpaceKey,
  { labelFa: string; labelEn: string; emoji: string; accent: string }
> = {
  neighborhood: {
    labelFa: 'محله',
    labelEn: 'Neighborhood',
    emoji: '🏘',
    accent: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  },
  education: {
    labelFa: 'آموزش',
    labelEn: 'Education',
    emoji: '🎓',
    accent: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  },
  sports: {
    labelFa: 'ورزش',
    labelEn: 'Sports',
    emoji: '⚽',
    accent: 'bg-orange-50 text-orange-700 ring-orange-200',
  },
  culture: {
    labelFa: 'فرهنگ',
    labelEn: 'Culture',
    emoji: '🎭',
    accent: 'bg-pink-50 text-pink-700 ring-pink-200',
  },
  business: {
    labelFa: 'کسب‌وکار',
    labelEn: 'Business',
    emoji: '💼',
    accent: 'bg-amber-50 text-amber-700 ring-amber-200',
  },
  technology: {
    labelFa: 'تکنولوژی',
    labelEn: 'Technology',
    emoji: '💻',
    accent: 'bg-sky-50 text-sky-700 ring-sky-200',
  },
  family: {
    labelFa: 'خانواده',
    labelEn: 'Family',
    emoji: '👨‍👩‍👧‍👦',
    accent: 'bg-rose-50 text-rose-700 ring-rose-200',
  },
  health: {
    labelFa: 'سلامت',
    labelEn: 'Health',
    emoji: '🩺',
    accent: 'bg-teal-50 text-teal-700 ring-teal-200',
  },
  gaming: {
    labelFa: 'گیم',
    labelEn: 'Gaming',
    emoji: '🎮',
    accent: 'bg-violet-50 text-violet-700 ring-violet-200',
  },
  university: {
    labelFa: 'دانشگاه',
    labelEn: 'University',
    emoji: '🏛',
    accent: 'bg-slate-100 text-slate-700 ring-slate-300',
  },
};


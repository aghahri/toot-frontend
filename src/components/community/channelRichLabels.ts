/** Persian labels for channel richness — driven by API enums, no fake data. */

export const POSTING_MODE_FA: Record<string, string> = {
  ADMINS_ONLY: 'فقط مدیران',
  PUBLISHERS_AND_ADMINS: 'مدیر و ناشر',
  ALL_MEMBERS: 'همه اعضا',
};

export const CHANNEL_ROLE_FA: Record<string, string> = {
  CHANNEL_ADMIN: 'مدیر کانال',
  PUBLISHER: 'ناشر',
  SUBSCRIBER: 'مشترک',
};

/** Short hint under title — subtle permission clarity */
export function channelRoleHintFa(role: string | null | undefined, isMember: boolean): string | null {
  if (!isMember || !role) return null;
  if (role === 'CHANNEL_ADMIN') return 'شما مدیر این کانال هستید';
  if (role === 'PUBLISHER') return 'شما منتشرکننده هستید';
  if (role === 'SUBSCRIBER') return 'شما مشترک این کانال هستید';
  return null;
}

export function networkTypeBadgeFa(networkType: string | undefined): string | null {
  switch (networkType) {
    case 'NEIGHBORHOOD':
      return 'شبکه محله‌ای';
    case 'BUSINESS':
      return 'کسب‌وکار';
    case 'EDUCATION':
      return 'آموزش';
    case 'SPORTS':
      return 'ورزش';
    case 'GAMING':
      return 'بازی';
    case 'GENERAL':
      return 'عمومی';
    default:
      return null;
  }
}

export function spaceCategoryBadgeFa(spaceCategory: string | undefined): string | null {
  switch (spaceCategory) {
    case 'NEIGHBORHOOD':
      return 'محله';
    case 'EDUCATION':
      return 'آموزش';
    case 'SPORT':
      return 'ورزش';
    case 'TECH':
      return 'فناوری';
    case 'PUBLIC_GENERAL':
      return 'عمومی';
    default:
      return null;
  }
}

export function readOnlyHintForPostingMode(postingMode: string | undefined): string {
  switch (postingMode) {
    case 'ADMINS_ONLY':
      return 'فقط مدیران کانال می‌توانند اینجا منتشر کنند.';
    case 'PUBLISHERS_AND_ADMINS':
      return 'فقط مدیران و ناشران می‌توانند در این کانال پست بگذارند.';
    case 'ALL_MEMBERS':
      return 'ارسال برای همه اعضا فعال است؛ نقش شما اجازهٔ انتشار نمی‌دهد.';
    default:
      return 'طبق تنظیمات کانال، ارسال برای شما فعال نیست.';
  }
}

export type ChannelEmptyKind = 'neighborhood' | 'business' | 'education' | 'sport' | 'general';

export function resolveChannelEmptyKind(
  spaceCategory: string | undefined,
  networkType: string | undefined,
): ChannelEmptyKind {
  if (spaceCategory === 'NEIGHBORHOOD' || networkType === 'NEIGHBORHOOD') return 'neighborhood';
  if (networkType === 'BUSINESS') return 'business';
  if (spaceCategory === 'EDUCATION' || networkType === 'EDUCATION') return 'education';
  if (spaceCategory === 'SPORT' || networkType === 'SPORTS') return 'sport';
  return 'general';
}

export function channelEmptyStateCopy(
  kind: ChannelEmptyKind,
  canPost: boolean,
): { title: string; subtitle: string; cta?: string } {
  switch (kind) {
    case 'neighborhood':
      return {
        title: 'هنوز انتشاری ثبت نشده',
        subtitle: 'این کانال برای اطلاعیه‌های محله آماده است؛ اخبار و اعلان‌های محلی اینجا پخش می‌شوند.',
        cta: canPost ? 'اولین مطلب را منتشر کنید' : 'این کانال را دنبال کنید',
      };
    case 'business':
      return {
        title: 'هنوز انتشاری ثبت نشده',
        subtitle: 'این کانال برای اطلاعیه‌ها و انتشار اخبار آماده است؛ فضای رسمی و قابل اعتماد برای سازمان شما.',
        cta: canPost ? 'اولین مطلب را منتشر کنید' : 'این کانال را دنبال کنید',
      };
    case 'education':
      return {
        title: 'هنوز انتشاری ثبت نشده',
        subtitle: 'این کانال برای انتشار مطالب آموزشی آماده است؛ برنامه‌ها و مطالب را اینجا اطلاع‌رسانی کنید.',
        cta: canPost ? 'اولین مطلب را منتشر کنید' : 'این کانال را دنبال کنید',
      };
    case 'sport':
      return {
        title: 'هنوز انتشاری ثبت نشده',
        subtitle: 'اخبار تیم و رویدادها را اینجا به‌صورت فید رسمی منتشر کنید.',
        cta: canPost ? 'اولین مطلب را منتشر کنید' : 'این کانال را دنبال کنید',
      };
    default:
      return {
        title: 'کانال آمادهٔ اولین انتشار است',
        subtitle: 'این فضا برای پخش و اطلاع‌رسانی است؛ رفتار آن شبیه گفت‌وگوی گروهی نیست.',
        cta: canPost ? 'اولین مطلب را منتشر کنید' : 'این کانال را دنبال کنید',
      };
  }
}

/** One-line broadcast purpose under the title — publication-first positioning */
export function channelHeroTagline(kind: ChannelEmptyKind, networkName: string): string {
  switch (kind) {
    case 'business':
      return `اطلاعیه‌ها، فرصت‌های شغلی و اخبار — ${networkName}`;
    case 'neighborhood':
      return `اطلاعیه‌ها و اخبار محلی — ${networkName}`;
    case 'education':
      return `مطالب آموزشی و برنامه‌ها — ${networkName}`;
    case 'sport':
      return `اخبار و رویدادها — ${networkName}`;
    default:
      return `فضای انتشار و اطلاع‌رسانی — ${networkName}`;
  }
}

/** Subtle hero chrome — not a giant banner */
export function channelHeroSurfaceClass(kind: ChannelEmptyKind): string {
  switch (kind) {
    case 'business':
      return 'border-slate-300/80 bg-[linear-gradient(145deg,rgba(15,23,42,0.06)_0%,rgba(99,102,241,0.06)_45%,transparent_100%)] shadow-[0_12px_40px_-12px_rgba(15,23,42,0.25)]';
    case 'neighborhood':
      return 'border-emerald-400/35 bg-[linear-gradient(145deg,rgba(16,185,129,0.09)_0%,rgba(59,130,246,0.05)_50%,transparent_100%)] shadow-[0_12px_36px_-14px_rgba(16,185,129,0.28)]';
    case 'education':
      return 'border-indigo-400/30 bg-[linear-gradient(145deg,rgba(99,102,241,0.08)_0%,transparent_55%)] shadow-md';
    case 'sport':
      return 'border-orange-400/30 bg-[linear-gradient(145deg,rgba(249,115,22,0.07)_0%,transparent_55%)] shadow-md';
    default:
      return 'border-[var(--border-soft)] bg-[var(--card-bg)] shadow-md';
  }
}

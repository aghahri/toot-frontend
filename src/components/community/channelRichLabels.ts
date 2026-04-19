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
        title: 'هنوز اطلاعیه‌ای منتشر نشده',
        subtitle: 'این کانال برای اطلاع‌رسانی محلی آماده است؛ اولین خبر را همین‌جا منتشر کنید.',
        cta: canPost ? 'اولین انتشار را بنویسید' : undefined,
      };
    case 'business':
      return {
        title: 'هنوز محتوایی منتشر نشده',
        subtitle: 'کانال رسمی سازمان شماست؛ اعلان‌ها و فرصت‌ها را اینجا منتشر کنید.',
        cta: canPost ? 'اولین اعلان یا فرصت شغلی را منتشر کنید' : undefined,
      };
    case 'education':
      return {
        title: 'هنوز مطلبی منتشر نشده',
        subtitle: 'کلاس، اخبار و برنامه‌ها را در این کانال اطلاع‌رسانی کنید.',
        cta: canPost ? 'اولین مطلب آموزشی را بنویسید' : undefined,
      };
    case 'sport':
      return {
        title: 'هنوز خبری منتشر نشده',
        subtitle: 'اخبار تیم و رویدادها را اینجا با اعضا به اشتراک بگذارید.',
        cta: canPost ? 'اولین خبر را منتشر کنید' : undefined,
      };
    default:
      return {
        title: 'این کانال آمادهٔ اولین انتشار است',
        subtitle: 'پیام‌ها اینجا به‌صورت فید منتشر می‌شوند؛ با ابزارهای مرتبط، محله و شبکه را به کانال وصل کنید.',
        cta: canPost ? 'اولین پست را بنویسید' : undefined,
      };
  }
}

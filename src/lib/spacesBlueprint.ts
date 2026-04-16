import type { SpaceKey } from './spacesCatalog';

export type SpaceCapabilityStage = 'active' | 'foundation' | 'planned';

export type SpaceCapability = {
  id: string;
  title: string;
  stage: SpaceCapabilityStage;
};

export type SpaceBlueprint = {
  id: 'neighborhood' | 'education' | 'sports' | 'gaming' | 'business';
  titleFa: string;
  titleEn: string;
  summaryFa: string;
  valueFa: string;
  badge: string;
  accentClass: string;
  mappedCategory: SpaceKey;
  capabilities: SpaceCapability[];
  utilities?: Array<{
    id: string;
    title: string;
    description: string;
    cta: string;
  }>;
};

export const SPACE_BLUEPRINTS: readonly SpaceBlueprint[] = [
  {
    id: 'neighborhood',
    titleFa: 'فضای محله',
    titleEn: 'Neighborhood',
    summaryFa: 'اکوسیستم محله برای شبکه‌های واقعی، گروه‌های خدماتی و تعامل همسایگی.',
    valueFa: 'پایه قوی برای رشد شبکه‌های محله‌محور و کسب‌وکارهای محلی.',
    badge: 'Flagship',
    accentClass: 'from-emerald-600 via-teal-600 to-cyan-800 ring-emerald-200/60',
    mappedCategory: 'NEIGHBORHOOD',
    capabilities: [
      { id: 'forms', title: 'فرم‌های محله‌ای', stage: 'foundation' },
      { id: 'polls', title: 'نظرسنجی‌های محلی', stage: 'planned' },
      { id: 'local-biz-groups', title: 'گروه‌های کسب‌وکار محلی', stage: 'active' },
    ],
    utilities: [
      {
        id: 'local-survey-forms',
        title: 'Local Survey Forms',
        description: 'فرم‌های محلی برای جمع‌آوری داده و بازخورد شهروندی در سطح محله.',
        cta: 'شروع فرم محلی',
      },
      {
        id: 'neighborhood-requests',
        title: 'Neighborhood Requests',
        description: 'ثبت و پیگیری درخواست‌های محله‌ای برای مسائل خدماتی و اجتماعی.',
        cta: 'ثبت درخواست',
      },
      {
        id: 'local-business-directory',
        title: 'Local Business Directory',
        description: 'فهرست کسب‌وکارهای محلی برای معرفی خدمات محله و اتصال سریع مردم.',
        cta: 'مشاهده فهرست',
      },
      {
        id: 'community-bulletin',
        title: 'Community Bulletin',
        description: 'تابلوی اعلانات محله برای اطلاع‌رسانی رویدادها و پیام‌های عمومی.',
        cta: 'بازکردن تابلوی محله',
      },
      {
        id: 'join-district-networks',
        title: 'Join District Networks',
        description: 'ورود به شبکه‌های ناحیه‌ای برای مشارکت مستقیم در فعالیت‌های محلی.',
        cta: 'پیوستن به شبکه ناحیه',
      },
    ],
  },
  {
    id: 'education',
    titleFa: 'فضای آموزش',
    titleEn: 'Education',
    summaryFa: 'برای دانشگاه‌ها، کلاس‌ها و جامعه‌های یادگیری تخصصی.',
    valueFa: 'مسیر آماده برای کلاس، انجمن آموزشی و ابزارهای نقش‌محور.',
    badge: 'Flagship',
    accentClass: 'from-indigo-600 via-violet-600 to-purple-900 ring-violet-200/60',
    mappedCategory: 'EDUCATION',
    capabilities: [
      { id: 'class-groups', title: 'گروه‌های کلاسی', stage: 'active' },
      { id: 'teacher-roles', title: 'جریان نقش‌محور مدرس/استاد', stage: 'foundation' },
      { id: 'assignments', title: 'تکلیف/ویدیو/ارزیابی', stage: 'planned' },
    ],
    utilities: [
      {
        id: 'student-groups',
        title: 'Student Groups',
        description: 'گروه‌های دانشجویی برای تعامل کلاسی، گفتگوهای درسی و هماهنگی پروژه‌ها.',
        cta: 'ورود به Student Groups',
      },
      {
        id: 'teacher-channels',
        title: 'Teacher Channels',
        description: 'کانال‌های مدرسین برای اطلاع‌رسانی رسمی، برنامه کلاس و محتوای آموزشی.',
        cta: 'مشاهده Teacher Channels',
      },
      {
        id: 'homework-assignment-groups',
        title: 'Homework & Assignment Groups',
        description: 'ساختار گروهی برای پیگیری تکالیف، تحویل پروژه و همکاری آموزشی.',
        cta: 'راه‌اندازی Assignment Group',
      },
      {
        id: 'class-communities',
        title: 'Class Communities',
        description: 'کامیونیتی‌های کلاسی برای هر درس/دانشکده با فضای گفتگو و ارتباط پایدار.',
        cta: 'ورود به Class Community',
      },
      {
        id: 'verified-teacher-identity',
        title: 'Verified Teacher / Professor identity',
        description: 'زیرساخت هویت تاییدشده برای مدرس/استاد در مسیر نقش‌محور آموزشی.',
        cta: 'مشاهده وضعیت تایید هویت',
      },
      {
        id: 'live-video-class',
        title: 'Future Live Class / Video Class support',
        description: 'مسیر توسعه برای کلاس زنده و ویدیوکلاس در فازهای بعدی آموزشی.',
        cta: 'بررسی Live Class Roadmap',
      },
    ],
  },
  {
    id: 'sports',
    titleFa: 'فضای ورزش',
    titleEn: 'Sports',
    summaryFa: 'برای باشگاه‌ها، تیم‌ها و اجتماع‌های ورزشی.',
    valueFa: 'سازمان‌دهی بهتر تعاملات تیمی و فعالیت‌های ورزشی.',
    badge: 'Flagship',
    accentClass: 'from-orange-500 via-rose-600 to-red-800 ring-orange-200/60',
    mappedCategory: 'SPORT',
    capabilities: [
      { id: 'team-groups', title: 'گروه‌های تیمی', stage: 'active' },
      { id: 'coach-structures', title: 'ساختار مربی/تیم', stage: 'foundation' },
      { id: 'training-tools', title: 'ابزار تمرین و برنامه', stage: 'planned' },
    ],
  },
  {
    id: 'gaming',
    titleFa: 'فضای گیمینگ',
    titleEn: 'Gaming',
    summaryFa: 'برای کامیونیتی بازی، کلن/گیلد و انجمن‌های گفتگو.',
    valueFa: 'اکوسیستم بازی از همین امروز با پایه اجتماعی قابل توسعه.',
    badge: 'Flagship',
    accentClass: 'from-violet-600 via-fuchsia-700 to-indigo-900 ring-violet-200/60',
    mappedCategory: 'TECH',
    capabilities: [
      { id: 'guild-groups', title: 'گروه‌های کلن/گیلد', stage: 'foundation' },
      { id: 'game-forums', title: 'فروم‌های بازی', stage: 'planned' },
      { id: 'match-lobbies', title: 'اتاق‌های هماهنگی بازی', stage: 'planned' },
    ],
  },
  {
    id: 'business',
    titleFa: 'فضای کسب‌وکار',
    titleEn: 'Business',
    summaryFa: 'برای تیم‌ها، همکاری حرفه‌ای و گروه‌های عملیاتی.',
    valueFa: 'مسیر واضح برای رشد شبکه‌های همکاری و تیم‌های کسب‌وکاری.',
    badge: 'Flagship',
    accentClass: 'from-amber-600 via-orange-700 to-rose-800 ring-amber-200/60',
    mappedCategory: 'PUBLIC_GENERAL',
    capabilities: [
      { id: 'collab-groups', title: 'گروه‌های همکاری', stage: 'active' },
      { id: 'team-roles', title: 'نقش‌های تیمی', stage: 'foundation' },
      { id: 'workflow-tools', title: 'ابزارهای گردش‌کار', stage: 'planned' },
    ],
  },
];

export function capabilityStageLabel(stage: SpaceCapabilityStage): string {
  if (stage === 'active') return 'فعال';
  if (stage === 'foundation') return 'پایه';
  return 'بعدی';
}


type SmartReplyInput = {
  latestText: string;
  latestMessageType?: string;
};

function normalizePersian(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ي]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/[آأإ]/g, 'ا')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const RULES: Array<{ needles: string[]; replies: string[] }> = [
  {
    needles: ['سلام', 'درود'],
    replies: ['سلام عزیزم', 'درود', 'خوبی؟', 'سلام، چطوری؟'],
  },
  {
    needles: ['چی شد', 'چه شد'],
    replies: ['الان بررسی می‌کنم', 'اوکی، پیگیری می‌کنم', 'یه لحظه صبر کن', 'الان خبر می‌دم'],
  },
  {
    needles: ['کجایی', 'کجاستی', 'کجای', 'کی میای', 'کی میایی'],
    replies: ['الان میام', 'در راهَم', 'چند دقیقه دیگه می‌رسم', 'همین حوالی‌ام'],
  },
  {
    needles: ['چرا'],
    replies: ['الان توضیح می‌دم', 'حق با توئه', 'بذار شفاف بگم', 'اشتباه از من بود'],
  },
  {
    needles: ['باشه', 'اوکی', 'ok', 'okay', 'انجام شد', 'میام', 'رسیدم'],
    replies: ['عالیه', 'حله', 'پس هماهنگه', 'ممنون'],
  },
  {
    needles: ['ناراحتم', 'ناراحتم', 'دلم تنگ شده', 'دلتنگم', 'دوستت دارم'],
    replies: ['منم کنارت هستم', 'قلبم پیشته', 'منم دوستت دارم', 'فدات شم'],
  },
  {
    needles: ['دمت گرم', 'عشقی', 'نوکرم'],
    replies: ['قربانت', 'مخلصم', 'ارادت داریم', 'فدات'],
  },
  {
    needles: ['ببخشید', 'ببخش', 'شرمنده'],
    replies: ['خواهش می‌کنم', 'اتفاقی نیفتاده', 'اوکیه', 'مهم نیست'],
  },
  {
    needles: ['فردا', 'امشب', 'الان', 'دیر میشه', 'دیر می‌شود'],
    replies: ['اوکی، هماهنگ می‌کنیم', 'من پایه‌ام', 'ساعتشو بگو', 'باشه خبر بده'],
  },
  {
    needles: ['زنگ بزن', 'تماس بگیر', 'وقت داری'],
    replies: ['الان زنگ می‌زنم', 'چند دقیقه دیگه', 'الان نمی‌تونم', 'پیام بده لطفاً'],
  },
  {
    needles: ['مرسی', 'ممنون', 'لطف کردی'],
    replies: ['خواهش می‌کنم', 'قابلی نداشت', 'قربانت', 'در خدمتم'],
  },
  {
    needles: ['خسته شدم', 'خستم'],
    replies: ['استراحت کن', 'حق داری', 'یه چایی بخور', 'من هستم'],
  },
];

const FALLBACK_REPLIES = ['باشه', 'حله', 'الان می‌گم', 'مرسی'];

export function getSmartPersianReplies(input: SmartReplyInput): string[] {
  if (input.latestMessageType && input.latestMessageType !== 'TEXT') {
    return FALLBACK_REPLIES;
  }
  const text = normalizePersian(input.latestText || '');
  if (!text) return FALLBACK_REPLIES;

  const collected: string[] = [];
  for (const rule of RULES) {
    if (rule.needles.some((needle) => text.includes(normalizePersian(needle)))) {
      for (const reply of rule.replies) {
        if (!collected.includes(reply)) collected.push(reply);
      }
      if (collected.length >= 4) break;
    }
  }
  if (collected.length > 0) return collected.slice(0, 4);
  return FALLBACK_REPLIES.slice(0, 4);
}

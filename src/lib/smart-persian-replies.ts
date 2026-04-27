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
    needles: ['سلام'],
    replies: ['سلام عزیزم', 'درود', 'خوبی؟', 'سلام، چطوری؟'],
  },
  {
    needles: ['کجایی', 'کجاستی', 'کجای'],
    replies: ['الان میام', 'در راهَم', 'چند دقیقه دیگه می‌رسم', 'همین حوالی‌ام'],
  },
  {
    needles: ['دمت گرم'],
    replies: ['قربانت', 'انجام وظیفه بود', 'مرسی از تو', 'مخلصم'],
  },
  {
    needles: ['ممنون', 'مرسی'],
    replies: ['خواهش می‌کنم', 'قابلی نداشت', 'قربانت', 'در خدمتم'],
  },
  {
    needles: ['خسته شدم', 'خستم'],
    replies: ['استراحت کن', 'حق داری', 'یه چایی بخور', 'من هستم'],
  },
  {
    needles: ['دوستت دارم'],
    replies: ['منم دوستت دارم', 'قربونت', 'دلم برات تنگ شده', 'عزیز دلمی'],
  },
  {
    needles: ['باشه', 'اوکی', 'ok', 'okay'],
    replies: ['عالیه', 'حله', 'پس هماهنگه', 'ممنون'],
  },
  {
    needles: ['زنگ بزن', 'تماس بگیر'],
    replies: ['الان زنگ می‌زنم', 'چند دقیقه دیگه', 'الان نمی‌تونم', 'پیام بده لطفاً'],
  },
];

const FALLBACK_REPLIES = ['باشه', 'حله', 'الان می‌گم', 'مرسی'];

export function getSmartPersianReplies(input: SmartReplyInput): string[] {
  if (input.latestMessageType && input.latestMessageType !== 'TEXT') {
    return FALLBACK_REPLIES;
  }
  const text = normalizePersian(input.latestText || '');
  if (!text) return FALLBACK_REPLIES;

  for (const rule of RULES) {
    if (rule.needles.some((needle) => text.includes(normalizePersian(needle)))) {
      return rule.replies.slice(0, 4);
    }
  }
  return FALLBACK_REPLIES;
}

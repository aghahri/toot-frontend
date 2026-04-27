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
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type ReplyRule = {
  exactPhrases?: string[];
  containsPhrases?: string[];
  intentWords?: string[];
  replies: string[];
};

const RULES: ReplyRule[] = [
  {
    exactPhrases: ['سلام'],
    containsPhrases: ['سلام'],
    intentWords: ['درود'],
    replies: ['سلام عزیزم', 'درود', 'خوبی؟', 'سلام، چطوری؟'],
  },
  {
    exactPhrases: ['چی شد', 'چه شد'],
    containsPhrases: ['چی شد', 'چه شد'],
    intentWords: ['چرا'],
    replies: ['الان بررسی می‌کنم', 'اوکی، پیگیری می‌کنم', 'یه لحظه صبر کن', 'الان خبر می‌دم'],
  },
  {
    exactPhrases: ['کجایی', 'کی میای', 'کی میایی'],
    containsPhrases: ['کجایی', 'کی میای', 'کی میایی'],
    intentWords: ['کجاستی', 'کجای'],
    replies: ['الان میام', 'در راهم', 'نزدیکم', 'چند دقیقه دیگه'],
  },
  {
    exactPhrases: ['باشه', 'اوکی', 'ok', 'okay', 'انجام شد', 'میام', 'رسیدم'],
    containsPhrases: ['باشه', 'اوکی', 'انجام شد', 'میام', 'رسیدم'],
    intentWords: ['okay', 'ok'],
    replies: ['عالیه', 'حله', 'پس هماهنگه', 'ممنون'],
  },
  {
    exactPhrases: ['دلم تنگه', 'دلم تنگ شده', 'تنگ شده'],
    containsPhrases: ['دلم تنگ', 'تنگ شده'],
    intentWords: ['دلتنگ'],
    replies: ['منم دلم برات تنگ شده', 'قربونت', 'زود می‌بینمت', 'عزیز دلم'],
  },
  {
    exactPhrases: ['دوستت دارم'],
    containsPhrases: ['دوستت دارم'],
    intentWords: ['عاشقتم'],
    replies: ['منم دوستت دارم', 'قربونت', 'عشق منی', '❤️'],
  },
  {
    exactPhrases: ['ناراحتم'],
    containsPhrases: ['ناراحتم'],
    intentWords: ['غمگینم', 'حالم بده'],
    replies: ['چی شده؟', 'من هستم', 'درست میشه', 'بغلت کنم؟'],
  },
  {
    exactPhrases: ['خسته شدم', 'خستم'],
    containsPhrases: ['خسته شدم', 'خستم'],
    intentWords: ['خسته'],
    replies: ['استراحت کن', 'یه چایی بخور', 'حق داری', 'فردا بهتره'],
  },
  {
    exactPhrases: ['دمت گرم', 'عشقی', 'نوکرم'],
    containsPhrases: ['دمت گرم', 'عشقی', 'نوکرم'],
    intentWords: ['رفیق'],
    replies: ['قربانت', 'مخلصم', 'ارادت داریم', 'فدات'],
  },
  {
    exactPhrases: ['ببخشید', 'ببخش', 'شرمنده'],
    containsPhrases: ['ببخشید', 'ببخش', 'شرمنده'],
    intentWords: [],
    replies: ['خواهش می‌کنم', 'اتفاقی نیفتاده', 'اوکیه', 'مهم نیست'],
  },
  {
    exactPhrases: ['فردا', 'امشب', 'الان', 'دیر میشه', 'دیر می شود'],
    containsPhrases: ['فردا', 'امشب', 'دیر میشه', 'دیر می شود'],
    intentWords: ['الان'],
    replies: ['اوکی، هماهنگ می‌کنیم', 'من پایه‌ام', 'ساعتشو بگو', 'باشه خبر بده'],
  },
  {
    exactPhrases: ['زنگ بزن', 'تماس بگیر', 'وقت داری'],
    containsPhrases: ['زنگ بزن', 'تماس بگیر', 'وقت داری'],
    intentWords: ['زنگ', 'تماس'],
    replies: ['الان زنگ می‌زنم', 'چند دقیقه دیگه', 'الان نمیتونم', 'پیام بده'],
  },
  {
    exactPhrases: ['مرسی', 'ممنون', 'لطف کردی'],
    containsPhrases: ['مرسی', 'ممنون', 'لطف کردی'],
    intentWords: ['متشکرم'],
    replies: ['خواهش می‌کنم', 'قابلی نداشت', 'قربانت', 'انجام وظیفه بود'],
  },
];

const FALLBACK_REPLIES = ['باشه', 'حله', 'الان می‌گم', 'مرسی'];

function hasAny(text: string, phrases: string[] | undefined): boolean {
  if (!phrases?.length) return false;
  return phrases.some((phrase) => {
    const p = normalizePersian(phrase);
    return !!p && text.includes(p);
  });
}

export function getSmartPersianReplies(input: SmartReplyInput): string[] {
  if (input.latestMessageType && input.latestMessageType !== 'TEXT') {
    return FALLBACK_REPLIES;
  }
  const text = normalizePersian(input.latestText || '');
  if (!text) return FALLBACK_REPLIES;

  // 1) exact phrase cluster
  for (const rule of RULES) {
    if (hasAny(text, rule.exactPhrases)) {
      return rule.replies.slice(0, 4);
    }
  }

  // 2) contains phrase cluster
  for (const rule of RULES) {
    if (hasAny(text, rule.containsPhrases)) {
      return rule.replies.slice(0, 4);
    }
  }

  // 3) intent-word cluster
  for (const rule of RULES) {
    if (hasAny(text, rule.intentWords)) {
      return rule.replies.slice(0, 4);
    }
  }

  // 4) generic fallback only if nothing matched
  return FALLBACK_REPLIES.slice(0, 4);
}

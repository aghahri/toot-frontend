export type StickerItemLite = {
  id: string;
  packId: string;
  url: string;
  label: string | null;
};

export type StickerPackLite = {
  id: string;
  title: string;
  items: StickerItemLite[];
};

function normalizePersianText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[آأإ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\u200c/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type Rule = {
  tokens: string[];
  tags: string[];
};

const SMART_RULES: Rule[] = [
  { tokens: ['سلام', 'صبح', 'شب', 'درود'], tags: ['hello', 'greet', 'morning', 'night'] },
  { tokens: ['خسته', 'خواب', 'بیحال'], tags: ['tired', 'sleep', 'yawn'] },
  { tokens: ['مرسی', 'ممنون', 'دمت گرم', 'تشکر'], tags: ['thanks', 'respect', 'love'] },
  { tokens: ['دوستت دارم'], tags: ['love', 'heart', 'hug'] },
  { tokens: ['عصبانی', 'کلافه'], tags: ['angry', 'mad'] },
  { tokens: ['ناراحت', 'غمگین'], tags: ['sad', 'cry'] },
  { tokens: ['کجایی', 'کو', 'منتظر'], tags: ['where', 'wait', 'come'] },
  { tokens: ['بیا', 'زود'], tags: ['come', 'go', 'fast'] },
  { tokens: ['تبریک', 'تولد', 'مبارک'], tags: ['party', 'birthday', 'celebrate'] },
  { tokens: ['عالی', 'خفن', 'باحال'], tags: ['cool', 'great', 'wow'] },
  { tokens: ['خنده', 'خنده دار', 'باحاله'], tags: ['funny', 'lol', 'laugh'] },
];

function scoreItem(item: StickerItemLite, draft: string): number {
  const label = normalizePersianText(item.label ?? '');
  const english = (item.label ?? '').toLowerCase();
  let score = 0;

  if (!draft) {
    if (label || english) score += 1;
    return score;
  }

  for (const rule of SMART_RULES) {
    const matched = rule.tokens.some((token) => draft.includes(normalizePersianText(token)));
    if (!matched) continue;
    score += 4;
    for (const tag of rule.tags) {
      if (label.includes(tag) || english.includes(tag)) score += 5;
    }
  }

  if (label && draft.split(' ').some((w) => w && label.includes(w))) score += 3;
  return score;
}

export function getSmartStickerSuggestions(
  draftText: string,
  packs: StickerPackLite[],
  limit = 16,
): StickerItemLite[] {
  const all = packs.flatMap((p) => p.items);
  if (all.length === 0) return [];
  const draft = normalizePersianText(draftText);
  const ranked = all
    .map((item, idx) => ({ item, score: scoreItem(item, draft), idx }))
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.idx - b.idx))
    .filter((x) => x.score > 0 || draft.length === 0)
    .slice(0, limit)
    .map((x) => x.item);
  if (ranked.length >= limit || draft.length > 0) return ranked;
  return all.slice(0, limit);
}

const STORAGE_KEY = 'toot_direct_drafts_v1';

export const DIRECT_DRAFT_CHANGED_EVENT = 'toot-direct-draft-changed';

function readRaw(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'string' && v.trim()) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function writeRaw(next: Record<string, string>) {
  if (typeof window === 'undefined') return;
  try {
    if (Object.keys(next).length === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
    window.dispatchEvent(new Event(DIRECT_DRAFT_CHANGED_EVENT));
  } catch {
    /* ignore quota */
  }
}

export function getDirectDraft(conversationId: string): string {
  if (!conversationId) return '';
  return readRaw()[conversationId] ?? '';
}

export function setDirectDraft(conversationId: string, text: string) {
  if (!conversationId) return;
  const trimmed = text.trim();
  const all = readRaw();
  if (!trimmed) {
    delete all[conversationId];
    writeRaw(all);
    return;
  }
  all[conversationId] = text;
  writeRaw(all);
}

export function clearDirectDraft(conversationId: string) {
  if (!conversationId) return;
  const all = readRaw();
  if (!(conversationId in all)) return;
  delete all[conversationId];
  writeRaw(all);
}

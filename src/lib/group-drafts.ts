const STORAGE_KEY = 'toot_group_drafts_v1';

export const GROUP_DRAFT_CHANGED_EVENT = 'toot-group-draft-changed';

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
    window.dispatchEvent(new Event(GROUP_DRAFT_CHANGED_EVENT));
  } catch {
    /* ignore quota */
  }
}

export function getGroupDraft(groupId: string): string {
  if (!groupId) return '';
  return readRaw()[groupId] ?? '';
}

export function setGroupDraft(groupId: string, text: string) {
  if (!groupId) return;
  const trimmed = text.trim();
  const all = readRaw();
  if (!trimmed) {
    delete all[groupId];
    writeRaw(all);
    return;
  }
  all[groupId] = text;
  writeRaw(all);
}

export function clearGroupDraft(groupId: string) {
  if (!groupId) return;
  const all = readRaw();
  if (!(groupId in all)) return;
  delete all[groupId];
  writeRaw(all);
}

export function clearAllGroupDrafts() {
  writeRaw({});
}

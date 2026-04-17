/**
 * Align with backend registration: `^[a-zA-Z0-9_]+$` length 3–30, stored lowercase.
 * Mention scan matches PostsService.MENTION_HANDLE_RE (no dot).
 */
export const MENTION_FULL_RE = /(?<![a-zA-Z0-9_])@([a-zA-Z0-9_]{3,30})(?![a-zA-Z0-9_])/g;

/** Capturing split: odd indices are @handle (with @), even are plain text. */
export const MENTION_SPLIT_RE = /((?<![a-zA-Z0-9_])@[a-zA-Z0-9_]{3,30}(?![a-zA-Z0-9_]))/g;

export type ActiveMention = { start: number; query: string };

/**
 * If caret is inside an @mention token being typed, return start index and query (without @).
 * Query may be empty right after typing @.
 */
export function getActiveMentionQuery(text: string, caret: number): ActiveMention | null {
  const safeCaret = Math.min(Math.max(0, caret), text.length);
  const before = text.slice(0, safeCaret);
  const at = before.lastIndexOf('@');
  if (at < 0) return null;
  if (at > 0 && /[a-zA-Z0-9_]/.test(text[at - 1])) return null;
  const afterAt = text.slice(at + 1, safeCaret);
  if (afterAt.length > 30) return null;
  if (!/^[a-zA-Z0-9_]*$/.test(afterAt)) return null;
  return { start: at, query: afterAt };
}

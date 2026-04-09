/** Must match backend `ALLOWED_DIRECT_REACTION_EMOJIS` (fixed picker). */
export const DIRECT_REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const;

export type DirectReactionSummary = { emoji: string; userIds: string[] };

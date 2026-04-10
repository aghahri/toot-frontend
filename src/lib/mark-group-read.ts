import { apiFetch } from '@/lib/api';

export type MarkGroupReadResponse = {
  updated: boolean;
  lastReadMessageId: string | null;
};

export function markGroupConversationRead(
  token: string,
  groupId: string,
  lastReadMessageId?: string,
) {
  return apiFetch<MarkGroupReadResponse>(`groups/${groupId}/read`, {
    method: 'POST',
    token,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(lastReadMessageId ? { lastReadMessageId } : {}),
  });
}

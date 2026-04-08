import { apiFetch } from './api';

export type MarkDirectReadResponse = {
  updated: boolean;
  lastReadMessageId: string | null;
};

export function markDirectConversationRead(
  token: string,
  conversationId: string,
  lastReadMessageId?: string,
): Promise<MarkDirectReadResponse> {
  return apiFetch<MarkDirectReadResponse>(`direct/conversations/${conversationId}/read`, {
    method: 'POST',
    token,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(lastReadMessageId ? { lastReadMessageId } : {}),
  });
}

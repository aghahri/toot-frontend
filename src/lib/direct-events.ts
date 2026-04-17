export const DIRECT_CONVERSATION_READ_EVENT = 'toot:direct:conversation-read';

export type DirectConversationReadEventDetail = {
  conversationId: string;
};

export function notifyDirectConversationRead(conversationId: string) {
  if (typeof window === 'undefined' || !conversationId) return;
  window.dispatchEvent(
    new CustomEvent<DirectConversationReadEventDetail>(DIRECT_CONVERSATION_READ_EVENT, {
      detail: { conversationId },
    }),
  );
}

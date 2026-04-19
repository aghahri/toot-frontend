/** Shared channel message shape for publication UI */
export type ChannelMsg = {
  id: string;
  content: string | null;
  createdAt: string;
  sender: { id: string; name: string };
  messageType?: string | null;
  metadata?: Record<string, unknown> | null;
  media?: {
    url: string;
    mimeType?: string;
    type?: string;
    originalName?: string | null;
    durationMs?: number | null;
  } | null;
};

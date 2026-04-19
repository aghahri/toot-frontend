/** Shared channel message shape for publication UI */
export type ChannelMsg = {
  id: string;
  content: string | null;
  createdAt: string;
  sender: { id: string; name: string };
  media?: { url: string; mimeType?: string; type?: string } | null;
};

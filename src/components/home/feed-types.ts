export type FeedMedia = {
  id: string;
  url: string;
  type: string;
  mimeType?: string;
  originalName?: string | null;
  size?: number;
  createdAt?: string;
};

export type FeedPost = {
  id: string;
  userId: string;
  text: string;
  mediaUrl: string | null;
  createdAt: string;
  user: { id: string; name: string; avatar: string | null; username?: string | null };
  media: FeedMedia[];
};

export type FeedTabId = 'for-you' | 'following' | 'local' | 'networks';

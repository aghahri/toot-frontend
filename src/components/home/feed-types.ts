export type FeedMedia = {
  id: string;
  url: string;
  type: string;
  mimeType?: string;
  originalName?: string | null;
  size?: number;
  createdAt?: string;
};

export type FeedEntryKind = 'post' | 'viewer_repost';

export type FeedPost = {
  id: string;
  userId: string;
  text: string;
  mediaUrl: string | null;
  createdAt: string;
  user: { id: string; name: string; avatar: string | null; username?: string | null };
  media: FeedMedia[];
  likeCount: number;
  repostCount: number;
  replyCount: number;
  liked: boolean;
  reposted: boolean;
  bookmarked: boolean;
  quotedPost?: {
    id: string;
    userId: string;
    text: string;
    createdAt: string;
    user: { id: string; name: string; avatar: string | null; username?: string | null };
  } | null;
  educationCourse?: {
    id: string;
    ownerId: string;
    title: string;
    owner: { id: string; name: string; username?: string | null; avatar: string | null };
    nextMeeting: { id: string; startsAt: string; status: string } | null;
    enrollmentsCount: number;
    isEnrolled: boolean;
  } | null;
  /** Row is the viewer’s repost surfaced at the top of the home feed (from API). */
  feedEntry?: FeedEntryKind;
  viewerRepostedAt?: string | null;
};

export type PostEngagementSnapshot = Pick<
  FeedPost,
  'likeCount' | 'repostCount' | 'replyCount' | 'liked' | 'reposted' | 'bookmarked'
>;

export type PostReplyItem = {
  id: string;
  text: string;
  createdAt: string;
  user: { id: string; name: string; avatar: string | null; username?: string | null };
};

/** Profile “Replies” tab: a reply plus parent post preview (from GET posts/user/:id/replies). */
export type ProfileReplyFeedRow = {
  reply: PostReplyItem;
  parentPost: {
    id: string;
    text: string;
    createdAt: string;
    user: { id: string; name: string; avatar: string | null; username?: string | null };
  };
};

export type CreatePostReplyResponse = PostEngagementSnapshot & {
  reply: PostReplyItem;
};

export type FeedTabId = 'for-you' | 'following' | 'local' | 'networks';

import type { FeedPost } from '@/components/home/feed-types';

export function normalizeFeedPost(p: FeedPost): FeedPost {
  return {
    ...p,
    likeCount: p.likeCount ?? 0,
    repostCount: p.repostCount ?? 0,
    replyCount: p.replyCount ?? 0,
    liked: p.liked ?? false,
    reposted: p.reposted ?? false,
    bookmarked: p.bookmarked ?? false,
    quotedPost: p.quotedPost ?? null,
    feedEntry: p.feedEntry === 'viewer_repost' ? 'viewer_repost' : (p.feedEntry ?? 'post'),
    viewerRepostedAt: p.viewerRepostedAt ?? undefined,
  };
}

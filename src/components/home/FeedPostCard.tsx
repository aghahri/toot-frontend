'use client';

import type { FeedPost } from './feed-types';

function formatFeedTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = Date.now();
  const diff = Math.max(0, now - d.getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'همین الان';
  if (min < 60) return `${min} دقیقه`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ساعت`;
  return d.toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' });
}

function initials(name: string): string {
  const t = name.trim();
  if (!t) return '?';
  return t.slice(0, 1);
}

type FeedPostCardProps = {
  post: FeedPost;
};

export function FeedPostCard({ post }: FeedPostCardProps) {
  const p = post;
  const handle = p.user?.username?.trim() || `@user_${p.userId.slice(0, 6)}`;
  const name = p.user?.name?.trim() || 'کاربر';

  return (
    <article
      className="border-b border-slate-100/90 bg-white px-4 py-3 transition hover:bg-slate-50/60"
      dir="rtl"
    >
      <div className="flex gap-3">
        <div className="shrink-0">
          {p.user?.avatar ? (
            <img
              src={p.user.avatar}
              alt=""
              className="h-11 w-11 rounded-full object-cover ring-1 ring-slate-200/80"
            />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-slate-600 text-sm font-bold text-white ring-1 ring-slate-200/60">
              {initials(name)}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
                <span className="truncate text-[15px] font-bold text-slate-900">{name}</span>
                <span className="truncate text-sm text-slate-500" dir="ltr">
                  {handle}
                </span>
                <span className="text-slate-300">·</span>
                <time
                  className="shrink-0 text-sm text-slate-400"
                  dateTime={p.createdAt}
                  title={new Date(p.createdAt).toLocaleString('fa-IR')}
                >
                  {formatFeedTime(p.createdAt)}
                </time>
              </div>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label="گزینه‌های بیشتر"
              disabled
            >
              <span className="text-lg leading-none">⋯</span>
            </button>
          </div>

          {p.text ? (
            <div className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed text-slate-800">
              {p.text}
            </div>
          ) : null}

          {p.media && p.media.length > 0 ? (
            <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50">
              {p.media.map((m) =>
                m.type === 'VIDEO' || m.mimeType?.startsWith('video/') ? (
                  <video
                    key={m.id}
                    src={m.url}
                    controls
                    className="max-h-[min(24rem,70vh)] w-full bg-black object-contain"
                  />
                ) : (
                  <img
                    key={m.id}
                    src={m.url}
                    alt={m.originalName || ''}
                    className="max-h-[min(24rem,70vh)] w-full object-contain"
                  />
                ),
              )}
            </div>
          ) : p.mediaUrl ? (
            <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200/80">
              <img
                src={p.mediaUrl}
                alt=""
                className="max-h-[min(24rem,70vh)] w-full object-contain"
              />
            </div>
          ) : null}

          <div className="mt-3 flex max-w-md items-center justify-between text-slate-400" dir="ltr">
            <button
              type="button"
              disabled
              className="flex h-9 min-w-[2.75rem] items-center justify-center gap-1 rounded-full text-sm transition hover:bg-sky-50 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="پاسخ"
            >
              <span className="text-base">💬</span>
            </button>
            <button
              type="button"
              disabled
              className="flex h-9 min-w-[2.75rem] items-center justify-center gap-1 rounded-full text-sm transition hover:bg-emerald-50 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="بازنشر"
            >
              <span className="text-base">↻</span>
            </button>
            <button
              type="button"
              disabled
              className="flex h-9 min-w-[2.75rem] items-center justify-center gap-1 rounded-full text-sm transition hover:bg-rose-50 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="پسند"
            >
              <span className="text-base">♡</span>
            </button>
            <button
              type="button"
              disabled
              className="flex h-9 min-w-[2.75rem] items-center justify-center gap-1 rounded-full text-sm transition hover:bg-amber-50 hover:text-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="نشان‌گذاری"
            >
              <span className="text-base">🔖</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

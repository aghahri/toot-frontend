'use client';

type StoryItem = {
  id: string;
  title: string;
  summary: string | null;
  category: string | null;
  url: string | null;
  imageUrl?: string | null;
  publishedAt: string | null;
  source: { name: string };
};

function toRelativeFa(input?: string | null) {
  if (!input) return 'بدون زمان';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return 'بدون زمان';
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'همین حالا';
  if (minutes < 60) return `${minutes} دقیقه پیش`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ساعت پیش`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} روز پیش`;
  return date.toLocaleDateString('fa-IR');
}

function scopeLabel(scope: 'today' | 'local' | 'networks') {
  if (scope === 'local') return 'محله من';
  if (scope === 'networks') return 'شبکه‌ها';
  return 'امروز';
}

export function StoryCuratedRail({
  scope,
  loading,
  items,
}: {
  scope: 'today' | 'local' | 'networks';
  loading: boolean;
  items: StoryItem[];
}) {
  return (
    <section className="mx-2 mt-2.5">
      <div className="theme-card-bg theme-border-soft overflow-hidden rounded-2xl border shadow-sm">
        <div className="flex items-center justify-between px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[12px] font-extrabold text-[var(--accent-hover)]">
              S
            </span>
            <p className="text-xs font-extrabold text-[var(--text-primary)]">Story Curated</p>
          </div>
          <span className="rounded-full border border-[var(--border-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">
            {scopeLabel(scope)}
          </span>
        </div>

        {loading ? (
          <div className="px-3 pb-3">
            <p className="text-[11px] text-[var(--text-secondary)]">در حال بارگذاری استوری‌ها…</p>
          </div>
        ) : items.length === 0 ? (
          <div className="px-3 pb-3">
            <p className="text-[11px] text-[var(--text-secondary)]">
              هنوز استوری منتشرشده‌ای برای این بخش وجود ندارد.
            </p>
          </div>
        ) : (
          <div className="no-scrollbar overflow-x-auto px-3 pb-3">
            <div className="flex gap-2.5">
              {items.map((item) => {
                const href = item.url?.trim() || null;
                const CardRoot = href ? 'a' : 'div';
                const cardProps = href
                  ? {
                      href,
                      target: '_blank',
                      rel: 'noreferrer noopener',
                    }
                  : {};
                return (
                  <CardRoot
                    key={item.id}
                    {...cardProps}
                    className="theme-surface-soft theme-border-soft block w-[78vw] max-w-[18rem] shrink-0 overflow-hidden rounded-xl border transition hover:border-[var(--accent-ring)] hover:shadow-md"
                  >
                    <div className="relative h-24 w-full overflow-hidden bg-[var(--surface-strong)]">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,var(--surface-soft),var(--surface-strong))]">
                          <span className="rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-bold text-[var(--text-secondary)]">
                            {item.category || 'Story'}
                          </span>
                        </div>
                      )}
                      <span className="absolute right-2 top-2 rounded-full bg-black/45 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        {toRelativeFa(item.publishedAt)}
                      </span>
                    </div>
                    <div className="px-2.5 py-2">
                      <p className="line-clamp-2 text-[12px] font-bold text-[var(--text-primary)]">
                        {item.title}
                      </p>
                      <p className="mt-1 line-clamp-2 text-[11px] text-[var(--text-secondary)]">
                        {item.summary || 'گزیده کوتاه در دسترس نیست.'}
                      </p>
                      <p className="mt-1.5 line-clamp-1 text-[10px] font-semibold text-[var(--accent-hover)]">
                        منبع: {item.source.name}
                      </p>
                    </div>
                  </CardRoot>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

'use client';

type StoryItem = {
  id: string;
  title: string;
  summary: string | null;
  category: string | null;
  url: string | null;
  imageUrl?: string | null;
  publishedAt: string | null;
  storyKind?: 'TODAY' | 'LOCAL' | 'NETWORK';
  trustLabel?: string;
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

function kindBadge(kind?: StoryItem['storyKind']) {
  if (kind === 'LOCAL') return { label: 'Local', cls: 'bg-emerald-500/15 text-emerald-700' };
  if (kind === 'NETWORK') return { label: 'Network', cls: 'bg-violet-500/15 text-violet-700' };
  return { label: 'Today', cls: 'bg-sky-500/15 text-sky-700' };
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
                const kind = kindBadge(item.storyKind);
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
                        <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-[linear-gradient(135deg,var(--surface-soft),var(--surface-strong))]">
                          <span className="rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-bold text-[var(--text-secondary)]">
                            {item.category || 'Story'}
                          </span>
                          <span className="rounded-full border border-black/10 bg-black/5 px-2 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">
                            {item.source.name.slice(0, 18)}
                          </span>
                        </div>
                      )}
                      <span className="absolute right-2 top-2 rounded-full bg-black/45 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        {toRelativeFa(item.publishedAt)}
                      </span>
                    </div>
                    <div className="px-2.5 py-2">
                      <div className="mb-1 flex items-center gap-1.5">
                        <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${kind.cls}`}>
                          {kind.label}
                        </span>
                        {item.trustLabel ? (
                          <span className="rounded-full border border-[var(--border-soft)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--text-secondary)]">
                            {item.trustLabel}
                          </span>
                        ) : null}
                      </div>
                      <p className="line-clamp-2 text-[12px] font-bold text-[var(--text-primary)]">
                        {item.title}
                      </p>
                      <p className="mt-1 line-clamp-2 text-[11px] text-[var(--text-secondary)]">
                        {item.summary || 'گزیده کوتاه در دسترس نیست.'}
                      </p>
                      <div className="mt-1.5 flex items-center justify-between gap-1">
                        <p className="line-clamp-1 text-[10px] font-semibold text-[var(--accent-hover)]">
                          {item.source.name}
                        </p>
                        <span className="text-[9px] text-[var(--text-secondary)]">{toRelativeFa(item.publishedAt)}</span>
                      </div>
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

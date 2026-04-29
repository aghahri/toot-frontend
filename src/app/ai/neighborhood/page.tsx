'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { AuthGate } from '@/components/AuthGate';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { featureFlags } from '@/lib/feature-flags';
import {
  dedupedGet,
  getCachedNetworksList,
  NEIGHBORHOOD_NETWORKS_QUERY,
  readLastSelectedNetworkId,
  setCachedNetworksList,
  writeLastSelectedNetworkId,
} from '@/lib/neighborhoodFormsPerf';

type NetworkRow = {
  id: string;
  name: string;
  spaceCategory?: string;
  isMember?: boolean;
};

type AssistantSource = {
  id?: string;
  title: string;
  type?: string;
  networkId?: string;
  confidence?: number;
};

type AssistantResult = {
  answer: string;
  sources: AssistantSource[];
  suggestions: string[];
};

function normalizeAssistantResult(payload: unknown): AssistantResult {
  const root = (payload ?? {}) as Record<string, unknown>;
  const data =
    root.data && typeof root.data === 'object'
      ? (root.data as Record<string, unknown>)
      : root;

  const rawAnswer =
    typeof data.answer === 'string'
      ? data.answer
      : typeof data.response === 'string'
        ? data.response
        : typeof data.text === 'string'
          ? data.text
          : '';

  const rawSources = Array.isArray(data.sources) ? data.sources : [];
  const sources = rawSources.reduce<AssistantSource[]>((acc, row) => {
      if (!row || typeof row !== 'object') return acc;
      const item = row as Record<string, unknown>;
      const title =
        typeof item.title === 'string'
          ? item.title
          : typeof item.name === 'string'
            ? item.name
            : typeof item.label === 'string'
              ? item.label
              : '';
      if (!title) return acc;
      acc.push({
        id: typeof item.id === 'string' ? item.id : undefined,
        title,
        type: typeof item.type === 'string' ? item.type : undefined,
        networkId: typeof item.networkId === 'string' ? item.networkId : undefined,
        confidence: typeof item.confidence === 'number' ? item.confidence : undefined,
      });
      return acc;
    }, []);

  const rawSuggestions = Array.isArray(data.suggestions)
    ? data.suggestions
    : Array.isArray(data.followUps)
      ? data.followUps
      : [];
  const suggestions = rawSuggestions
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0);

  return {
    answer: rawAnswer.trim(),
    sources,
    suggestions,
  };
}

function sourceTypeFa(type?: string): string {
  if (type === 'post') return 'پست';
  if (type === 'business' || type === 'directory') return 'کسب‌وکار';
  if (type === 'poll') return 'نظرسنجی';
  if (type === 'bulletin') return 'اطلاعیه';
  if (type === 'spotlight') return 'ویترین';
  return 'منبع';
}

function sourceHref(src: AssistantSource): string {
  const sid = src.id?.trim() ?? '';
  if (src.type === 'post') {
    return sid ? `/home?postId=${encodeURIComponent(sid)}` : '/home';
  }
  if (src.type === 'business' || src.type === 'directory') {
    return sid ? `/spaces/business/directory/${encodeURIComponent(sid)}` : '/spaces/business/directory';
  }
  if (src.type === 'poll') return '/spaces/neighborhood/polls';
  if (src.type === 'bulletin') return '/spaces/neighborhood/bulletin';
  if (src.type === 'spotlight') return '/spaces/neighborhood/showcase';
  return '/spaces/neighborhood/showcase';
}

export default function NeighborhoodAssistantDevPage() {
  const enabled = featureFlags.aiNeighborhoodAssistant;
  const [question, setQuestion] = useState('');
  const [networkId, setNetworkId] = useState('');
  const [networks, setNetworks] = useState<NetworkRow[]>([]);
  const [networksLoading, setNetworksLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AssistantResult | null>(null);
  const NETWORKS_PATH = `networks?${NEIGHBORHOOD_NETWORKS_QUERY}`;

  const selectedNetwork = useMemo(
    () => networks.find((row) => row.id === networkId) ?? null,
    [networks, networkId],
  );

  const loadNetworks = useCallback(async () => {
    if (!enabled) return;
    const token = getAccessToken();
    if (!token) {
      setError('برای استفاده از دستیار باید وارد شوید.');
      setNetworksLoading(false);
      return;
    }
    const cached = getCachedNetworksList<NetworkRow[]>(NEIGHBORHOOD_NETWORKS_QUERY);
    if (cached?.length) {
      setNetworks(cached);
      const last = readLastSelectedNetworkId();
      const pick = last && cached.some((row) => row.id === last) ? last : cached[0].id;
      setNetworkId((prev) => (prev && cached.some((row) => row.id === prev) ? prev : pick));
      setNetworksLoading(false);
    } else {
      setNetworksLoading(true);
    }
    try {
      const fresh = await dedupedGet(`GET:${NETWORKS_PATH}`, () =>
        apiFetch<NetworkRow[]>(NETWORKS_PATH, { method: 'GET', token }),
      );
      const joined = fresh.filter((row) => row.isMember !== false);
      setCachedNetworksList(NEIGHBORHOOD_NETWORKS_QUERY, joined);
      setNetworks(joined);
      setNetworkId((prev) => {
        if (prev && joined.some((row) => row.id === prev)) return prev;
        const last = readLastSelectedNetworkId();
        if (last && joined.some((row) => row.id === last)) return last;
        return joined[0]?.id ?? '';
      });
      setError(null);
    } catch (e) {
      setNetworks([]);
      setError(e instanceof Error ? e.message : 'بارگذاری شبکه‌ها ممکن نیست');
    } finally {
      setNetworksLoading(false);
    }
  }, [NETWORKS_PATH, enabled]);

  useEffect(() => {
    if (!enabled) return;
    void loadNetworks();
  }, [enabled, loadNetworks]);

  useEffect(() => {
    if (!networkId) return;
    writeLastSelectedNetworkId(networkId);
  }, [networkId]);

  const ask = useCallback(
    async (q: string) => {
      if (!enabled) return;
      const token = getAccessToken();
      if (!token) {
        setError('برای استفاده از دستیار باید وارد شوید.');
        return;
      }
      const cleanQuestion = q.trim();
      if (!cleanQuestion) {
        setError('سوال را وارد کنید.');
        return;
      }
      if (!networkId.trim()) {
        setError('ابتدا شبکه محله را انتخاب کنید.');
        return;
      }

      setLoading(true);
      setError(null);
      setResult(null);
      try {
        const params = new URLSearchParams({
          q: cleanQuestion,
          networkId: networkId.trim(),
        });
        const response = await apiFetch<unknown>(`assistant/neighborhood?${params.toString()}`, {
          method: 'GET',
          token,
        });
        const normalized = normalizeAssistantResult(response);
        if (!normalized.answer) {
          throw new Error('پاسخ معتبر از دستیار دریافت نشد.');
        }
        setResult(normalized);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'خطا در دریافت پاسخ دستیار');
      } finally {
        setLoading(false);
      }
    },
    [enabled, networkId],
  );

  const onSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void ask(question);
    },
    [ask, question],
  );

  if (!enabled) {
    return null;
  }

  return (
    <AuthGate>
      <main className="theme-page-bg theme-text-primary mx-auto w-full max-w-lg px-4 pb-14 pt-4" dir="rtl">
        <Card className="space-y-4">
          <div>
            <h1 className="text-lg font-extrabold text-[var(--text-primary)]">دستیار محله (آزمایشی)</h1>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              این صفحه فقط برای تست داخلی است و در ناوبری عمومی نمایش داده نمی‌شود.
            </p>
          </div>

          {networksLoading ? (
            <div className="rounded-xl bg-[var(--surface-soft)] px-3 py-3 text-xs font-semibold text-[var(--text-secondary)]">
              در حال بارگذاری محله‌های شما...
            </div>
          ) : null}

          {!networksLoading && networks.length === 0 ? (
            <Card className="space-y-3">
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                برای استفاده از دستیار محله، ابتدا عضو یک محله شوید.
              </p>
              <Link
                href="/spaces"
                className="inline-flex rounded-xl border border-[var(--border-soft)] px-3 py-2 text-xs font-bold text-[var(--text-primary)] transition hover:bg-[var(--surface-soft)]"
              >
                رفتن به فضاها
              </Link>
            </Card>
          ) : null}

          <form className="space-y-3" onSubmit={onSubmit}>
            <label className="block text-xs font-bold text-[var(--text-primary)]">
              سوال
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                placeholder="مثلاً نانوایی خوب نزدیکم؟"
              />
            </label>

            {!networksLoading && networks.length > 0 ? (
              <label className="block text-xs font-bold text-[var(--text-primary)]">
                محله
                <select
                  value={networkId}
                  onChange={(e) => setNetworkId(e.target.value)}
                  className="mt-1 w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                >
                  {networks.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {selectedNetwork ? (
              <p className="rounded-xl bg-[var(--surface-soft)] px-3 py-2 text-xs text-[var(--text-secondary)]">
                شبکه انتخاب‌شده: <span className="font-bold text-[var(--text-primary)]">{selectedNetwork.name}</span>
              </p>
            ) : null}

            <Button type="submit" loading={loading} disabled={!networkId || networks.length === 0}>
              پرسش
            </Button>
          </form>

          {error ? (
            <Card className="border-red-300/80 bg-red-50/80">
              <p className="text-sm font-semibold text-red-700">{error}</p>
            </Card>
          ) : null}

          {result ? (
            <div className="space-y-3">
              <Card>
                <h2 className="text-sm font-extrabold text-[var(--text-primary)]">پاسخ</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--text-primary)]">{result.answer}</p>
              </Card>

              <Card>
                <h2 className="text-sm font-extrabold text-[var(--text-primary)]">منابع</h2>
                {result.sources.length > 0 ? (
                  <ul className="mt-2 space-y-2">
                    {result.sources.map((src, idx) => (
                      <li key={`${src.type ?? 'source'}-${src.id ?? idx}-${src.title}`}>
                        <Link
                          href={sourceHref(src)}
                          className="group block rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2.5 transition hover:bg-[var(--card-bg)] hover:shadow-sm active:scale-[0.99]"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="rounded-full border border-[var(--border-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--text-secondary)]">
                              {sourceTypeFa(src.type)}
                            </span>
                            <span className="text-xs font-bold text-[var(--accent-hover)] transition group-hover:translate-x-[-1px]">
                              ←
                            </span>
                          </div>
                          <p className="mt-1.5 line-clamp-2 text-xs font-semibold text-[var(--text-primary)]">
                            {src.title}
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-[var(--text-secondary)]">منبعی گزارش نشده است.</p>
                )}
              </Card>

              <Card>
                <h2 className="text-sm font-extrabold text-[var(--text-primary)]">پیشنهادها</h2>
                {result.suggestions.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {result.suggestions.map((item, idx) => (
                      <button
                        key={`${item}-${idx}`}
                        type="button"
                        onClick={() => {
                          setQuestion(item);
                        }}
                        className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--card-bg)]"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-[var(--text-secondary)]">پیشنهادی وجود ندارد.</p>
                )}
              </Card>
            </div>
          ) : null}
        </Card>
      </main>
    </AuthGate>
  );
}

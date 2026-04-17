'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

type StoryCandidate = {
  id: string;
  title: string;
  summary: string | null;
  url: string | null;
  category: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PUBLISHED';
  freshnessScore: number;
  trustScore: number;
  relevanceScore: number;
  createdAt: string;
  source: {
    id: string;
    name: string;
    type: string;
    regionScope: string;
    isActive: boolean;
  };
};

type CandidateResponse = {
  data: StoryCandidate[];
  meta: { total: number; limit: number; offset: number; hasMore: boolean };
};

export default function AdminStoryQueuePage() {
  const [items, setItems] = useState<StoryCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<CandidateResponse>('admin/story/candidates?limit=120', {
        method: 'GET',
        token,
      });
      setItems(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load story candidates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const patchStatus = async (id: string, action: 'approve' | 'reject' | 'publish') => {
    const token = getAccessToken();
    if (!token) return;
    try {
      await apiFetch(`admin/story/candidates/${id}`, {
        method: 'PATCH',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    }
  };

  const runGenerator = async () => {
    const token = getAccessToken();
    if (!token) return;
    setRunning(true);
    setError(null);
    try {
      await apiFetch('admin/story/candidates/generate', {
        method: 'POST',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 20 }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate candidates');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Story AI Curator</h1>
          <p className="mt-1 text-sm text-slate-400">
            Candidate queue for controlled Story publishing.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
          >
            Refresh
          </button>
          <button
            type="button"
            disabled={running}
            onClick={() => void runGenerator()}
            className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {running ? 'Generating…' : 'Generate internal candidates'}
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-6 text-sm text-slate-400">Loading queue…</p>
      ) : items.length === 0 ? (
        <p className="mt-6 rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-400">
          No candidates yet. Run internal generation to seed queue.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold text-slate-100">{item.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-400">
                    {item.summary || 'No summary'}
                  </p>
                  <p className="mt-2 text-[11px] text-slate-500">
                    Source: {item.source.name} · {item.source.type} · {item.source.regionScope}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Freshness {item.freshnessScore} · Trust {item.trustScore} · Relevance{' '}
                    {item.relevanceScore}
                  </p>
                </div>
                <span className="rounded-full border border-slate-700 px-2.5 py-1 text-[11px] font-semibold text-slate-300">
                  {item.status}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void patchStatus(item.id, 'approve')}
                  className="rounded-lg border border-emerald-800 bg-emerald-950/40 px-2.5 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-900/40"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => void patchStatus(item.id, 'reject')}
                  className="rounded-lg border border-red-800 bg-red-950/40 px-2.5 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-900/40"
                >
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => void patchStatus(item.id, 'publish')}
                  className="rounded-lg border border-sky-800 bg-sky-950/40 px-2.5 py-1.5 text-xs font-semibold text-sky-300 hover:bg-sky-900/40"
                >
                  Publish
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

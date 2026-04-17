'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

type StorySource = {
  id: string;
  name: string;
  type: 'RSS' | 'WEB' | 'INTERNAL';
  baseUrl: string | null;
  category: string | null;
  isActive: boolean;
  trustScore: number;
  regionScope: 'GLOBAL' | 'COUNTRY' | 'CITY' | 'LOCAL';
  createdAt: string;
};

const typeOptions: StorySource['type'][] = ['RSS', 'WEB', 'INTERNAL'];
const regionOptions: StorySource['regionScope'][] = ['GLOBAL', 'COUNTRY', 'CITY', 'LOCAL'];

export default function AdminStorySourcesPage() {
  const [rows, setRows] = useState<StorySource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    type: 'RSS' as StorySource['type'],
    baseUrl: '',
    category: '',
    trustScore: 60,
    regionScope: 'GLOBAL' as StorySource['regionScope'],
  });

  const load = async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<StorySource[]>('admin/story/sources', { method: 'GET', token });
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load sources');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const createSource = async () => {
    const token = getAccessToken();
    if (!token) return;
    try {
      await apiFetch('admin/story/sources', {
        method: 'POST',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          type: form.type,
          baseUrl: form.baseUrl.trim() || undefined,
          category: form.category.trim() || undefined,
          trustScore: form.trustScore,
          regionScope: form.regionScope,
          isActive: true,
        }),
      });
      setForm({
        name: '',
        type: 'RSS',
        baseUrl: '',
        category: '',
        trustScore: 60,
        regionScope: 'GLOBAL',
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    }
  };

  const toggleActive = async (row: StorySource) => {
    const token = getAccessToken();
    if (!token) return;
    try {
      await apiFetch(`admin/story/sources/${row.id}`, {
        method: 'PATCH',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Story Sources</h1>
      <p className="mt-1 text-sm text-slate-400">Trusted sources for candidate ingestion.</p>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <section className="mt-5 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <h2 className="text-sm font-bold text-slate-200">Add source</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <input
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="Source name"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-600"
          />
          <select
            value={form.type}
            onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as StorySource['type'] }))}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none"
          >
            {typeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <input
            value={form.baseUrl}
            onChange={(e) => setForm((p) => ({ ...p, baseUrl: e.target.value }))}
            placeholder="https://example.com/feed"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-600"
          />
          <input
            value={form.category}
            onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
            placeholder="Category"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-600"
          />
          <input
            type="number"
            min={0}
            max={100}
            value={form.trustScore}
            onChange={(e) => setForm((p) => ({ ...p, trustScore: Number(e.target.value) || 0 }))}
            placeholder="Trust score"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-600"
          />
          <select
            value={form.regionScope}
            onChange={(e) =>
              setForm((p) => ({ ...p, regionScope: e.target.value as StorySource['regionScope'] }))
            }
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none"
          >
            {regionOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          disabled={!form.name.trim()}
          onClick={() => void createSource()}
          className="mt-3 rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
        >
          Add source
        </button>
      </section>

      {loading ? (
        <p className="mt-6 text-sm text-slate-400">Loading sources…</p>
      ) : (
        <ul className="mt-5 space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-100">
                    {row.name} <span className="text-slate-500">({row.type})</span>
                  </p>
                  <p className="mt-1 truncate text-[11px] text-slate-500">
                    {row.baseUrl || 'No base URL'} · {row.regionScope} · trust {row.trustScore}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void toggleActive(row)}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                    row.isActive
                      ? 'border-emerald-700 bg-emerald-950/40 text-emerald-300'
                      : 'border-slate-700 bg-slate-900 text-slate-300'
                  }`}
                >
                  {row.isActive ? 'Active' : 'Inactive'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

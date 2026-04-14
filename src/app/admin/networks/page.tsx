'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';

type Row = {
  id: string;
  name: string;
  spaceCategory: string;
  visibility: string;
  isFeatured: boolean;
  memberCount?: number;
};

type PageData = { data: Row[]; meta: { total: number; limit: number; offset: number; hasMore: boolean } };

export default function AdminNetworksPage() {
  const [qInput, setQInput] = useState('');
  const [qActive, setQActive] = useState('');
  const [cat, setCat] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 25;
  const [data, setData] = useState<PageData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      if (qActive.trim()) qs.set('q', qActive.trim());
      if (cat) qs.set('spaceCategory', cat);
      const res = await apiFetch<PageData>(`admin/networks?${qs}`, { method: 'GET', token });
      setData(res);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [offset, qActive, cat]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <h1 className="text-xl font-bold text-white">Networks</h1>
      <div className="mt-4 flex flex-wrap gap-2">
        <input
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          placeholder="Filter by name / slug"
          className="min-w-[10rem] flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
        />
        <select
          value={cat}
          onChange={(e) => {
            setCat(e.target.value);
            setOffset(0);
          }}
          className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-white"
        >
          <option value="">All space categories</option>
          <option value="NEIGHBORHOOD">NEIGHBORHOOD</option>
          <option value="PUBLIC_GENERAL">PUBLIC_GENERAL</option>
          <option value="EDUCATION">EDUCATION</option>
          <option value="SPORT">SPORT</option>
          <option value="TECH">TECH</option>
        </select>
        <button
          type="button"
          onClick={() => {
            setQActive(qInput);
            setOffset(0);
          }}
          className="rounded-lg bg-slate-700 px-3 py-2 text-sm text-white"
        >
          Apply
        </button>
      </div>
      {err ? <p className="mt-4 text-red-400">{err}</p> : null}
      {loading ? <p className="mt-6 text-slate-500">Loading…</p> : null}
      {data && data.data.length === 0 ? <p className="mt-6 text-slate-500">No networks.</p> : null}
      {data && data.data.length > 0 ? (
        <div className="mt-6 overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Space</th>
                <th className="px-3 py-2">Visibility</th>
                <th className="px-3 py-2">Featured</th>
                <th className="px-3 py-2">Members</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {data.data.map((n) => (
                <tr key={n.id} className="border-t border-slate-800">
                  <td className="px-3 py-2 text-slate-200">{n.name}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-400">{n.spaceCategory}</td>
                  <td className="px-3 py-2">{n.visibility}</td>
                  <td className="px-3 py-2">{n.isFeatured ? 'yes' : 'no'}</td>
                  <td className="px-3 py-2">{n.memberCount ?? '—'}</td>
                  <td className="px-3 py-2 text-right">
                    <Link href={`/admin/networks/${n.id}`} className="text-sky-400 hover:underline">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {data?.meta ? (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={offset === 0}
            onClick={() => setOffset((o) => Math.max(0, o - limit))}
            className="rounded border border-slate-700 px-3 py-1 text-sm disabled:opacity-40"
          >
            Prev
          </button>
          <button
            type="button"
            disabled={!data.meta.hasMore}
            onClick={() => setOffset((o) => o + limit)}
            className="rounded border border-slate-700 px-3 py-1 text-sm disabled:opacity-40"
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}

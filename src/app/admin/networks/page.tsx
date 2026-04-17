'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';

type Row = {
  id: string;
  name: string;
  spaceCategory: string;
  networkType?: string;
  alignedSpaceCategory?: string | null;
  visibility: string;
  isFeatured: boolean;
  memberCount?: number;
};

type PageData = { data: Row[]; meta: { total: number; limit: number; offset: number; hasMore: boolean } };

export default function AdminNetworksPage() {
  const [qInput, setQInput] = useState('');
  const [qActive, setQActive] = useState('');
  const [cat, setCat] = useState('');
  const [networkType, setNetworkType] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 25;
  const [data, setData] = useState<PageData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createType, setCreateType] = useState('GENERAL');
  const [createAlignedSpace, setCreateAlignedSpace] = useState('PUBLIC_GENERAL');
  const [createVisibility, setCreateVisibility] = useState('PUBLIC');
  const [createMsg, setCreateMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      if (qActive.trim()) qs.set('q', qActive.trim());
      if (cat) qs.set('spaceCategory', cat);
      if (networkType) qs.set('networkType', networkType);
      const res = await apiFetch<PageData>(`admin/networks?${qs}`, { method: 'GET', token });
      setData(res);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [offset, qActive, cat, networkType]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createNetwork() {
    const token = getAccessToken();
    if (!token || createName.trim().length < 2 || creating) return;
    setCreating(true);
    setCreateMsg(null);
    setErr(null);
    try {
      await apiFetch('admin/networks', {
        method: 'POST',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createName.trim(),
          description: createDescription.trim() || undefined,
          visibility: createVisibility,
          networkType: createType,
          alignedSpaceCategory: createAlignedSpace,
          spaceCategory: createAlignedSpace,
        }),
      });
      setCreateName('');
      setCreateDescription('');
      setCreateMsg('Network created.');
      setOffset(0);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to create network');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-white">Networks</h1>
      <div className="mt-4 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
        <p className="text-sm font-semibold text-slate-200">Create typed network</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <input
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            placeholder="Network name"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          />
          <select
            value={createVisibility}
            onChange={(e) => setCreateVisibility(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          >
            <option value="PUBLIC">PUBLIC</option>
            <option value="PRIVATE">PRIVATE</option>
            <option value="INVITE_ONLY">INVITE_ONLY</option>
          </select>
          <select
            value={createType}
            onChange={(e) => setCreateType(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          >
            {['GENERAL', 'NEIGHBORHOOD', 'EDUCATION', 'BUSINESS', 'SPORTS', 'GAMING'].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            value={createAlignedSpace}
            onChange={(e) => setCreateAlignedSpace(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          >
            {['PUBLIC_GENERAL', 'NEIGHBORHOOD', 'EDUCATION', 'SPORT', 'TECH'].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <textarea
            value={createDescription}
            onChange={(e) => setCreateDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            className="sm:col-span-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setCreateType('EDUCATION');
              setCreateAlignedSpace('EDUCATION');
            }}
            className="rounded-md border border-indigo-700/50 bg-indigo-900/30 px-2.5 py-1 text-xs text-indigo-200"
          >
            Education template
          </button>
          <button
            type="button"
            onClick={() => {
              setCreateType('BUSINESS');
              setCreateAlignedSpace('PUBLIC_GENERAL');
            }}
            className="rounded-md border border-amber-700/50 bg-amber-900/30 px-2.5 py-1 text-xs text-amber-200"
          >
            Business template
          </button>
          <button
            type="button"
            disabled={creating || createName.trim().length < 2}
            onClick={() => void createNetwork()}
            className="rounded-md bg-sky-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            {creating ? 'Creating…' : 'Create network'}
          </button>
        </div>
        {createMsg ? <p className="mt-2 text-xs text-emerald-400">{createMsg}</p> : null}
      </div>
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
        <select
          value={networkType}
          onChange={(e) => {
            setNetworkType(e.target.value);
            setOffset(0);
          }}
          className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-white"
        >
          <option value="">All network types</option>
          <option value="GENERAL">GENERAL</option>
          <option value="NEIGHBORHOOD">NEIGHBORHOOD</option>
          <option value="EDUCATION">EDUCATION</option>
          <option value="BUSINESS">BUSINESS</option>
          <option value="SPORTS">SPORTS</option>
          <option value="GAMING">GAMING</option>
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
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Aligned</th>
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
                  <td className="px-3 py-2">
                    <span className="rounded bg-indigo-900/40 px-2 py-0.5 font-mono text-[11px] text-indigo-200">
                      {n.networkType ?? 'GENERAL'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[11px] text-slate-300">
                      {n.alignedSpaceCategory ?? '—'}
                    </span>
                  </td>
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

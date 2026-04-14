'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';

type Net = { id: string; name: string; spaceCategory: string; memberCount?: number };
type PageData = { data: Net[]; meta: { hasMore: boolean; total: number; limit: number; offset: number } };

export default function AdminGeographyPage() {
  const [data, setData] = useState<PageData | null>(null);
  const [bootstrapResult, setBootstrapResult] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dryRun, setDryRun] = useState(true);
  const [mapLimit, setMapLimit] = useState(20);

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setErr(null);
    try {
      const qs = new URLSearchParams({ limit: '40', offset: '0', spaceCategory: 'NEIGHBORHOOD' });
      const res = await apiFetch<PageData>(`admin/networks?${qs}`, { method: 'GET', token });
      setData(res);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function runBootstrap() {
    const token = getAccessToken();
    if (!token) return;
    setBootstrapResult(null);
    setErr(null);
    try {
      const res = await apiFetch<unknown>('admin/bootstrap/neighborhood-networks', {
        method: 'POST',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun, mapLimit, countryCode: 'IR' }),
      });
      setBootstrapResult(typeof res === 'object' ? JSON.stringify(res, null, 2) : String(res));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-white">Geography / Neighborhoods</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-400">
        Inspect imported neighborhood-scoped networks. Bootstrap uses the existing server-side geography provider (IR
        v1). Always test with dry run first.
      </p>

      <div className="mt-8 rounded-lg border border-amber-900/50 bg-amber-950/20 p-4">
        <h2 className="text-sm font-bold text-amber-200">Neighborhood bootstrap</h2>
        <label className="mt-2 flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
          Dry run (no writes)
        </label>
        <label className="mt-2 block text-sm text-slate-300">
          Map limit
          <input
            type="number"
            min={1}
            value={mapLimit}
            onChange={(e) => setMapLimit(Number(e.target.value) || 1)}
            className="ml-2 w-24 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-white"
          />
        </label>
        <button
          type="button"
          onClick={() => void runBootstrap()}
          className="mt-4 rounded bg-amber-600 px-4 py-2 text-sm font-bold text-white"
        >
          Run bootstrap
        </button>
        {bootstrapResult ? (
          <pre className="mt-4 max-h-64 overflow-auto rounded bg-slate-950 p-3 text-xs text-slate-300">
            {bootstrapResult}
          </pre>
        ) : null}
      </div>

      {err ? <p className="mt-4 text-red-400">{err}</p> : null}

      <h2 className="mt-10 text-sm font-bold text-slate-400">Neighborhood networks (sample)</h2>
      {!data ? <p className="mt-4 text-slate-500">Loading…</p> : null}
      {data && (
        <ul className="mt-3 max-h-96 space-y-1 overflow-y-auto text-sm">
          {data.data.map((n) => (
            <li key={n.id} className="flex justify-between gap-2 rounded border border-slate-800 px-2 py-1">
              <span className="truncate text-slate-200">{n.name}</span>
              <Link href={`/admin/networks/${n.id}`} className="shrink-0 text-sky-400 hover:underline">
                Admin
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

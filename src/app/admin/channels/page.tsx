'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';

type Row = { id: string; name: string; networkId: string; spaceCategory: string; isFeatured: boolean };
type PageData = { data: Row[]; meta: { hasMore: boolean; limit: number; offset: number; total: number } };

export default function AdminChannelsPage() {
  const [offset, setOffset] = useState(0);
  const limit = 25;
  const [data, setData] = useState<PageData | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setErr(null);
    try {
      const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      const res = await apiFetch<PageData>(`admin/channels?${qs}`, { method: 'GET', token });
      setData(res);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    }
  }, [offset]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <h1 className="text-xl font-bold text-white">Channels</h1>
      {err ? <p className="mt-4 text-red-400">{err}</p> : null}
      {!data ? <p className="mt-6 text-slate-500">Loading…</p> : null}
      {data && (
        <div className="mt-6 overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Network</th>
                <th className="px-3 py-2">Space</th>
                <th className="px-3 py-2">Featured</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {data.data.map((c) => (
                <tr key={c.id} className="border-t border-slate-800">
                  <td className="px-3 py-2 text-slate-200">{c.name}</td>
                  <td className="px-3 py-2 font-mono text-xs">{c.networkId}</td>
                  <td className="px-3 py-2">{c.spaceCategory}</td>
                  <td className="px-3 py-2">{c.isFeatured ? 'yes' : 'no'}</td>
                  <td className="px-3 py-2 text-right">
                    <Link href={`/admin/channels/${c.id}`} className="text-sky-400 hover:underline">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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

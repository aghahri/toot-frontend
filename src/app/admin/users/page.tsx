'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';

type Row = {
  id: string;
  email: string;
  name: string;
  username?: string;
  globalRole: string;
  createdAt: string;
};

type PageData = {
  data: Row[];
  meta: { total: number; limit: number; offset: number; hasMore: boolean };
};

export default function AdminUsersPage() {
  const [qInput, setQInput] = useState('');
  const [qActive, setQActive] = useState('');
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
      if (qActive.trim().length >= 2) qs.set('q', qActive.trim());
      const res = await apiFetch<PageData>(`admin/users?${qs}`, { method: 'GET', token });
      setData(res);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [offset, qActive]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <h1 className="text-xl font-bold text-white">Users</h1>
      <div className="mt-4 flex flex-wrap gap-2">
        <input
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          placeholder="Search name / email / username (min 2 chars)"
          className="min-w-[12rem] flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-sky-500"
        />
        <button
          type="button"
          onClick={() => {
            setQActive(qInput);
            setOffset(0);
          }}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Search
        </button>
      </div>
      {err ? <p className="mt-4 text-sm text-red-400">{err}</p> : null}
      {loading ? <p className="mt-6 text-slate-500">Loading…</p> : null}
      {!loading && data && data.data.length === 0 ? <p className="mt-6 text-slate-500">No users.</p> : null}
      {data && data.data.length > 0 ? (
        <div className="mt-6 overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {data.data.map((u) => (
                <tr key={u.id} className="border-t border-slate-800">
                  <td className="px-3 py-2 text-slate-200">{u.name}</td>
                  <td className="px-3 py-2 text-slate-400">{u.email}</td>
                  <td className="px-3 py-2 font-mono text-xs text-amber-200">{u.globalRole}</td>
                  <td className="px-3 py-2 text-right">
                    <Link href={`/admin/users/${u.id}`} className="text-sky-400 hover:underline">
                      View
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

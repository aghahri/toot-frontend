'use client';

import { useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';

type Row = { id: string; email: string; name: string; globalRole: string; createdAt: string };
type PageData = { data: Row[]; meta: { total: number } };

export default function AdminStaffPage() {
  const [data, setData] = useState<PageData | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setErr(null);
    try {
      const res = await apiFetch<PageData>('admin/staff?limit=100&offset=0', { method: 'GET', token });
      setData(res);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <h1 className="text-xl font-bold text-white">Staff roles</h1>
      <p className="mt-2 text-sm text-slate-400">Super admin only. Elevated operators (non-USER roles).</p>
      {err ? <p className="mt-4 text-red-400">{err}</p> : null}
      {!data ? <p className="mt-6 text-slate-500">Loading…</p> : null}
      {data && (
        <table className="mt-6 w-full text-left text-sm">
          <thead className="text-slate-500">
            <tr>
              <th className="py-2">Name</th>
              <th className="py-2">Email</th>
              <th className="py-2">Role</th>
            </tr>
          </thead>
          <tbody>
            {data.data.map((u) => (
              <tr key={u.id} className="border-t border-slate-800">
                <td className="py-2 text-slate-200">{u.name}</td>
                <td className="py-2 text-slate-400">{u.email}</td>
                <td className="py-2 font-mono text-xs text-amber-200">{u.globalRole}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

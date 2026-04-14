'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';

type G = {
  id: string;
  name: string;
  description: string | null;
  type: string;
  networkId: string | null;
  isFeatured: boolean;
  memberCount?: number;
};

export default function AdminGroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === 'string' ? params.id : '';
  const [row, setRow] = useState<G | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let c = false;
    void (async () => {
      const token = getAccessToken();
      if (!token) return;
      try {
        const g = await apiFetch<G>(`admin/groups/${encodeURIComponent(id)}`, { method: 'GET', token });
        if (c) return;
        setRow(g);
        setName(g.name);
        setDescription(g.description ?? '');
        setIsFeatured(g.isFeatured);
      } catch (e) {
        if (!c) setErr(e instanceof Error ? e.message : 'Error');
      }
    })();
    return () => {
      c = true;
    };
  }, [id]);

  async function save() {
    const token = getAccessToken();
    if (!token || !id) return;
    setMsg(null);
    setErr(null);
    try {
      await apiFetch(`admin/groups/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null, isFeatured }),
      });
      setMsg('Saved.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    }
  }

  if (err && !row) return <p className="text-red-400">{err}</p>;
  if (!row) return <p className="text-slate-500">Loading…</p>;

  return (
    <div>
      <button type="button" onClick={() => router.push('/admin/groups')} className="text-sm text-sky-400">
        ← Groups
      </button>
      <h1 className="mt-4 text-xl font-bold text-white">{row.name}</h1>
      <p className="text-xs text-slate-500">
        {row.type} · members: {row.memberCount ?? '—'}
      </p>
      <div className="mt-6 space-y-4 rounded-lg border border-slate-800 p-4">
        <label className="block text-sm text-slate-300">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-2 text-white"
          />
        </label>
        <label className="block text-sm text-slate-300">
          Description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-2 text-white"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} />
          Featured
        </label>
        <button type="button" onClick={() => void save()} className="rounded bg-sky-600 px-4 py-2 text-sm text-white">
          Save
        </button>
        {msg ? <p className="text-emerald-400">{msg}</p> : null}
        {err ? <p className="text-red-400">{err}</p> : null}
      </div>
    </div>
  );
}

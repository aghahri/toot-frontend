'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';

type Net = {
  id: string;
  name: string;
  description: string | null;
  slug: string | null;
  visibility: string;
  spaceCategory: string;
  isFeatured: boolean;
  memberCount?: number;
};

export default function AdminNetworkDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === 'string' ? params.id : '';
  const [row, setRow] = useState<Net | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('PUBLIC');
  const [spaceCategory, setSpaceCategory] = useState('PUBLIC_GENERAL');
  const [isFeatured, setIsFeatured] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void (async () => {
      const token = getAccessToken();
      if (!token) return;
      try {
        const n = await apiFetch<Net>(`admin/networks/${encodeURIComponent(id)}`, { method: 'GET', token });
        if (cancelled) return;
        setRow(n);
        setName(n.name);
        setDescription(n.description ?? '');
        setVisibility(n.visibility);
        setSpaceCategory(n.spaceCategory);
        setIsFeatured(n.isFeatured);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function save() {
    const token = getAccessToken();
    if (!token || !id) return;
    setMsg(null);
    setErr(null);
    try {
      await apiFetch(`admin/networks/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          visibility,
          spaceCategory,
          isFeatured,
        }),
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
      <button type="button" onClick={() => router.push('/admin/networks')} className="text-sm text-sky-400">
        ← Networks
      </button>
      <h1 className="mt-4 text-xl font-bold text-white">{row.name}</h1>
      <p className="mt-1 font-mono text-xs text-slate-500">{row.id}</p>

      <div className="mt-6 space-y-4 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <label className="block text-sm">
          <span className="text-slate-400">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-2 text-white"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-400">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-2 text-white"
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-400">Visibility</span>
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-2 text-white"
          >
            <option value="PUBLIC">PUBLIC</option>
            <option value="PRIVATE">PRIVATE</option>
            <option value="INVITE_ONLY">INVITE_ONLY</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-slate-400">Space category</span>
          <select
            value={spaceCategory}
            onChange={(e) => setSpaceCategory(e.target.value)}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-2 text-white"
          >
            {['PUBLIC_GENERAL', 'NEIGHBORHOOD', 'EDUCATION', 'SPORT', 'TECH'].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} />
          <span className="text-slate-300">Featured on vitrin</span>
        </label>
        <button type="button" onClick={() => void save()} className="rounded bg-sky-600 px-4 py-2 text-sm font-semibold text-white">
          Save changes
        </button>
        {msg ? <p className="text-sm text-emerald-400">{msg}</p> : null}
        {err ? <p className="text-sm text-red-400">{err}</p> : null}
      </div>
    </div>
  );
}

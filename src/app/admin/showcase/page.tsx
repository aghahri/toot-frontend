'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';

type Ann = {
  id: string;
  title: string;
  body: string;
  scopeType: string;
  networkId: string | null;
  isPublished: boolean;
  publishedAt: string | null;
};

type PageData = { data: Ann[]; meta: { hasMore: boolean; limit: number; offset: number; total: number } };
type PublicShowcaseData = {
  announcements: Array<{ id: string; title: string; body: string }>;
  featuredNetworks: Array<{ id: string; name: string }>;
  featuredGroups: Array<{ id: string; name: string }>;
  featuredChannels: Array<{ id: string; name: string }>;
};

export default function AdminShowcasePage() {
  const [rows, setRows] = useState<Ann[]>([]);
  const [publicShowcase, setPublicShowcase] = useState<PublicShowcaseData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [scope, setScope] = useState<'GLOBAL' | 'NETWORK'>('GLOBAL');
  const [networkId, setNetworkId] = useState('');
  const [publishNow, setPublishNow] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const [res, live] = await Promise.all([
        apiFetch<PageData>('admin/announcements?limit=50&offset=0', { method: 'GET', token }),
        apiFetch<PublicShowcaseData>('showcase', { method: 'GET', token }),
      ]);
      setRows(res.data);
      setPublicShowcase(live);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    const token = getAccessToken();
    if (!token) return;
    if (!title.trim() || !body.trim()) {
      setErr('Title و Body الزامی است.');
      return;
    }
    setMsg(null);
    setErr(null);
    setSaving(true);
    try {
      await apiFetch('admin/announcements', {
        method: 'POST',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          scopeType: scope,
          networkId: scope === 'NETWORK' ? networkId.trim() || undefined : undefined,
          isPublished: publishNow,
        }),
      });
      setTitle('');
      setBody('');
      setNetworkId('');
      setPublishNow(true);
      setMsg(publishNow ? 'Announcement created and published.' : 'Announcement created as draft.');
      void load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(a: Ann) {
    const token = getAccessToken();
    if (!token) return;
    setSaving(true);
    try {
      await apiFetch(`admin/announcements/${encodeURIComponent(a.id)}`, {
        method: 'PATCH',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished: !a.isPublished }),
      });
      void load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-white">Showcase / Vitrin</h1>
      <p className="mt-2 text-sm text-slate-400">
        Announcements and featured spaces power public vitrín.{' '}
        <Link href="/vitrin" className="text-sky-400 underline">
          Open public vitrin
        </Link>
      </p>

      <div className="mt-6 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-300">Live public snapshot</h2>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-200"
          >
            Refresh
          </button>
        </div>
        {loading ? <p className="mt-3 text-xs text-slate-500">Loading…</p> : null}
        {publicShowcase ? (
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300 md:grid-cols-4">
            <div className="rounded border border-slate-700 p-2">Live announcements: {publicShowcase.announcements.length}</div>
            <div className="rounded border border-slate-700 p-2">Featured networks: {publicShowcase.featuredNetworks.length}</div>
            <div className="rounded border border-slate-700 p-2">Featured groups: {publicShowcase.featuredGroups.length}</div>
            <div className="rounded border border-slate-700 p-2">Featured channels: {publicShowcase.featuredChannels.length}</div>
          </div>
        ) : null}
      </div>

      <div className="mt-8 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <h2 className="text-sm font-bold text-slate-300">New announcement</h2>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="mt-2 w-full rounded border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-white"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Body"
          rows={4}
          className="mt-2 w-full rounded border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-white"
        />
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value as 'GLOBAL' | 'NETWORK')}
          className="mt-2 rounded border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-white"
        >
          <option value="GLOBAL">GLOBAL</option>
          <option value="NETWORK">NETWORK</option>
        </select>
        {scope === 'NETWORK' ? (
          <input
            value={networkId}
            onChange={(e) => setNetworkId(e.target.value)}
            placeholder="network id (required for NETWORK)"
            className="mt-2 ml-2 rounded border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-white"
          />
        ) : null}
        <label className="mt-3 flex items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={publishNow}
            onChange={(e) => setPublishNow(e.target.checked)}
            className="h-4 w-4"
          />
          Publish immediately
        </label>
        <button
          type="button"
          disabled={saving}
          onClick={() => void create()}
          className="mt-3 rounded bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Create announcement'}
        </button>
        {msg ? <p className="mt-2 text-sm text-emerald-400">{msg}</p> : null}
      </div>

      {err ? <p className="mt-4 text-red-400">{err}</p> : null}
      <h2 className="mt-8 text-sm font-bold text-slate-400">Announcements</h2>
      <ul className="mt-3 space-y-2">
        {rows.map((a) => (
          <li key={a.id} className="rounded border border-slate-800 bg-slate-900/50 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-100">{a.title}</p>
                <p className="text-xs text-slate-500">
                  {a.scopeType} {a.networkId ? `· ${a.networkId}` : ''} · {a.isPublished ? 'published' : 'draft'}
                </p>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => void togglePublish(a)}
                className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-200 disabled:opacity-60"
              >
                {a.isPublished ? 'Unpublish' : 'Publish'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

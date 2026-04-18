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
  networkType?: string;
  alignedSpaceCategory?: string | null;
  isFeatured: boolean;
  memberCount?: number;
};

type NetworkMemberRow = {
  id: string;
  userId: string;
  role: string;
  joinedAt: string;
  user: { id: string; name: string; email: string; avatar: string | null };
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
  const [networkType, setNetworkType] = useState('GENERAL');
  const [alignedSpaceCategory, setAlignedSpaceCategory] = useState('PUBLIC_GENERAL');
  const [isFeatured, setIsFeatured] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [members, setMembers] = useState<NetworkMemberRow[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersErr, setMembersErr] = useState<string | null>(null);
  const [promoteUserId, setPromoteUserId] = useState('');
  const [promoteBusy, setPromoteBusy] = useState(false);

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
        setNetworkType(n.networkType ?? 'GENERAL');
        setAlignedSpaceCategory(n.alignedSpaceCategory ?? n.spaceCategory ?? 'PUBLIC_GENERAL');
        setIsFeatured(n.isFeatured);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void (async () => {
      const token = getAccessToken();
      if (!token) return;
      setMembersLoading(true);
      setMembersErr(null);
      try {
        const list = await apiFetch<NetworkMemberRow[]>(
          `admin/networks/${encodeURIComponent(id)}/members`,
          { method: 'GET', token },
        );
        if (!cancelled) setMembers(list);
      } catch (e) {
        if (!cancelled) setMembersErr(e instanceof Error ? e.message : 'Failed to load members');
      } finally {
        if (!cancelled) setMembersLoading(false);
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
          networkType,
          alignedSpaceCategory,
          isFeatured,
        }),
      });
      setMsg('Saved.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    }
  }

  async function staffPromoteMember(targetUserId: string) {
    const token = getAccessToken();
    if (!token || !id || !targetUserId.trim()) return;
    setPromoteBusy(true);
    setMembersErr(null);
    try {
      await apiFetch(`admin/networks/${encodeURIComponent(id)}/members/${encodeURIComponent(targetUserId.trim())}/promote-network-admin`, {
        method: 'POST',
        token,
      });
      const list = await apiFetch<NetworkMemberRow[]>(`admin/networks/${encodeURIComponent(id)}/members`, {
        method: 'GET',
        token,
      });
      setMembers(list);
      setPromoteUserId('');
      setMsg('Network admin assigned.');
    } catch (e) {
      setMembersErr(e instanceof Error ? e.message : 'Promote failed');
    } finally {
      setPromoteBusy(false);
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
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <span className="rounded bg-indigo-900/40 px-2 py-1 font-mono text-indigo-200">
          type: {row.networkType ?? 'GENERAL'}
        </span>
        <span className="rounded bg-slate-800 px-2 py-1 font-mono text-slate-300">
          aligned: {row.alignedSpaceCategory ?? '—'}
        </span>
      </div>

      {row.spaceCategory === 'NEIGHBORHOOD' ? (
        <p className="mt-3 rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-100">
          شبکه محله: برای دسترسی مدیر محله به فرم‌های مدیریتی، یک عضو را به «مدیر شبکه» ارتقا دهید (نیاز به نقش جغرافیا / پشتیبانی / سوپرادمین).
        </p>
      ) : null}

      <div className="mt-6 space-y-3 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <h2 className="text-sm font-semibold text-slate-200">اعضا و مدیران شبکه</h2>
        <p className="text-xs text-slate-500">
          فهرست اعضا؛ برای محله‌ها اگر هنوز مدیر محله ندارید، اینجا یک عضو را ارتقا دهید تا بتواند فرم‌ها و مدیریت محله را ببیند.
        </p>
        {membersLoading ? <p className="text-xs text-slate-500">Loading members…</p> : null}
        {membersErr ? <p className="text-xs text-red-400">{membersErr}</p> : null}
        {!membersLoading && members.length > 0 ? (
          <ul className="max-h-56 space-y-2 overflow-y-auto text-xs">
            {members.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-800 bg-slate-950/50 px-2 py-2"
              >
                <div>
                  <span className="font-medium text-slate-200">{m.user.name}</span>
                  <span className="ml-2 font-mono text-[10px] text-slate-500">{m.userId}</span>
                  <span
                    className={
                      m.role === 'NETWORK_ADMIN'
                        ? 'ml-2 rounded bg-amber-900/40 px-1.5 py-0.5 text-[10px] text-amber-200'
                        : 'ml-2 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400'
                    }
                  >
                    {m.role}
                  </span>
                </div>
                {m.role !== 'NETWORK_ADMIN' ? (
                  <button
                    type="button"
                    disabled={promoteBusy}
                    onClick={() => void staffPromoteMember(m.userId)}
                    className="rounded bg-sky-700 px-2 py-1 text-[11px] font-semibold text-white hover:bg-sky-600 disabled:opacity-50"
                  >
                    Promote to network admin
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-wrap items-end gap-2 border-t border-slate-800 pt-3">
          <label className="block text-xs">
            <span className="text-slate-400">Promote by user id</span>
            <input
              value={promoteUserId}
              onChange={(e) => setPromoteUserId(e.target.value)}
              placeholder="user uuid"
              className="mt-1 w-full min-w-[12rem] rounded border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-[11px] text-white"
            />
          </label>
          <button
            type="button"
            disabled={promoteBusy || !promoteUserId.trim()}
            onClick={() => void staffPromoteMember(promoteUserId)}
            className="rounded bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
          >
            Promote
          </button>
        </div>
      </div>

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
        <label className="block text-sm">
          <span className="text-slate-400">Network type</span>
          <select
            value={networkType}
            onChange={(e) => setNetworkType(e.target.value)}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-2 text-white"
          >
            {['GENERAL', 'NEIGHBORHOOD', 'EDUCATION', 'BUSINESS', 'SPORTS', 'GAMING'].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-slate-400">Aligned space category</span>
          <select
            value={alignedSpaceCategory}
            onChange={(e) => setAlignedSpaceCategory(e.target.value)}
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

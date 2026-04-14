'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { ADMIN_ASSIGNABLE_ROLES } from '@/lib/admin-roles';

type UserDetail = {
  id: string;
  email: string;
  mobile?: string;
  username?: string;
  name: string;
  globalRole: string;
  createdAt: string;
};

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === 'string' ? params.id : '';
  const [user, setUser] = useState<UserDetail | null>(null);
  const [sessionRole, setSessionRole] = useState<string | null>(null);
  const [rolePick, setRolePick] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void (async () => {
      const token = getAccessToken();
      if (!token) return;
      try {
        const [u, s] = await Promise.all([
          apiFetch<UserDetail>(`admin/users/${encodeURIComponent(id)}`, { method: 'GET', token }),
          apiFetch<{ globalRole: string }>('admin/session', { method: 'GET', token }),
        ]);
        if (cancelled) return;
        setUser(u);
        setSessionRole(s.globalRole);
        setRolePick(u.globalRole);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function saveRole() {
    const token = getAccessToken();
    if (!token || !id) return;
    setMsg(null);
    setErr(null);
    try {
      await apiFetch(`admin/users/${encodeURIComponent(id)}/role`, {
        method: 'PATCH',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ globalRole: rolePick }),
      });
      setMsg('Role updated.');
      const u = await apiFetch<UserDetail>(`admin/users/${encodeURIComponent(id)}`, { method: 'GET', token });
      setUser(u);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed');
    }
  }

  if (err && !user) {
    return <p className="text-red-400">{err}</p>;
  }
  if (!user) return <p className="text-slate-500">Loading…</p>;

  const isSuper = sessionRole === 'SUPER_ADMIN';

  return (
    <div>
      <button type="button" onClick={() => router.push('/admin/users')} className="text-sm text-sky-400">
        ← Users
      </button>
      <h1 className="mt-4 text-xl font-bold text-white">{user.name}</h1>
      <dl className="mt-4 space-y-2 text-sm text-slate-300">
        <div>
          <dt className="text-slate-500">Email</dt>
          <dd>{user.email}</dd>
        </div>
        {user.username ? (
          <div>
            <dt className="text-slate-500">Username</dt>
            <dd>@{user.username}</dd>
          </div>
        ) : null}
        {user.mobile ? (
          <div>
            <dt className="text-slate-500">Mobile</dt>
            <dd className="font-mono text-xs">{user.mobile}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-slate-500">Role</dt>
          <dd className="font-mono text-amber-200">{user.globalRole}</dd>
        </div>
      </dl>

      {isSuper ? (
        <div className="mt-8 rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <h2 className="text-sm font-bold text-slate-300">Change global role</h2>
          <select
            value={rolePick}
            onChange={(e) => setRolePick(e.target.value)}
            className="mt-2 w-full max-w-xs rounded border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-white"
          >
            {ADMIN_ASSIGNABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void saveRole()}
            className="mt-3 rounded bg-amber-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Save role
          </button>
          {msg ? <p className="mt-2 text-sm text-emerald-400">{msg}</p> : null}
          {err ? <p className="mt-2 text-sm text-red-400">{err}</p> : null}
        </div>
      ) : (
        <p className="mt-6 text-sm text-slate-500">Role changes require super admin.</p>
      )}

      <p className="mt-8">
        <Link href={`/profile/${user.id}`} className="text-sky-400 hover:underline">
          Open public profile →
        </Link>
      </p>
    </div>
  );
}

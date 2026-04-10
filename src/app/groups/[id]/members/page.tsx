'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AuthGate } from '@/components/AuthGate';
import { getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';

type MemberRow = {
  id: string;
  role: string;
  user: { id: string; name: string; avatar: string | null; email: string };
};

export default function GroupMembersPage() {
  const params = useParams();
  const groupId = typeof params?.id === 'string' ? params.id : '';
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!groupId) return;
    const token = getAccessToken();
    if (!token) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const list = await apiFetch<MemberRow[]>(`groups/${groupId}/members`, { method: 'GET', token });
        if (!cancelled) setRows(Array.isArray(list) ? list : []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'خطا');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  return (
    <AuthGate>
      <main className="mx-auto min-h-[50vh] w-full max-w-md bg-stone-50 px-4 py-4" dir="rtl">
        <Link href={`/groups/${groupId}/info`} className="text-sm font-bold text-sky-700 underline">
          ← اطلاعات گروه
        </Link>
        <h1 className="mt-4 text-lg font-extrabold text-stone-900">اعضای گروه</h1>
        {loading ? (
          <p className="mt-4 text-sm text-stone-500">در حال بارگذاری…</p>
        ) : error ? (
          <p className="mt-4 text-sm text-red-700">{error}</p>
        ) : (
          <ul className="mt-4 divide-y divide-stone-200 rounded-2xl border border-stone-200 bg-white">
            {rows.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-3 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-200 text-sm font-bold text-stone-700">
                  {m.user.name.slice(0, 1)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold text-stone-900">{m.user.name}</div>
                  <div className="text-[11px] text-stone-500">
                    {m.role === 'GROUP_ADMIN' ? 'مدیر' : 'عضو'}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </AuthGate>
  );
}

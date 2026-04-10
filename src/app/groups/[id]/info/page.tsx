'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AuthGate } from '@/components/AuthGate';
import { getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';

type GroupDetail = {
  id: string;
  name: string;
  description: string | null;
  network?: { id: string; name: string };
  memberCount?: number;
  myRole?: string | null;
  isMember?: boolean;
};

export default function GroupInfoPage() {
  const params = useParams();
  const groupId = typeof params?.id === 'string' ? params.id : '';
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!groupId) return;
    const token = getAccessToken();
    if (!token) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const g = await apiFetch<GroupDetail>(`groups/${groupId}`, { method: 'GET', token });
        if (!cancelled) setGroup(g);
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
        <div className="mb-4 flex items-center gap-2">
          <Link href={`/groups/${groupId}`} className="text-sm font-bold text-sky-700 underline">
            ← بازگشت به گفتگو
          </Link>
        </div>
        {loading ? (
          <p className="text-sm text-stone-500">در حال بارگذاری…</p>
        ) : error ? (
          <p className="text-sm font-semibold text-red-700">{error}</p>
        ) : group ? (
          <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <div>
              <h1 className="text-xl font-extrabold text-stone-900">{group.name}</h1>
              {group.description ? (
                <p className="mt-2 text-sm leading-relaxed text-stone-600">{group.description}</p>
              ) : null}
            </div>
            <dl className="space-y-2 text-sm">
              {group.network?.name ? (
                <div className="flex justify-between gap-2 border-t border-stone-100 pt-2">
                  <dt className="text-stone-500">شبکه</dt>
                  <dd className="font-semibold text-stone-800">{group.network.name}</dd>
                </div>
              ) : null}
              {typeof group.memberCount === 'number' ? (
                <div className="flex justify-between gap-2 border-t border-stone-100 pt-2">
                  <dt className="text-stone-500">اعضا</dt>
                  <dd className="font-semibold text-stone-800">{group.memberCount} نفر</dd>
                </div>
              ) : null}
              {group.myRole ? (
                <div className="flex justify-between gap-2 border-t border-stone-100 pt-2">
                  <dt className="text-stone-500">نقش شما</dt>
                  <dd className="font-semibold text-stone-800">
                    {group.myRole === 'GROUP_ADMIN' ? 'مدیر گروه' : 'عضو'}
                  </dd>
                </div>
              ) : null}
            </dl>
            <Link
              href={`/groups/${groupId}/members`}
              className="block rounded-xl bg-sky-600 py-3 text-center text-sm font-bold text-white"
            >
              مشاهدهٔ اعضا
            </Link>
          </div>
        ) : null}
      </main>
    </AuthGate>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AuthGate } from '@/components/AuthGate';
import { getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { groupRoleBadgeClasses, groupRoleLabelFa } from '@/lib/group-roles';

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

  const initial = group?.name?.trim().slice(0, 1) || 'گ';

  return (
    <AuthGate>
      <main className="mx-auto min-h-[50vh] w-full max-w-md bg-[#f0f2f5] px-3 py-4 pb-24" dir="rtl">
        <Link
          href={`/groups/${groupId}`}
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-bold text-emerald-800 transition hover:bg-white/80"
        >
          <span aria-hidden>‹</span>
          بازگشت به گفتگو
        </Link>

        {loading ? (
          <div className="mt-8 space-y-3">
            <div className="mx-auto h-20 w-20 animate-pulse rounded-full bg-white/80" />
            <div className="mx-auto h-6 w-40 animate-pulse rounded-lg bg-white/80" />
          </div>
        ) : error ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-5 text-center">
            <p className="text-sm font-semibold text-red-800">{error}</p>
          </div>
        ) : group ? (
          <div className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-200/80">
            <div className="flex flex-col items-center border-b border-stone-100 px-4 pb-5 pt-6 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 text-2xl font-extrabold text-white shadow-md ring-4 ring-white">
                {initial}
              </div>
              <h1 className="mt-4 px-2 text-[1.35rem] font-extrabold leading-snug text-stone-900">{group.name}</h1>
              {group.description ? (
                <p className="mt-2 max-w-sm px-1 text-[13px] leading-relaxed text-stone-600">{group.description}</p>
              ) : (
                <p className="mt-2 text-[12px] text-stone-400">بدون توضیح</p>
              )}
            </div>

            <dl className="divide-y divide-stone-100 px-4 py-1 text-[13px]">
              {group.network?.name ? (
                <div className="flex items-center justify-between gap-3 py-3">
                  <dt className="text-stone-500">شبکه</dt>
                  <dd className="font-semibold text-stone-900">{group.network.name}</dd>
                </div>
              ) : null}
              {typeof group.memberCount === 'number' ? (
                <div className="flex items-center justify-between gap-3 py-3">
                  <dt className="text-stone-500">اعضا</dt>
                  <dd className="font-semibold text-stone-900">{group.memberCount} نفر</dd>
                </div>
              ) : null}
              {group.myRole ? (
                <div className="flex items-center justify-between gap-3 py-3">
                  <dt className="text-stone-500">نقش شما</dt>
                  <dd>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-extrabold ${groupRoleBadgeClasses(group.myRole)}`}
                    >
                      {groupRoleLabelFa(group.myRole)}
                    </span>
                  </dd>
                </div>
              ) : null}
            </dl>

            <div className="p-4 pt-2">
              <Link
                href={`/groups/${groupId}/members`}
                className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-emerald-600 text-sm font-extrabold text-white shadow-sm transition hover:bg-emerald-700"
              >
                مدیریت و مشاهدهٔ اعضا
              </Link>
            </div>
          </div>
        ) : null}
      </main>
    </AuthGate>
  );
}

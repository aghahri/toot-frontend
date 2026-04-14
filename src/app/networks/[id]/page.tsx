'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AuthGate } from '@/components/AuthGate';
import { getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';

type NetworkPayload = {
  id: string;
  name: string;
  description: string | null;
  slug: string | null;
  visibility: string;
  isMember: boolean;
  myRole: string | null;
};

export default function NetworkDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === 'string' ? params.id : '';

  const [net, setNet] = useState<NetworkPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token || !id) return;
    setLoading(true);
    setError(null);
    try {
      const row = await apiFetch<NetworkPayload>(`networks/${encodeURIComponent(id)}`, {
        method: 'GET',
        token,
      });
      setNet(row);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا');
      setNet(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function join() {
    const token = getAccessToken();
    if (!token || !id) return;
    setJoining(true);
    setError(null);
    try {
      await apiFetch(`networks/${encodeURIComponent(id)}/join`, { method: 'POST', token });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'پیوستن ممکن نیست');
    } finally {
      setJoining(false);
    }
  }

  return (
    <AuthGate>
      <main className="mx-auto w-full max-w-md px-4 pb-10 pt-2" dir="rtl">
        <div className="mb-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-10 min-w-[2.5rem] items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
            aria-label="بازگشت"
          >
            ←
          </button>
          <Link href="/spaces" className="text-xs font-bold text-sky-700 underline">
            فضاها
          </Link>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">در حال بارگذاری…</p>
        ) : error && !net ? (
          <p className="text-sm font-semibold text-red-700">{error}</p>
        ) : net ? (
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
            <h1 className="text-xl font-extrabold text-slate-900">{net.name}</h1>
            {net.slug ? (
              <p className="mt-1 text-xs text-slate-500" dir="ltr">
                {net.slug}
              </p>
            ) : null}
            {net.description ? <p className="mt-3 text-sm leading-relaxed text-slate-600">{net.description}</p> : null}
            <p className="mt-2 text-[11px] font-medium text-slate-500">وضعیت: {net.visibility}</p>

            {error ? <p className="mt-3 text-xs font-semibold text-amber-700">{error}</p> : null}

            <div className="mt-5 flex flex-wrap gap-2">
              {!net.isMember ? (
                <button
                  type="button"
                  disabled={joining}
                  onClick={() => void join()}
                  className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  {joining ? '…' : 'پیوستن به شبکه'}
                </button>
              ) : (
                <span className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-800">
                  عضو شبکه هستید
                </span>
              )}
              {net.isMember ? (
                <Link
                  href={`/groups/new?kind=community&networkId=${encodeURIComponent(net.id)}`}
                  className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-bold text-sky-800"
                >
                  ساخت گروه اجتماعی
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </main>
    </AuthGate>
  );
}

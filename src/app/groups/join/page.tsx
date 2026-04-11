'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

type InvitePreview = {
  groupId: string;
  name: string;
  description: string | null;
  networkName: string | null;
  memberCount: number;
};

function GroupJoinInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token')?.trim() ?? '';

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [authed, setAuthed] = useState(false);

  const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
  const loginHref = `/login?next=${encodeURIComponent(`/groups/join${tokenParam}`)}`;

  useEffect(() => {
    setAuthed(!!getAccessToken());
  }, []);

  useEffect(() => {
    if (!token) {
      setPreviewError('لینک دعوت نامعتبر است.');
      setLoadingPreview(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoadingPreview(true);
      setPreviewError(null);
      try {
        const p = await apiFetch<InvitePreview>(`groups/invites/${encodeURIComponent(token)}/preview`, {
          method: 'GET',
        });
        if (!cancelled) setPreview(p);
      } catch (e) {
        if (!cancelled) setPreviewError(e instanceof Error ? e.message : 'دعوت‌نامه یافت نشد.');
      } finally {
        if (!cancelled) setLoadingPreview(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function onJoin() {
    const t = getAccessToken();
    if (!t || !token) {
      router.push(loginHref);
      return;
    }
    setJoining(true);
    setJoinError(null);
    try {
      const g = await apiFetch<{ id: string }>('groups/invites/join', {
        method: 'POST',
        token: t,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      router.replace(`/groups/${g.id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'خطا';
      if (msg.includes('already a member') || msg.includes('قبلاً') || msg.toLowerCase().includes('already')) {
        if (preview?.groupId) {
          router.replace(`/groups/${preview.groupId}`);
          return;
        }
      }
      setJoinError(msg);
    } finally {
      setJoining(false);
    }
  }

  return (
    <main className="mx-auto min-h-[50vh] w-full max-w-md bg-stone-50 px-4 py-6" dir="rtl">
      <h1 className="text-lg font-extrabold text-stone-900">دعوت به گروه</h1>

      {loadingPreview ? (
        <p className="mt-4 text-sm text-stone-500">در حال بارگذاری…</p>
      ) : previewError ? (
        <p className="mt-4 text-sm font-semibold text-red-700">{previewError}</p>
      ) : preview ? (
        <div className="mt-4 space-y-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <h2 className="text-xl font-extrabold text-stone-900">{preview.name}</h2>
          {preview.description ? (
            <p className="text-sm leading-relaxed text-stone-600">{preview.description}</p>
          ) : null}
          <dl className="space-y-1 text-sm text-stone-600">
            {preview.networkName ? (
              <div className="flex justify-between gap-2">
                <dt>شبکه</dt>
                <dd className="font-semibold text-stone-800">{preview.networkName}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-2">
              <dt>اعضا</dt>
              <dd className="font-semibold text-stone-800">{preview.memberCount} نفر</dd>
            </div>
          </dl>

          {joinError ? <p className="text-sm font-semibold text-red-700">{joinError}</p> : null}

          {authed ? (
            <button
              type="button"
              disabled={joining}
              onClick={() => void onJoin()}
              className="mt-2 w-full rounded-xl bg-emerald-600 py-3 text-center text-sm font-bold text-white disabled:opacity-60"
            >
              {joining ? 'در حال پیوستن…' : 'پیوستن به گروه'}
            </button>
          ) : (
            <Link
              href={loginHref}
              className="mt-2 block w-full rounded-xl bg-sky-600 py-3 text-center text-sm font-bold text-white"
            >
              ورود برای پیوستن
            </Link>
          )}
        </div>
      ) : null}

      <div className="mt-6 text-center">
        <Link href="/groups" className="text-sm font-bold text-sky-700 underline">
          بازگشت به گروه‌ها
        </Link>
      </div>
    </main>
  );
}

export default function GroupJoinPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md px-4 py-8 text-center text-sm text-stone-600" dir="rtl">
          در حال بارگذاری…
        </div>
      }
    >
      <GroupJoinInner />
    </Suspense>
  );
}

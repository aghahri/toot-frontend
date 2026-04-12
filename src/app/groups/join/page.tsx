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
      setPreviewError('این لینک دعوت کامل نیست یا نامعتبر است.');
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
    <main className="mx-auto min-h-[50vh] w-full max-w-md bg-[#f0f2f5] px-3 py-6" dir="rtl">
      <h1 className="text-[1.35rem] font-extrabold text-stone-900">دعوت به گروه</h1>
      <p className="mt-1 text-[12px] leading-relaxed text-stone-500">
        با ورود به توت، فقط شما به این گروه اضافه می‌شوید.
      </p>

      {loadingPreview ? (
        <div className="mt-6 space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-stone-200/80">
          <div className="h-6 max-w-[75%] animate-pulse rounded bg-stone-100" />
          <div className="h-4 w-full animate-pulse rounded bg-stone-50" />
          <div className="h-4 max-w-[66%] animate-pulse rounded bg-stone-50" />
        </div>
      ) : previewError ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-center shadow-sm">
          <p className="text-sm font-semibold text-red-800">{previewError}</p>
        </div>
      ) : preview ? (
        <div className="mt-5 overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-stone-200/80">
          <div className="border-b border-stone-100 px-4 py-4">
            <h2 className="text-lg font-extrabold leading-snug text-stone-900">{preview.name}</h2>
            {preview.description ? (
              <p className="mt-2 text-[13px] leading-relaxed text-stone-600">{preview.description}</p>
            ) : null}
          </div>
          <dl className="space-y-0 divide-y divide-stone-100 px-4 text-[13px]">
            {preview.networkName ? (
              <div className="flex justify-between gap-2 py-3">
                <dt className="text-stone-500">شبکه</dt>
                <dd className="font-semibold text-stone-900">{preview.networkName}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-2 py-3">
              <dt className="text-stone-500">اعضا</dt>
              <dd className="font-semibold text-stone-900">{preview.memberCount} نفر</dd>
            </div>
          </dl>

          <div className="p-4 pt-2">
            {joinError ? (
              <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-center text-[12px] font-semibold text-red-800">
                {joinError}
              </p>
            ) : null}

            {authed ? (
              <button
                type="button"
                disabled={joining}
                onClick={() => void onJoin()}
                className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-emerald-600 text-sm font-extrabold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-55"
              >
                {joining ? 'در حال پیوستن…' : 'پیوستن به گروه'}
              </button>
            ) : (
              <Link
                href={loginHref}
                className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-stone-900 text-sm font-extrabold text-white shadow-sm transition hover:bg-stone-800"
              >
                ورود و پیوستن
              </Link>
            )}
          </div>
        </div>
      ) : null}

      <div className="mt-8 text-center">
        <Link href="/groups" className="text-sm font-bold text-emerald-800 underline-offset-2 hover:underline">
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
        <div className="mx-auto max-w-md px-4 py-10 text-center text-sm text-stone-600" dir="rtl">
          در حال بارگذاری…
        </div>
      }
    >
      <GroupJoinInner />
    </Suspense>
  );
}

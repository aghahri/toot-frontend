'use client';

import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthGate } from '@/components/AuthGate';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

const SEARCH_DEBOUNCE_MS = 320;

type SearchUser = { id: string; name: string; username: string; avatar: string | null };
type SearchPost = {
  id: string;
  text: string;
  createdAt: string;
  userId: string;
  user: { id: string; name: string; username: string; avatar: string | null };
};
type SearchGroup = { id: string; name: string; description: string | null; networkId: string | null };
type SearchNetwork = { id: string; name: string; description: string | null; slug: string | null };
type SearchChannel = { id: string; name: string; description: string | null; networkId: string | null };

type SearchAllResponse = {
  users: SearchUser[];
  posts: SearchPost[];
  networks: SearchNetwork[];
  groups: SearchGroup[];
  channels: SearchChannel[];
};

function excerpt(text: string, max = 120): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

export default function SearchPage() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SearchAllResponse | null>(null);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    const term = q.trim();

    const timer = window.setTimeout(() => {
      if (term.length < 2) {
        setResult(null);
        setError(null);
        setLoading(false);
        return;
      }

      const seq = ++requestSeqRef.current;
      setLoading(true);
      setError(null);

      const t = getAccessToken();
      if (!t) {
        if (seq === requestSeqRef.current) setLoading(false);
        return;
      }

      void (async () => {
        try {
          const data = await apiFetch<SearchAllResponse>(
            `search/all?q=${encodeURIComponent(term)}&limit=15`,
            { method: 'GET', token: t },
          );
          if (seq !== requestSeqRef.current) return;
          setResult(data);
        } catch (e) {
          if (seq !== requestSeqRef.current) return;
          setResult(null);
          setError(e instanceof Error ? e.message : 'خطا در جستجو');
        } finally {
          if (seq === requestSeqRef.current) setLoading(false);
        }
      })();
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [q]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const term = q.trim();
    if (term.length < 2) return;
    const seq = ++requestSeqRef.current;
    const t = getAccessToken();
    if (!t) return;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const data = await apiFetch<SearchAllResponse>(
          `search/all?q=${encodeURIComponent(term)}&limit=15`,
          { method: 'GET', token: t },
        );
        if (seq !== requestSeqRef.current) return;
        setResult(data);
      } catch (err) {
        if (seq !== requestSeqRef.current) return;
        setResult(null);
        setError(err instanceof Error ? err.message : 'خطا در جستجو');
      } finally {
        if (seq === requestSeqRef.current) setLoading(false);
      }
    })();
  }

  const empty =
    result &&
    result.users.length === 0 &&
    result.posts.length === 0 &&
    result.networks.length === 0 &&
    result.groups.length === 0 &&
    result.channels.length === 0;

  const hashtagFirst = q.trim().startsWith('#');

  return (
    <AuthGate>
      <div className="theme-page-bg theme-text-primary min-h-[50dvh] pb-28" dir="rtl">
        <header className="theme-panel-bg theme-border-soft sticky top-14 z-[12] border-b px-3 py-3 backdrop-blur-md sm:px-4">
          <div className="mx-auto flex max-w-lg flex-col gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => router.back()}
                className="shrink-0 rounded-full px-2 py-1 text-sm font-bold text-slate-600 hover:bg-slate-100"
              >
                ← بازگشت
              </button>
              <h1 className="text-lg font-extrabold text-slate-900">جستجو</h1>
            </div>
            <form onSubmit={onSubmit} className="flex min-w-0 gap-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="نام کاربر، متن پست، یا #هشتگ"
                className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-sky-400/50"
                dir="rtl"
                autoComplete="off"
                enterKeyHint="search"
              />
            </form>
            <p className="text-[11px] leading-relaxed text-slate-500">
              نتایج با تایپ به‌روز می‌شوند؛ حداقل دو نویسه. برای هشتگ با # شروع کنید.
            </p>
          </div>
        </header>

        <main className="mx-auto max-w-lg px-3 pt-4 sm:px-4">
          {error && !loading ? (
            <p className="mb-4 text-center text-sm font-semibold text-red-700">{error}</p>
          ) : null}

          {loading ? (
            <div className="space-y-3" aria-busy="true" aria-label="در حال جستجو">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-2xl bg-slate-200/50" />
              ))}
            </div>
          ) : null}

          {!loading && result && empty ? (
            <div className="theme-card-bg theme-border-soft rounded-2xl border px-6 py-10 text-center shadow-sm">
              <p className="text-sm font-bold text-slate-700">نتیجه‌ای پیدا نشد</p>
              <p className="mt-2 text-xs text-slate-500">
                عبارت دیگری امتحان کنید؛ برای هشتگ حتماً با # شروع کنید (مثلاً #تهران).
              </p>
            </div>
          ) : null}

          {!loading && result && !empty ? (
            <div className="space-y-8 pb-6">
              {hashtagFirst ? (
                <>
                  {result.posts.length > 0 ? (
                    <section aria-labelledby="sec-posts">
                      <h2 id="sec-posts" className="mb-3 text-xs font-extrabold text-slate-500">
                        پست‌های این هشتگ
                      </h2>
                      <ul className="space-y-2">
                        {result.posts.map((p) => (
                          <li key={p.id}>
                            <Link
                              href={`/home?postId=${encodeURIComponent(p.id)}`}
                              className="block rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:border-slate-300"
                            >
                              <div className="flex items-center gap-2 text-xs text-slate-500">
                                <span className="font-bold text-slate-800">{p.user.name}</span>
                                <span dir="ltr">@{p.user.username}</span>
                              </div>
                              <p className="mt-2 text-sm leading-relaxed text-slate-700">
                                {excerpt(p.text)}
                              </p>
                              <p className="mt-2 text-[11px] font-semibold text-sky-700">
                                مشاهده در فید خانه ←
                              </p>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}
                </>
              ) : null}

              {!hashtagFirst && result.users.length > 0 ? (
                <section aria-labelledby="sec-users">
                  <h2 id="sec-users" className="mb-3 text-xs font-extrabold text-slate-500">
                    کاربران
                  </h2>
                  <ul className="space-y-2 rounded-2xl border border-slate-200/80 bg-white p-2 shadow-sm">
                    {result.users.map((u) => (
                      <li key={u.id}>
                        <Link
                          href={`/profile/${u.id}`}
                          className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-slate-50"
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-sm font-bold text-slate-600">
                            {u.avatar ? (
                              <img src={u.avatar} alt="" className="h-full w-full object-cover" />
                            ) : (
                              u.name.slice(0, 1)
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-bold text-slate-900">{u.name}</div>
                            <div className="truncate text-xs text-slate-500" dir="ltr">
                              @{u.username}
                            </div>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {!hashtagFirst && result.posts.length > 0 ? (
                <section aria-labelledby="sec-posts-general">
                  <h2 id="sec-posts-general" className="mb-3 text-xs font-extrabold text-slate-500">
                    پست‌ها
                  </h2>
                  <ul className="space-y-2">
                    {result.posts.map((p) => (
                      <li key={p.id}>
                        <Link
                          href={`/home?postId=${encodeURIComponent(p.id)}`}
                          className="block rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:border-slate-300"
                        >
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span className="font-bold text-slate-800">{p.user.name}</span>
                            <span dir="ltr">@{p.user.username}</span>
                          </div>
                          <p className="mt-2 text-sm leading-relaxed text-slate-700">
                            {excerpt(p.text)}
                          </p>
                          <p className="mt-2 text-[11px] font-semibold text-sky-700">
                            مشاهده در فید خانه ←
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {!hashtagFirst && result.groups.length > 0 ? (
                <section aria-labelledby="sec-groups">
                  <h2 id="sec-groups" className="mb-3 text-xs font-extrabold text-slate-500">
                    گروه‌ها
                  </h2>
                  <ul className="space-y-2">
                    {result.groups.map((g) => (
                      <li key={g.id}>
                        <Link
                          href={`/groups/${g.id}`}
                          className="block rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:border-slate-300"
                        >
                          <div className="font-bold text-slate-900">{g.name}</div>
                          {g.description ? (
                            <p className="mt-1 text-xs text-slate-600">{excerpt(g.description, 100)}</p>
                          ) : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {!hashtagFirst && result.channels.length > 0 ? (
                <section aria-labelledby="sec-channels">
                  <h2 id="sec-channels" className="mb-3 text-xs font-extrabold text-slate-500">
                    کانال‌ها
                  </h2>
                  <ul className="space-y-2">
                    {result.channels.map((c) => (
                      <li
                        key={c.id}
                        className="rounded-2xl border border-slate-200/80 bg-white p-4 text-sm font-bold text-slate-800 shadow-sm"
                      >
                        {c.name}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {!hashtagFirst && result.networks.length > 0 ? (
                <section aria-labelledby="sec-networks">
                  <h2 id="sec-networks" className="mb-3 text-xs font-extrabold text-slate-500">
                    شبکه‌ها
                  </h2>
                  <ul className="space-y-2">
                    {result.networks.map((n) => (
                      <li
                        key={n.id}
                        className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
                      >
                        <div className="font-bold text-slate-900">{n.name}</div>
                        {n.slug ? (
                          <div className="mt-1 text-xs text-slate-500" dir="ltr">
                            {n.slug}
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          ) : null}
        </main>
      </div>
    </AuthGate>
  );
}

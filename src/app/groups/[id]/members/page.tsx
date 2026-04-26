'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AuthGate } from '@/components/AuthGate';
import { getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { groupRoleBadgeClasses, groupRoleLabelFa, isGroupManagerRole } from '@/lib/group-roles';

type UserSearchHit = {
  id: string;
  name: string;
  username: string;
  phoneMasked: string;
};

const SEARCH_MIN_LEN = 2;
const SEARCH_DEBOUNCE_MS = 300;

type MemberRow = {
  id: string;
  role: string;
  user: { id: string; name: string; avatar: string | null; email: string };
};

type GroupMe = {
  myRole?: string | null;
};

export default function GroupMembersPage() {
  const params = useParams();
  const groupId = typeof params?.id === 'string' ? params.id : '';
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchHits, setSearchHits] = useState<UserSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [addBusy, setAddBusy] = useState<string | null>(null); // userId currently being added
  const [addFeedback, setAddFeedback] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);

  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token || !groupId) return;
    setLoading(true);
    setError(null);
    try {
      const [me, g, list] = await Promise.all([
        apiFetch<{ id: string }>('users/me', { method: 'GET', token }),
        apiFetch<GroupMe>(`groups/${groupId}`, { method: 'GET', token }),
        apiFetch<MemberRow[]>(`groups/${groupId}/members`, { method: 'GET', token }),
      ]);
      setMyUserId(me.id);
      setMyRole(g.myRole ?? null);
      setRows(Array.isArray(list) ? list : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    void load();
  }, [load]);

  const canManage = isGroupManagerRole(myRole);
  const isOwner = myRole === 'OWNER';

  /** O(1) lookup of existing members so the search list can mark them as
   *  already-added instead of letting the admin click 'add' and get a 409. */
  const memberUserIds = useMemo(() => new Set(rows.map((r) => r.user.id)), [rows]);

  /** Debounced user search. Triggers only when query length >= 2 (Persian
   *  user expectation: 'two letters' or 'two phone digits'). The backend's
   *  /users/search already enforces the same minimum and matches name,
   *  username, email, and mobile (raw + normalized 98-prefix). */
  useEffect(() => {
    if (!canManage) return;
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    const q = searchQuery.trim();
    if (q.length < SEARCH_MIN_LEN) {
      setSearchHits([]);
      setSearchError(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    setSearchError(null);
    searchDebounceRef.current = setTimeout(async () => {
      const token = getAccessToken();
      if (!token) return;
      try {
        const hits = await apiFetch<UserSearchHit[]>(
          `users/search?q=${encodeURIComponent(q)}&limit=20`,
          { method: 'GET', token },
        );
        setSearchHits(hits);
      } catch (e) {
        setSearchHits([]);
        setSearchError(e instanceof Error ? e.message : 'جستجو ناموفق بود');
      } finally {
        setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery, canManage]);

  async function onAddMember(userId: string) {
    const token = getAccessToken();
    if (!token || !groupId) return;
    setAddBusy(userId);
    setAddFeedback(null);
    try {
      await apiFetch<MemberRow[]>(`groups/${groupId}/members`, {
        method: 'POST',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      setAddFeedback({ kind: 'ok', text: 'کاربر به گروه اضافه شد.' });
      // Drop the user from the visible search hits so the row doesn't
      // re-render as 'add'-able for an instant before load() refreshes.
      setSearchHits((prev) => prev.filter((u) => u.id !== userId));
      await load();
    } catch (e) {
      setAddFeedback({ kind: 'err', text: e instanceof Error ? e.message : 'افزودن ناموفق بود.' });
    } finally {
      setAddBusy(null);
    }
  }

  async function loadInvite() {
    const token = getAccessToken();
    if (!token || !groupId) return;
    setInviteBusy(true);
    setInviteMsg(null);
    try {
      const r = await apiFetch<{ token: string; joinPath: string }>(`groups/${groupId}/invite`, {
        method: 'GET',
        token,
      });
      const path = r.joinPath.startsWith('/') ? r.joinPath : `/${r.joinPath}`;
      setInviteUrl(`${window.location.origin}${path}`);
    } catch (e) {
      setInviteMsg(e instanceof Error ? e.message : 'خطا');
    } finally {
      setInviteBusy(false);
    }
  }

  async function copyInvite() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setInviteMsg('لینک کپی شد. می‌توانید در هر جا بفرستید.');
    } catch {
      setInviteMsg('کپی نشد؛ لینک را با انگشت انتخاب کنید.');
    }
  }

  async function shareInvite() {
    if (!inviteUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'دعوت به گروه در توت', text: 'با این لینک به گروه بپیوندید:', url: inviteUrl });
      } catch {
        /* dismissed */
      }
    } else {
      await copyInvite();
    }
  }

  async function rotateInvite() {
    if (!window.confirm('لینک قبلی از کار می‌افتد و دیگران با آن نمی‌توانند بپیوندند. ادامه می‌دهید؟')) return;
    const token = getAccessToken();
    if (!token || !groupId) return;
    setInviteBusy(true);
    setInviteMsg(null);
    try {
      const r = await apiFetch<{ token: string; joinPath: string }>(`groups/${groupId}/invite/rotate`, {
        method: 'POST',
        token,
      });
      const path = r.joinPath.startsWith('/') ? r.joinPath : `/${r.joinPath}`;
      setInviteUrl(`${window.location.origin}${path}`);
      setInviteMsg('لینک جدید ساخته شد.');
    } catch (e) {
      setInviteMsg(e instanceof Error ? e.message : 'خطا');
    } finally {
      setInviteBusy(false);
    }
  }

  async function removeMember(targetUserId: string) {
    if (!window.confirm('این شخص از گروه خارج شود؟')) return;
    const token = getAccessToken();
    if (!token || !groupId) return;
    setActionBusy(`rm:${targetUserId}`);
    try {
      await apiFetch(`groups/${groupId}/members/${encodeURIComponent(targetUserId)}`, {
        method: 'DELETE',
        token,
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا');
    } finally {
      setActionBusy(null);
    }
  }

  async function promoteMember(targetUserId: string) {
    const token = getAccessToken();
    if (!token || !groupId) return;
    setActionBusy(`up:${targetUserId}`);
    try {
      await apiFetch(`groups/${groupId}/members/${encodeURIComponent(targetUserId)}/promote`, {
        method: 'POST',
        token,
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا');
    } finally {
      setActionBusy(null);
    }
  }

  async function demoteMember(targetUserId: string) {
    const token = getAccessToken();
    if (!token || !groupId) return;
    setActionBusy(`down:${targetUserId}`);
    try {
      await apiFetch(`groups/${groupId}/members/${encodeURIComponent(targetUserId)}/demote`, {
        method: 'POST',
        token,
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا');
    } finally {
      setActionBusy(null);
    }
  }

  const managerHint =
    myRole === 'OWNER'
      ? 'شما مالک گروه هستید؛ می‌توانید اعضا و مدیرها را مدیریت کنید.'
      : myRole === 'ADMIN' || myRole === 'GROUP_ADMIN'
        ? 'شما مدیر گروه هستید؛ می‌توانید عضو اضافه یا حذف کنید و لینک دعوت بسازید.'
        : null;

  return (
    <AuthGate>
      <main className="mx-auto min-h-[50vh] w-full max-w-md bg-[#f0f2f5] px-3 py-4 pb-28" dir="rtl">
        <Link
          href={`/groups/${groupId}/info`}
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-bold text-emerald-800 transition hover:bg-white/80"
        >
          <span aria-hidden>‹</span>
          اطلاعات گروه
        </Link>

        <div className="mt-3">
          <h1 className="text-[1.35rem] font-extrabold leading-tight text-stone-900">اعضا</h1>
          <p className="mt-1 text-[13px] leading-relaxed text-stone-600">
            {loading ? '…' : `${rows.length} نفر در این گروه`}
          </p>
        </div>

        {canManage && managerHint ? (
          <p className="mt-3 rounded-2xl border border-emerald-200/80 bg-emerald-50/90 px-3 py-2.5 text-[12px] font-medium leading-relaxed text-emerald-950">
            {managerHint}
          </p>
        ) : null}

        {canManage ? (
          <section className="mt-4 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)]">
            <div className="border-b border-[var(--line)] px-3 py-2.5">
              <h2 className="text-sm font-extrabold text-[var(--ink)]">افزودن عضو</h2>
              <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--ink-3)]">
                با دو کاراکتر از نام، نام کاربری یا شماره تماس جستجو کنید.
              </p>
            </div>
            <div className="space-y-2 p-3">
              <div className="flex h-11 items-center gap-2 rounded-xl bg-[var(--surface-2)] px-3 text-[var(--ink-3)]">
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4 shrink-0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.5-3.5" />
                </svg>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="جستجو با نام، نام کاربری یا شماره"
                  className="h-full w-full bg-transparent text-[13px] text-[var(--ink)] placeholder:text-[var(--ink-3)] outline-none"
                  autoComplete="off"
                  aria-label="جستجوی کاربر برای افزودن"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-[18px] leading-none text-[var(--ink-3)] hover:text-[var(--ink-2)]"
                    aria-label="پاک کردن جستجو"
                  >
                    ×
                  </button>
                ) : null}
              </div>

              {addFeedback ? (
                <p
                  className={`text-[12px] font-semibold ${
                    addFeedback.kind === 'ok' ? 'text-[var(--success)]' : 'text-[var(--accent-hover)]'
                  }`}
                  role="status"
                >
                  {addFeedback.text}
                </p>
              ) : null}

              {searchQuery.trim().length > 0 && searchQuery.trim().length < SEARCH_MIN_LEN ? (
                <p className="text-[11px] text-[var(--ink-3)]">حداقل ۲ کاراکتر وارد کنید.</p>
              ) : null}

              {searching ? (
                <p className="text-[11px] text-[var(--ink-3)]">در حال جستجو…</p>
              ) : searchError ? (
                <p className="text-[12px] font-semibold text-[var(--accent-hover)]" role="alert">
                  {searchError}
                </p>
              ) : searchQuery.trim().length >= SEARCH_MIN_LEN && searchHits.length === 0 ? (
                <p className="text-[11px] text-[var(--ink-3)]">کاربری یافت نشد.</p>
              ) : searchHits.length > 0 ? (
                <ul className="divide-y divide-[var(--line)] overflow-hidden rounded-xl border border-[var(--line)]">
                  {searchHits.map((u) => {
                    const alreadyMember = memberUserIds.has(u.id);
                    const adding = addBusy === u.id;
                    const initial = (u.name || u.username || '?').trim().slice(0, 1) || '?';
                    return (
                      <li
                        key={u.id}
                        className="flex items-center gap-3 bg-[var(--surface)] px-3 py-2.5"
                      >
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-sm font-bold text-[var(--ink-2)]"
                          aria-hidden
                        >
                          {initial.toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-bold text-[var(--ink)]">
                            {u.name || 'بدون نام'}
                          </p>
                          <p className="truncate text-[11px] text-[var(--ink-3)]" dir="ltr">
                            @{u.username} · {u.phoneMasked}
                          </p>
                        </div>
                        {alreadyMember ? (
                          <span className="shrink-0 rounded-full bg-[var(--surface-2)] px-3 py-1 text-[11px] font-bold text-[var(--ink-3)]">
                            عضو گروه است
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={adding}
                            onClick={() => void onAddMember(u.id)}
                            className="shrink-0 rounded-full bg-[var(--accent)] px-3.5 py-1.5 text-[12px] font-extrabold text-[var(--accent-contrast)] transition hover:bg-[var(--accent-hover)] disabled:opacity-50"
                          >
                            {adding ? '…' : 'افزودن'}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          </section>
        ) : null}

        {canManage ? (
          <section className="mt-3 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-200/80">
            <div className="border-b border-stone-100 px-3 py-2.5">
              <h2 className="text-sm font-extrabold text-stone-900">لینک دعوت</h2>
              <p className="mt-0.5 text-[11px] leading-relaxed text-stone-500">
                هر کسی با این لینک — در صورت ورود به توت — می‌تواند به گروه بپیوندد. فقط با افراد مورد اعتماد به‌اشتراک بگذارید.
              </p>
            </div>
            <div className="space-y-3 p-3">
              {!inviteUrl ? (
                <button
                  type="button"
                  disabled={inviteBusy}
                  onClick={() => void loadInvite()}
                  className="flex min-h-[44px] w-full items-center justify-center rounded-xl bg-stone-900 text-sm font-bold text-white shadow-sm transition hover:bg-stone-800 disabled:opacity-55"
                >
                  {inviteBusy ? 'در حال آماده‌سازی…' : 'نمایش لینک دعوت'}
                </button>
              ) : (
                <>
                  <div
                    className="rounded-xl border border-stone-200 bg-stone-50/90 px-3 py-2.5 text-[12px] leading-relaxed text-stone-800"
                    dir="ltr"
                  >
                    {inviteUrl}
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                    <button
                      type="button"
                      onClick={() => void copyInvite()}
                      className="min-h-[44px] rounded-xl bg-emerald-600 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
                    >
                      کپی لینک
                    </button>
                    <button
                      type="button"
                      onClick={() => void shareInvite()}
                      className="min-h-[44px] rounded-xl border border-stone-200 bg-white text-sm font-bold text-stone-800 transition hover:bg-stone-50"
                    >
                      اشتراک‌گذاری
                    </button>
                    <button
                      type="button"
                      disabled={inviteBusy}
                      onClick={() => void rotateInvite()}
                      className="col-span-2 min-h-[40px] rounded-xl border border-amber-300/90 bg-amber-50 text-[12px] font-bold text-amber-950 transition hover:bg-amber-100 disabled:opacity-55 sm:col-span-1"
                    >
                      ساخت لینک جدید (لینک قبلی از کار می‌افتد)
                    </button>
                  </div>
                </>
              )}
              {inviteMsg ? (
                <p className="text-center text-[12px] font-medium text-stone-600" role="status">
                  {inviteMsg}
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        {loading ? (
          <div className="mt-6 space-y-3 px-1">
            <div className="h-16 animate-pulse rounded-2xl bg-white/80" />
            <div className="h-16 animate-pulse rounded-2xl bg-white/80" />
            <div className="h-16 animate-pulse rounded-2xl bg-white/80" />
          </div>
        ) : error ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-center">
            <p className="text-sm font-semibold text-red-800">{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-3 rounded-full bg-stone-900 px-4 py-2 text-xs font-bold text-white"
            >
              تلاش دوباره
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-stone-300 bg-white/70 px-4 py-10 text-center">
            <p className="text-sm font-bold text-stone-700">هنوز عضوی نیست</p>
            <p className="mt-2 text-[12px] text-stone-500">بعداً اینجا پر می‌شود.</p>
          </div>
        ) : (
          <ul className="mt-4 space-y-2.5">
            {rows.map((m) => {
              const label = groupRoleLabelFa(m.role);
              const badgeCls = groupRoleBadgeClasses(m.role);
              const busy =
                actionBusy === `rm:${m.user.id}` ||
                actionBusy === `up:${m.user.id}` ||
                actionBusy === `down:${m.user.id}`;
              const isSelf = myUserId != null && m.user.id === myUserId;
              const showRemove =
                canManage &&
                !isSelf &&
                m.role !== 'OWNER' &&
                (m.role !== 'ADMIN' || isOwner);
              const showPromote = canManage && m.role === 'MEMBER' && !isSelf;
              const showDemote = isOwner && m.role === 'ADMIN' && !isSelf;
              const hasRowActions = showPromote || showDemote || showRemove;

              return (
                <li key={m.id} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-200/70">
                  <div className="flex gap-3 p-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-stone-200 to-stone-300 text-base font-bold text-stone-700 ring-2 ring-white">
                      {m.user.avatar ? (
                        <img src={m.user.avatar} alt="" className="h-full w-full object-cover" />
                      ) : (
                        m.user.name.slice(0, 1)
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-bold text-stone-900">{m.user.name}</span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${badgeCls}`}
                        >
                          {label}
                        </span>
                        {isSelf ? (
                          <span className="text-[10px] font-bold text-stone-400">(شما)</span>
                        ) : null}
                      </div>
                      <p className="mt-1 truncate font-mono text-[10px] text-stone-400" dir="ltr" title={m.user.id}>
                        {m.user.id}
                      </p>
                    </div>
                  </div>
                  {canManage && hasRowActions ? (
                    <div className="flex flex-wrap gap-1.5 border-t border-stone-100 bg-stone-50/80 px-2 py-2">
                      {showPromote ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void promoteMember(m.user.id)}
                          className="min-h-[40px] flex-1 rounded-lg bg-white px-2 text-[11px] font-bold text-stone-800 ring-1 ring-stone-200 transition hover:bg-stone-100 disabled:opacity-45 sm:flex-none sm:px-3"
                        >
                          مدیر کردن
                        </button>
                      ) : null}
                      {showDemote ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void demoteMember(m.user.id)}
                          className="min-h-[40px] flex-1 rounded-lg bg-white px-2 text-[11px] font-bold text-stone-800 ring-1 ring-stone-200 transition hover:bg-stone-100 disabled:opacity-45 sm:flex-none sm:px-3"
                        >
                          عضو کردن
                        </button>
                      ) : null}
                      {showRemove ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void removeMember(m.user.id)}
                          className="min-h-[40px] flex-1 rounded-lg bg-red-50 px-2 text-[11px] font-bold text-red-800 ring-1 ring-red-200/80 transition hover:bg-red-100 disabled:opacity-45 sm:flex-none sm:px-3"
                        >
                          حذف از گروه
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </AuthGate>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AuthGate } from '@/components/AuthGate';
import { getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { groupRoleLabelFa, isGroupManagerRole } from '@/lib/group-roles';

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

  const [addUserId, setAddUserId] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const [addMsg, setAddMsg] = useState<string | null>(null);

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

  async function onAddMember() {
    const token = getAccessToken();
    if (!token || !groupId) return;
    const uid = addUserId.trim();
    if (!uid) {
      setAddMsg('شناسهٔ کاربر را وارد کنید.');
      return;
    }
    setAddBusy(true);
    setAddMsg(null);
    try {
      await apiFetch<MemberRow[]>(`groups/${groupId}/members`, {
        method: 'POST',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uid }),
      });
      setAddUserId('');
      setAddMsg('کاربر به گروه اضافه شد.');
      await load();
    } catch (e) {
      setAddMsg(e instanceof Error ? e.message : 'خطا');
    } finally {
      setAddBusy(false);
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
      setInviteMsg('لینک در حافظه کپی شد.');
    } catch {
      setInviteMsg('کپی ناموفق بود؛ لینک را دستی انتخاب کنید.');
    }
  }

  async function shareInvite() {
    if (!inviteUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'دعوت به گروه', url: inviteUrl });
      } catch {
        /* user cancelled */
      }
    } else {
      await copyInvite();
    }
  }

  async function rotateInvite() {
    if (!window.confirm('لینک قبلی دیگر کار نمی‌کند. ادامه می‌دهید؟')) return;
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
    if (!window.confirm('این عضو از گروه حذف شود؟')) return;
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

  return (
    <AuthGate>
      <main className="mx-auto min-h-[50vh] w-full max-w-md bg-stone-50 px-4 py-4" dir="rtl">
        <Link href={`/groups/${groupId}/info`} className="text-sm font-bold text-sky-700 underline">
          ← اطلاعات گروه
        </Link>
        <h1 className="mt-4 text-lg font-extrabold text-stone-900">اعضای گروه</h1>

        {canManage ? (
          <section className="mt-4 space-y-3 rounded-2xl border border-stone-200 bg-white p-3">
            <h2 className="text-sm font-extrabold text-stone-800">افزودن با شناسه</h2>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={addUserId}
                onChange={(e) => setAddUserId(e.target.value)}
                placeholder="شناسهٔ کاربر"
                className="min-w-0 flex-1 rounded-xl border border-stone-200 px-3 py-2 text-sm"
                dir="ltr"
              />
              <button
                type="button"
                disabled={addBusy}
                onClick={() => void onAddMember()}
                className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {addBusy ? '…' : 'افزودن'}
              </button>
            </div>
            {addMsg ? <p className="text-xs text-stone-600">{addMsg}</p> : null}
          </section>
        ) : null}

        {canManage ? (
          <section className="mt-3 space-y-2 rounded-2xl border border-stone-200 bg-white p-3">
            <h2 className="text-sm font-extrabold text-stone-800">لینک دعوت</h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={inviteBusy}
                onClick={() => void loadInvite()}
                className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
              >
                {inviteBusy ? '…' : 'نمایش / ساخت لینک'}
              </button>
              {inviteUrl ? (
                <>
                  <button
                    type="button"
                    onClick={() => void copyInvite()}
                    className="rounded-xl border border-stone-300 px-3 py-2 text-xs font-bold text-stone-800"
                  >
                    کپی
                  </button>
                  <button
                    type="button"
                    onClick={() => void shareInvite()}
                    className="rounded-xl border border-stone-300 px-3 py-2 text-xs font-bold text-stone-800"
                  >
                    اشتراک
                  </button>
                  <button
                    type="button"
                    disabled={inviteBusy}
                    onClick={() => void rotateInvite()}
                    className="rounded-xl border border-amber-400 px-3 py-2 text-xs font-bold text-amber-900"
                  >
                    لینک جدید
                  </button>
                </>
              ) : null}
            </div>
            {inviteUrl ? (
              <p className="break-all rounded-lg bg-stone-100 p-2 text-[11px] leading-relaxed text-stone-700" dir="ltr">
                {inviteUrl}
              </p>
            ) : null}
            {inviteMsg ? <p className="text-xs text-stone-600">{inviteMsg}</p> : null}
          </section>
        ) : null}

        {loading ? (
          <p className="mt-4 text-sm text-stone-500">در حال بارگذاری…</p>
        ) : error ? (
          <p className="mt-4 text-sm text-red-700">{error}</p>
        ) : (
          <ul className="mt-4 divide-y divide-stone-200 rounded-2xl border border-stone-200 bg-white">
            {rows.map((m) => {
              const label = groupRoleLabelFa(m.role);
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

              return (
                <li key={m.id} className="px-3 py-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-200 text-sm font-bold text-stone-700">
                      {m.user.name.slice(0, 1)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold text-stone-900">{m.user.name}</div>
                      <div className="text-[11px] text-stone-500" dir="ltr">
                        {m.user.id}
                      </div>
                      <div className="mt-1">
                        <span className="inline-block rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-bold text-stone-700">
                          {label}
                        </span>
                      </div>
                      {canManage && (showPromote || showDemote || showRemove) ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {showPromote ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void promoteMember(m.user.id)}
                              className="rounded-lg bg-stone-200 px-2 py-1 text-[11px] font-bold text-stone-800 disabled:opacity-50"
                            >
                              ارتقا به مدیر
                            </button>
                          ) : null}
                          {showDemote ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void demoteMember(m.user.id)}
                              className="rounded-lg bg-stone-200 px-2 py-1 text-[11px] font-bold text-stone-800 disabled:opacity-50"
                            >
                              تنزل به عضو
                            </button>
                          ) : null}
                          {showRemove ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void removeMember(m.user.id)}
                              className="rounded-lg bg-red-50 px-2 py-1 text-[11px] font-bold text-red-800 disabled:opacity-50"
                            >
                              حذف از گروه
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </AuthGate>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { AuthGate } from '@/components/AuthGate';
import { Card } from '@/components/ui/Card';
import { getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';

type Network = { id: string; name: string; description: string | null };
type GroupStub = { id: string; name: string; description: string | null; networkId: string };

export default function SpacesPage() {
  const [networks, setNetworks] = useState<Network[]>([]);
  const [groupsByNet, setGroupsByNet] = useState<Record<string, GroupStub[]>>({});
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const nets = await apiFetch<Network[]>('discover/networks?limit=20', {
          method: 'GET',
          token,
        });
        if (cancelled) return;
        setNetworks(Array.isArray(nets) ? nets : []);
        const map: Record<string, GroupStub[]> = {};
        for (const n of nets ?? []) {
          try {
            const gs = await apiFetch<GroupStub[]>(`discover/networks/${n.id}/groups?limit=15`, {
              method: 'GET',
              token,
            });
            map[n.id] = Array.isArray(gs) ? gs : [];
          } catch {
            map[n.id] = [];
          }
        }
        if (!cancelled) setGroupsByNet(map);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'خطا');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function joinGroup(groupId: string) {
    const token = getAccessToken();
    if (!token) return;
    setJoining(groupId);
    setError(null);
    try {
      await apiFetch(`groups/${groupId}/join`, { method: 'POST', token });
      window.location.href = `/groups/${groupId}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'امکان پیوستن نیست (شبکه یا عضویت)');
    } finally {
      setJoining(null);
    }
  }

  return (
    <AuthGate>
      <main className="mx-auto w-full max-w-md px-4 pb-3 pt-2" dir="rtl">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-lg font-extrabold text-slate-900">فضاها و گروه‌ها</h1>
          <Link href="/direct" className="text-xs font-bold text-sky-700 underline">
            چت‌ها و گروه‌ها
          </Link>
        </div>
        <Card>
          <p className="text-sm leading-relaxed text-slate-600">
            شبکه‌های عمومی و گروه‌های هر شبکه را ببینید. برای پیوستن باید عضو همان شبکه باشید.
          </p>
        </Card>
        {loading ? (
          <p className="mt-4 text-sm text-slate-500">در حال بارگذاری…</p>
        ) : error ? (
          <p className="mt-4 text-sm font-semibold text-red-700">{error}</p>
        ) : (
          <div className="mt-4 space-y-4">
            {networks.map((n) => (
              <Card key={n.id}>
                <h2 className="text-base font-bold text-slate-900">{n.name}</h2>
                {n.description ? (
                  <p className="mt-1 text-xs text-slate-600">{n.description}</p>
                ) : null}
                <ul className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                  {(groupsByNet[n.id] ?? []).length === 0 ? (
                    <li className="text-xs text-slate-400">گروهی نیست</li>
                  ) : (
                    (groupsByNet[n.id] ?? []).map((g) => (
                      <li
                        key={g.id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-slate-900">{g.name}</div>
                        </div>
                        <button
                          type="button"
                          disabled={joining === g.id}
                          onClick={() => void joinGroup(g.id)}
                          className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
                        >
                          {joining === g.id ? '…' : 'پیوستن'}
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </Card>
            ))}
          </div>
        )}
      </main>
    </AuthGate>
  );
}

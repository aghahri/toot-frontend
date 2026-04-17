'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';

const quickActions = [
  { href: '/admin/users', title: 'Users', desc: 'Search, inspect accounts, role updates' },
  { href: '/admin/networks', title: 'Networks', desc: 'Core network operations and featured controls' },
  { href: '/admin/groups', title: 'Groups', desc: 'Community/chat groups overview and edits' },
  { href: '/admin/channels', title: 'Channels', desc: 'Channel operations and featured controls' },
  { href: '/admin/showcase', title: 'Showcase', desc: 'Announcements and flagship vitrín links' },
  { href: '/admin/story', title: 'Story queue', desc: 'Review, approve, reject, and publish story candidates' },
  { href: '/admin/story/sources', title: 'Story sources', desc: 'Manage trusted story sources and regions' },
  { href: '/admin/moderation', title: 'Moderation', desc: 'Reported items and post moderation' },
  { href: '/admin/geography', title: 'Geography', desc: 'Neighborhood import/bootstrap tools' },
  { href: '/admin/staff', title: 'Staff', desc: 'Privileged operator role management' },
] as const;

type DashboardResponse = {
  totals: {
    users: number;
    networks: number;
    groups: number;
    channels: number;
    posts: number;
  };
  operations: {
    liveAnnouncements: number;
    reports: number;
    vitrinCoreLinks: number;
    featuredItems: number;
  };
  featuredBreakdown: {
    networks: number;
    groups: number;
    channels: number;
  };
  recent: {
    announcements: Array<{
      id: string;
      title: string;
      scopeType: string;
      publishedAt: string | null;
    }>;
    vitrinCoreLinks: Array<{
      key: string;
      title: string;
      updatedAt: string;
    }>;
  };
};

export default function AdminHomePage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = getAccessToken();
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch<DashboardResponse>('admin/dashboard', { method: 'GET', token });
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load dashboard');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-400">
        Operational overview for platform scale, moderation signals, and showcase/vitrín readiness.
      </p>

      {loading ? <p className="mt-6 text-sm text-slate-400">Loading dashboard…</p> : null}
      {error ? <p className="mt-6 rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-300">{error}</p> : null}

      {data ? (
        <>
          <section className="mt-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Platform totals</h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <MetricCard label="Users" value={data.totals.users} accent="text-sky-300" />
              <MetricCard label="Networks" value={data.totals.networks} accent="text-emerald-300" />
              <MetricCard label="Groups" value={data.totals.groups} accent="text-violet-300" />
              <MetricCard label="Channels" value={data.totals.channels} accent="text-indigo-300" />
              <MetricCard label="Posts" value={data.totals.posts} accent="text-amber-300" />
            </ul>
          </section>

          <section className="mt-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Operational signals</h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label="Live announcements" value={data.operations.liveAnnouncements} accent="text-sky-300" />
              <MetricCard label="Reports" value={data.operations.reports} accent="text-rose-300" />
              <MetricCard label="Vitrin core links" value={data.operations.vitrinCoreLinks} accent="text-indigo-300" />
              <MetricCard label="Featured items" value={data.operations.featuredItems} accent="text-violet-300" />
            </ul>
            <p className="mt-2 text-xs text-slate-500">
              Featured breakdown — networks: {data.featuredBreakdown.networks}, groups: {data.featuredBreakdown.groups}, channels:{' '}
              {data.featuredBreakdown.channels}
            </p>
          </section>

          <section className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <h3 className="text-sm font-bold text-slate-200">Recent live announcements</h3>
              {data.recent.announcements.length === 0 ? (
                <p className="mt-3 text-xs text-slate-500">No published announcements yet.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {data.recent.announcements.map((a) => (
                    <li key={a.id} className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2">
                      <p className="text-sm font-semibold text-slate-100">{a.title}</p>
                      <p className="mt-1 text-[11px] text-slate-500">{a.scopeType}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <h3 className="text-sm font-bold text-slate-200">Recently updated vitrín core links</h3>
              {data.recent.vitrinCoreLinks.length === 0 ? (
                <p className="mt-3 text-xs text-slate-500">No core links configured.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {data.recent.vitrinCoreLinks.map((link) => (
                    <li key={link.key} className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2">
                      <p className="text-sm font-semibold text-slate-100">{link.title}</p>
                      <p className="mt-1 text-[11px] font-mono text-slate-500">{link.key}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </>
      ) : null}

      <section className="mt-8">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Quick actions</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {quickActions.map((c) => (
            <li key={c.href}>
              <Link
                href={c.href}
                className="block rounded-xl border border-slate-800 bg-slate-900/60 p-4 transition hover:border-slate-600 hover:bg-slate-900"
              >
                <h3 className="text-base font-semibold text-sky-300">{c.title}</h3>
                <p className="mt-1 text-sm text-slate-400">{c.desc}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function MetricCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <li className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-extrabold ${accent}`}>{value.toLocaleString()}</p>
    </li>
  );
}

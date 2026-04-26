'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

type SystemHealth = {
  realtime: {
    iceConfigured: boolean;
    iceServerCount: number;
    iceUrlCount: number;
    stunCount: number;
    turnCount: number;
    turnWarning: boolean;
  };
  push: {
    fcmConfigured: boolean;
    activeDeviceCount: number | null;
  };
  socket: {
    connectedSocketCount: number;
    onlineUserCount: number;
    redisConfigured: boolean;
    redisConnected: boolean;
  };
  app: {
    nodeEnv: string;
    uptimeSeconds: number;
    processUptimeSeconds: number;
    serverTime: string;
    bootedAt: string;
    buildCommit: string | null;
  };
};

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m || parts.length === 0) parts.push(`${m}m`);
  return parts.join(' ');
}

export default function AdminSystemPage() {
  const [data, setData] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setError('Not authenticated.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<SystemHealth>('admin/system/health', { method: 'GET', token });
      setData(res);
      setFetchedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load system health');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">System health</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Read-only operator diagnostics. No secrets, no env values, no TURN credentials —
            booleans and counts only. Lets ops verify ICE/STUN/TURN, FCM, socket presence,
            and Redis without SSH.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="shrink-0 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 disabled:opacity-50"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error ? (
        <p className="mt-6 rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      {data ? (
        <>
          {data.realtime.turnWarning ? (
            <p className="mt-6 rounded-lg border border-amber-700/60 bg-amber-950/30 px-3 py-2 text-sm font-semibold text-amber-200">
              ⚠ ICE config has zero TURN servers — voice/video will fail behind symmetric NAT.
              Verify <code className="text-amber-100">WEBRTC_ICE_SERVERS_JSON</code> on the
              backend host.
            </p>
          ) : null}

          {data.realtime.iceConfigured === false ? (
            <p className="mt-6 rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-2 text-sm font-semibold text-red-200">
              ⚠ ICE config missing entirely — <code>WEBRTC_ICE_SERVERS_JSON</code> is unset.
              Calls cannot connect.
            </p>
          ) : null}

          <Section title="A · Realtime / Calls">
            <Row label="ICE config loaded" value={<Pill ok={data.realtime.iceConfigured} />} />
            <Row label="ICE server entries" value={<Num>{data.realtime.iceServerCount}</Num>} />
            <Row label="ICE URL count" value={<Num>{data.realtime.iceUrlCount}</Num>} />
            <Row label="STUN count" value={<Num>{data.realtime.stunCount}</Num>} />
            <Row
              label="TURN count"
              value={
                <Num accent={data.realtime.turnWarning ? 'text-amber-300' : 'text-emerald-300'}>
                  {data.realtime.turnCount}
                </Num>
              }
            />
          </Section>

          <Section title="B · Push (FCM)">
            <Row label="FCM configured" value={<Pill ok={data.push.fcmConfigured} />} />
            <Row
              label="Active push devices"
              value={
                data.push.activeDeviceCount === null ? (
                  <span className="text-xs text-slate-500">unavailable</span>
                ) : (
                  <Num>{data.push.activeDeviceCount}</Num>
                )
              }
            />
          </Section>

          <Section title="C · Socket / Presence">
            <Row label="Connected sockets" value={<Num>{data.socket.connectedSocketCount}</Num>} />
            <Row label="Online users" value={<Num>{data.socket.onlineUserCount}</Num>} />
            <Row label="Redis configured" value={<Pill ok={data.socket.redisConfigured} />} />
            <Row label="Redis connected" value={<Pill ok={data.socket.redisConnected} />} />
          </Section>

          <Section title="D · App status">
            <Row
              label="NODE_ENV"
              value={
                <code className="rounded bg-slate-900 px-2 py-0.5 font-mono text-[11px] text-sky-300">
                  {data.app.nodeEnv}
                </code>
              }
            />
            <Row label="Process uptime" value={<Mono>{formatDuration(data.app.processUptimeSeconds)}</Mono>} />
            <Row label="Service uptime" value={<Mono>{formatDuration(data.app.uptimeSeconds)}</Mono>} />
            <Row label="Server time (UTC)" value={<Mono>{data.app.serverTime}</Mono>} />
            <Row label="Booted at" value={<Mono>{data.app.bootedAt}</Mono>} />
            <Row
              label="Build commit"
              value={
                data.app.buildCommit ? (
                  <Mono>{data.app.buildCommit.slice(0, 12)}</Mono>
                ) : (
                  <span className="text-xs text-slate-500">unavailable</span>
                )
              }
            />
          </Section>
        </>
      ) : null}

      {fetchedAt ? (
        <p className="mt-6 text-[11px] text-slate-500">
          Fetched at {fetchedAt.toISOString()}. Auto-refresh is disabled — tap Refresh for fresh data.
        </p>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</h2>
      <ul className="mt-3 divide-y divide-slate-800">{children}</ul>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm text-slate-300">{label}</span>
      <span className="text-sm">{value}</span>
    </li>
  );
}

function Pill({ ok }: { ok: boolean }) {
  return (
    <span
      className={
        ok
          ? 'rounded-full border border-emerald-700/60 bg-emerald-950/40 px-2 py-0.5 text-[11px] font-bold text-emerald-300'
          : 'rounded-full border border-red-700/60 bg-red-950/40 px-2 py-0.5 text-[11px] font-bold text-red-300'
      }
    >
      {ok ? 'yes' : 'no'}
    </span>
  );
}

function Num({ children, accent }: { children: number; accent?: string }) {
  return (
    <span className={`font-mono text-sm font-bold ${accent ?? 'text-slate-100'}`}>
      {children.toLocaleString()}
    </span>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-[12px] text-slate-300">{children}</span>;
}

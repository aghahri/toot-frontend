'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { toFaDigits } from '@/lib/format';

type WindowKey = '24h' | '7d';

type OtpMetrics = {
  requestCount: number;
  smsTotal: number;
  smsSent: number;
  smsFailed: number;
  smsSuccessRate: number | null;
  activeProvider: string | null;
  latestSmsAt: string | null;
};

type PushMetrics = {
  activeDeviceCount: number;
  devicesAddedInWindow: number;
  sendAttempts: number | null;
  sendSuccess: number | null;
  sendFailure: number | null;
};

type CallMetrics = {
  attemptCount: number;
  acceptedCount: number;
  rejectedCount: number;
  missedCount: number;
  failedCount: number;
  endedCount: number;
  busyCount: number;
  avgDurationSeconds: number | null;
  activeRingingCount: number | null;
};

type StoryMetrics = {
  candidatesCreated: number;
  candidatesPending: number;
  candidatesApproved: number;
  candidatesPublished: number;
  candidatesRejected: number;
  totalViews: number;
  totalClicks: number;
  ctr: number | null;
};

type UserMetrics = {
  newUsers: number;
  activeUsersLastSeen: number;
  activeUsersNote: string;
};

type WindowMetrics = {
  otp: OtpMetrics;
  push: PushMetrics;
  calls: CallMetrics;
  story: StoryMetrics;
  users: UserMetrics;
};

type AnalyticsResponse = {
  windows: { '24h': WindowMetrics; '7d': WindowMetrics };
  generatedAt: string;
  unavailable: Array<{ metric: string; reason: string }>;
};

const WINDOW_LABELS: Record<WindowKey, string> = {
  '24h': '۲۴ ساعت',
  '7d': '۷ روز',
};

export default function AdminSystemAnalyticsPage() {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
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
      const res = await apiFetch<AnalyticsResponse>('admin/system/analytics', {
        method: 'GET',
        token,
      });
      setData(res);
      setFetchedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div dir="rtl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">تحلیل‌های سیستم</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            نمای عملیاتی ۲۴ ساعت و ۷ روز اخیر — فقط شمارش و میانگین، بدون داده‌های خصوصی،
            توکن یا اعتبارنامهٔ ارائه‌دهنده.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            <Link href="/admin/system" className="text-sky-400 hover:underline">
              ← سلامت سیستم
            </Link>
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="shrink-0 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 disabled:opacity-50"
        >
          {loading ? 'در حال بارگذاری…' : 'تازه‌سازی'}
        </button>
      </div>

      {error ? (
        <p className="mt-6 rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-300" dir="ltr">
          {error}
        </p>
      ) : null}

      {data ? (
        <>
          <CardSection title="پیامک و OTP">
            <DualWindow data={data} render={(w) => <OtpBlock m={w.otp} />} />
          </CardSection>

          <CardSection title="پوش نوتیفیکیشن">
            <DualWindow data={data} render={(w) => <PushBlock m={w.push} />} />
          </CardSection>

          <CardSection title="تماس و realtime">
            <DualWindow data={data} render={(w, key) => <CallsBlock m={w.calls} windowKey={key} />} />
          </CardSection>

          <CardSection title="استوری">
            <DualWindow data={data} render={(w) => <StoryBlock m={w.story} />} />
          </CardSection>

          <CardSection title="کاربران">
            <DualWindow data={data} render={(w) => <UsersBlock m={w.users} />} />
          </CardSection>

          {data.unavailable.length > 0 ? (
            <section className="mt-6 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500" dir="ltr">
                Metrics not yet available
              </h2>
              <ul className="mt-3 space-y-2">
                {data.unavailable.map((u) => (
                  <li key={u.metric} className="flex items-start gap-3 text-xs text-slate-400" dir="ltr">
                    <code className="shrink-0 rounded bg-slate-800 px-2 py-0.5 font-mono text-slate-300">
                      {u.metric}
                    </code>
                    <span>{u.reason}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] text-slate-500">
                این موارد فعلاً داده ثبت نمی‌شود. در صورت نیاز، در پاس بعدی به اسکیما اضافه می‌شود.
              </p>
            </section>
          ) : null}
        </>
      ) : null}

      {fetchedAt ? (
        <p className="mt-6 text-[11px] text-slate-500" dir="ltr">
          Fetched at {fetchedAt.toISOString()} · server generated at {data?.generatedAt ?? '—'}.
          Auto-refresh disabled — tap تازه‌سازی for fresh data.
        </p>
      ) : null}
    </div>
  );
}

/* ---------------- helpers ---------------- */

function CardSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h2 className="text-sm font-bold text-slate-200">{title}</h2>
      {children}
    </section>
  );
}

function DualWindow({
  data,
  render,
}: {
  data: AnalyticsResponse;
  render: (w: WindowMetrics, key: WindowKey) => React.ReactNode;
}) {
  return (
    <div className="mt-3 grid gap-3 md:grid-cols-2">
      {(['24h', '7d'] as WindowKey[]).map((k) => (
        <div key={k} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            {WINDOW_LABELS[k]}
          </p>
          {render(data.windows[k], k)}
        </div>
      ))}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-3 py-1.5 text-xs">
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-100">{value}</span>
    </li>
  );
}

function Num({ children, accent }: { children: number | null | undefined; accent?: string }) {
  if (children == null) return <Unavailable />;
  return (
    <span className={`font-mono text-sm font-bold ${accent ?? 'text-slate-100'}`}>
      {toFaDigits(children.toLocaleString('fa-IR'))}
    </span>
  );
}

function Pct({ value }: { value: number | null }) {
  if (value == null) return <Unavailable />;
  return (
    <span className="font-mono text-sm font-bold text-emerald-300">
      {toFaDigits((value * 100).toFixed(1))}٪
    </span>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-[12px] text-slate-300" dir="ltr">{children}</span>;
}

function Unavailable() {
  return <span className="text-[11px] text-slate-500">فعلاً داده ثبت نمی‌شود</span>;
}

function formatDuration(s: number | null): string {
  if (s == null) return '—';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return toFaDigits(`${m}:${sec.toString().padStart(2, '0')}`);
}

function formatRelativeFa(iso: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('fa-IR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/* ---------------- blocks ---------------- */

function OtpBlock({ m }: { m: OtpMetrics }) {
  return (
    <ul className="divide-y divide-slate-800">
      <Row label="درخواست OTP" value={<Num>{m.requestCount}</Num>} />
      <Row label="پیامک کل" value={<Num>{m.smsTotal}</Num>} />
      <Row label="پیامک موفق" value={<Num accent="text-emerald-300">{m.smsSent}</Num>} />
      <Row label="پیامک ناموفق" value={<Num accent="text-rose-300">{m.smsFailed}</Num>} />
      <Row label="نرخ موفقیت" value={<Pct value={m.smsSuccessRate} />} />
      <Row
        label="ارائه‌دهندهٔ فعال"
        value={
          m.activeProvider ? (
            <code className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[11px] text-amber-200" dir="ltr">
              {m.activeProvider}
            </code>
          ) : (
            <Unavailable />
          )
        }
      />
      <Row label="آخرین ارسال" value={<Mono>{formatRelativeFa(m.latestSmsAt)}</Mono>} />
    </ul>
  );
}

function PushBlock({ m }: { m: PushMetrics }) {
  return (
    <ul className="divide-y divide-slate-800">
      <Row label="دستگاه‌های فعال (کل)" value={<Num>{m.activeDeviceCount}</Num>} />
      <Row label="دستگاه‌های جدید این بازه" value={<Num>{m.devicesAddedInWindow}</Num>} />
      <Row label="تلاش ارسال" value={<Num>{m.sendAttempts}</Num>} />
      <Row label="ارسال موفق" value={<Num>{m.sendSuccess}</Num>} />
      <Row label="ارسال ناموفق" value={<Num>{m.sendFailure}</Num>} />
    </ul>
  );
}

function CallsBlock({ m, windowKey }: { m: CallMetrics; windowKey: WindowKey }) {
  return (
    <ul className="divide-y divide-slate-800">
      <Row label="کل تلاش‌ها" value={<Num>{m.attemptCount}</Num>} />
      <Row label="پاسخ داده شده" value={<Num accent="text-emerald-300">{m.acceptedCount}</Num>} />
      <Row label="پایان طبیعی" value={<Num>{m.endedCount}</Num>} />
      <Row label="رد شده" value={<Num>{m.rejectedCount}</Num>} />
      <Row label="بی‌پاسخ" value={<Num>{m.missedCount}</Num>} />
      <Row label="ناموفق" value={<Num accent="text-rose-300">{m.failedCount}</Num>} />
      <Row label="مشغول" value={<Num>{m.busyCount}</Num>} />
      <Row
        label="میانگین مدت (دقیقه:ثانیه)"
        value={<Mono>{formatDuration(m.avgDurationSeconds)}</Mono>}
      />
      {windowKey === '24h' ? (
        <Row label="فعال در حال زنگ‌خوردن" value={<Num>{m.activeRingingCount}</Num>} />
      ) : null}
    </ul>
  );
}

function StoryBlock({ m }: { m: StoryMetrics }) {
  return (
    <ul className="divide-y divide-slate-800">
      <Row label="کاندیدا ساخته شده" value={<Num>{m.candidatesCreated}</Num>} />
      <Row label="در انتظار" value={<Num>{m.candidatesPending}</Num>} />
      <Row label="تأیید شده" value={<Num accent="text-emerald-300">{m.candidatesApproved}</Num>} />
      <Row label="منتشر شده" value={<Num accent="text-sky-300">{m.candidatesPublished}</Num>} />
      <Row label="رد شده" value={<Num accent="text-rose-300">{m.candidatesRejected}</Num>} />
      <Row label="مجموع نمایش (منتشرشده)" value={<Num>{m.totalViews}</Num>} />
      <Row label="مجموع کلیک (منتشرشده)" value={<Num>{m.totalClicks}</Num>} />
      <Row label="نرخ کلیک (CTR)" value={<Pct value={m.ctr} />} />
    </ul>
  );
}

function UsersBlock({ m }: { m: UserMetrics }) {
  return (
    <>
      <ul className="divide-y divide-slate-800">
        <Row label="کاربران جدید" value={<Num>{m.newUsers}</Num>} />
        <Row label="فعال (lastSeenAt)" value={<Num>{m.activeUsersLastSeen}</Num>} />
      </ul>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-500" dir="ltr">
        {m.activeUsersNote}
      </p>
    </>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AuthGate } from '@/components/AuthGate';
import { apiFetch } from '@/lib/api';

/**
 * Admin: SMS Integration management.
 * Talks to /admin/sms/* on the backend (SUPER_ADMIN only). The backend
 * masks all secrets — this page never receives a stored password.
 */

type ProviderKind = 'SAMANTEL' | 'MOCK';

type IntegrationSummary = {
  id: string;
  provider: ProviderKind;
  name: string;
  enabled: boolean;
  hasConfig: boolean;
  apiUrl: string | null;
  username: string | null;
  sender: string | null;
  passwordSet: boolean;
  lastHealthStatus: string | null;
  lastHealthMessage: string | null;
  lastCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type LogRow = {
  id: string;
  provider: ProviderKind;
  purpose: 'OTP' | 'TEST';
  recipientMasked: string;
  sender: string | null;
  customerId: string | null;
  serverId: string | null;
  status: 'QUEUED' | 'SENT' | 'FAILED';
  providerCode: string | null;
  providerMessage: string | null;
  createdAt: string;
};

type LogsResponse = {
  data: LogRow[];
  meta: { total: number; limit: number; offset: number; hasMore: boolean };
};

type SendResult = {
  ready: boolean;
  status: 'SENT' | 'FAILED';
  serverId?: string;
  customerId?: string;
  code?: string;
  message?: string;
};

type BalanceResult = {
  ready: boolean;
  status: 'OK' | 'FAILED';
  amount: number | null;
  raw?: string;
  code?: string;
  message?: string;
};

const DEFAULT_API_URL = 'https://sms.samantel.ir/services/rest/index.php';

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('fa-IR', {
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

export default function AdminSmsIntegrationPage() {
  const [rows, setRows] = useState<IntegrationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [provider, setProvider] = useState<ProviderKind>('SAMANTEL');
  const [name, setName] = useState('Samantel');
  const [enabled, setEnabled] = useState(true);
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [sender, setSender] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);

  const [testPhone, setTestPhone] = useState('');
  const [testBody, setTestBody] = useState('');
  const [testBusy, setTestBusy] = useState(false);
  const [testResult, setTestResult] = useState<SendResult | null>(null);

  const [balance, setBalance] = useState<BalanceResult | null>(null);
  const [balanceBusy, setBalanceBusy] = useState(false);

  const [logs, setLogs] = useState<LogRow[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const loadIntegrations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await apiFetch<IntegrationSummary[]>('admin/sms/integration', {
        method: 'GET',
      });
      setRows(list);
      // Hydrate the form from the active row (or first) so admin lands ready
      // to edit, never blank.
      const target = list.find((r) => r.enabled) ?? list[0] ?? null;
      if (target) {
        setEditingId(target.id);
        setProvider(target.provider);
        setName(target.name);
        setEnabled(target.enabled);
        setApiUrl(target.apiUrl ?? DEFAULT_API_URL);
        setUsername(target.username ?? '');
        setSender(target.sender ?? '');
        setPassword('');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'بارگذاری شکست خورد');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const res = await apiFetch<LogsResponse>('admin/sms/logs?limit=20', {
        method: 'GET',
      });
      setLogs(res.data);
    } catch {
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadIntegrations();
    void loadLogs();
  }, [loadIntegrations, loadLogs]);

  async function save() {
    setSaving(true);
    setError(null);
    setSavedFlash(null);
    try {
      const config: Record<string, string> = {};
      if (apiUrl.trim()) config.apiUrl = apiUrl.trim();
      if (username.trim()) config.username = username.trim();
      if (password) config.password = password; // empty → backend keeps stored
      if (sender.trim()) config.sender = sender.trim();
      const path = editingId
        ? `admin/sms/integration/${encodeURIComponent(editingId)}`
        : 'admin/sms/integration';
      await apiFetch(path, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId ?? undefined,
          provider,
          name,
          enabled,
          config: Object.keys(config).length ? config : undefined,
        }),
      });
      setPassword('');
      setSavedFlash('ذخیره شد.');
      await loadIntegrations();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ذخیره شکست خورد');
    } finally {
      setSaving(false);
    }
  }

  async function runTestSend() {
    if (!testPhone.trim()) return;
    setTestBusy(true);
    setTestResult(null);
    try {
      const res = await apiFetch<SendResult>('admin/sms/test-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone.trim(), body: testBody.trim() || undefined }),
      });
      setTestResult(res);
      void loadLogs();
    } catch (e) {
      setTestResult({
        ready: true,
        status: 'FAILED',
        message: e instanceof Error ? e.message : 'خطا',
      });
    } finally {
      setTestBusy(false);
    }
  }

  async function runBalance() {
    setBalanceBusy(true);
    setBalance(null);
    try {
      const res = await apiFetch<BalanceResult>('admin/sms/balance', { method: 'GET' });
      setBalance(res);
      void loadIntegrations();
    } catch (e) {
      setBalance({
        ready: true,
        status: 'FAILED',
        amount: null,
        message: e instanceof Error ? e.message : 'خطا',
      });
    } finally {
      setBalanceBusy(false);
    }
  }

  return (
    <AuthGate>
      <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-6" dir="rtl">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-extrabold text-[var(--ink)]">یکپارچه‌سازی پیامک</h1>
          <Link
            href="/admin"
            className="text-xs font-bold text-[var(--accent-hover)] underline-offset-2 hover:underline"
          >
            بازگشت به پنل ادمین
          </Link>
        </div>

        {error ? (
          <p
            role="alert"
            className="mb-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--accent-hover)]"
          >
            {error}
          </p>
        ) : null}

        {savedFlash ? (
          <p
            role="status"
            className="mb-4 rounded-xl border border-[var(--line)] bg-[var(--accent-soft)] px-3 py-2 text-sm font-semibold text-[var(--accent-hover)]"
          >
            {savedFlash}
          </p>
        ) : null}

        <section className="mb-6 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
          <h2 className="mb-3 text-sm font-extrabold text-[var(--ink)]">تنظیمات سرویس‌دهنده</h2>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold text-[var(--ink-2)]">
              ارائه‌دهنده
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as ProviderKind)}
                className="mt-1 h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent-ring)]"
              >
                <option value="SAMANTEL">Samantel</option>
                <option value="MOCK">Mock (فقط توسعه)</option>
              </select>
            </label>

            <label className="text-xs font-bold text-[var(--ink-2)]">
              نام نمایشی
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثلاً Samantel — production"
                className="mt-1 h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent-ring)]"
              />
            </label>

            <label className="text-xs font-bold text-[var(--ink-2)] sm:col-span-2">
              آدرس API
              <input
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                dir="ltr"
                className="mt-1 h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent-ring)]"
              />
            </label>

            <label className="text-xs font-bold text-[var(--ink-2)]">
              نام کاربری
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                dir="ltr"
                className="mt-1 h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent-ring)]"
              />
            </label>

            <label className="text-xs font-bold text-[var(--ink-2)]">
              رمز عبور
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={editingId ? 'برای تغییر، رمز جدید را وارد کنید' : 'رمز عبور Samantel'}
                autoComplete="new-password"
                dir="ltr"
                className="mt-1 h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent-ring)]"
              />
              <span className="mt-1 block text-[10px] font-semibold text-[var(--ink-3)]">
                {editingId
                  ? rows.find((r) => r.id === editingId)?.passwordSet
                    ? 'رمز ذخیره شده — خالی بگذارید تا تغییر نکند.'
                    : 'هنوز رمزی ذخیره نشده.'
                  : ' '}
              </span>
            </label>

            <label className="text-xs font-bold text-[var(--ink-2)]">
              شماره فرستنده
              <input
                value={sender}
                onChange={(e) => setSender(e.target.value)}
                placeholder="989999XXXXXX"
                dir="ltr"
                className="mt-1 h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent-ring)]"
              />
            </label>

            <label className="flex items-center gap-2 text-xs font-bold text-[var(--ink-2)] sm:col-span-2">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              فعال (تنها این سرویس‌دهنده برای پیامک استفاده می‌شود)
            </label>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="rounded-full bg-[var(--accent)] px-5 py-2 text-xs font-extrabold text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              {saving ? '…' : 'ذخیره'}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setName('');
                setApiUrl(DEFAULT_API_URL);
                setUsername('');
                setPassword('');
                setSender('');
                setEnabled(true);
              }}
              className="rounded-full border border-[var(--line)] px-4 py-2 text-xs font-extrabold text-[var(--ink-2)] hover:bg-[var(--surface-2)]"
            >
              فرم خالی
            </button>
            {loading ? (
              <span className="text-[11px] text-[var(--ink-3)]">در حال بارگذاری…</span>
            ) : null}
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
          <h2 className="mb-3 text-sm font-extrabold text-[var(--ink)]">ارسال تست</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="09xxxxxxxxx"
              dir="ltr"
              className="h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent-ring)]"
            />
            <input
              value={testBody}
              onChange={(e) => setTestBody(e.target.value)}
              placeholder="متن دلخواه (اختیاری)"
              className="h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent-ring)]"
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={testBusy || !testPhone.trim()}
              onClick={() => void runTestSend()}
              className="rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-extrabold text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              {testBusy ? '…' : 'ارسال تست'}
            </button>
            <button
              type="button"
              disabled={balanceBusy}
              onClick={() => void runBalance()}
              className="rounded-full border border-[var(--line)] px-4 py-2 text-xs font-extrabold text-[var(--ink-2)] hover:bg-[var(--surface-2)] disabled:opacity-50"
            >
              {balanceBusy ? '…' : 'بررسی موجودی'}
            </button>
          </div>
          {testResult ? (
            <p className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--ink-2)]">
              <span className="font-bold">
                نتیجه: {testResult.status === 'SENT' ? 'ارسال شد' : 'ناموفق'}
              </span>
              {testResult.code ? <> · کد: <span dir="ltr">{testResult.code}</span></> : null}
              {testResult.message ? (
                <>
                  {' · '}
                  <span dir="ltr">{testResult.message}</span>
                </>
              ) : null}
              {testResult.serverId ? (
                <>
                  {' · '}serverId=<span dir="ltr">{testResult.serverId}</span>
                </>
              ) : null}
            </p>
          ) : null}
          {balance ? (
            <p className="mt-2 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--ink-2)]">
              <span className="font-bold">
                موجودی: {balance.status === 'OK' ? balance.amount?.toLocaleString('fa-IR') ?? '—' : 'ناموفق'}
              </span>
              {balance.code ? <> · کد: <span dir="ltr">{balance.code}</span></> : null}
              {balance.message ? <> · <span dir="ltr">{balance.message}</span></> : null}
            </p>
          ) : null}
          {rows.find((r) => r.id === editingId)?.lastHealthStatus ? (
            <p className="mt-2 text-[11px] text-[var(--ink-3)]">
              آخرین بررسی: {rows.find((r) => r.id === editingId)?.lastHealthStatus} ·{' '}
              {fmtDate(rows.find((r) => r.id === editingId)?.lastCheckedAt ?? null)}
            </p>
          ) : null}
        </section>

        <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-[var(--ink)]">آخرین ارسال‌ها</h2>
            <button
              type="button"
              onClick={() => void loadLogs()}
              className="text-[11px] font-bold text-[var(--accent-hover)] underline-offset-2 hover:underline"
            >
              تازه‌سازی
            </button>
          </div>
          {logsLoading ? (
            <p className="text-[11px] text-[var(--ink-3)]">در حال بارگذاری…</p>
          ) : logs.length === 0 ? (
            <p className="text-[11px] text-[var(--ink-3)]">هنوز ارسالی ثبت نشده.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-xs">
                <thead>
                  <tr className="text-[10px] font-bold text-[var(--ink-3)]">
                    <th className="px-2 py-1 text-start">زمان</th>
                    <th className="px-2 py-1 text-start">گیرنده</th>
                    <th className="px-2 py-1 text-start">نوع</th>
                    <th className="px-2 py-1 text-start">وضعیت</th>
                    <th className="px-2 py-1 text-start">کد</th>
                    <th className="px-2 py-1 text-start">customerId</th>
                    <th className="px-2 py-1 text-start">serverId</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((row) => (
                    <tr key={row.id} className="border-t border-[var(--line)] text-[var(--ink-2)]">
                      <td className="px-2 py-1.5 text-[11px]">{fmtDate(row.createdAt)}</td>
                      <td className="px-2 py-1.5 font-mono text-[11px]" dir="ltr">
                        {row.recipientMasked}
                      </td>
                      <td className="px-2 py-1.5">{row.purpose === 'OTP' ? 'OTP' : 'تست'}</td>
                      <td
                        className={`px-2 py-1.5 font-bold ${
                          row.status === 'SENT' ? 'text-[var(--accent-hover)]' : 'text-[var(--ink-3)]'
                        }`}
                      >
                        {row.status === 'SENT' ? 'ارسال شد' : row.status === 'FAILED' ? 'ناموفق' : 'صف'}
                      </td>
                      <td className="px-2 py-1.5 font-mono text-[10px]" dir="ltr">
                        {row.providerCode ?? '—'}
                      </td>
                      <td className="px-2 py-1.5 font-mono text-[10px]" dir="ltr">
                        {row.customerId ?? '—'}
                      </td>
                      <td className="px-2 py-1.5 font-mono text-[10px]" dir="ltr">
                        {row.serverId ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </AuthGate>
  );
}

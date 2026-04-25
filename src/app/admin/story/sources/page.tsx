'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { toFaDigits } from '@/lib/format';

type StorySource = {
  id: string;
  name: string;
  type: 'RSS' | 'WEB' | 'INTERNAL';
  baseUrl: string | null;
  category: string | null;
  isActive: boolean;
  trustScore: number;
  regionScope: 'GLOBAL' | 'COUNTRY' | 'CITY' | 'LOCAL';
  createdAt: string;
  updatedAt: string;
};

const typeOptions: StorySource['type'][] = ['RSS', 'WEB', 'INTERNAL'];
const regionOptions: StorySource['regionScope'][] = ['GLOBAL', 'COUNTRY', 'CITY', 'LOCAL'];

const REGION_FA: Record<StorySource['regionScope'], string> = {
  GLOBAL: 'جهانی',
  COUNTRY: 'کشور',
  CITY: 'شهر',
  LOCAL: 'محله',
};

const TYPE_FA: Record<StorySource['type'], string> = {
  RSS: 'RSS',
  WEB: 'وب',
  INTERNAL: 'داخلی',
};

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

export default function AdminStorySourcesPage() {
  const [rows, setRows] = useState<StorySource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ingestSummary, setIngestSummary] = useState<string | null>(null);
  const [ingestingSourceId, setIngestingSourceId] = useState<string | null>(null);
  const [ingestingAll, setIngestingAll] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: '',
    type: 'RSS' as StorySource['type'],
    baseUrl: '',
    category: '',
    trustScore: 60,
    regionScope: 'GLOBAL' as StorySource['regionScope'],
  });

  const load = async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<StorySource[]>('admin/story/sources', { method: 'GET', token });
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'بارگذاری منابع شکست خورد');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const createSource = async () => {
    const token = getAccessToken();
    if (!token) return;
    setCreating(true);
    setError(null);
    try {
      await apiFetch('admin/story/sources', {
        method: 'POST',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          type: form.type,
          baseUrl: form.baseUrl.trim() || undefined,
          category: form.category.trim() || undefined,
          trustScore: form.trustScore,
          regionScope: form.regionScope,
          isActive: true,
        }),
      });
      setForm({
        name: '',
        type: 'RSS',
        baseUrl: '',
        category: '',
        trustScore: 60,
        regionScope: 'GLOBAL',
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ایجاد منبع شکست خورد');
    } finally {
      setCreating(false);
    }
  };

  const ingestSource = async (sourceId?: string) => {
    const token = getAccessToken();
    if (!token) return;
    if (sourceId) setIngestingSourceId(sourceId);
    else setIngestingAll(true);
    setError(null);
    setIngestSummary(null);
    try {
      const result = await apiFetch<{
        imported?: number;
        skipped?: number;
        sourceCount?: number;
      }>('admin/story/sources/ingest', {
        method: 'POST',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId, limit: 12 }),
      });
      const imported = result.imported ?? 0;
      const skipped = result.skipped ?? 0;
      const sourceCount = result.sourceCount ?? (sourceId ? 1 : 0);
      setIngestSummary(
        sourceId
          ? `دریافت انجام شد: ${toFaDigits(imported)} نامزد جدید، ${toFaDigits(skipped)} تکراری/رد.`
          : `از ${toFaDigits(sourceCount)} منبع دریافت شد: ${toFaDigits(imported)} جدید، ${toFaDigits(skipped)} تکراری/رد.`,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'دریافت از منبع شکست خورد');
    } finally {
      setIngestingSourceId(null);
      setIngestingAll(false);
    }
  };

  const toggleActive = async (row: StorySource) => {
    const token = getAccessToken();
    if (!token) return;
    setError(null);
    try {
      await apiFetch(`admin/story/sources/${row.id}`, {
        method: 'PATCH',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'به‌روزرسانی شکست خورد');
    }
  };

  return (
    <div dir="rtl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-[var(--ink)]">منابع استوری</h1>
          <p className="mt-1 text-sm text-[var(--ink-3)]">
            منابع معتبر برای دریافت نامزدهای داستان (RSS / وب / داخلی).
          </p>
        </div>
        <button
          type="button"
          disabled={ingestingAll}
          onClick={() => void ingestSource(undefined)}
          className="rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-extrabold text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)] disabled:opacity-50"
        >
          {ingestingAll ? '…' : 'دریافت همه منابع فعال'}
        </button>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--accent-hover)]"
        >
          {error}
        </p>
      ) : null}
      {ingestSummary ? (
        <p
          role="status"
          className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--accent-soft)] px-3 py-2 text-sm font-semibold text-[var(--accent-hover)]"
        >
          {ingestSummary}
        </p>
      ) : null}

      <section className="mt-5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
        <h2 className="mb-3 text-sm font-extrabold text-[var(--ink)]">افزودن منبع جدید</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-xs font-bold text-[var(--ink-2)]">
            نام منبع
            <input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="مثلاً خبرگزاری ایرنا"
              className="mt-1 h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent-ring)]"
            />
          </label>
          <label className="text-xs font-bold text-[var(--ink-2)]">
            نوع
            <select
              value={form.type}
              onChange={(e) =>
                setForm((p) => ({ ...p, type: e.target.value as StorySource['type'] }))
              }
              className="mt-1 h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent-ring)]"
            >
              {typeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {TYPE_FA[opt]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold text-[var(--ink-2)] sm:col-span-2">
            آدرس پایه
            <input
              value={form.baseUrl}
              onChange={(e) => setForm((p) => ({ ...p, baseUrl: e.target.value }))}
              placeholder="https://example.com/feed"
              dir="ltr"
              className="mt-1 h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent-ring)]"
            />
          </label>
          <label className="text-xs font-bold text-[var(--ink-2)]">
            دسته‌بندی
            <input
              value={form.category}
              onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
              placeholder="مثلاً اقتصاد"
              className="mt-1 h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent-ring)]"
            />
          </label>
          <label className="text-xs font-bold text-[var(--ink-2)]">
            امتیاز اعتماد ({toFaDigits(form.trustScore)}/۱۰۰)
            <input
              type="number"
              min={0}
              max={100}
              value={form.trustScore}
              onChange={(e) => setForm((p) => ({ ...p, trustScore: Number(e.target.value) || 0 }))}
              className="mt-1 h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent-ring)]"
            />
          </label>
          <label className="text-xs font-bold text-[var(--ink-2)]">
            دامنه جغرافیایی
            <select
              value={form.regionScope}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  regionScope: e.target.value as StorySource['regionScope'],
                }))
              }
              className="mt-1 h-10 w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent-ring)]"
            >
              {regionOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {REGION_FA[opt]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            disabled={!form.name.trim() || creating}
            onClick={() => void createSource()}
            className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-xs font-extrabold text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            {creating ? '…' : 'افزودن منبع'}
          </button>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs font-bold text-[var(--ink-2)] hover:bg-[var(--surface-2)]"
          >
            تازه‌سازی
          </button>
        </div>
      </section>

      {loading ? (
        <p className="mt-6 text-sm text-[var(--ink-3)]">در حال بارگذاری…</p>
      ) : rows.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-6 text-center text-sm text-[var(--ink-3)]">
          هنوز منبعی ثبت نشده. اولین منبع را از فرم بالا اضافه کنید.
        </p>
      ) : (
        <ul className="mt-5 space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate text-sm font-extrabold text-[var(--ink)]">{row.name}</p>
                    <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-bold text-[var(--ink-3)]">
                      {TYPE_FA[row.type]}
                    </span>
                    <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-bold text-[var(--ink-3)]">
                      {REGION_FA[row.regionScope]}
                    </span>
                    {row.category ? (
                      <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-bold text-[var(--ink-3)]">
                        {row.category}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 truncate text-[11px] text-[var(--ink-3)]" dir="ltr">
                    {row.baseUrl || '—'}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--ink-3)]">
                    اعتماد {toFaDigits(row.trustScore)}/۱۰۰ · ساخت{' '}
                    <span dir="ltr">{fmtDate(row.createdAt)}</span> · آخرین تغییر{' '}
                    <span dir="ltr">{fmtDate(row.updatedAt)}</span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void toggleActive(row)}
                    className={`rounded-full px-3 py-1.5 text-xs font-extrabold transition ${
                      row.isActive
                        ? 'bg-[var(--accent-soft)] text-[var(--accent-hover)] hover:bg-[var(--surface-strong)]'
                        : 'border border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink-3)] hover:bg-[var(--surface-strong)]'
                    }`}
                  >
                    {row.isActive ? 'فعال' : 'غیرفعال'}
                  </button>
                  <button
                    type="button"
                    disabled={ingestingSourceId === row.id || row.type === 'INTERNAL' || !row.baseUrl}
                    onClick={() => void ingestSource(row.id)}
                    className="rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-extrabold text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)] disabled:opacity-40"
                  >
                    {ingestingSourceId === row.id ? '…' : 'دریافت'}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

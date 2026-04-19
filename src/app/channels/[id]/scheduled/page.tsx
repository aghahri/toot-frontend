'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AuthGate } from '@/components/AuthGate';
import { ScheduledDateTimeField } from '@/components/community/ScheduledDateTimeField';
import { getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { formatAppDateTime, getAppLocale } from '@/lib/locale-date';

type Row = {
  id: string;
  content: string | null;
  scheduledFor: string;
  status: 'PENDING' | 'PUBLISHED' | 'CANCELED' | 'FAILED';
};

function toValidIso(raw: string): string | null {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export default function ChannelScheduledPage() {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : '';
  const [rows, setRows] = useState<Row[]>([]);
  const [content, setContent] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editScheduledFor, setEditScheduledFor] = useState('');
  const locale = getAppLocale();
  const isFa = locale === 'fa';

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token || !id) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await apiFetch<{ data: Row[] }>(`channels/${encodeURIComponent(id)}/scheduled-posts?limit=40`, { method: 'GET', token });
      setRows(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'خطا');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    const token = getAccessToken();
    if (!token || !id || !scheduledFor) return;
    const iso = toValidIso(scheduledFor);
    if (!iso) {
      setErr('تاریخ/زمان نامعتبر است');
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await apiFetch(`channels/${encodeURIComponent(id)}/scheduled-posts`, {
        method: 'POST',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim() || undefined, scheduledFor: iso }),
      });
      setContent('');
      setScheduledFor('');
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'ثبت نشد');
    } finally {
      setSaving(false);
    }
  }

  async function onCancel(rowId: string) {
    const token = getAccessToken();
    if (!token || !id) return;
    await apiFetch(`channels/${encodeURIComponent(id)}/scheduled-posts/${encodeURIComponent(rowId)}/cancel`, { method: 'POST', token });
    await load();
  }

  async function onEditSave(rowId: string) {
    const token = getAccessToken();
    if (!token || !id || !editScheduledFor) return;
    const iso = toValidIso(editScheduledFor);
    if (!iso) {
      setErr('تاریخ/زمان نامعتبر است');
      return;
    }
    await apiFetch(`channels/${encodeURIComponent(id)}/scheduled-posts/${encodeURIComponent(rowId)}`, {
      method: 'PATCH',
      token,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: editContent.trim() || undefined,
        scheduledFor: iso,
      }),
    });
    setEditingId(null);
    await load();
  }

  return (
    <AuthGate>
      <main className="theme-page-bg min-h-screen px-3 py-4" dir="rtl">
        <div className="mx-auto max-w-2xl space-y-3">
          <Link href={`/channels/${encodeURIComponent(id)}`} className="inline-block text-xs font-bold text-[var(--accent-hover)]">بازگشت به کانال</Link>
          <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--card-bg)] p-4">
            <h1 className="text-sm font-black text-[var(--text-primary)]">زمان‌بندی انتشار</h1>
            <form onSubmit={onCreate} className="mt-3 space-y-2">
              <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} placeholder="متن انتشار" className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm" />
              <ScheduledDateTimeField value={scheduledFor} onChange={setScheduledFor} disabled={saving} />
              <p className="text-[11px] text-[var(--text-secondary)]">
                {isFa
                  ? 'تاریخ و زمان را از تقویم شمسی انتخاب کنید (نمایش با تقویم برنامه یکسان است).'
                  : 'Pick date and time from the calendar (matches app display locale).'}
              </p>
              <button disabled={saving || !scheduledFor} className="rounded-xl bg-violet-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                {saving ? '…' : 'ثبت انتشار زمان‌بندی‌شده'}
              </button>
            </form>
            {err ? <p className="mt-2 text-xs text-red-700">{err}</p> : null}
          </section>
          <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--card-bg)] p-4">
            <h2 className="text-sm font-black text-[var(--text-primary)]">لیست انتشارهای برنامه‌ریزی‌شده</h2>
            {loading ? <p className="mt-2 text-xs text-[var(--text-secondary)]">در حال بارگذاری…</p> : (
              <ul className="mt-3 space-y-2">
                {rows.map((r) => (
                  <li key={r.id} className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3">
                    {editingId === r.id ? (
                      <div className="space-y-2">
                        <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={2} className="w-full rounded-xl border border-[var(--border-soft)] bg-white px-2 py-1 text-xs" />
                        <ScheduledDateTimeField value={editScheduledFor} onChange={setEditScheduledFor} />
                      </div>
                    ) : (
                      <>
                        <p className="text-xs font-bold">{r.content || '(بدون متن)'}</p>
                        <p className="mt-1 text-[11px] text-[var(--text-secondary)]">{formatAppDateTime(r.scheduledFor)} · {r.status}</p>
                      </>
                    )}
                    {r.status === 'PENDING' ? (
                      <div className="mt-2 flex gap-3">
                        {editingId === r.id ? (
                          <button onClick={() => void onEditSave(r.id)} className="text-[11px] font-bold text-emerald-700">ذخیره</button>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingId(r.id);
                              setEditContent(r.content || '');
                              setEditScheduledFor(r.scheduledFor);
                            }}
                            className="text-[11px] font-bold text-[var(--accent-hover)]"
                          >
                            ویرایش
                          </button>
                        )}
                        <button onClick={() => void onCancel(r.id)} className="text-[11px] font-bold text-red-700">لغو</button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </AuthGate>
  );
}

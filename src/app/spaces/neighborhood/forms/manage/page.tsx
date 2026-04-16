'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { Suspense } from 'react';
import { AuthGate } from '@/components/AuthGate';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { FIELD_TYPE_OPTIONS, formStatusLabel } from '@/lib/neighborhoodForms';

type ManageFormRow = {
  id: string;
  title: string;
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED';
  _count: { responses: number; fields: number };
};

type FieldDraft = {
  key: string;
  label: string;
  type: (typeof FIELD_TYPE_OPTIONS)[number]['value'];
  required: boolean;
  options: string;
};

const CARD =
  'rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-[0_10px_24px_rgba(15,23,42,0.06)]';
const PRIMARY_CTA =
  'rounded-2xl bg-emerald-700 px-4 py-2.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-emerald-600 disabled:opacity-60';
const SECONDARY_CTA =
  'rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-extrabold text-slate-700 transition hover:bg-slate-50';

function NeighborhoodFormsManageInner() {
  const searchParams = useSearchParams();
  const networkId = searchParams.get('networkId') ?? '';

  const [forms, setForms] = useState<ManageFormRow[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<FieldDraft[]>([
    { key: 'full_name', label: 'نام', type: 'short_text', required: true, options: '' },
  ]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadManage() {
    if (!networkId) return;
    setLoading(true);
    setError(null);
    try {
      const token = getAccessToken();
      if (!token) return;
      const res = await apiFetch<ManageFormRow[]>(`networks/${networkId}/forms/manage`, {
        method: 'GET',
        token,
      });
      setForms(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'مدیریت فرم‌ها در دسترس نیست');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadManage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [networkId]);

  async function createForm(e: FormEvent) {
    e.preventDefault();
    if (!networkId) return;
    setSaving(true);
    setError(null);
    try {
      const token = getAccessToken();
      if (!token) return;
      await apiFetch(`networks/${networkId}/forms`, {
        method: 'POST',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          fields: fields.map((f, idx) => ({
            key: f.key,
            label: f.label,
            type: f.type,
            required: f.required,
            order: idx,
            options:
              f.type === 'single_choice' || f.type === 'multi_choice'
                ? f.options
                    .split(',')
                    .map((x) => x.trim())
                    .filter(Boolean)
                : undefined,
          })),
        }),
      });
      setTitle('');
      setDescription('');
      await loadManage();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ایجاد فرم ممکن نیست');
    } finally {
      setSaving(false);
    }
  }

  async function mutate(formId: string, action: 'publish' | 'unpublish' | 'close') {
    try {
      const token = getAccessToken();
      if (!token) return;
      await apiFetch(`networks/${networkId}/forms/${formId}/${action}`, {
        method: 'POST',
        token,
      });
      await loadManage();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'عملیات فرم ممکن نیست');
    }
  }

  return (
    <AuthGate>
      <main className="mx-auto w-full max-w-md px-4 pb-12 pt-4 sm:pb-14" dir="rtl">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h1 className="text-lg font-extrabold text-slate-900">مدیریت Neighborhood Forms</h1>
          <Link href={`/spaces/neighborhood/forms?networkId=${encodeURIComponent(networkId)}`} className={SECONDARY_CTA}>
            بازگشت
          </Link>
        </div>

        <section className={CARD}>
          <h2 className="text-sm font-extrabold text-slate-900">ایجاد فرم جدید</h2>
          <form onSubmit={createForm} className="mt-3 space-y-2.5">
            <input
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
              placeholder="عنوان فرم"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            <textarea
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
              placeholder="توضیح فرم"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div className="space-y-2">
              {fields.map((field, idx) => (
                <div key={`${field.key}-${idx}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-2.5">
                  <input
                    className="mb-1.5 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs"
                    placeholder="key"
                    value={field.key}
                    onChange={(e) =>
                      setFields((prev) => prev.map((x, i) => (i === idx ? { ...x, key: e.target.value } : x)))
                    }
                    required
                  />
                  <input
                    className="mb-1.5 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs"
                    placeholder="label"
                    value={field.label}
                    onChange={(e) =>
                      setFields((prev) => prev.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)))
                    }
                    required
                  />
                  <select
                    className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs"
                    value={field.type}
                    onChange={(e) =>
                      setFields((prev) =>
                        prev.map((x, i) => (i === idx ? { ...x, type: e.target.value as FieldDraft['type'] } : x)),
                      )
                    }
                  >
                    {FIELD_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {(field.type === 'single_choice' || field.type === 'multi_choice') ? (
                    <input
                      className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs"
                      placeholder="گزینه‌ها با کاما"
                      value={field.options}
                      onChange={(e) =>
                        setFields((prev) => prev.map((x, i) => (i === idx ? { ...x, options: e.target.value } : x)))
                      }
                    />
                  ) : null}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className={SECONDARY_CTA}
                onClick={() =>
                  setFields((prev) => [
                    ...prev,
                    { key: `field_${prev.length + 1}`, label: '', type: 'short_text', required: false, options: '' },
                  ])
                }
              >
                افزودن فیلد
              </button>
              <button type="submit" className={PRIMARY_CTA} disabled={saving}>
                {saving ? 'در حال ایجاد...' : 'ایجاد فرم'}
              </button>
            </div>
          </form>
        </section>

        <section className={CARD + ' mt-4'}>
          <h2 className="text-sm font-extrabold text-slate-900">فرم‌های شبکه</h2>
          {loading ? <p className="mt-2 text-sm text-slate-500">در حال بارگذاری…</p> : null}
          {error ? <p className="mt-2 text-sm font-semibold text-red-700">{error}</p> : null}
          <ul className="mt-3 space-y-2.5">
            {forms.map((form) => (
              <li key={form.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-extrabold text-slate-900">{form.title}</p>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                    {formStatusLabel(form.status)}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  فیلد: {form._count.fields} | پاسخ: {form._count.responses}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {form.status === 'DRAFT' ? (
                    <button type="button" className={PRIMARY_CTA} onClick={() => void mutate(form.id, 'publish')}>
                      انتشار
                    </button>
                  ) : null}
                  {form.status === 'PUBLISHED' ? (
                    <>
                      <button type="button" className={SECONDARY_CTA} onClick={() => void mutate(form.id, 'unpublish')}>
                        بازگشت به پیش‌نویس
                      </button>
                      <button type="button" className={SECONDARY_CTA} onClick={() => void mutate(form.id, 'close')}>
                        بستن فرم
                      </button>
                    </>
                  ) : null}
                  <Link href={`/spaces/neighborhood/forms/${form.id}/responses?networkId=${encodeURIComponent(networkId)}`} className={SECONDARY_CTA}>
                    پاسخ‌ها
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </AuthGate>
  );
}

export default function NeighborhoodFormsManagePage() {
  return (
    <Suspense
      fallback={
        <div className="px-4 py-10 text-center text-sm text-slate-500" dir="rtl">
          در حال بارگذاری…
        </div>
      }
    >
      <NeighborhoodFormsManageInner />
    </Suspense>
  );
}

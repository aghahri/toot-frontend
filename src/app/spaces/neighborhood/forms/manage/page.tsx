'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { Suspense } from 'react';
import { AuthGate } from '@/components/AuthGate';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { FIELD_TYPE_OPTIONS, formStatusBadgeClass, formStatusLabel } from '@/lib/neighborhoodForms';

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

type NetworkOption = {
  id: string;
  name: string;
  spaceCategory: string;
  myRole?: 'NETWORK_ADMIN' | 'MEMBER' | null;
};

const CARD =
  'rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-[0_10px_24px_rgba(15,23,42,0.06)]';
const PRIMARY_CTA =
  'rounded-2xl bg-emerald-700 px-4 py-2.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-emerald-600 disabled:opacity-60';
const SECONDARY_CTA =
  'rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-extrabold text-slate-700 transition hover:bg-slate-50';

function NeighborhoodFormsManageInner() {
  const searchParams = useSearchParams();
  const networkIdFromQuery = searchParams.get('networkId') ?? '';

  const [forms, setForms] = useState<ManageFormRow[]>([]);
  const [networkOptions, setNetworkOptions] = useState<NetworkOption[]>([]);
  const [selectedNetworkId, setSelectedNetworkId] = useState(networkIdFromQuery);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<FieldDraft[]>([
    { key: 'full_name', label: 'نام', type: 'short_text', required: true, options: '' },
  ]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canSubmit = !!selectedNetworkId && !saving;

  function validateCreatePayload() {
    if (!selectedNetworkId) return 'لطفا ابتدا شبکه محله را انتخاب کنید.';
    if (!title.trim()) return 'عنوان فرم الزامی است.';
    if (fields.length === 0) return 'حداقل یک فیلد لازم است.';
    for (const [idx, field] of fields.entries()) {
      if (!field.key.trim()) return `کلید فیلد ${idx + 1} الزامی است.`;
      if (!field.label.trim()) return `عنوان فیلد ${idx + 1} الزامی است.`;
      if (field.type === 'single_choice' || field.type === 'multi_choice') {
        const options = field.options
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean);
        if (options.length < 2) return `فیلد ${idx + 1}: حداقل دو گزینه لازم است.`;
      }
    }
    return null;
  }

  async function loadManage() {
    if (!selectedNetworkId) {
      setForms([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError((prev) => (prev?.includes('شبکه') ? null : prev));
    try {
      const token = getAccessToken();
      if (!token) {
        setError('برای مدیریت فرم‌ها باید وارد شوید.');
        return;
      }
      const res = await apiFetch<ManageFormRow[]>(`networks/${selectedNetworkId}/forms/manage`, {
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
    let cancelled = false;
    void (async () => {
      const token = getAccessToken();
      if (!token) {
        setError('برای مدیریت فرم‌ها باید وارد شوید.');
        setLoading(false);
        return;
      }
      try {
        const allNetworks = await apiFetch<NetworkOption[]>('networks', { method: 'GET', token });
        const adminNeighborhood = allNetworks.filter(
          (n) => n.spaceCategory === 'NEIGHBORHOOD' && n.myRole === 'NETWORK_ADMIN',
        );
        if (cancelled) return;
        setNetworkOptions(adminNeighborhood);
        if (!selectedNetworkId && adminNeighborhood[0]) {
          setSelectedNetworkId(adminNeighborhood[0].id);
        }
        if (!adminNeighborhood.length) {
          setError('شما در حال حاضر ادمین هیچ شبکه محله‌ای نیستید.');
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'بارگذاری شبکه‌ها ممکن نیست');
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void loadManage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNetworkId]);

  async function createForm(e: FormEvent) {
    e.preventDefault();
    const validationError = validateCreatePayload();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const token = getAccessToken();
      if (!token) {
        setError('برای ایجاد فرم باید وارد شوید.');
        return;
      }
      await apiFetch(`networks/${selectedNetworkId}/forms`, {
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
      setSuccess('فرم با موفقیت ایجاد شد.');
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
      if (!token) {
        setError('برای مدیریت فرم باید وارد شوید.');
        return;
      }
      if (!selectedNetworkId) {
        setError('لطفا ابتدا شبکه محله را انتخاب کنید.');
        return;
      }
      await apiFetch(`networks/${selectedNetworkId}/forms/${formId}/${action}`, {
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
          <Link href={`/spaces/neighborhood/forms${selectedNetworkId ? `?networkId=${encodeURIComponent(selectedNetworkId)}` : ''}`} className={SECONDARY_CTA}>
            بازگشت
          </Link>
        </div>

        <section className={CARD}>
          <h2 className="text-sm font-extrabold text-slate-900">ایجاد فرم جدید</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            فرم‌های محله‌ای برای نظرسنجی، درخواست خدمات و جمع‌آوری داده محلی.
          </p>
          <div className="mt-3">
            <label className="mb-1 block text-xs font-bold text-slate-700">شبکه محله (اجباری)</label>
            <select
              value={selectedNetworkId}
              onChange={(e) => setSelectedNetworkId(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-emerald-300"
            >
              <option value="">انتخاب شبکه</option>
              {networkOptions.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
            {!selectedNetworkId ? (
              <p className="mt-1 text-xs font-semibold text-amber-700">
                بدون انتخاب شبکه، دکمه ایجاد فرم غیرفعال می‌ماند.
              </p>
            ) : null}
          </div>
          <form onSubmit={createForm} className="mt-3 space-y-2.5">
            <input
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
              placeholder="عنوان فرم"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            <p className="-mt-1 text-[11px] text-slate-500">عنوان کوتاه و دقیق انتخاب کنید.</p>
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
                  <p className="mb-1 text-[11px] font-bold text-slate-600">فیلد {idx + 1}</p>
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
                  <label className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-slate-600">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(e) =>
                        setFields((prev) =>
                          prev.map((x, i) => (i === idx ? { ...x, required: e.target.checked } : x)),
                        )
                      }
                    />
                    پاسخ این فیلد الزامی است
                  </label>
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
              <button type="submit" className={PRIMARY_CTA} disabled={!canSubmit}>
                {saving ? 'در حال ایجاد...' : 'ایجاد فرم'}
              </button>
            </div>
          </form>
        </section>

        <section className={CARD + ' mt-4'}>
          <h2 className="text-sm font-extrabold text-slate-900">فرم‌های شبکه</h2>
          {loading ? (
            <div className="mt-2 space-y-2">
              <p className="text-sm text-slate-500">در حال بارگذاری فرم‌ها…</p>
              <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
            </div>
          ) : null}
          {error ? <p className="mt-2 rounded-2xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p> : null}
          {success ? <p className="mt-2 rounded-2xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{success}</p> : null}
          {!loading && !error && forms.length === 0 ? (
            <p className="mt-2 rounded-2xl bg-slate-50 px-3 py-3 text-sm text-slate-600">
              هنوز فرمی برای این شبکه ثبت نشده است.
            </p>
          ) : null}
          <ul className="mt-3 space-y-2.5">
            {forms.map((form) => (
              <li key={form.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-extrabold text-slate-900">{form.title}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${formStatusBadgeClass(form.status)}`}>
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
                  <Link href={`/spaces/neighborhood/forms/${form.id}/responses?networkId=${encodeURIComponent(selectedNetworkId)}`} className={SECONDARY_CTA}>
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

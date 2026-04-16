'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AuthGate } from '@/components/AuthGate';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

type FieldRow = {
  id: string;
  key: string;
  label: string;
  type: 'SHORT_TEXT' | 'LONG_TEXT' | 'SINGLE_CHOICE' | 'MULTI_CHOICE' | 'NUMBER' | 'BOOLEAN';
  required: boolean;
  options: string[];
};

type FormDetail = {
  id: string;
  title: string;
  description: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED';
  fields: FieldRow[];
  myResponse: { id: string; submittedAt: string } | null;
};

const CARD =
  'rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-[0_10px_24px_rgba(15,23,42,0.06)]';
const PRIMARY_CTA =
  'rounded-2xl bg-emerald-700 px-4 py-2.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-emerald-600 disabled:opacity-60';
const SECONDARY_CTA =
  'rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-extrabold text-slate-700 transition hover:bg-slate-50';

export default function NeighborhoodFormDetailPage() {
  const params = useParams<{ formId: string }>();
  const searchParams = useSearchParams();
  const formId = params?.formId ?? '';
  const networkId = searchParams.get('networkId') ?? '';

  const [detail, setDetail] = useState<FormDetail | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canSubmit = useMemo(
    () => !!detail && detail.status === 'PUBLISHED' && !detail.myResponse,
    [detail],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!networkId || !formId) return;
      setLoading(true);
      setError(null);
      try {
        const token = getAccessToken();
        if (!token) return;
        const res = await apiFetch<FormDetail>(`networks/${networkId}/forms/${formId}`, {
          method: 'GET',
          token,
        });
        if (!cancelled) setDetail(res);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'بارگذاری فرم ممکن نیست');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [formId, networkId]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!detail || !canSubmit) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const token = getAccessToken();
      if (!token) return;
      const payload = detail.fields
        .filter((field) => answers[field.id] !== undefined && answers[field.id] !== '')
        .map((field) => ({ fieldId: field.id, value: answers[field.id] }));
      await apiFetch(`networks/${networkId}/forms/${formId}/submit`, {
        method: 'POST',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: payload }),
      });
      setSuccess('پاسخ شما ثبت شد.');
      setDetail((prev) =>
        prev ? { ...prev, myResponse: { id: 'submitted', submittedAt: new Date().toISOString() } } : prev,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ثبت پاسخ ممکن نیست');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthGate>
      <main className="mx-auto w-full max-w-md px-4 pb-12 pt-4 sm:pb-14" dir="rtl">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h1 className="text-lg font-extrabold text-slate-900">ثبت فرم محله</h1>
          <Link href="/spaces/neighborhood/forms" className={SECONDARY_CTA}>
            بازگشت
          </Link>
        </div>
        <section className={CARD}>
          {loading ? <p className="text-sm text-slate-500">در حال بارگذاری…</p> : null}
          {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
          {detail ? (
            <>
              <h2 className="text-base font-extrabold text-slate-900">{detail.title}</h2>
              {detail.description ? (
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{detail.description}</p>
              ) : null}
              {detail.myResponse ? (
                <p className="mt-3 rounded-2xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
                  شما قبلا این فرم را پاسخ داده‌اید.
                </p>
              ) : null}
              <form onSubmit={submit} className="mt-4 space-y-3">
                {detail.fields.map((field) => (
                  <div key={field.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <label className="mb-1 block text-xs font-bold text-slate-700">
                      {field.label} {field.required ? '*' : ''}
                    </label>
                    {field.type === 'SHORT_TEXT' ? (
                      <input
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                        value={String(answers[field.id] ?? '')}
                        onChange={(ev) => setAnswers((prev) => ({ ...prev, [field.id]: ev.target.value }))}
                      />
                    ) : null}
                    {field.type === 'LONG_TEXT' ? (
                      <textarea
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                        rows={4}
                        value={String(answers[field.id] ?? '')}
                        onChange={(ev) => setAnswers((prev) => ({ ...prev, [field.id]: ev.target.value }))}
                      />
                    ) : null}
                    {field.type === 'NUMBER' ? (
                      <input
                        type="number"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                        value={String(answers[field.id] ?? '')}
                        onChange={(ev) =>
                          setAnswers((prev) => ({
                            ...prev,
                            [field.id]: ev.target.value === '' ? '' : Number(ev.target.value),
                          }))
                        }
                      />
                    ) : null}
                    {field.type === 'BOOLEAN' ? (
                      <select
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                        value={String(answers[field.id] ?? '')}
                        onChange={(ev) =>
                          setAnswers((prev) => ({
                            ...prev,
                            [field.id]: ev.target.value === 'true' ? true : ev.target.value === 'false' ? false : '',
                          }))
                        }
                      >
                        <option value="">انتخاب کنید</option>
                        <option value="true">بله</option>
                        <option value="false">خیر</option>
                      </select>
                    ) : null}
                    {(field.type === 'SINGLE_CHOICE' || field.type === 'MULTI_CHOICE') ? (
                      <div className="space-y-1.5">
                        {field.options.map((opt) => (
                          <label key={opt} className="flex items-center gap-2 text-xs text-slate-700">
                            <input
                              type={field.type === 'SINGLE_CHOICE' ? 'radio' : 'checkbox'}
                              name={field.id}
                              checked={
                                field.type === 'SINGLE_CHOICE'
                                  ? answers[field.id] === opt
                                  : Array.isArray(answers[field.id]) && (answers[field.id] as string[]).includes(opt)
                              }
                              onChange={(ev) => {
                                if (field.type === 'SINGLE_CHOICE') {
                                  setAnswers((prev) => ({ ...prev, [field.id]: opt }));
                                  return;
                                }
                                const prevList = Array.isArray(answers[field.id]) ? (answers[field.id] as string[]) : [];
                                setAnswers((prev) => ({
                                  ...prev,
                                  [field.id]: ev.target.checked
                                    ? [...prevList, opt]
                                    : prevList.filter((x) => x !== opt),
                                }));
                              }}
                            />
                            {opt}
                          </label>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
                {success ? <p className="text-sm font-semibold text-emerald-700">{success}</p> : null}
                <button type="submit" disabled={!canSubmit || saving} className={PRIMARY_CTA}>
                  {saving ? 'در حال ثبت...' : 'ثبت پاسخ'}
                </button>
              </form>
            </>
          ) : null}
        </section>
      </main>
    </AuthGate>
  );
}

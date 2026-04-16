'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AuthGate } from '@/components/AuthGate';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

type SummaryField = {
  fieldId: string;
  label: string;
  type: string;
  counts?: Record<string, number>;
  yes?: number;
  no?: number;
  answered?: number;
};

type SummaryRes = {
  totalResponses: number;
  fields: SummaryField[];
};

type ResponseRow = {
  id: string;
  submittedAt: string;
  respondent: { id: string; name: string; username: string };
  answers: Array<{
    id: string;
    value: unknown;
    field: { id: string; label: string; key: string; type: string };
  }>;
};

const CARD =
  'rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-[0_10px_24px_rgba(15,23,42,0.06)]';
const SECONDARY_CTA =
  'rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-extrabold text-slate-700 transition hover:bg-slate-50';

export default function NeighborhoodFormResponsesPage() {
  const params = useParams<{ formId: string }>();
  const formId = params?.formId ?? '';
  const searchParams = useSearchParams();
  const networkId = searchParams.get('networkId') ?? '';

  const [summary, setSummary] = useState<SummaryRes | null>(null);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!networkId || !formId) return;
      setLoading(true);
      setError(null);
      try {
        const token = getAccessToken();
        if (!token) return;
        const [summaryRes, responsesRes] = await Promise.all([
          apiFetch<SummaryRes>(`networks/${networkId}/forms/${formId}/summary`, { method: 'GET', token }),
          apiFetch<ResponseRow[]>(`networks/${networkId}/forms/${formId}/responses`, { method: 'GET', token }),
        ]);
        if (cancelled) return;
        setSummary(summaryRes);
        setResponses(responsesRes);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'بارگذاری پاسخ‌ها ممکن نیست');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [formId, networkId]);

  return (
    <AuthGate>
      <main className="mx-auto w-full max-w-md px-4 pb-12 pt-4 sm:pb-14" dir="rtl">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h1 className="text-lg font-extrabold text-slate-900">خلاصه و پاسخ‌های فرم</h1>
          <Link href={`/spaces/neighborhood/forms/manage?networkId=${encodeURIComponent(networkId)}`} className={SECONDARY_CTA}>
            بازگشت
          </Link>
        </div>

        <section className={CARD}>
          {loading ? <p className="text-sm text-slate-500">در حال بارگذاری…</p> : null}
          {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
          {summary ? (
            <>
              <p className="text-sm font-extrabold text-slate-900">تعداد کل پاسخ‌ها: {summary.totalResponses}</p>
              <ul className="mt-3 space-y-2">
                {summary.fields.map((field) => (
                  <li key={field.fieldId} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-extrabold text-slate-900">{field.label}</p>
                    {field.counts ? (
                      <div className="mt-1 text-[11px] text-slate-600">
                        {Object.entries(field.counts).map(([key, val]) => (
                          <p key={key}>
                            {key}: {val}
                          </p>
                        ))}
                      </div>
                    ) : null}
                    {typeof field.yes === 'number' && typeof field.no === 'number' ? (
                      <p className="mt-1 text-[11px] text-slate-600">
                        بله: {field.yes} | خیر: {field.no}
                      </p>
                    ) : null}
                    {typeof field.answered === 'number' ? (
                      <p className="mt-1 text-[11px] text-slate-600">پاسخ داده‌شده: {field.answered}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>

        <section className={CARD + ' mt-4'}>
          <h2 className="text-sm font-extrabold text-slate-900">لیست پاسخ‌ها</h2>
          <ul className="mt-3 space-y-2.5">
            {responses.map((row) => (
              <li key={row.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-bold text-slate-700">
                  {row.respondent.name} (@{row.respondent.username})
                </p>
                <p className="text-[10px] text-slate-500">{new Date(row.submittedAt).toLocaleString('fa-IR')}</p>
                <div className="mt-2 space-y-1 text-[11px] text-slate-700">
                  {row.answers.map((ans) => (
                    <p key={ans.id}>
                      <span className="font-bold">{ans.field.label}: </span>
                      {Array.isArray(ans.value) ? ans.value.join(', ') : String(ans.value)}
                    </p>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </AuthGate>
  );
}

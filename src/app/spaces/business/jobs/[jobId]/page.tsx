'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { AuthGate } from '@/components/AuthGate';
import { getAccessToken } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { fetchBusinessJob } from '@/lib/businessSpace';
import { LinkCapabilityModal } from '@/components/capability/LinkCapabilityModal';

function JobDetailInner() {
  const params = useParams();
  const sp = useSearchParams();
  const jobId = typeof params?.jobId === 'string' ? params.jobId : '';
  const networkId = sp.get('networkId')?.trim() || '';
  const [row, setRow] = useState<Awaited<ReturnType<typeof fetchBusinessJob>> | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;
    let c = false;
    void (async () => {
      try {
        const j = await fetchBusinessJob(jobId);
        if (!c) setRow(j);
      } catch (e) {
        if (!c) setErr(e instanceof Error ? e.message : 'خطا');
      }
    })();
    return () => {
      c = true;
    };
  }, [jobId]);

  async function applyHint() {
    const token = getAccessToken();
    if (!token || !jobId) return;
    setHint(null);
    try {
      const res = await apiFetch<{ contactMethod: string; contactValue: string | null }>(
        `business/jobs/${encodeURIComponent(jobId)}/apply-hint`,
        { method: 'POST', token },
      );
      setHint(`${res.contactMethod}${res.contactValue ? `: ${res.contactValue}` : ''}`);
    } catch (e) {
      setHint(e instanceof Error ? e.message : 'خطا');
    }
  }

  return (
    <main className="theme-page-bg mx-auto w-full max-w-md space-y-4 px-4 pb-16 pt-4" dir="rtl">
      <Link href={networkId ? `/spaces/business/jobs?networkId=${encodeURIComponent(networkId)}` : '/spaces/business'}>←</Link>
      {err ? <p className="text-red-600">{err}</p> : null}
      {row ? (
        <>
          <h1 className="text-xl font-black text-[var(--text-primary)]">{row.title}</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            {row.companyName} · {row.jobType} {row.remote ? '· دورکار' : ''}
          </p>
          {row.city ? <p className="text-sm">{row.city}</p> : null}
          {row.salaryText ? <p className="text-sm">حقوق: {row.salaryText}</p> : null}
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{row.description}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void applyHint()} className="rounded-full border px-4 py-2 text-xs font-bold">
              راه ارتباط / اقدام
            </button>
            {networkId ? (
              <button type="button" onClick={() => setLinkOpen(true)} className="rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-bold text-[var(--accent-contrast)]">
                اشتراک در گروه یا کانال
              </button>
            ) : null}
          </div>
          {hint ? <p className="text-xs text-[var(--text-secondary)]">{hint}</p> : null}
        </>
      ) : (
        !err && <p>…</p>
      )}
      {networkId && jobId ? (
        <LinkCapabilityModal
          open={linkOpen}
          onClose={() => setLinkOpen(false)}
          networkId={networkId}
          capabilityType="JOB"
          capabilityId={jobId}
          sourceSpaceCategory="PUBLIC_GENERAL"
        />
      ) : null}
    </main>
  );
}

export default function JobDetailPage() {
  return (
    <AuthGate>
      <Suspense fallback={<p className="p-6">…</p>}>
        <JobDetailInner />
      </Suspense>
    </AuthGate>
  );
}

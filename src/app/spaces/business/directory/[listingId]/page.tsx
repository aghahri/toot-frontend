'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { AuthGate } from '@/components/AuthGate';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { LinkCapabilityModal } from '@/components/capability/LinkCapabilityModal';
import { fetchBusinessMeetings, type BusinessMeetingRow } from '@/lib/businessSpace';

type ListingDetail = {
  id: string;
  businessName: string;
  category: string;
  city: string | null;
  description: string | null;
  imageMedia: { url: string } | null;
};

function ListingDetailInner() {
  const params = useParams();
  const sp = useSearchParams();
  const listingId = typeof params?.listingId === 'string' ? params.listingId : '';
  const networkId = sp.get('networkId')?.trim() || '';
  const [row, setRow] = useState<ListingDetail | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [meetings, setMeetings] = useState<BusinessMeetingRow[]>([]);
  const [showMeetingHistory, setShowMeetingHistory] = useState(false);
  const activeMeeting = meetings.find((item) => {
    const st = item.meeting.status;
    return st === 'SCHEDULED' || st === 'LIVE';
  });

  useEffect(() => {
    if (!listingId) return;
    let c = false;
    void (async () => {
      const token = getAccessToken();
      if (!token) return;
      try {
        const r = await apiFetch<ListingDetail>(`business/directory/${encodeURIComponent(listingId)}`, {
          method: 'GET',
          token,
        });
        if (!c) setRow(r);
      } catch (e) {
        if (!c) setErr(e instanceof Error ? e.message : 'خطا');
      }
    })();
    return () => {
      c = true;
    };
  }, [listingId]);

  useEffect(() => {
    if (!listingId) return;
    let c = false;
    void (async () => {
      try {
        const res = await fetchBusinessMeetings(listingId, 10);
        if (!c) setMeetings(res.data);
      } catch {
        if (!c) setMeetings([]);
      }
    })();
    return () => {
      c = true;
    };
  }, [listingId]);

  return (
    <main className="theme-page-bg mx-auto max-w-md space-y-4 px-4 pb-16 pt-4" dir="rtl">
      <Link href={networkId ? `/spaces/business/directory?networkId=${encodeURIComponent(networkId)}` : '/spaces/business'}>←</Link>
      {err ? <p className="text-red-600">{err}</p> : null}
      {row ? (
        <>
          {row.imageMedia?.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={row.imageMedia.url} alt="" className="mx-auto max-h-48 rounded-2xl object-contain" />
          ) : null}
          <h1 className="text-xl font-black">{row.businessName}</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            {row.category}
            {row.city ? ` · ${row.city}` : ''}
          </p>
          {row.description ? <p className="text-sm leading-relaxed">{row.description}</p> : null}
          <section className="space-y-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--card-bg)] p-3">
            <h2 className="text-sm font-black">{activeMeeting ? 'جلسه آنلاین فعال' : 'مشاوره آنلاین'}</h2>
            <p className="text-xs text-[var(--text-secondary)]">
              {activeMeeting ? 'همین حالا وارد شوید' : 'جلسه تصویری فوری با این کسب‌وکار'}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {['سریع', 'آنلاین', 'تصویری'].map((hint) => (
                <span
                  key={hint}
                  className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700"
                >
                  {hint}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {activeMeeting ? (
                <Link
                  href={`/meetings/${activeMeeting.meeting.id}`}
                  className="rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-extrabold text-[var(--accent-contrast)]"
                >
                  ورود به جلسه
                </Link>
              ) : (
                <Link
                  href={`/meetings/new?context=business&listingId=${encodeURIComponent(listingId)}`}
                  className="rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-extrabold text-[var(--accent-contrast)]"
                >
                  شروع جلسه
                </Link>
              )}
              <button
                type="button"
                onClick={() => setShowMeetingHistory((v) => !v)}
                className="rounded-full border border-[var(--border-soft)] px-4 py-2 text-xs font-bold"
              >
                {showMeetingHistory ? 'بستن جلسات قبلی' : 'مشاهده جلسات قبلی'}
              </button>
            </div>
            {showMeetingHistory ? meetings.length > 0 ? (
              <ul className="space-y-2">
                {meetings.slice(0, 6).map((item) => (
                  <li key={item.id} className="flex items-center justify-between rounded-xl border border-[var(--border-soft)] px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold">{item.meeting.title}</p>
                      <p className="text-[11px] text-[var(--text-secondary)]">{new Date(item.meeting.startsAt).toLocaleString('fa-IR')}</p>
                    </div>
                    <Link
                      href={`/meetings/${item.meeting.id}`}
                      className="rounded-full border border-[var(--border-soft)] px-3 py-1 text-[11px] font-extrabold"
                    >
                      ورود
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-[var(--text-secondary)]">هنوز جلسه‌ای برگزار نشده است</p>
            ) : null}
          </section>
          {networkId ? (
            <button type="button" onClick={() => setLinkOpen(true)} className="rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-bold text-[var(--accent-contrast)]">
              اشتراک در جامعه
            </button>
          ) : null}
        </>
      ) : (
        !err && <p>…</p>
      )}
      {networkId && listingId ? (
        <LinkCapabilityModal
          open={linkOpen}
          onClose={() => setLinkOpen(false)}
          networkId={networkId}
          capabilityType="BUSINESS_LISTING"
          capabilityId={listingId}
          sourceSpaceCategory="PUBLIC_GENERAL"
        />
      ) : null}
    </main>
  );
}

export default function ListingDetailPage() {
  return (
    <AuthGate>
      <Suspense fallback={<p className="p-6">…</p>}>
        <ListingDetailInner />
      </Suspense>
    </AuthGate>
  );
}

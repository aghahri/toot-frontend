'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { AuthGate } from '@/components/AuthGate';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { LinkCapabilityModal } from '@/components/capability/LinkCapabilityModal';

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

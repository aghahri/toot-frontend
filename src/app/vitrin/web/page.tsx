'use client';

import Link from 'next/link';
import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthGate } from '@/components/AuthGate';
import { getVitrinEntryById } from '@/config/vitrinCatalog';

function VitrinWebInner() {
  const searchParams = useSearchParams();
  const raw = searchParams.get('entry');
  const entry = useMemo(() => getVitrinEntryById(raw), [raw]);

  if (!entry) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center" dir="rtl">
        <p className="text-sm font-semibold text-slate-800">این صفحه در دسترس نیست.</p>
        <Link href="/vitrin" className="text-sm font-bold text-sky-700 underline">
          بازگشت به ویترین
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col" dir="rtl">
      <div className="flex items-center gap-2 border-b border-stone-200/90 bg-white px-3 py-2">
        <Link
          href="/vitrin"
          className="flex h-10 min-w-[2.5rem] items-center justify-center rounded-full text-stone-600 hover:bg-stone-100"
          aria-label="بازگشت به ویترین"
        >
          ←
        </Link>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-extrabold text-stone-900">{entry.title}</h2>
          <p className="truncate text-[11px] text-stone-500">{entry.subtitle}</p>
        </div>
      </div>
      <iframe
        title={entry.title}
        src={entry.url}
        className="min-h-[70vh] w-full flex-1 border-0 bg-white"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <p className="border-t border-stone-100 bg-stone-50 px-3 py-2 text-[10px] text-stone-500">
        برخی سایت‌ها نمایش داخل اپ را محدود می‌کنند؛ در آن صورت می‌توانید همان سایت را در مرورگر باز کنید.
      </p>
    </div>
  );
}

export default function VitrinWebPage() {
  return (
    <AuthGate>
      <Suspense
        fallback={
          <div className="px-4 py-8 text-center text-sm text-slate-600" dir="rtl">
            در حال بارگذاری…
          </div>
        }
      >
        <VitrinWebInner />
      </Suspense>
    </AuthGate>
  );
}

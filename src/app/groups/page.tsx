'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AuthGate } from '@/components/AuthGate';

/** Primary inbox lives on `/direct`; keep this route for bookmarks only. */
export default function GroupsIndexRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/direct');
  }, [router]);
  return (
    <AuthGate>
      <main className="mx-auto min-h-[40vh] w-full max-w-md px-4 py-12 text-center text-sm text-stone-600" dir="rtl">
        در حال هدایت به چت‌ها…
      </main>
    </AuthGate>
  );
}

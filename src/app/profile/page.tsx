'use client';

import { AuthGate } from '@/components/AuthGate';
import { getAccessToken } from '@/lib/auth';
import { Card } from '@/components/ui/Card';

export default function ProfilePage() {
  const token = getAccessToken();

  return (
    <AuthGate>
      <main className="mx-auto w-full max-w-md p-4">
        <div className="mb-4">
          <h1 className="text-2xl font-extrabold">پروفایل</h1>
          <p className="mt-1 text-sm text-slate-700">نمایش ساده اطلاعات کاربر (MVP).</p>
        </div>

        <Card>
          <div className="space-y-3">
            <div className="text-sm">
              توکن فعال است: <span className="font-semibold text-emerald-700">{token ? 'بله' : 'خیر'}</span>
            </div>
            <div className="break-all text-xs text-slate-500">توکن: {token ? `${token.slice(0, 18)}...` : '-'}</div>
          </div>
        </Card>
      </main>
    </AuthGate>
  );
}


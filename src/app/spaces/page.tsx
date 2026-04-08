'use client';

import { AuthGate } from '@/components/AuthGate';
import { Card } from '@/components/ui/Card';

export default function SpacesPage() {
  return (
    <AuthGate>
      <main className="mx-auto w-full max-w-md px-4 pb-3 pt-2">
        <Card>
          <p className="text-sm font-semibold text-slate-900">محله و جمع‌های نزدیک شما</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            فضاها برای کشف همسایگی، گروه‌های محلی و فعالیت‌های مشترک طراحی می‌شود؛ نقطه ورودی ساده به
            اجتماع کوچک‌تر از کل شبکه.
          </p>
          <ul className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm text-slate-600">
            <li className="flex gap-2">
              <span className="font-semibold text-slate-400">•</span>
              <span>معرفی فضاهای عمومی و محلی</span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-slate-400">•</span>
              <span>همسایگی و رویدادها (در نسخه بعد)</span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-slate-400">•</span>
              <span>بدون داده ساختگی؛ فعلاً چارچوب محصول</span>
            </li>
          </ul>
        </Card>
      </main>
    </AuthGate>
  );
}

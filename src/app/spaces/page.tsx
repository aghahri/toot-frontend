'use client';

import { AuthGate } from '@/components/AuthGate';
import { Card } from '@/components/ui/Card';

export default function SpacesPage() {
  return (
    <AuthGate>
      <main className="mx-auto w-full max-w-md p-4">
        <div className="mb-4">
          <h1 className="text-2xl font-extrabold">فضاها</h1>
          <p className="mt-1 text-sm text-slate-700">فضاهای اجتماعی و کانون‌های گفت‌وگو به‌زودی اضافه می‌شوند.</p>
        </div>
        <Card>
          <p className="text-sm leading-relaxed text-slate-700">
            این صفحه فعلاً نمایشی است. ساختار نهایی شبکه‌ها و گروه‌ها بدون تغییر API فعلی، در آپدیت بعدی پیاده‌سازی می‌شود.
          </p>
        </Card>
      </main>
    </AuthGate>
  );
}

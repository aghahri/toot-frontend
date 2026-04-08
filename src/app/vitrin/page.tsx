'use client';

import { AuthGate } from '@/components/AuthGate';
import { Card } from '@/components/ui/Card';

export default function VitrinPage() {
  return (
    <AuthGate>
      <main className="mx-auto w-full max-w-md p-4">
        <div className="mb-4">
          <h1 className="text-2xl font-extrabold">ویترین</h1>
          <p className="mt-1 text-sm text-slate-700">محصولات و پیشنهادها به‌زودی اینجا نمایش داده می‌شوند.</p>
        </div>
        <Card>
          <p className="text-sm leading-relaxed text-slate-700">
            این بخش در نسخه‌های بعدی تکمیل می‌شود. فعلاً می‌توانید از تب‌های استوری و گفتگو استفاده کنید.
          </p>
        </Card>
      </main>
    </AuthGate>
  );
}

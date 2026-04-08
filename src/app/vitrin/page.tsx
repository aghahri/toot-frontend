'use client';

import { AuthGate } from '@/components/AuthGate';
import { Card } from '@/components/ui/Card';

export default function VitrinPage() {
  return (
    <AuthGate>
      <main className="mx-auto w-full max-w-md px-4 pb-3 pt-2">
        <Card>
          <p className="text-sm font-semibold text-slate-900">فروشگاه و پیشنهادهای ویژه</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            ویترین جایی برای دیدن محصولات، خدمات و پیشنهادهای منتخب است؛ بدون شلوغی و با تمرکز روی کیفیت
            نمایش.
          </p>
          <ul className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm text-slate-600">
            <li className="flex gap-2">
              <span className="font-semibold text-slate-400">•</span>
              <span>دسته‌بندی‌های روشن و مرور آسان</span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-slate-400">•</span>
              <span>هماهنگ با تجربه موبایل و RTL</span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-slate-400">•</span>
              <span>محتوای واقعی به‌زودی اضافه می‌شود</span>
            </li>
          </ul>
        </Card>
      </main>
    </AuthGate>
  );
}

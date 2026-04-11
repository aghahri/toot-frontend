'use client';

import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="mx-auto w-full max-w-md p-4 pb-12">
      <div className="mb-10 pt-4">
        <h1 className="text-3xl font-extrabold text-slate-900">توت</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          شبکهٔ اجتماعی محله و ارتباط نزدیک‌تر با اطرافیان.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/login"
          className="rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          ورود
        </Link>
        <Link
          href="/register"
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
        >
          ثبت‌نام
        </Link>
      </div>
    </main>
  );
}

'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthGate } from '@/components/AuthGate';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

function NewJobInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const networkId = sp.get('networkId')?.trim() || '';
  const [title, setTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [city, setCity] = useState('');
  const [remote, setRemote] = useState(false);
  const [jobType, setJobType] = useState('FULL_TIME');
  const [salaryText, setSalaryText] = useState('');
  const [description, setDescription] = useState('');
  const [skills, setSkills] = useState('');
  const [contactMethod, setContactMethod] = useState('IN_APP');
  const [contactValue, setContactValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    const token = getAccessToken();
    if (!token || !networkId || !title.trim() || !companyName.trim() || !description.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const skillArr = skills
        .split(/[,،]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const created = await apiFetch<{ id: string }>('business/jobs', {
        method: 'POST',
        token,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          networkId,
          title: title.trim(),
          companyName: companyName.trim(),
          city: city.trim() || undefined,
          remote,
          jobType,
          salaryText: salaryText.trim() || undefined,
          description: description.trim(),
          skills: skillArr,
          contactMethod: contactMethod.trim(),
          contactValue: contactValue.trim() || undefined,
        }),
      });
      router.replace(`/spaces/business/jobs/${created.id}?networkId=${encodeURIComponent(networkId)}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'خطا');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="theme-page-bg mx-auto w-full max-w-md space-y-3 px-4 pb-16 pt-4" dir="rtl">
      <Link href={networkId ? `/spaces/business/jobs?networkId=${encodeURIComponent(networkId)}` : '/spaces/business'}>← بازگشت</Link>
      <h1 className="text-lg font-black">ثبت فرصت شغلی</h1>
      {!networkId ? <p className="text-sm text-red-600">networkId نامعتبر است</p> : null}
      <label className="block text-sm">
        عنوان شغل
        <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" />
      </label>
      <label className="block text-sm">
        شرکت / برند
        <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" />
      </label>
      <label className="block text-sm">
        شهر
        <input value={city} onChange={(e) => setCity(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={remote} onChange={(e) => setRemote(e.target.checked)} />
        دورکار
      </label>
      <label className="block text-sm">
        نوع همکاری
        <select value={jobType} onChange={(e) => setJobType(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2">
          <option value="FULL_TIME">تمام‌وقت</option>
          <option value="PART_TIME">پاره‌وقت</option>
          <option value="FREELANCE">فریلنس</option>
          <option value="INTERNSHIP">کارآموزی</option>
        </select>
      </label>
      <label className="block text-sm">
        حقوق (اختیاری)
        <input value={salaryText} onChange={(e) => setSalaryText(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" />
      </label>
      <label className="block text-sm">
        توضیح کوتاه
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="mt-1 w-full rounded-xl border px-3 py-2" />
      </label>
      <label className="block text-sm">
        مهارت‌ها (با ویرگول)
        <input value={skills} onChange={(e) => setSkills(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" />
      </label>
      <label className="block text-sm">
        روش تماس
        <select value={contactMethod} onChange={(e) => setContactMethod(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2">
          <option value="IN_APP">داخل توت</option>
          <option value="PHONE">تلفن</option>
          <option value="EMAIL">ایمیل</option>
          <option value="LINK">لینک خارجی</option>
        </select>
      </label>
      <label className="block text-sm">
        مقدار تماس (اختیاری)
        <input value={contactValue} onChange={(e) => setContactValue(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" />
      </label>
      {err ? <p className="text-sm text-red-600">{err}</p> : null}
      <button
        type="button"
        disabled={busy || !networkId}
        onClick={() => void submit()}
        className="w-full rounded-full bg-[var(--accent)] py-3 font-extrabold text-[var(--accent-contrast)] disabled:opacity-50"
      >
        {busy ? '…' : 'ثبت'}
      </button>
    </main>
  );
}

export default function NewJobPage() {
  return (
    <AuthGate>
      <Suspense fallback={<p className="p-6">…</p>}>
        <NewJobInner />
      </Suspense>
    </AuthGate>
  );
}

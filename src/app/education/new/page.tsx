'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AuthGate } from '@/components/AuthGate';
import { createEducationCourse } from '@/lib/education';

export default function NewEducationCoursePage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const c = await createEducationCourse({
        title: title.trim(),
        description: description.trim() || undefined,
        visibility,
        coverImageUrl: coverImageUrl.trim() || undefined,
      });
      router.replace(`/education/${c.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ایجاد دوره');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthGate>
      <div className="mx-auto max-w-md px-4 pb-8 pt-3">
        <div className="mb-4">
          <Link href="/spaces/education" className="text-[12px] font-bold text-[var(--text-secondary)]">
            ← بازگشت به آموزش
          </Link>
        </div>
        <form
          onSubmit={submit}
          className="space-y-3 rounded-3xl border border-[var(--border-soft)] bg-[var(--card-bg)] p-4 ring-1 ring-[var(--border-soft)]"
        >
          <h1 className="text-lg font-black text-[var(--text-primary)]">ایجاد دوره جدید</h1>
          {error ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-200">
              {error}
            </div>
          ) : null}
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">عنوان</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              minLength={3}
              className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none ring-0"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">توضیح</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none ring-0"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">بنر (اختیاری)</span>
            <input
              value={coverImageUrl}
              onChange={(e) => setCoverImageUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none ring-0"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">دسترسی</span>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as 'PUBLIC' | 'PRIVATE')}
              className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none ring-0"
            >
              <option value="PUBLIC">عمومی</option>
              <option value="PRIVATE">خصوصی</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={saving || title.trim().length < 3}
            className="w-full rounded-2xl bg-violet-700 px-4 py-2 text-sm font-extrabold text-white disabled:opacity-50"
          >
            {saving ? 'در حال ایجاد…' : 'ایجاد دوره'}
          </button>
        </form>
      </div>
    </AuthGate>
  );
}

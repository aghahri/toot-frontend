'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { AuthGate } from '@/components/AuthGate';
import {
  fetchEducationCourse,
  patchEducationCourse,
  type EducationCourse,
} from '@/lib/education';

export default function EditEducationCoursePage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === 'string' ? params.id : '';
  const [course, setCourse] = useState<EducationCourse | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED'>('PUBLISHED');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const c = await fetchEducationCourse(id);
      if (!c._meta?.isOwner) throw new Error('فقط سازنده دوره امکان ویرایش دارد.');
      setCourse(c);
      setTitle(c.title);
      setDescription(c.description ?? '');
      setVisibility(c.visibility);
      setStatus(c.status);
      setCoverImageUrl(c.coverImageUrl ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا');
      setCourse(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!course || saving) return;
    setSaving(true);
    setError(null);
    try {
      await patchEducationCourse(course.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        visibility,
        status,
        coverImageUrl: coverImageUrl.trim() || undefined,
      });
      router.replace(`/education/${course.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ویرایش دوره');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthGate>
      <div className="mx-auto max-w-md px-4 pb-8 pt-3">
        <div className="mb-4">
          <Link href={id ? `/education/${id}` : '/education/manage'} className="text-[12px] font-bold text-[var(--text-secondary)]">
            ← بازگشت
          </Link>
        </div>
        {error ? (
          <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-200">
            {error}
          </div>
        ) : null}
        {loading ? (
          <div className="h-36 animate-pulse rounded-3xl bg-[var(--surface-soft)]" />
        ) : !course ? null : (
          <form
            onSubmit={onSubmit}
            className="space-y-3 rounded-3xl border border-[var(--border-soft)] bg-[var(--card-bg)] p-4 ring-1 ring-[var(--border-soft)]"
          >
            <h1 className="text-lg font-black text-[var(--text-primary)]">ویرایش دوره</h1>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">عنوان</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">خلاصه</span>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">بنر (اختیاری)</span>
              <input value={coverImageUrl} onChange={(e) => setCoverImageUrl(e.target.value)} placeholder="https://..." className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">دسترسی</span>
                <select value={visibility} onChange={(e) => setVisibility(e.target.value as 'PUBLIC' | 'PRIVATE')} className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm">
                  <option value="PUBLIC">عمومی</option>
                  <option value="PRIVATE">خصوصی</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">انتشار</span>
                <select value={status} onChange={(e) => setStatus(e.target.value as 'DRAFT' | 'PUBLISHED')} className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm">
                  <option value="PUBLISHED">منتشر شده</option>
                  <option value="DRAFT">پیش‌نویس</option>
                </select>
              </label>
            </div>
            <button type="submit" disabled={saving || title.trim().length < 3} className="w-full rounded-2xl bg-violet-700 px-4 py-2 text-sm font-extrabold text-white disabled:opacity-50">
              {saving ? 'در حال ذخیره…' : 'ذخیره تغییرات'}
            </button>
          </form>
        )}
      </div>
    </AuthGate>
  );
}

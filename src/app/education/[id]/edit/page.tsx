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
      if (!c._meta?.canManage) throw new Error('فقط صاحب دوره یا ادمین امکان ویرایش دارد.');
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
      setCourse((prev) =>
        prev
          ? {
              ...prev,
              title: title.trim(),
              description: description.trim() || null,
              status,
              visibility,
              coverImageUrl: coverImageUrl.trim() || null,
            }
          : prev,
      );
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
          <Link
            href={id ? `/education/${id}` : '/education/manage'}
            className="text-[12px] font-bold text-[var(--text-secondary)]"
          >
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
            <div className="flex items-start justify-between gap-2">
              <div>
                <h1 className="text-lg font-black text-[var(--text-primary)]">ویرایش دوره</h1>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  تغییرات دوره را بازبینی کنید و سپس ذخیره کنید
                </p>
              </div>
              <span
                className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-extrabold ${
                  status === 'PUBLISHED'
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                    : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                }`}
              >
                {status === 'PUBLISHED' ? 'منتشرشده' : 'پیش‌نویس'}
              </span>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">عنوان</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                minLength={3}
                className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">خلاصه</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">
                لینک تصویر کاور (اختیاری)
              </span>
              <input
                value={coverImageUrl}
                onChange={(e) => setCoverImageUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">دسترسی</span>
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as 'PUBLIC' | 'PRIVATE')}
                  className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
                >
                  <option value="PUBLIC">عمومی</option>
                  <option value="PRIVATE">خصوصی</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-[var(--text-secondary)]">انتشار</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'DRAFT' | 'PUBLISHED')}
                  className="w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
                >
                  <option value="PUBLISHED">منتشر شده</option>
                  <option value="DRAFT">پیش‌نویس</option>
                </select>
              </label>
            </div>
            <div className="grid grid-cols-1 gap-2 pt-1">
              <button
                type="submit"
                disabled={saving || title.trim().length < 3}
                className="w-full rounded-2xl bg-violet-700 px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-50"
              >
                {saving ? 'در حال ذخیره تغییرات…' : 'ذخیره تغییرات'}
              </button>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/education/${course.id}/sessions`}
                  className="rounded-xl border border-[var(--border-soft)] px-3 py-2 text-xs font-bold text-[var(--text-primary)]"
                >
                  جلسات دوره
                </Link>
                <Link
                  href={`/education/${course.id}`}
                  className="rounded-xl border border-[var(--border-soft)] px-3 py-2 text-xs font-bold text-[var(--text-primary)]"
                >
                  صفحه دوره
                </Link>
                <Link
                  href="/education/manage"
                  className="rounded-xl border border-[var(--border-soft)] px-3 py-2 text-xs font-bold text-[var(--text-secondary)]"
                >
                  مدیریت آموزش
                </Link>
              </div>
            </div>
          </form>
        )}
      </div>
    </AuthGate>
  );
}

'use client';

import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthGate } from '@/components/AuthGate';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { uploadImageFile } from '@/lib/uploadImageFile';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TextInput } from '@/components/forms/TextInput';
import { ThemeSelector } from '@/components/settings/ThemeSelector';

const MAX_AVATAR_BYTES = 20 * 1024 * 1024;
const ACCEPT_IMAGES = 'image/*';

type MeProfile = {
  id: string;
  name: string;
  username: string;
  avatar: string | null;
  bio: string | null;
};

function isAllowedImageFile(f: File): boolean {
  const t = (f.type || '').toLowerCase();
  if (!t.startsWith('image/')) return false;
  if (t === 'image/svg+xml') return false;
  return true;
}

export default function ProfileEditPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  /** Saved or manually edited URL (advanced). */
  const [avatarUrl, setAvatarUrl] = useState('');
  /** New file chosen locally; uploaded on save. */
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  /** object URL for pendingAvatarFile */
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    };
  }, [pendingPreviewUrl]);

  useEffect(() => {
    const t = getAccessToken();
    if (!t) return;
    let cancelled = false;
    (async () => {
      try {
        const me = await apiFetch<MeProfile>('users/me', { method: 'GET', token: t });
        if (cancelled) return;
        setUserId(me.id);
        setName(me.name);
        setUsername(me.username);
        setBio(me.bio ?? '');
        setAvatarUrl(me.avatar ?? '');
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'خطا در بارگذاری');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function openFilePicker(mode: 'gallery' | 'camera') {
    const el = fileInputRef.current;
    if (!el) return;
    if (mode === 'camera') {
      el.setAttribute('capture', 'environment');
    } else {
      el.removeAttribute('capture');
    }
    el.click();
  }

  function onAvatarFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!isAllowedImageFile(f)) {
      setError('فقط فایل تصویری مجاز است (نه SVG).');
      return;
    }
    if (f.size > MAX_AVATAR_BYTES) {
      setError('حجم تصویر بیش از ۲۰ مگابایت است.');
      return;
    }
    setError(null);
    setPendingAvatarFile(f);
    setPendingPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
  }

  function clearPendingAvatar() {
    setPendingAvatarFile(null);
    setPendingPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }

  const displayAvatarSrc = pendingPreviewUrl || (avatarUrl.trim() ? avatarUrl.trim() : null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const t = getAccessToken();
    if (!t) return;
    setSaving(true);
    setUploadingAvatar(false);
    setError(null);
    setSuccess(null);
    try {
      let finalAvatar = avatarUrl.trim();
      if (pendingAvatarFile) {
        setUploadingAvatar(true);
        finalAvatar = await uploadImageFile(t, pendingAvatarFile);
        setUploadingAvatar(false);
        setAvatarUrl(finalAvatar);
        clearPendingAvatar();
      }

      await apiFetch<MeProfile>('users/me', {
        method: 'PATCH',
        token: t,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          username: username.trim().toLowerCase(),
          bio: bio.trim() || undefined,
          avatar: finalAvatar || undefined,
        }),
      });
      setSuccess('ذخیره شد.');
      if (userId) {
        router.push(`/profile/${userId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ذخیره ناموفق بود');
    } finally {
      setSaving(false);
      setUploadingAvatar(false);
    }
  }

  return (
    <AuthGate>
      <main className="theme-page-bg mx-auto w-full max-w-md p-4 pb-28" dir="rtl">
        <div className="mb-3 flex items-center gap-2">
          <Link
            href={userId ? `/profile/${userId}` : '/profile'}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-bold text-sky-800 transition hover:bg-white/90 hover:underline"
          >
            <span aria-hidden>‹</span>
            بازگشت
          </Link>
        </div>
        <h1 className="text-[1.35rem] font-extrabold tracking-tight text-slate-900">ویرایش پروفایل</h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">
          نام، نام کاربری، بیو و تصویر را به‌روز کنید.
        </p>

        <Card className="mt-5 border-slate-200/80 shadow-sm ring-1 ring-slate-100/80">
          {loading ? (
            <p className="text-sm text-slate-500">در حال بارگذاری…</p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              {success ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                  {success}
                </div>
              ) : null}

              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT_IMAGES}
                className="sr-only"
                aria-hidden
                tabIndex={-1}
                onChange={onAvatarFileChange}
              />

              <div>
                <p className="mb-2 text-sm font-semibold text-slate-800">تصویر پروفایل</p>
                <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
                  <button
                    type="button"
                    onClick={() => openFilePicker('gallery')}
                    disabled={saving}
                    className="group relative shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
                    aria-label="انتخاب تصویر پروفایل"
                  >
                    <span className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-slate-300 bg-slate-100 ring-2 ring-transparent transition group-hover:border-sky-400 group-hover:ring-sky-100">
                      {displayAvatarSrc ? (
                        <img
                          src={displayAvatarSrc}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-4xl font-bold text-slate-400" aria-hidden>
                          ؟
                        </span>
                      )}
                      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-1 py-2 text-center text-[11px] font-bold text-white">
                        تغییر عکس
                      </span>
                    </span>
                  </button>
                  <div className="flex w-full min-w-0 flex-col gap-2 text-center sm:text-right">
                    <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => openFilePicker('gallery')}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                      >
                        گالری
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => openFilePicker('camera')}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
                      >
                        دوربین
                      </button>
                      {pendingAvatarFile ? (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={clearPendingAvatar}
                          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-800 transition hover:bg-red-100 disabled:opacity-50"
                        >
                          حذف انتخاب
                        </button>
                      ) : null}
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-500">
                      {pendingAvatarFile
                        ? 'تصویر جدید با ذخیره ارسال می‌شود.'
                        : 'روی تصویر بزنید یا گالری/دوربین را انتخاب کنید. روی موبایل، دوربین در صورت پشتیبانی مرورگر باز می‌شود.'}
                    </p>
                  </div>
                </div>
              </div>

              <TextInput
                label="نام نمایشی"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={saving}
                required
                minLength={2}
              />
              <TextInput
                label="نام کاربری"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={saving}
                required
                dir="ltr"
                className="font-mono"
              />
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-800">بیوگرافی</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  disabled={saving}
                  rows={3}
                  maxLength={500}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400/60"
                />
              </div>
              <details className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2">
                <summary className="cursor-pointer text-xs font-bold text-slate-600">پیشرفته: آدرس URL تصویر</summary>
                <p className="mt-2 text-[11px] text-slate-500">
                  در صورت نیاز می‌توانید به‌جای آپلود، آدرس مستقیم تصویر را وارد کنید.
                </p>
                <div className="mt-2">
                  <TextInput
                    label="آدرس تصویر"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    disabled={saving}
                    dir="ltr"
                    placeholder="https://…"
                  />
                </div>
              </details>
              {error ? <div className="text-sm font-semibold text-red-600">{error}</div> : null}
              <Button type="submit" loading={saving}>
                {uploadingAvatar ? 'در حال آپلود تصویر…' : saving ? 'ذخیره…' : 'ذخیره'}
              </Button>
            </form>
          )}
        </Card>
        <div className="mt-4">
          <ThemeSelector />
        </div>
      </main>
    </AuthGate>
  );
}

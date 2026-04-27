'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { AuthGate } from '@/components/AuthGate';
import { ScheduledDateTimeField } from '@/components/community/ScheduledDateTimeField';
import { createMeeting } from '@/lib/meetings';
import { createBusinessMeeting } from '@/lib/businessSpace';

const LABELS = ['کلاس آنلاین', 'جلسه رفع اشکال', 'جلسه خصوصی', 'وبینار کوچک'] as const;

function NewMeetingInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const context = searchParams.get('context')?.trim() || 'education';
  const listingId = searchParams.get('listingId')?.trim() || '';
  const qpNetwork = searchParams.get('networkId')?.trim() || '';
  const isBusinessContext = context === 'business' && !!listingId;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [educationLabel, setEducationLabel] = useState<string>(LABELS[0]);
  const [maxParticipants, setMaxParticipants] = useState('');
  const [businessLimit, setBusinessLimit] = useState('5');
  const [businessVisibility, setBusinessVisibility] = useState<'PRIVATE' | 'LINK'>('PRIVATE');
  const [allowGuests, setAllowGuests] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bodyBase = useMemo(
    () => ({
      sourceSpaceCategory: 'EDUCATION',
      meetingType: 'EDUCATION',
      ...(qpNetwork ? { networkId: qpNetwork } : {}),
    }),
    [qpNetwork],
  );

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      if (isBusinessContext) {
        const parsedLimit = Number.parseInt(businessLimit, 10);
        if (!Number.isFinite(parsedLimit) || parsedLimit < 2) {
          throw new Error('حداکثر شرکت‌کنندگان نامعتبر است.');
        }
        const created = await createBusinessMeeting(listingId, {
          title: title.trim() || undefined,
          maxParticipants: parsedLimit,
          allowGuests: businessVisibility === 'LINK',
          durationMinutes: 60,
        });
        router.replace(`/meetings/${created.meetingId}`);
        return;
      }

      if (!title.trim()) throw new Error('عنوان را وارد کنید.');
      if (!startsAt) throw new Error('زمان شروع را انتخاب کنید.');
      const maxRaw = maxParticipants.trim();
      let maxP: number | undefined;
      if (maxRaw) {
        const n = Number.parseInt(maxRaw, 10);
        if (Number.isNaN(n) || n < 2) throw new Error('حداکثر شرکت‌کنندگان نامعتبر است.');
        maxP = n;
      }

      const row = await createMeeting({
        title: title.trim(),
        description: description.trim() || undefined,
        startsAt,
        durationMinutes,
        educationLabel,
        allowGuests,
        ...bodyBase,
        ...(maxP !== undefined ? { maxParticipants: maxP } : {}),
      });
      router.replace(`/meetings/${row.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthGate>
      <div className="mx-auto max-w-md px-4 pb-6 pt-2">
        <div className="mb-4 flex items-center justify-between">
          <Link
            href={isBusinessContext ? '/spaces/business' : '/spaces/education'}
            className="text-[12px] font-bold text-[var(--text-secondary)] hover:text-[var(--accent-hover)]"
          >
            {isBusinessContext ? '← فضای کسب‌وکار' : '← فضای آموزش'}
          </Link>
        </div>

        <h1 className="mb-1 text-xl font-black text-[var(--text-primary)]">
          {isBusinessContext ? 'ایجاد جلسه آنلاین' : 'جلسه جدید'}
        </h1>
        <p className="mb-4 text-sm text-[var(--text-secondary)]">
          {isBusinessContext
            ? 'تنظیمات جلسه مشاوره آنلاین کسب‌وکار'
            : 'زمان‌بندی، نوع جلسه و جزئیات — هماهنگ با تقویم رابط کاربری.'}
        </p>

        {error ? (
          <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-200">
            {error}
          </div>
        ) : null}

        <div className="space-y-4 rounded-3xl border border-[var(--border-soft)] bg-[var(--card-bg)] p-4 ring-1 ring-[var(--border-soft)]">
          <label className="block">
            <span className="text-[11px] font-bold text-[var(--text-secondary)]">
              {isBusinessContext ? 'عنوان (اختیاری)' : 'عنوان'}
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500/40"
              placeholder={isBusinessContext ? 'مثلاً مشاوره فروش آنلاین' : 'مثلاً جلسه مرور فصل سوم'}
            />
          </label>

          {isBusinessContext ? (
            <>
              <label className="block">
                <span className="text-[11px] font-bold text-[var(--text-secondary)]">حداکثر شرکت‌کننده</span>
                <select
                  value={businessLimit}
                  onChange={(e) => setBusinessLimit(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
                >
                  {[2, 5, 10].map((n) => (
                    <option key={n} value={String(n)}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] font-bold text-[var(--text-secondary)]">دسترسی</span>
                <select
                  value={businessVisibility}
                  onChange={(e) => setBusinessVisibility(e.target.value === 'LINK' ? 'LINK' : 'PRIVATE')}
                  className="mt-1 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
                >
                  <option value="PRIVATE">خصوصی</option>
                  <option value="LINK">با لینک</option>
                </select>
              </label>
            </>
          ) : (
            <label className="block">
              <span className="text-[11px] font-bold text-[var(--text-secondary)]">نوع / برچسب آموزشی</span>
              <select
                value={educationLabel}
                onChange={(e) => setEducationLabel(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500/40"
              >
                {LABELS.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </label>
          )}

          {!isBusinessContext ? (
            <label className="block">
              <span className="text-[11px] font-bold text-[var(--text-secondary)]">زمان شروع</span>
              <div className="mt-1">
                <ScheduledDateTimeField value={startsAt} onChange={setStartsAt} disabled={saving} />
              </div>
            </label>
          ) : null}

          {!isBusinessContext ? (
            <label className="block">
              <span className="text-[11px] font-bold text-[var(--text-secondary)]">مدت (دقیقه)</span>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
              >
                {[30, 45, 60, 90, 120].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {!isBusinessContext ? (
            <label className="block">
              <span className="text-[11px] font-bold text-[var(--text-secondary)]">توضیح (اختیاری)</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="mt-1 w-full resize-none rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500/40"
              />
            </label>
          ) : null}

          {!isBusinessContext ? (
            <label className="block">
              <span className="text-[11px] font-bold text-[var(--text-secondary)]">حداکثر شرکت‌کننده (اختیاری)</span>
              <input
                inputMode="numeric"
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
                placeholder="مثلاً ۳۰"
              />
            </label>
          ) : null}

          {!isBusinessContext ? (
            <label className="flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]">
              <input
                type="checkbox"
                checked={allowGuests}
                onChange={(e) => setAllowGuests(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--border-soft)]"
              />
              میزبان مهمان بدون عضویت شبکه را بپذیرد (در صورت نبود شبکه، برای ورود لازم است)
            </label>
          ) : null}

          {qpNetwork ? (
            <p className="text-[11px] text-[var(--text-secondary)]">این جلسه به شبکه انتخاب‌شده شما متصل می‌شود.</p>
          ) : null}

          <button
            type="button"
            disabled={saving}
            onClick={() => void submit()}
            className="w-full rounded-2xl bg-violet-700 py-3 text-sm font-extrabold text-white shadow-md transition hover:bg-violet-600 disabled:opacity-50"
          >
            {saving ? '…' : isBusinessContext ? 'ایجاد جلسه' : 'ثبت جلسه'}
          </button>
        </div>
      </div>
    </AuthGate>
  );
}

export default function NewMeetingPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md px-4 py-8 text-center text-sm text-[var(--text-secondary)]">…</div>
      }
    >
      <NewMeetingInner />
    </Suspense>
  );
}

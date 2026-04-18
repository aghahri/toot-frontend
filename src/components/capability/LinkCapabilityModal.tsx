'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createCapabilityLink,
  fetchCapabilityLinkTargets,
  type CapabilityKind,
  type CapabilitySourceSpace,
  type CapabilityTargetKind,
} from '@/lib/capabilityLinks';

type Props = {
  open: boolean;
  onClose: () => void;
  networkId: string;
  capabilityType: CapabilityKind;
  capabilityId: string;
  /** Neighborhood polls/forms vs Business jobs/projects/listings */
  sourceSpaceCategory?: CapabilitySourceSpace;
  onLinked?: () => void;
};

export function LinkCapabilityModal({
  open,
  onClose,
  networkId,
  capabilityType,
  capabilityId,
  sourceSpaceCategory = 'NEIGHBORHOOD',
  onLinked,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targets, setTargets] = useState<Awaited<ReturnType<typeof fetchCapabilityLinkTargets>> | null>(null);
  const [targetKind, setTargetKind] = useState<CapabilityTargetKind>('GROUP');
  const [targetId, setTargetId] = useState('');

  const load = useCallback(async () => {
    if (!networkId) return;
    setLoading(true);
    setError(null);
    try {
      const t = await fetchCapabilityLinkTargets(networkId);
      setTargets(t);
      setTargetId('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'بارگذاری ممکن نیست');
      setTargets(null);
    } finally {
      setLoading(false);
    }
  }, [networkId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const options = useMemo(() => {
    if (!targets) return [];
    if (targetKind === 'NETWORK') return [{ id: targets.network.id, name: `${targets.network.name} (کل شبکه)` }];
    if (targetKind === 'GROUP') return targets.groups;
    return targets.channels;
  }, [targets, targetKind]);

  useEffect(() => {
    if (!open) return;
    const first = options[0]?.id ?? '';
    setTargetId((prev) => (prev && options.some((o) => o.id === prev) ? prev : first));
  }, [open, options]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!targetId) {
      setError('یک مقصد را انتخاب کنید.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createCapabilityLink({
        capabilityType,
        capabilityId,
        sourceSpaceCategory,
        targetEntityType: targetKind,
        targetEntityId: targetId,
      });
      onLinked?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ایجاد لینک ممکن نیست');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center" dir="rtl">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="بستن"
        onClick={() => !submitting && onClose()}
      />
      <div className="relative z-[81] w-full max-w-md rounded-t-3xl border border-[var(--border-soft)] bg-[var(--card-bg)] p-4 shadow-xl sm:rounded-3xl">
        <h2 className="text-sm font-black text-[var(--text-primary)]">اشتراک در جامعه</h2>
        <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
          {sourceSpaceCategory === 'PUBLIC_GENERAL'
            ? 'این مورد را به گروه، کانال یا صفحهٔ همان شبکه کسب‌وکار وصل کنید.'
            : 'این قابلیت را به گروه، کانال یا صفحهٔ همان شبکه محله وصل کنید (بدون کپی کردن محتوا).'}
        </p>

        {loading ? (
          <p className="mt-4 text-sm text-[var(--text-secondary)]">در حال بارگذاری مقصدها…</p>
        ) : (
          <form onSubmit={(e) => void onSubmit(e)} className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-[10px] font-extrabold text-[var(--text-secondary)]">نوع مقصد</label>
              <select
                value={targetKind}
                onChange={(e) => setTargetKind(e.target.value as CapabilityTargetKind)}
                className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
              >
                <option value="GROUP">گروه</option>
                <option value="CHANNEL">کانال</option>
                <option value="NETWORK">شبکه (صفحهٔ شبکه)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-extrabold text-[var(--text-secondary)]">مقصد</label>
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-2 text-sm"
                disabled={options.length === 0}
              >
                {options.length === 0 ? (
                  <option value="">موردی نیست — ابتدا عضو گروه/کانال این شبکه شوید</option>
                ) : (
                  options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            {error ? <p className="text-xs font-semibold text-red-600">{error}</p> : null}

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="submit"
                disabled={submitting || !targetId}
                className="rounded-full bg-[var(--accent)] px-4 py-2 text-[11px] font-extrabold text-[var(--accent-contrast)] disabled:opacity-50"
              >
                {submitting ? '…' : 'تأیید لینک'}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => onClose()}
                className="rounded-full border border-[var(--border-soft)] px-4 py-2 text-[11px] font-extrabold text-[var(--text-primary)]"
              >
                انصراف
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

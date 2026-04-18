'use client';

import { useEffect } from 'react';
import { LinkedCapabilitiesPanel } from '@/components/capability/LinkedCapabilitiesPanel';
import type { CapabilityTargetKind } from '@/lib/capabilityLinks';

type Props = {
  open: boolean;
  onClose: () => void;
  targetType: CapabilityTargetKind;
  targetId: string;
  title?: string;
};

export function CommunityToolsSheet({ open, onClose, targetType, targetId, title = 'ابزارهای جامعه' }: Props) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center" dir="rtl">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[1px]"
        aria-label="بستن"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="community-tools-title"
        className="relative z-[91] flex max-h-[min(88dvh,560px)] w-full max-w-md flex-col rounded-t-3xl border border-[var(--border-soft)] bg-[var(--card-bg)] shadow-2xl sm:rounded-3xl"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border-soft)] px-4 py-3">
          <h2 id="community-tools-title" className="text-sm font-black text-[var(--text-primary)]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 min-w-[2.5rem] items-center justify-center rounded-full text-lg text-[var(--text-secondary)] transition hover:bg-[var(--surface-soft)]"
            aria-label="بستن"
          >
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-6 pt-3 [-webkit-overflow-scrolling:touch]">
          <LinkedCapabilitiesPanel
            targetType={targetType}
            targetId={targetId}
            title=""
            showWhenEmpty
            variant="plain"
            className="!p-0"
          />
        </div>
      </div>
    </div>
  );
}

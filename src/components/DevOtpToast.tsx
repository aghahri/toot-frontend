'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const AUTO_DISMISS_MS = 15_000;
const COPY_FEEDBACK_MS = 2_000;

/** Optional extra gate for local builds; popup still shows whenever the API returns a code. */
export function isDevOtpPopupEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DEV_OTP === 'true';
}

type DevOtpToastProps = {
  code: string | null | undefined;
};

/**
 * Dev OTP toast — visibility must NOT depend on an initial `hidden: true` gate before effects run
 * (that pattern returned null on the first paint whenever `hidden` was still true, so the portal
 * never mounted in some real browsers/React timings). We only hide after dismiss timer or manual
 * close, and `dismissed` resets whenever `display` changes so repeat requests reopen reliably.
 */
export function DevOtpToast({ code }: DevOtpToastProps) {
  const display = (code ?? '').trim();
  const hasCode = display.length > 0;
  const [dismissed, setDismissed] = useState(false);
  const copyResetRef = useRef<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    return () => {
      if (copyResetRef.current != null) {
        window.clearTimeout(copyResetRef.current);
        copyResetRef.current = null;
      }
    };
  }, []);

  // New code → show again; start / reset 15s auto-dismiss.
  useLayoutEffect(() => {
    if (!hasCode) {
      setDismissed(true);
      return;
    }
    setDismissed(false);
    setCopied(false);
    const t = window.setTimeout(() => setDismissed(true), AUTO_DISMISS_MS);
    return () => window.clearTimeout(t);
  }, [display, hasCode]);

  const dismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  const onCopyCode = useCallback(async () => {
    if (!display) return;
    try {
      await navigator.clipboard.writeText(display);
      setCopied(true);
      if (copyResetRef.current != null) {
        window.clearTimeout(copyResetRef.current);
      }
      copyResetRef.current = window.setTimeout(() => {
        setCopied(false);
        copyResetRef.current = null;
      }, COPY_FEEDBACK_MS);
    } catch {
      /* ignore */
    }
  }, [display]);

  if (!hasCode || dismissed) return null;

  if (typeof document === 'undefined' || !document.body) return null;

  const showEnvHint = isDevOtpPopupEnabled();

  const node = (
    <div
      className="pointer-events-auto fixed right-4 top-4 w-[min(18rem,calc(100vw-2rem))] rounded-xl bg-slate-900 px-4 py-3 text-white shadow-lg ring-1 ring-white/10"
      style={{ zIndex: 2147483647 }}
      role="status"
      aria-live="polite"
      dir="rtl"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold text-slate-300">کد تایید (توسعه)</div>
          <button
            type="button"
            onClick={() => void onCopyCode()}
            className="mt-1 w-full rounded-lg bg-white/10 px-2 py-2 text-start transition hover:bg-white/15"
            title="کپی کردن"
          >
            <span
              className="font-mono text-2xl font-extrabold tracking-widest text-white"
              dir="ltr"
            >
              {display}
            </span>
          </button>
          {showEnvHint ? (
            <p className="mt-1.5 text-[10px] leading-snug text-slate-400">
              همچنین با <code className="rounded bg-black/30 px-1">NEXT_PUBLIC_DEV_OTP=true</code> در فرانت قابل تأیید است.
            </p>
          ) : (
            <p className="mt-1.5 text-[10px] leading-snug text-slate-400">
              این کد از پاسخ سرور آمده است (حالت توسعه/آزمایش).
            </p>
          )}
          {copied ? (
            <p className="mt-1 text-[11px] font-semibold text-emerald-400">کپی شد</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-lg px-2 py-1 text-lg leading-none text-slate-400 transition hover:bg-white/10 hover:text-white"
          aria-label="بستن"
        >
          ×
        </button>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}

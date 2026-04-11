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
  /** Increment on each new OTP request so the toast resets even if the code string repeats. */
  requestEpoch?: number;
};

export function DevOtpToast({ code, requestEpoch = 0 }: DevOtpToastProps) {
  const [hidden, setHidden] = useState(true);
  const [copied, setCopied] = useState(false);
  const copyResetRef = useRef<number | null>(null);
  const display = code?.trim() ?? '';
  const hasCode = display.length > 0;

  useEffect(() => {
    return () => {
      if (copyResetRef.current != null) {
        window.clearTimeout(copyResetRef.current);
        copyResetRef.current = null;
      }
    };
  }, []);

  // useLayoutEffect: show in the same frame as the new code; drive visibility from code+epoch only (no "mounted" gate — that deferred the portal until after paint and caused flaky visibility).
  useLayoutEffect(() => {
    if (!hasCode) {
      setHidden(true);
      return;
    }
    setHidden(false);
    setCopied(false);
    const t = window.setTimeout(() => setHidden(true), AUTO_DISMISS_MS);
    return () => window.clearTimeout(t);
  }, [code, requestEpoch, hasCode]);

  const dismiss = useCallback(() => {
    setHidden(true);
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

  if (!hasCode || hidden) return null;

  if (typeof document === 'undefined' || !document.body) return null;

  const showEnvHint = isDevOtpPopupEnabled();

  const node = (
    <div
      className="pointer-events-auto fixed right-4 top-4 z-[10050] w-[min(18rem,calc(100vw-2rem))] rounded-xl bg-slate-900 px-4 py-3 text-white shadow-lg ring-1 ring-white/10"
      role="status"
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

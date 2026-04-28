'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { useAppRealtime } from '@/context/AppRealtimeSocketContext';

type LiveCaption = {
  id: string;
  speakerLabel: string;
  faText: string;
  enText: string;
};

type Props = {
  socket: ReturnType<typeof useAppRealtime>['socket'];
  connected: boolean;
  meetingId: string;
};

function MeetingCaptionsLabComponent({ socket, connected, meetingId }: Props) {
  const [enabled, setEnabled] = useState(false);
  const [caption, setCaption] = useState<LiveCaption | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      setCaption(null);
      return;
    }
    if (!socket || !connected || !meetingId) return;

    const clearHideTimer = () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };

    const onMeetingCaption = (payload: {
      meetingId: string;
      id?: string;
      speakerLabel?: string;
      faText?: string;
      enText?: string;
    }) => {
      if (payload.meetingId !== meetingId) return;
      const faText = payload.faText?.trim();
      const enText = payload.enText?.trim();
      if (!faText || !enText) return;
      setCaption({
        id: payload.id || `${Date.now()}`,
        speakerLabel: payload.speakerLabel?.trim() || 'گوینده',
        faText,
        enText,
      });
      clearHideTimer();
      hideTimerRef.current = window.setTimeout(() => {
        setCaption(null);
        hideTimerRef.current = null;
      }, 4500);
    };

    const onMeetingCaptionClear = (payload: { meetingId: string }) => {
      if (payload.meetingId !== meetingId) return;
      clearHideTimer();
      setCaption(null);
    };

    socket.on('meeting_caption', onMeetingCaption);
    socket.on('meeting_caption_clear', onMeetingCaptionClear);

    return () => {
      clearHideTimer();
      socket.off('meeting_caption', onMeetingCaption);
      socket.off('meeting_caption_clear', onMeetingCaptionClear);
    };
  }, [connected, enabled, meetingId, socket]);

  function triggerDemoCaptions() {
    if (!enabled || !socket || !meetingId) return;
    socket.emit('meeting_caption_trigger_demo', { meetingId });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setEnabled((prev) => !prev)}
        className={`flex h-12 min-w-[5.2rem] items-center justify-center rounded-full px-3 text-xs font-extrabold shadow-md ${
          enabled ? 'bg-emerald-600 text-white' : 'bg-[var(--surface-soft)] text-[var(--text-primary)]'
        }`}
      >
        زیرنویس آزمایشی
      </button>
      <button
        type="button"
        onClick={triggerDemoCaptions}
        disabled={!enabled}
        className="flex h-12 min-w-[4.2rem] items-center justify-center rounded-full bg-[var(--surface-soft)] px-3 text-xs font-extrabold text-[var(--text-primary)] shadow-md disabled:opacity-50"
      >
        دمو
      </button>
      {mountedRef.current && caption
        ? createPortal(
            <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex justify-center px-4">
              <div className="max-w-[42rem] rounded-xl bg-black/75 px-3 py-2 text-center text-white">
                <p className="text-[10px] font-bold text-emerald-200">{caption.speakerLabel}</p>
                <p className="text-sm font-extrabold leading-tight">{caption.faText}</p>
                <p className="mt-0.5 text-xs leading-tight text-zinc-200">{caption.enText}</p>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export default memo(MeetingCaptionsLabComponent);

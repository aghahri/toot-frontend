'use client';

import { useEffect, useRef, useState } from 'react';
import { formatVoiceClock } from '@/lib/chat-media';

export type VoiceBubbleMedia = {
  url: string;
  durationMs?: number | null;
};

export function VoiceMessageBubble({
  media,
  mine,
  messageId,
  playingMessageId,
  setPlayingMessageId,
}: {
  media: VoiceBubbleMedia;
  mine: boolean;
  messageId: string;
  playingMessageId: string | null;
  setPlayingMessageId: (id: string | null) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentMs, setCurrentMs] = useState(0);
  const [totalMs, setTotalMs] = useState(media.durationMs ?? 0);
  const [localPlaying, setLocalPlaying] = useState(false);

  useEffect(() => {
    setTotalMs(media.durationMs ?? 0);
  }, [media.durationMs, media.url, messageId]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (playingMessageId !== messageId && !a.paused) {
      a.pause();
    }
  }, [playingMessageId, messageId]);

  const barBg = mine ? 'bg-white/20' : 'bg-slate-200';
  const barFill = mine ? 'bg-white' : 'bg-emerald-500';

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (localPlaying) {
      a.pause();
      setPlayingMessageId(null);
      return;
    }
    setPlayingMessageId(messageId);
    void a.play().catch(() => {
      setPlayingMessageId(null);
      setLocalPlaying(false);
    });
  };

  return (
    <div className="mt-2 w-full min-w-[11rem] max-w-[16rem]">
      <audio
        ref={audioRef}
        src={media.url}
        preload="metadata"
        className="hidden"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (!(media.durationMs && media.durationMs > 0) && d && !Number.isNaN(d)) {
            setTotalMs(Math.round(d * 1000));
          }
        }}
        onPlay={() => setLocalPlaying(true)}
        onPause={() => setLocalPlaying(false)}
        onEnded={() => {
          setLocalPlaying(false);
          setProgress(0);
          setCurrentMs(0);
          setPlayingMessageId(null);
        }}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          const d = el.duration;
          if (d && !Number.isNaN(d) && d > 0) {
            setProgress(el.currentTime / d);
            setCurrentMs(Math.floor(el.currentTime * 1000));
          }
        }}
      />
      <div className="flex items-center gap-2" dir="ltr">
        <button
          type="button"
          onClick={toggle}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition active:scale-95 ${
            mine ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-slate-200 text-slate-800 hover:bg-slate-300'
          }`}
          aria-label={localPlaying ? 'توقف' : 'پخش'}
        >
          {localPlaying ? '❚❚' : '▶'}
        </button>
        <div className={`min-w-0 flex-1 overflow-hidden rounded-full ${barBg} py-1.5`}>
          <div
            className={`h-1 rounded-full ${barFill} transition-[width] duration-150 ease-linear`}
            style={{ width: `${Math.min(100, progress * 100)}%` }}
          />
        </div>
        <span
          className={`shrink-0 tabular-nums text-[11px] font-medium ${
            mine ? 'text-white/80' : 'text-slate-500'
          }`}
        >
          {formatVoiceClock(currentMs)} / {formatVoiceClock(totalMs || 0)}
        </span>
      </div>
    </div>
  );
}

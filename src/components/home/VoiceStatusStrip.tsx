'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { tinyHaptic } from '@/lib/haptic';

type VoiceStatusFeedItem = {
  user: {
    id: string;
    name: string;
    username: string;
    avatar: string | null;
  };
  status: {
    id: string;
    mediaId: string;
    durationSec: number;
    caption: string | null;
    createdAt: string;
    expiresAt: string;
  };
  mediaUrl: string;
};

type VoiceStatusFeedResponse = {
  data: VoiceStatusFeedItem[];
};

function initials(name: string) {
  const clean = name.trim();
  if (!clean) return '🎤';
  return clean.slice(0, 1).toUpperCase();
}

function timeLeftLabel(expiresAt: string) {
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  if (diffMs <= 0) return 'امروز';
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return `${minutes} دقیقه مانده`;
  const hours = Math.floor(minutes / 60);
  return `${hours} ساعت مانده`;
}

export function VoiceStatusStrip() {
  const [items, setItems] = useState<VoiceStatusFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openItem, setOpenItem] = useState<VoiceStatusFeedItem | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void apiFetch<VoiceStatusFeedResponse>('voice-status/feed', {
      method: 'GET',
      token,
    })
      .then((res) => {
        if (!cancelled) setItems(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const showEmpty = !loading && items.length === 0;
  const activeItem = useMemo(() => openItem, [openItem]);

  return (
    <>
      <section className="mx-2 mt-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-[12px] font-extrabold text-[var(--ink)]">وضعیت صوتی دوستان</h3>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          <Link
            href="/status/voice"
            className="flex min-w-[4.25rem] shrink-0 flex-col items-center gap-1"
            onClick={() => tinyHaptic()}
          >
            <div className="relative flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-[var(--accent-ring)] bg-[var(--surface-2)]">
              <span className="text-xl font-bold text-[var(--accent-hover)]">+</span>
            </div>
            <span className="line-clamp-2 text-center text-[10px] font-semibold text-[var(--ink-2)]">وضعیت من</span>
          </Link>

          {loading
            ? [0, 1, 2, 3].map((i) => (
                <div key={i} className="flex min-w-[4.25rem] shrink-0 animate-pulse flex-col items-center gap-1">
                  <div className="h-14 w-14 rounded-full bg-[var(--surface-2)]" />
                  <div className="h-2.5 w-12 rounded bg-[var(--surface-2)]" />
                </div>
              ))
            : items.map((item) => (
                <button
                  key={item.status.id}
                  type="button"
                  onClick={() => {
                    tinyHaptic();
                    setOpenItem(item);
                  }}
                  className="flex min-w-[4.25rem] shrink-0 flex-col items-center gap-1"
                >
                  <div className="relative rounded-full p-[2px] ring-2 ring-emerald-500/80">
                    {item.user.avatar ? (
                      <img src={item.user.avatar} alt={item.user.name} className="h-14 w-14 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--surface-2)] text-sm font-bold text-[var(--ink)]">
                        {initials(item.user.name)}
                      </div>
                    )}
                    <span className="absolute -bottom-0.5 -left-0.5 rounded-full bg-white px-1 text-[10px] shadow">🎤</span>
                  </div>
                  <span className="line-clamp-2 w-16 text-center text-[10px] font-semibold text-[var(--ink-2)]">
                    {item.user.name}
                  </span>
                </button>
              ))}
        </div>

        {showEmpty ? (
          <div className="mt-2 rounded-xl bg-[var(--surface-2)] px-3 py-2 text-[11px] text-[var(--ink-3)]">
            <Link href="/status/voice" className="font-semibold text-[var(--accent-hover)]">
              اولین وضعیت صوتی امروز را بگذار
            </Link>
          </div>
        ) : null}
      </section>

      {activeItem ? (
        <div
          className="fixed inset-0 z-50 bg-black/35"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpenItem(null);
          }}
        >
          <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-lg rounded-t-3xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-2xl">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-[var(--surface-2)]" />
            <div className="flex items-center gap-2">
              {activeItem.user.avatar ? (
                <img src={activeItem.user.avatar} alt={activeItem.user.name} className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-2)] text-xs font-bold text-[var(--ink)]">
                  {initials(activeItem.user.name)}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[var(--ink)]">{activeItem.user.name}</p>
                <p className="truncate text-[11px] text-[var(--ink-3)]">@{activeItem.user.username}</p>
              </div>
            </div>

            <audio src={activeItem.mediaUrl} controls className="mt-3 w-full rounded-xl bg-white" />
            {activeItem.status.caption ? (
              <p className="mt-2 rounded-xl bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--ink-2)]">{activeItem.status.caption}</p>
            ) : null}
            <p className="mt-2 text-xs text-[var(--ink-3)]">{timeLeftLabel(activeItem.status.expiresAt)}</p>
          </div>
        </div>
      ) : null}
    </>
  );
}

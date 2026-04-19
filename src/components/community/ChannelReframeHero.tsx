'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { CommunityAvatarInitial } from '@/components/community/CommunityWorkspace';
import {
  channelHeroSurfaceClass,
  channelHeroTagline,
  channelRoleHintFa,
  CHANNEL_ROLE_FA,
  networkTypeBadgeFa,
  POSTING_MODE_FA,
  spaceCategoryBadgeFa,
  type ChannelEmptyKind,
} from '@/components/community/channelRichLabels';

type NetworkPayload = {
  id: string;
  name: string;
  networkType?: string;
  spaceCategory?: string;
};

type Props = {
  titleInitial: string;
  channelName: string;
  description: string | null;
  network: NetworkPayload;
  emptyKind: ChannelEmptyKind;
  /** fa-IR formatted */
  memberCount?: string;
  postCount?: string;
  openJobsCount?: number | null;
  postingMode?: string;
  spaceCategory?: string;
  isMember: boolean;
  myRole: string | null;
  joinButton: ReactNode;
  error: ReactNode;
  /** Sticky action strip — publication actions */
  actions: ReactNode;
};

function fmtJobs(n: number | null | undefined): string | null {
  if (n == null || n <= 0) return null;
  try {
    return n.toLocaleString('fa-IR');
  } catch {
    return String(n);
  }
}

/**
 * Broadcast-first hero — visually distinct from group “chat” pages: large identity, purpose line, stats.
 */
export function ChannelReframeHero({
  titleInitial,
  channelName,
  description,
  network,
  emptyKind,
  memberCount,
  postCount,
  openJobsCount,
  postingMode,
  spaceCategory,
  isMember,
  myRole,
  joinButton,
  error,
  actions,
}: Props) {
  const surface = channelHeroSurfaceClass(emptyKind);
  const tagline = channelHeroTagline(emptyKind, network.name);
  const jobsFa = fmtJobs(openJobsCount);

  return (
    <section className={`relative overflow-hidden rounded-3xl border ${surface}`}>
      <div className="pointer-events-none absolute -left-8 top-0 h-32 w-32 rounded-full bg-violet-400/10 blur-2xl" />
      <div className="relative px-4 pb-4 pt-5">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">کانال انتشار</p>

        <div className="mt-3 flex gap-3">
          <div className="min-w-0 flex-1 text-right">
            <h1 className="theme-text-primary text-[19px] font-black leading-tight tracking-tight">{channelName}</h1>
            <p className="mt-2 text-[13px] font-medium leading-relaxed text-[var(--text-secondary)]">{tagline}</p>
          </div>
          <CommunityAvatarInitial letter={titleInitial} label={channelName} size="xl" />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--border-soft)]/80 pt-3">
          {spaceCategoryBadgeFa(spaceCategory ?? network.spaceCategory) ? (
            <span className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-extrabold text-violet-900 shadow-sm ring-1 ring-violet-300/50">
              {spaceCategoryBadgeFa(spaceCategory ?? network.spaceCategory)}
            </span>
          ) : null}
          {networkTypeBadgeFa(network.networkType) ? (
            <span className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-extrabold text-slate-800 shadow-sm ring-1 ring-slate-300/60">
              {networkTypeBadgeFa(network.networkType)}
            </span>
          ) : null}
          {postingMode ? (
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-extrabold text-emerald-950 ring-1 ring-emerald-400/40">
              ارسال: {POSTING_MODE_FA[postingMode] ?? postingMode}
            </span>
          ) : null}
          {jobsFa ? (
            <span className="rounded-full bg-sky-500/15 px-2.5 py-1 text-[10px] font-extrabold text-sky-950 ring-1 ring-sky-400/35">
              استخدام فعال: {jobsFa}
            </span>
          ) : null}
        </div>

        <p className="theme-text-secondary mt-3 text-[12px] leading-relaxed">
          {description?.trim() ? (
            description.trim()
          ) : emptyKind === 'neighborhood' ? (
            <>
              <span className="font-semibold text-[var(--text-primary)]">کانال محله</span> — اطلاعیه‌ها و اخبار محلی را اینجا
              ببینید؛ فید رسمی است، نه گفت‌وگوی آزاد.
            </>
          ) : emptyKind === 'business' ? (
            <>
              <span className="font-semibold text-[var(--text-primary)]">کانال رسمی سازمان</span> — اعلان‌ها و فرصت‌ها در یک
              فید منظم و حرفه‌ای.
            </>
          ) : (
            <>فضای <span className="font-semibold text-[var(--text-primary)]">پخش و اطلاع‌رسانی</span>؛ برای گفت‌وگو گروه‌ها را
              باز کنید.</>
          )}
        </p>

        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--text-secondary)]">
          <Link href={`/networks/${network.id}`} className="font-bold text-[var(--accent-hover)] hover:underline">
            {network.name}
          </Link>
          {memberCount ? <span>· {memberCount} مشترک</span> : null}
          {postCount ? <span>· {postCount} انتشار</span> : null}
        </div>

        {isMember && myRole ? (
          <p className="mt-2 text-[11px] text-[var(--text-secondary)]">
            {channelRoleHintFa(myRole, true) ?? <>نقش: {CHANNEL_ROLE_FA[myRole] ?? myRole}</>}
          </p>
        ) : null}

        {error ? <div className="mt-3">{error}</div> : null}

        {joinButton ? <div className="mt-4">{joinButton}</div> : null}

        {isMember ? <div className="mt-4 border-t border-[var(--border-soft)]/70 pt-3">{actions}</div> : null}
      </div>
    </section>
  );
}

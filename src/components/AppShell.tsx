'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AppBottomNav } from '@/components/AppBottomNav';
import { AppSectionHeader, getAppSectionTitle } from '@/components/AppSectionHeader';
import { AppRealtimeProvider } from '@/context/AppRealtimeSocketContext';
import { VoiceCallProvider } from '@/context/VoiceCallContext';

function shouldShowBottomNav(pathname: string): boolean {
  if (pathname === '/') return false;
  if (pathname === '/login' || pathname === '/register') return false;
  return true;
}

/** `/channels/[id]` thread only — fixed workspace fills viewport between navbar and tab bar (no extra document scroll). */
function isChannelThreadPath(pathname: string): boolean {
  if (pathname === '/channels/new') return false;
  return /^\/channels\/[^/]+$/.test(pathname);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '';
  const showNav = shouldShowBottomNav(pathname);
  const sectionTitle = getAppSectionTitle(pathname);
  const showSectionHeader = sectionTitle !== null;
  const channelThreadFixed = isChannelThreadPath(pathname);

  return (
    <AppRealtimeProvider>
      <VoiceCallProvider>
        {showSectionHeader ? <AppSectionHeader /> : null}
        <div
          className={
            showNav && !channelThreadFixed
              ? 'theme-page-bg theme-text-primary pb-[calc(5rem+env(safe-area-inset-bottom,0px))]'
              : 'theme-page-bg theme-text-primary'
          }
        >
          {children}
        </div>
        {showNav ? <AppBottomNav /> : null}
      </VoiceCallProvider>
    </AppRealtimeProvider>
  );
}

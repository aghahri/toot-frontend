'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AppBottomNav } from '@/components/AppBottomNav';
import { AppSectionHeader, getAppSectionTitle } from '@/components/AppSectionHeader';
import { Navbar } from '@/components/Navbar';
import { AppRealtimeProvider } from '@/context/AppRealtimeSocketContext';
import { VoiceCallProvider } from '@/context/VoiceCallContext';

function shouldShowBottomNav(pathname: string): boolean {
  if (pathname === '/') return false;
  if (pathname === '/login' || pathname === '/register') return false;
  if (/^\/meetings\/[^/]+\/room\/?$/.test(pathname)) return false;
  return true;
}

/** `/channels/[id]` thread only — fixed workspace fills viewport between navbar and tab bar (no extra document scroll). */
function isChannelThreadPath(pathname: string): boolean {
  if (pathname === '/channels/new') return false;
  return /^\/channels\/[^/]+$/.test(pathname);
}

/** Direct thread gets its own in-page chat header (back + avatar + presence +
 * call/menu). Hiding the global Navbar avoids two stacked top bars and gives
 * the chat surface full viewport height — same pattern the design handoff
 * asks for. */
function isDirectThreadPath(pathname: string): boolean {
  return /^\/direct\/[^/]+$/.test(pathname);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '';
  const showNav = shouldShowBottomNav(pathname);
  const sectionTitle = getAppSectionTitle(pathname);
  const showSectionHeader = sectionTitle !== null;
  const channelThreadFixed = isChannelThreadPath(pathname);
  const showNavbar = !isDirectThreadPath(pathname);

  return (
    <AppRealtimeProvider>
      <VoiceCallProvider>
        {showNavbar ? <Navbar /> : null}
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

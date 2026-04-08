'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AppBottomNav } from '@/components/AppBottomNav';
import { AppSectionHeader, getAppSectionTitle } from '@/components/AppSectionHeader';

function shouldShowBottomNav(pathname: string): boolean {
  if (pathname === '/') return false;
  if (pathname === '/login' || pathname === '/register') return false;
  return true;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '';
  const showNav = shouldShowBottomNav(pathname);
  const sectionTitle = getAppSectionTitle(pathname);
  const showSectionHeader = sectionTitle !== null;

  return (
    <>
      {showSectionHeader ? <AppSectionHeader /> : null}
      <div
        className={
          showNav
            ? 'pb-[calc(5rem+env(safe-area-inset-bottom,0px))]'
            : undefined
        }
      >
        {children}
      </div>
      {showNav ? <AppBottomNav /> : null}
    </>
  );
}

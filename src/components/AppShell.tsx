'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AppBottomNav } from '@/components/AppBottomNav';

function shouldShowBottomNav(pathname: string): boolean {
  if (pathname === '/') return false;
  if (pathname === '/login' || pathname === '/register') return false;
  return true;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '';
  const showNav = shouldShowBottomNav(pathname);

  return (
    <>
      <div className={showNav ? 'pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))]' : undefined}>{children}</div>
      {showNav ? <AppBottomNav /> : null}
    </>
  );
}

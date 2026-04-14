import type { ReactNode } from 'react';
import { AdminAppChrome } from '@/components/admin/AdminAppChrome';

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminAppChrome>{children}</AdminAppChrome>;
}

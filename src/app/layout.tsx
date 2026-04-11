import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Navbar } from '@/components/Navbar';
import { AppShell } from '@/components/AppShell';

export const metadata: Metadata = {
  title: 'توت',
  description: 'شبکهٔ اجتماعی محله و ارتباط نزدیک‌تر با اطرافیان.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body>
        <div className="min-h-screen">
          <Navbar />
          <AppShell>{children}</AppShell>
        </div>
      </body>
    </html>
  );
}


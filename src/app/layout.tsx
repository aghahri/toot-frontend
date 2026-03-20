import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Navbar } from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'Toot',
  description: 'Toot frontend MVP',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body>
        <div className="min-h-screen">
          <Navbar />
          {children}
        </div>
      </body>
    </html>
  );
}


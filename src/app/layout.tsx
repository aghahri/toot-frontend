import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Navbar } from '@/components/Navbar';
import { AppShell } from '@/components/AppShell';
import { DEFAULT_THEME_KEY, THEME_OPTIONS, THEME_STORAGE_KEY } from '@/lib/theme';

export const metadata: Metadata = {
  title: 'توت',
  description: 'شبکهٔ اجتماعی محله و ارتباط نزدیک‌تر با اطرافیان.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const validThemeKeys = THEME_OPTIONS.map((x) => x.key).join(',');
  const bootThemeScript = `(function(){try{var k='${THEME_STORAGE_KEY}';var d='${DEFAULT_THEME_KEY}';var v='${validThemeKeys}'.split(',');var t=localStorage.getItem(k)||d;if(v.indexOf(t)===-1){t=d;}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','${DEFAULT_THEME_KEY}');}})();`;
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootThemeScript }} />
      </head>
      <body>
        <div className="theme-page-bg theme-text-primary min-h-screen">
          <Navbar />
          <AppShell>{children}</AppShell>
        </div>
      </body>
    </html>
  );
}


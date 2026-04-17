'use client';

import { useEffect, useState } from 'react';
import {
  DEFAULT_THEME_KEY,
  THEME_OPTIONS,
  type ThemeKey,
  applyTheme,
  persistTheme,
  readThemeFromStorage,
} from '@/lib/theme';

export function ThemeSelector() {
  const [selectedTheme, setSelectedTheme] = useState<ThemeKey>(DEFAULT_THEME_KEY);

  useEffect(() => {
    const theme = readThemeFromStorage();
    setSelectedTheme(theme);
    applyTheme(theme);
  }, []);

  function onSelectTheme(next: ThemeKey) {
    setSelectedTheme(next);
    applyTheme(next);
    persistTheme(next);
  }

  return (
    <section className="theme-card-bg theme-border-soft rounded-2xl border p-4 shadow-sm">
      <h2 className="theme-text-primary text-sm font-extrabold">رنگ اپ</h2>
      <p className="theme-text-secondary mt-1 text-xs leading-relaxed">
        تم رنگی رابط کاربری را انتخاب کنید. پیش‌فرض برنامه Light Blue است.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {THEME_OPTIONS.map((option) => {
          const active = selectedTheme === option.key;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => onSelectTheme(option.key)}
              className={[
                'flex items-center justify-between rounded-xl border px-3 py-2 text-right transition',
                active
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text-primary)]'
                  : 'theme-border-soft theme-card-bg theme-text-secondary hover:bg-[var(--surface-soft)]',
              ].join(' ')}
              aria-pressed={active}
            >
              <div className="flex min-w-0 flex-col text-right">
                <span className="truncate text-xs font-bold">{option.label}</span>
                <span className="theme-text-secondary text-[10px] font-medium">
                  {option.key === 'light-blue' ? 'Default' : 'Theme'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className={[
                    'h-4 w-4 rounded-full border border-white/80 shadow-sm',
                    active ? 'ring-2 ring-[var(--accent-ring)] ring-offset-1' : '',
                  ].join(' ')}
                  style={{ backgroundColor: option.accent }}
                  aria-hidden
                />
                <span
                  className="h-4 w-4 rounded-full border border-black/5 shadow-sm"
                  style={{ backgroundColor: option.key === 'black' ? '#0f172a' : '#ffffff' }}
                  aria-hidden
                />
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

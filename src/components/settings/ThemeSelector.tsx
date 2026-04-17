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
    <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-extrabold text-slate-900">رنگ اپ</h2>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">
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
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-slate-900'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
              ].join(' ')}
              aria-pressed={active}
            >
              <span className="text-xs font-bold">{option.label}</span>
              <span
                className={[
                  'h-5 w-5 rounded-full border border-white/80 shadow-sm',
                  active ? 'ring-2 ring-[var(--accent-ring)] ring-offset-1' : '',
                ].join(' ')}
                style={{ backgroundColor: option.accent }}
                aria-hidden
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}

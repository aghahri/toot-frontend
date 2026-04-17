export const THEME_STORAGE_KEY = 'toot_theme_v1';

export const THEME_OPTIONS = [
  { key: 'light-blue', label: 'Light Blue', accent: '#60A5FA' },
  { key: 'green', label: 'Green', accent: '#34D399' },
  { key: 'purple', label: 'Purple', accent: '#A78BFA' },
  { key: 'orange', label: 'Orange', accent: '#F59E0B' },
  { key: 'gray', label: 'Gray', accent: '#94A3B8' },
] as const;

export type ThemeKey = (typeof THEME_OPTIONS)[number]['key'];

export const DEFAULT_THEME_KEY: ThemeKey = 'light-blue';

export function isThemeKey(value: string): value is ThemeKey {
  return THEME_OPTIONS.some((x) => x.key === value);
}

export function readThemeFromStorage(): ThemeKey {
  if (typeof window === 'undefined') return DEFAULT_THEME_KEY;
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY) ?? '';
    return isThemeKey(raw) ? raw : DEFAULT_THEME_KEY;
  } catch {
    return DEFAULT_THEME_KEY;
  }
}

export function applyTheme(theme: ThemeKey) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
}

export function persistTheme(theme: ThemeKey) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* noop */
  }
}

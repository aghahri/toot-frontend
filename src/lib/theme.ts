export const THEME_STORAGE_KEY = 'toot_theme_v1';

export const THEME_OPTIONS = [
  { key: 'light-blue', label: 'Light Blue', accent: '#60A5FA' },
  { key: 'blue', label: 'Blue', accent: '#2563EB' },
  { key: 'green', label: 'Green', accent: '#22C55E' },
  { key: 'purple', label: 'Purple', accent: '#8B5CF6' },
  { key: 'orange', label: 'Orange', accent: '#F59E0B' },
  { key: 'red', label: 'Red', accent: '#EF4444' },
  { key: 'pink', label: 'Pink', accent: '#EC4899' },
  { key: 'gray', label: 'Gray', accent: '#64748B' },
  { key: 'white', label: 'White', accent: '#CBD5E1' },
  { key: 'black', label: 'Black', accent: '#334155' },
  { key: 'gold', label: 'Gold', accent: '#D4A017' },
  { key: 'teal', label: 'Teal', accent: '#0D9488' },
  { key: 'indigo', label: 'Indigo', accent: '#4F46E5' },
  { key: 'emerald', label: 'Emerald', accent: '#10B981' },
  { key: 'rose', label: 'Rose', accent: '#F43F5E' },
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

export type AppLocale = 'fa' | 'en';

function browserLang(): string {
  if (typeof document !== 'undefined') {
    const fromHtml = document.documentElement.lang?.trim();
    if (fromHtml) return fromHtml;
  }
  if (typeof navigator !== 'undefined') return navigator.language || 'fa';
  return 'fa';
}

export function getAppLocale(): AppLocale {
  const lang = browserLang().toLowerCase();
  return lang.startsWith('fa') ? 'fa' : 'en';
}

export function formatAppDateTime(iso: string, withSeconds = false): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const locale = getAppLocale();
  const tag = locale === 'fa' ? 'fa-IR-u-ca-persian' : 'en-US';
  return new Intl.DateTimeFormat(tag, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...(withSeconds ? { second: '2-digit' as const } : {}),
  }).format(d);
}

export function isoToDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const NON_LATIN_DIGIT = /[۰-۹٠-٩]/g;
function toLatinDigits(s: string): string {
  return s.replace(NON_LATIN_DIGIT, (ch) => {
    const code = ch.charCodeAt(0);
    if (code >= 0x06f0 && code <= 0x06f9) return String(code - 0x06f0);
    if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660);
    return ch;
  });
}

const jalaliLatn = new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-latn', {
  timeZone: 'UTC',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function gregorianDayToJalaliParts(gregorianUtcMs: number): { y: number; m: number; d: number } {
  const parts = jalaliLatn.formatToParts(new Date(gregorianUtcMs));
  const y = Number(parts.find((p) => p.type === 'year')?.value ?? NaN);
  const m = Number(parts.find((p) => p.type === 'month')?.value ?? NaN);
  const d = Number(parts.find((p) => p.type === 'day')?.value ?? NaN);
  return { y, m, d };
}

function jalaliToGregorianYmd(jy: number, jm: number, jd: number): { y: number; m: number; d: number } | null {
  const start = Date.UTC(jy + 620, 0, 1);
  const end = Date.UTC(jy + 622, 11, 31);
  const oneDay = 24 * 60 * 60 * 1000;
  for (let t = start; t <= end; t += oneDay) {
    const p = gregorianDayToJalaliParts(t);
    if (p.y === jy && p.m === jm && p.d === jd) {
      const g = new Date(t);
      return { y: g.getUTCFullYear(), m: g.getUTCMonth() + 1, d: g.getUTCDate() };
    }
  }
  return null;
}

export function isoToJalaliInputValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const datePart = new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-latn', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d).replaceAll('/', '-');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${datePart} ${hh}:${mm}`;
}

export function parseJalaliInputToIso(raw: string): string | null {
  const normalized = toLatinDigits(raw).trim().replaceAll('/', '-');
  const m = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{1,2}))?$/);
  if (!m) return null;
  const jy = Number(m[1]);
  const jm = Number(m[2]);
  const jd = Number(m[3]);
  const hh = Number(m[4] ?? '0');
  const mm = Number(m[5] ?? '0');
  if (!Number.isFinite(jy) || jm < 1 || jm > 12 || jd < 1 || jd > 31 || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    return null;
  }
  const g = jalaliToGregorianYmd(jy, jm, jd);
  if (!g) return null;
  const local = new Date(g.y, g.m - 1, g.d, hh, mm, 0, 0);
  if (Number.isNaN(local.getTime())) return null;
  return local.toISOString();
}

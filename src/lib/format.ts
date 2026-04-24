/**
 * Shared Persian-number / Persian-time formatters used by the family-launch
 * surfaces. Pure, dependency-free helpers — kept small on purpose so they
 * can be imported anywhere without pulling extra runtime weight.
 *
 * Referenced in the Claude Design handoff (see docs/design/handoff/... §8).
 */

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

/** Replace every ASCII digit with its Persian equivalent. Safe on strings
 *  that already contain Persian digits — pass-through. */
export function toFaDigits(input: number | string): string {
  return String(input).replace(/\d/g, (d) => FA_DIGITS[+d]);
}

/** Short clock like "۱۴:۳۲" using the Persian locale. Falls back to the raw
 *  ISO string when parsing fails so callers never crash on bad data. */
export function formatTimeFa(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

/** Compact count: <1k → digits, <1M → "۱٫۲ هزار", else → "۳٫۴ میلیون". */
export function formatCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return toFaDigits(0);
  if (n < 1000) return toFaDigits(n);
  if (n < 1_000_000) return `${toFaDigits((n / 1000).toFixed(1))} هزار`;
  return `${toFaDigits((n / 1_000_000).toFixed(1))} میلیون`;
}

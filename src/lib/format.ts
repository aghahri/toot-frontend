/**
 * Shared Persian-number / Persian-time formatters used by the family-launch
 * surfaces. Pure, dependency-free helpers — kept small on purpose so they
 * can be imported anywhere without pulling extra runtime weight.
 *
 * This file is referenced in the Claude Design handoff (see
 * docs/design/handoff/... §8). Only Round 1 consumers land here (digit
 * converter + clock time); the count/price/relative helpers will be added
 * when later rounds start using them.
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

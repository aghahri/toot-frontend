/**
 * Temporary curated vitrin destinations (v1). Replace this catalog when a CMS or admin flow exists.
 * Only these entry ids may be opened in the in-app web viewer (`/vitrin/web`).
 */
export type VitrinCatalogEntry = {
  id: string;
  title: string;
  subtitle: string;
  url: string;
  /** Tailwind classes for card chrome (gradient / border) */
  cardClass: string;
};

export const VITRIN_CATALOG: readonly VitrinCatalogEntry[] = [
  {
    id: 'bamakhabar',
    title: 'باماخبر',
    subtitle: 'سایت خبری محلات',
    url: 'https://bamakhabar.com',
    cardClass: 'from-amber-500/90 via-orange-500/85 to-rose-600/90 ring-amber-200/60',
  },
  {
    id: 'iranregions',
    title: 'نقشه محلات ایران',
    subtitle: 'نقشه جغرافیایی محلات ایران',
    url: 'https://www.iranregions.com',
    cardClass: 'from-emerald-600/90 via-teal-600/85 to-cyan-700/90 ring-emerald-200/60',
  },
  {
    id: 'bamatel',
    title: 'سیم\u200cکارت محله',
    subtitle: 'خدمات سیم\u200cکارت و ارتباطات',
    url: 'https://bamatel.net',
    cardClass: 'from-violet-600/90 via-purple-600/85 to-fuchsia-700/90 ring-violet-200/60',
  },
  {
    id: 'bamabank',
    title: 'بامابانک',
    subtitle: 'خدمات مالی محله',
    url: 'https://bamabank.net',
    cardClass: 'from-sky-600/90 via-blue-600/85 to-indigo-800/90 ring-sky-200/60',
  },
] as const;

const byId = new Map(VITRIN_CATALOG.map((e) => [e.id, e] as const));

export function getVitrinEntryById(id: string | null | undefined): VitrinCatalogEntry | null {
  if (!id || typeof id !== 'string') return null;
  return byId.get(id.trim()) ?? null;
}

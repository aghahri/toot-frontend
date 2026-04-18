/**
 * Session-scoped perf helpers for Neighborhood forms (v1): short TTL cache, last network id, request dedupe.
 */

const CACHE_TTL_MS = 45_000;
const LAST_NETWORK_KEY = 'toot.forms.lastNetworkId';

type CacheEntry<T> = { at: number; data: T };

let networksCache: Map<string, CacheEntry<unknown>> | null = null;
let formsCache: Map<string, CacheEntry<unknown>> | null = null;

function maps() {
  if (!networksCache) networksCache = new Map();
  if (!formsCache) formsCache = new Map();
  return { networksCache, formsCache };
}

export const NEIGHBORHOOD_NETWORKS_QUERY = 'spaceCategory=NEIGHBORHOOD';
export const NEIGHBORHOOD_ADMIN_NETWORKS_QUERY = 'spaceCategory=NEIGHBORHOOD&memberRole=NETWORK_ADMIN';

export function getCachedNetworksList<T>(queryKey: string): T | null {
  const { networksCache: m } = maps();
  const row = m.get(queryKey);
  if (!row || Date.now() - row.at > CACHE_TTL_MS) return null;
  return row.data as T;
}

export function setCachedNetworksList<T>(queryKey: string, data: T): void {
  const { networksCache: m } = maps();
  m.set(queryKey, { at: Date.now(), data });
}

export function getCachedPublishedForms<T>(networkId: string): T | null {
  const { formsCache: m } = maps();
  const row = m.get(networkId);
  if (!row || Date.now() - row.at > CACHE_TTL_MS) return null;
  return row.data as T;
}

export function setCachedPublishedForms<T>(networkId: string, data: T): void {
  const { formsCache: m } = maps();
  m.set(networkId, { at: Date.now(), data });
}

export function readLastSelectedNetworkId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(LAST_NETWORK_KEY);
  } catch {
    return null;
  }
}

export function writeLastSelectedNetworkId(networkId: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(LAST_NETWORK_KEY, networkId);
  } catch {
    /* ignore */
  }
}

const inflight = new Map<string, Promise<unknown>>();

/** Coalesce concurrent identical GETs (e.g. strict mode double mount). */
export function dedupedGet<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const p = fn().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p as Promise<T>;
}

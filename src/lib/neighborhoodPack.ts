import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

export type NeighborhoodNetworkRow = {
  id: string;
  name: string;
  spaceCategory: string;
  isMember?: boolean;
  /** From GET /networks — used for admin vs member copy */
  myRole?: 'NETWORK_ADMIN' | 'MEMBER' | null;
};

export async function fetchMemberNeighborhoodNetworks(): Promise<NeighborhoodNetworkRow[]> {
  const token = getAccessToken();
  if (!token) return [];
  const all = await apiFetch<NeighborhoodNetworkRow[]>('networks', { method: 'GET', token });
  return all.filter((n) => n.spaceCategory === 'NEIGHBORHOOD' && (n.isMember ?? false));
}

export type NeighborhoodPollRow = {
  id: string;
  question: string;
  options: string[];
  deadlineAt: string | null;
  isClosed: boolean;
  effectiveClosed: boolean;
  createdAt: string;
  createdBy: { id: string; name: string };
  counts: number[];
  totalVotes: number;
  myVote: number | null;
};

export async function fetchNeighborhoodPolls(networkId: string): Promise<NeighborhoodPollRow[]> {
  const token = getAccessToken();
  if (!token) throw new Error('ورود لازم است');
  return apiFetch<NeighborhoodPollRow[]>(`networks/${encodeURIComponent(networkId)}/neighborhood/polls`, {
    method: 'GET',
    token,
  });
}

export async function createNeighborhoodPoll(
  networkId: string,
  body: { question: string; options: string[]; deadlineAt?: string },
): Promise<{ id: string; createdAt: string }> {
  const token = getAccessToken();
  if (!token) throw new Error('ورود لازم است');
  return apiFetch(`networks/${encodeURIComponent(networkId)}/neighborhood/polls`, {
    method: 'POST',
    token,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function voteNeighborhoodPoll(networkId: string, pollId: string, optionIndex: number): Promise<void> {
  const token = getAccessToken();
  if (!token) throw new Error('ورود لازم است');
  await apiFetch(`networks/${encodeURIComponent(networkId)}/neighborhood/polls/${encodeURIComponent(pollId)}/vote`, {
    method: 'POST',
    token,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ optionIndex }),
  });
}

export async function closeNeighborhoodPoll(networkId: string, pollId: string): Promise<void> {
  const token = getAccessToken();
  if (!token) throw new Error('ورود لازم است');
  await apiFetch(`networks/${encodeURIComponent(networkId)}/neighborhood/polls/${encodeURIComponent(pollId)}/close`, {
    method: 'POST',
    token,
  });
}

export type NeighborhoodBulletinRow = {
  id: string;
  kind: string;
  title: string;
  body: string;
  createdAt: string;
  createdBy: { id: string; name: string };
};

export async function fetchNeighborhoodBulletins(networkId: string): Promise<NeighborhoodBulletinRow[]> {
  const token = getAccessToken();
  if (!token) throw new Error('ورود لازم است');
  return apiFetch(`networks/${encodeURIComponent(networkId)}/neighborhood/bulletins`, {
    method: 'GET',
    token,
  });
}

export async function createNeighborhoodBulletin(
  networkId: string,
  body: { kind: string; title: string; body: string },
): Promise<unknown> {
  const token = getAccessToken();
  if (!token) throw new Error('ورود لازم است');
  return apiFetch(`networks/${encodeURIComponent(networkId)}/neighborhood/bulletins`, {
    method: 'POST',
    token,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export type NeighborhoodSpotlightRow = {
  id: string;
  businessName: string;
  category: string;
  intro: string;
  description: string | null;
  imageUrl: string | null;
  contactHint: string | null;
  createdAt: string;
  createdBy: { id: string; name: string };
};

export async function fetchNeighborhoodSpotlights(networkId: string): Promise<NeighborhoodSpotlightRow[]> {
  const token = getAccessToken();
  if (!token) throw new Error('ورود لازم است');
  return apiFetch(`networks/${encodeURIComponent(networkId)}/neighborhood/spotlights`, {
    method: 'GET',
    token,
  });
}

export async function createNeighborhoodSpotlight(
  networkId: string,
  body: {
    businessName: string;
    category: string;
    intro: string;
    description?: string;
    imageUrl?: string;
    contactHint?: string;
  },
): Promise<unknown> {
  const token = getAccessToken();
  if (!token) throw new Error('ورود لازم است');
  return apiFetch(`networks/${encodeURIComponent(networkId)}/neighborhood/spotlights`, {
    method: 'POST',
    token,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Premium capability entry points for Neighborhood space detail */
export const NEIGHBORHOOD_CAPABILITY_CARDS = [
  {
    label: 'نظرسنجی محلی',
    sub: 'سوال بپرسید، گزینه بگذارید، نتیجه را ببینید',
    href: '/spaces/neighborhood/polls',
    emoji: '📊',
  },
  {
    label: 'فرم‌های مدیریتی',
    sub: 'درخواست نگهداری، گزارش و فرم‌های آماده',
    href: '/spaces/neighborhood/forms',
    emoji: '📋',
  },
  {
    label: 'کسب‌وکارهای محلی',
    sub: 'معرفی کوتاه و قابل اعتماد نزدیک شما',
    href: '/spaces/neighborhood/showcase',
    emoji: '🏪',
  },
  {
    label: 'تابلو اعلانات',
    sub: 'قطعی آب، جلسه، گم‌شده، رویداد',
    href: '/spaces/neighborhood/bulletin',
    emoji: '📌',
  },
] as const;

export const BULLETIN_KIND_LABELS: Record<string, string> = {
  NOTICE: 'اعلان',
  EVENT: 'رویداد',
  LOST_FOUND: 'گم‌شده / پیدا شده',
  MAINTENANCE: 'تعمیرات',
  OTHER: 'سایر',
};

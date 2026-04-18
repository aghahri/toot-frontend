import { apiFetch, getApiBaseUrl, getErrorMessageFromResponse } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';
import { buildMediaUrl } from '@/lib/media';

/** Keep aligned with backend `NEIGHBORHOOD_SPOTLIGHT_CATEGORY_VALUES`. */
export const LOCAL_BUSINESS_SHOWCASE_CATEGORIES = [
  'رستوران و کافه',
  'سوپرمارکت و مواد غذایی',
  'پوشاک',
  'آرایش و زیبایی',
  'سلامت و درمان',
  'ورزش و تناسب اندام',
  'آموزش',
  'خدمات فنی و تعمیرات',
  'خدمات حقوقی و اداری',
  'حمل‌ونقل و خودرو',
  'خانه و دکوراسیون',
  'فناوری و موبایل',
  'سایر',
] as const;

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
  /** Lean server-side filter — avoids loading all networks (see networks?spaceCategory=NEIGHBORHOOD). */
  return apiFetch<NeighborhoodNetworkRow[]>('networks?spaceCategory=NEIGHBORHOOD', { method: 'GET', token });
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

export async function updateNeighborhoodSpotlight(
  networkId: string,
  spotlightId: string,
  body: {
    businessName?: string;
    category?: string;
    intro?: string;
    description?: string;
    imageUrl?: string;
    contactHint?: string;
  },
): Promise<unknown> {
  const token = getAccessToken();
  if (!token) throw new Error('ورود لازم است');
  return apiFetch(
    `networks/${encodeURIComponent(networkId)}/neighborhood/spotlights/${encodeURIComponent(spotlightId)}`,
    {
      method: 'PATCH',
      token,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
}

export async function deleteNeighborhoodSpotlight(networkId: string, spotlightId: string): Promise<void> {
  const token = getAccessToken();
  if (!token) throw new Error('ورود لازم است');
  await apiFetch(
    `networks/${encodeURIComponent(networkId)}/neighborhood/spotlights/${encodeURIComponent(spotlightId)}`,
    { method: 'DELETE', token },
  );
}

/** Upload spotlight cover image via existing `POST /media/upload` flow. */
export async function uploadShowcaseImage(file: File): Promise<string> {
  const token = getAccessToken();
  if (!token) throw new Error('ورود لازم است');
  const mime = file.type || '';
  if (!mime.startsWith('image/')) {
    throw new Error('فقط فایل تصویری انتخاب کنید');
  }
  if (file.size > 20 * 1024 * 1024) {
    throw new Error('حجم تصویر از ۲۰ مگابایت بیشتر است');
  }
  const uploadUrl = `${getApiBaseUrl().replace(/\/+$/, '')}/media/upload`;
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    throw new Error(await getErrorMessageFromResponse(res));
  }
  const data = (await res.json()) as { url?: string; key?: string; media?: { url: string } };
  const resolvedUrl = data.key ? buildMediaUrl(data.key) : data.url ?? data.media?.url ?? null;
  if (!resolvedUrl) throw new Error('پاسخ آپلود ناقص است');
  return resolvedUrl;
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

/** Append networkId for deep links from space detail / teasers (optional). */
export function neighborhoodPageHref(path: string, networkId: string | null): string {
  if (!networkId) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}networkId=${encodeURIComponent(networkId)}`;
}

export type NeighborhoodVisibilitySnapshot = {
  poll: {
    id: string;
    question: string;
    effectiveClosed: boolean;
    totalVotes: number;
    openPollsCount: number;
  } | null;
  bulletin: { id: string; kind: string; title: string; createdAt: string } | null;
  spotlight: {
    id: string;
    businessName: string;
    category: string;
    intro: string;
    imageUrl: string | null;
    createdAt: string;
  } | null;
  counts: {
    openPolls: number;
    bulletins: number;
    spotlights: number;
    publishedForms: number;
  };
};

export async function fetchNeighborhoodVisibility(networkId: string): Promise<NeighborhoodVisibilitySnapshot> {
  const token = getAccessToken();
  if (!token) throw new Error('ورود لازم است');
  return apiFetch<NeighborhoodVisibilitySnapshot>(
    `networks/${encodeURIComponent(networkId)}/neighborhood/visibility`,
    { method: 'GET', token },
  );
}

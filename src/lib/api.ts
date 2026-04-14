import { API_BASE_URL, buildApiUrl } from './api-url';

let authModulePromise: Promise<typeof import('./auth')> | null = null;
function loadAuthModule() {
  if (!authModulePromise) authModulePromise = import('./auth');
  return authModulePromise;
}

export type HealthResponse = {
  status: string;
  timestamp?: string;
};

function extractMessageFromBody(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;

  const message = record.message;
  if (typeof message === 'string') return message;
  if (Array.isArray(message) && message.every((m) => typeof m === 'string')) return message.join(' ');

  // NestJS Validation errors sometimes come as message array of strings
  const error = record.error;
  if (typeof error === 'string') return error;

  return null;
}

export async function getErrorMessageFromResponse(res: Response): Promise<string> {
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      const body = (await res.json()) as unknown;
      return extractMessageFromBody(body) ?? `Request failed with ${res.status}`;
    } catch {
      // fall back to text below
    }
  }

  const text = await res.text().catch(() => '');
  return text || `Request failed with ${res.status}`;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
  /** Internal: avoid infinite 401 retry loops */
  _allow401Refresh = true,
): Promise<T> {
  const { token: tokenOverride, ...rest } = options;
  const { getAccessToken, tryRefreshAccessTokenOnce } = await loadAuthModule();
  const token = tokenOverride ?? getAccessToken() ?? undefined;

  const res = await fetch(buildApiUrl(path), {
    ...rest,
    headers: {
      ...(rest.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (
    res.status === 401 &&
    _allow401Refresh &&
    path !== 'auth/refresh' &&
    path !== 'auth/login' &&
    path !== 'auth/verify-otp' &&
    path !== 'auth/register' &&
    path !== 'auth/request-otp' &&
    path !== 'health'
  ) {
    const refreshed = await tryRefreshAccessTokenOnce();
    if (refreshed) {
      const nextTok = getAccessToken() ?? undefined;
      return apiFetch<T>(path, { ...options, token: nextTok }, false);
    }
  }

  if (!res.ok) {
    const message = await getErrorMessageFromResponse(res);
    throw new Error(message);
  }

  return (await res.json()) as T;
}

export function getApiBaseUrl() {
  return API_BASE_URL.replace(/\/+$/, '');
}

export async function getHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>('health', { method: 'GET' });
}

export { buildApiUrl } from './api-url';


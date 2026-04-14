import { buildApiUrl } from './api-url';
import { getErrorMessageFromResponse } from './api';

const ACCESS_KEY = 'toot_access_token';
const REFRESH_KEY = 'toot_refresh_token';

function notifyAuthTokenChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('toot-auth-token-changed'));
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(ACCESS_KEY);
  } catch {
    return null;
  }
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

export function setSessionTokens(accessToken: string, refreshToken: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ACCESS_KEY, accessToken);
  window.localStorage.setItem(REFRESH_KEY, refreshToken);
  notifyAuthTokenChanged();
}

export function clearSession() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
  notifyAuthTokenChanged();
}

/** Clears persisted session (access + refresh). */
export function clearAccessToken() {
  clearSession();
}

type TokenPayload = {
  accessToken?: string;
  refreshToken?: string;
};

function persistTokensFromPayload(data: TokenPayload): boolean {
  const a = data.accessToken;
  const r = data.refreshToken;
  if (!a || !r) return false;
  setSessionTokens(a, r);
  return true;
}

let refreshInFlight: Promise<boolean> | null = null;

export async function tryRefreshAccessTokenOnce(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  const rt = getRefreshToken();
  if (!rt) return false;

  refreshInFlight = (async () => {
    try {
      const res = await fetch(buildApiUrl('auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
      });
      if (!res.ok) {
        clearSession();
        return false;
      }
      const data = (await res.json()) as TokenPayload;
      if (!persistTokensFromPayload(data)) {
        clearSession();
        return false;
      }
      return true;
    } catch {
      clearSession();
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/** Resolves auth on cold start: uses access token if present, otherwise one refresh attempt. */
export async function bootstrapAuthState(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (getAccessToken()) return true;
  if (getRefreshToken()) return tryRefreshAccessTokenOnce();
  return false;
}

async function rawJsonFetch<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(buildApiUrl(path), init);
  if (!res.ok) {
    throw new Error(await getErrorMessageFromResponse(res));
  }
  return (await res.json()) as T;
}

export async function login(email: string, password: string): Promise<{
  accessToken: string;
}> {
  const data = await rawJsonFetch<TokenPayload>('auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!data?.accessToken || !data?.refreshToken) {
    throw new Error('Login failed: missing tokens');
  }

  setSessionTokens(data.accessToken, data.refreshToken);
  return { accessToken: data.accessToken };
}

export async function register(input: {
  email: string;
  password: string;
  name: string;
  username: string;
  mobile: string;
  bio?: string;
}): Promise<void> {
  await rawJsonFetch<unknown>('auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

function extractDevOtpCodeFromPayload(data: unknown): string | undefined {
  if (data == null || typeof data !== 'object') return undefined;

  const tryPick = (obj: Record<string, unknown>): string | undefined => {
    const v =
      obj.devOtpCode ??
      obj.dev_otp_code ??
      obj.otp ??
      obj.code ??
      obj.oneTimePassword;
    if (v == null) return undefined;
    const s = String(v).trim();
    return s.length > 0 ? s : undefined;
  };

  const root = data as Record<string, unknown>;
  const direct = tryPick(root);
  if (direct) return direct;

  const nested = root.data;
  if (nested != null && typeof nested === 'object') {
    return tryPick(nested as Record<string, unknown>);
  }
  return undefined;
}

export async function requestOtp(phone: string): Promise<{
  phoneMask: string;
  devOtpCode?: string;
}> {
  const data = await rawJsonFetch<unknown>('auth/request-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  });

  const devOtp = extractDevOtpCodeFromPayload(data);
  const phoneMask =
    data != null &&
    typeof data === 'object' &&
    typeof (data as Record<string, unknown>).phoneMask === 'string'
      ? ((data as Record<string, unknown>).phoneMask as string)
      : '';

  return {
    phoneMask,
    ...(devOtp != null ? { devOtpCode: devOtp } : {}),
  };
}

export async function verifyOtp(phone: string, code: string): Promise<{
  accessToken: string;
}> {
  const data = await rawJsonFetch<TokenPayload>('auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, code }),
  });

  if (!data?.accessToken || !data?.refreshToken) {
    throw new Error('Verify failed: missing tokens');
  }

  setSessionTokens(data.accessToken, data.refreshToken);
  return { accessToken: data.accessToken };
}

export function isAuthenticated(): boolean {
  return !!getAccessToken();
}

/** Revokes refresh on server (JWT-protected) and clears local session. */
export async function performServerLogout(): Promise<void> {
  const hadRefresh = !!getRefreshToken();
  if (!getAccessToken() && hadRefresh) {
    await tryRefreshAccessTokenOnce();
  }
  const access = getAccessToken();
  const refresh = getRefreshToken();
  if (access) {
    try {
      await fetch(buildApiUrl('auth/logout'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${access}`,
        },
        body: JSON.stringify(refresh ? { refreshToken: refresh } : {}),
      });
    } catch {
      /* best-effort */
    }
  }
  clearSession();
}

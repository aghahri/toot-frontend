import { apiFetch } from './api';

const TOKEN_KEY = 'toot_access_token';

function notifyAuthTokenChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('toot-auth-token-changed'));
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAccessToken(token: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(TOKEN_KEY, token);
  notifyAuthTokenChanged();
}

export function clearAccessToken() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(TOKEN_KEY);
  notifyAuthTokenChanged();
}

export async function login(email: string, password: string): Promise<{
  accessToken: string;
}> {
  const data = await apiFetch<{
    accessToken?: string;
  }>('auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!data?.accessToken) {
    throw new Error('Login failed: missing accessToken');
  }

  setAccessToken(data.accessToken);
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
  await apiFetch<unknown>('auth/register', {
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
  const data = await apiFetch<unknown>('auth/request-otp', {
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
  const data = await apiFetch<{
    accessToken?: string;
  }>('auth/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, code }),
  });

  if (!data?.accessToken) {
    throw new Error('Verify failed: missing accessToken');
  }

  setAccessToken(data.accessToken);
  return { accessToken: data.accessToken };
}

export function isAuthenticated(): boolean {
  return !!getAccessToken();
}


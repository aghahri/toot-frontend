import { apiFetch } from './api';

const TOKEN_KEY = 'toot_access_token';

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
}

export function clearAccessToken() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(TOKEN_KEY);
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
  mobile?: string;
  bio?: string;
}): Promise<void> {
  await apiFetch<unknown>('auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function isAuthenticated(): boolean {
  return !!getAccessToken();
}


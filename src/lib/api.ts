export type HealthResponse = {
  status: string;
  timestamp?: string;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://api.tootapp.net';

function buildUrl(path: string) {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const trimmedBase = API_BASE_URL.replace(/\/+$/, '');
  const trimmedPath = path.replace(/^\/+/, '');
  return `${trimmedBase}/${trimmedPath}`;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, ...rest } = options;

  const res = await fetch(buildUrl(path), {
    ...rest,
    headers: {
      ...(rest.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Request failed with ${res.status}`);
  }

  return (await res.json()) as T;
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export async function getHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>('health', { method: 'GET' });
}


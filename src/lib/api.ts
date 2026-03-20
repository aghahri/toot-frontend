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
    const message = await getErrorMessageFromResponse(res);
    throw new Error(message);
  }

  return (await res.json()) as T;
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export async function getHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>('health', { method: 'GET' });
}


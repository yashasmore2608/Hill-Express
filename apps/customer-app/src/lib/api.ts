import Constants from 'expo-constants';

/**
 * In dev, the phone can't reach "localhost" — that's the phone itself.
 * Metro's hostUri carries the dev machine's LAN IP, so the API base is
 * derived from it: run `pnpm dev:api` and every device on the wifi finds it.
 */
const resolveBaseUrl = (): string => {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (configured) return configured;
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) return `http://${hostUri.split(':')[0]}:3000`;
  return 'http://localhost:3000';
};

export const API_BASE = resolveBaseUrl();

/**
 * Images the admin uploaded are stored as a relative path (`/uploads/…`) so the
 * same database row resolves for the panel on localhost, this phone on the LAN,
 * and a production domain. Absolute URLs (externally hosted artwork) pass
 * through untouched.
 */
export const assetUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  return url.startsWith('/') ? `${API_BASE}${url}` : url;
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
}

export async function apiFetch<T>(path: string, opts: ApiOptions = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/v1${path}`, {
      method: opts.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
  } catch {
    // Offline is a state, not an error dump — callers show a readable message.
    throw new ApiError(0, 'No connection — check your network and try again');
  }

  const data = (await res.json().catch(() => ({}))) as { message?: string | string[] };
  if (!res.ok) {
    const msg = Array.isArray(data.message) ? data.message[0] : data.message;
    throw new ApiError(res.status, msg ?? `Request failed (${res.status})`);
  }
  return data as T;
}

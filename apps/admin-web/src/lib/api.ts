const TOKEN_KEY = 'he.admin.access';
const REFRESH_KEY = 'he.admin.refresh';

export const tokens = {
  get access() {
    return localStorage.getItem(TOKEN_KEY);
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(access: string, refresh: string) {
    localStorage.setItem(TOKEN_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

interface Options {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Skip the Authorization header (login only). */
  anonymous?: boolean;
}

/** Vite proxies /v1 to the API in dev; same-origin behind Caddy in prod. */
export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const res = await fetch(`/v1${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.anonymous || !tokens.access
        ? {}
        : { Authorization: `Bearer ${tokens.access}` }),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  }).catch(() => {
    throw new ApiError(0, 'Cannot reach the server — is the API running?');
  });

  if (res.status === 401 && !opts.anonymous) {
    tokens.clear();
    window.location.href = '/login';
    throw new ApiError(401, 'Session expired');
  }

  const data = (await res.json().catch(() => ({}))) as { message?: string | string[] };
  if (!res.ok) {
    const msg = Array.isArray(data.message) ? data.message[0] : data.message;
    throw new ApiError(res.status, msg ?? `Request failed (${res.status})`);
  }
  return data as T;
}

/** CSV downloads need the raw response, not JSON. */
export async function downloadCsv(path: string, fallbackName: string) {
  const res = await fetch(`/v1${path}`, {
    headers: tokens.access ? { Authorization: `Bearer ${tokens.access}` } : {},
  });
  if (!res.ok) throw new ApiError(res.status, 'Export failed');
  const blob = await res.blob();
  const disposition = res.headers.get('content-disposition') ?? '';
  const match = /filename="([^"]+)"/.exec(disposition);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = match?.[1] ?? fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

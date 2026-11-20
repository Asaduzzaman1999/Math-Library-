let inMemoryAuthToken: string | null = null;
let inMemoryTwoFactorToken: string | null = null;

export function setAuthToken(token: string | null) {
  inMemoryAuthToken = token;
}

export function getAuthToken(): string | null {
  return inMemoryAuthToken;
}

export function setTwoFactorToken(token: string | null) {
  inMemoryTwoFactorToken = token;
}

export function getTwoFactorToken(): string | null {
  return inMemoryTwoFactorToken;
}

export async function apiFetch<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (inMemoryAuthToken) {
    headers.set('Authorization', `Bearer ${inMemoryAuthToken}`);
  }
  if (inMemoryTwoFactorToken) {
    headers.set('X-2FA-Token', inMemoryTwoFactorToken);
  }
  if (!(options.body instanceof FormData) && !headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`) as Error & {
      status?: number;
      requires2FA?: boolean;
      twoFactorEnabled?: boolean;
    };
    err.status = res.status;
    err.requires2FA = data.requires2FA;
    err.twoFactorEnabled = data.twoFactorEnabled;
    throw err;
  }
  return data as T;
}

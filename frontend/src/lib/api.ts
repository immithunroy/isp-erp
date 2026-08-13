export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

const TOKEN_KEY = "isp_erp.access_token";
const REFRESH_KEY = "isp_erp.refresh_token";

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(access: string, refresh: string): void {
  localStorage.setItem(TOKEN_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export class ApiError extends Error {
  status: number;
  title: string;
  detail?: string;
  errors?: unknown[];

  constructor(opts: { status: number; title: string; detail?: string; errors?: unknown[] }) {
    super(opts.detail ?? opts.title);
    this.status = opts.status;
    this.title = opts.title;
    this.detail = opts.detail;
    this.errors = opts.errors;
  }
}

let refreshingPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;
  const resp = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refresh }),
  });
  if (!resp.ok) {
    clearTokens();
    return false;
  }
  const data = (await resp.json()) as { access_token: string; refresh_token: string };
  setTokens(data.access_token, data.refresh_token);
  return true;
}

export interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  auth?: boolean;
}

export async function apiFetch<T>(
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const { body, auth = true, headers, ...rest } = opts;

  const finalHeaders = new Headers(headers);
  if (body !== undefined && !finalHeaders.has("Content-Type")) {
    finalHeaders.set("Content-Type", "application/json");
  }
  if (auth) {
    const token = getAccessToken();
    if (token) finalHeaders.set("Authorization", `Bearer ${token}`);
  }

  const init: RequestInit = {
    ...rest,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  };

  let resp = await fetch(`${API_BASE_URL}${path}`, init);

  if (resp.status === 401 && auth && !path.startsWith("/auth/")) {
    if (!refreshingPromise) {
      refreshingPromise = refreshAccessToken().finally(() => {
        refreshingPromise = null;
      });
    }
    const refreshed = await refreshingPromise;
    if (refreshed) {
      const token = getAccessToken();
      if (token) finalHeaders.set("Authorization", `Bearer ${token}`);
      resp = await fetch(`${API_BASE_URL}${path}`, init);
    } else {
      clearTokens();
    }
  }

  if (resp.status === 204) return undefined as T;

  let payload: unknown = null;
  const contentType = resp.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    payload = await resp.json();
  }

  if (!resp.ok) {
    const err = (payload ?? {}) as {
      title?: string;
      detail?: string;
      errors?: unknown[];
    };
    throw new ApiError({
      status: resp.status,
      title: err.title ?? `HTTP ${resp.status}`,
      detail: err.detail,
      errors: err.errors,
    });
  }
  return payload as T;
}
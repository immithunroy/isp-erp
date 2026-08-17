import * as SecureStore from "expo-secure-store";
import type { TokenResponse } from "../types";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://103.177.54.6:8040/api/v1";

const ACCESS_KEY = "isp_erp.access_token";
const REFRESH_KEY = "isp_erp.refresh_token";

export function getAccessToken(): string | null {
  return SecureStore.getItemSync(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  return SecureStore.getItemSync(REFRESH_KEY);
}

export function setTokens(access: string, refresh: string): void {
  SecureStore.setItemSync(ACCESS_KEY, access);
  SecureStore.setItemSync(REFRESH_KEY, refresh);
}

export function clearTokens(): void {
  SecureStore.deleteItemSync(ACCESS_KEY);
  SecureStore.deleteItemSync(REFRESH_KEY);
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let refreshing: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;
  try {
    const resp = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    if (!resp.ok) {
      clearTokens();
      return false;
    }
    const data = (await resp.json()) as TokenResponse;
    setTokens(data.access_token, data.refresh_token);
    return true;
  } catch {
    clearTokens();
    return false;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
}

export async function apiFetch<T>(
  path: string,
  opts: RequestOptions = {}
): Promise<T> {
  const { method = "GET", body, auth = true } = opts;
  const headers: Record<string, string> = {};

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (auth) {
    const token = getAccessToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let resp = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (resp.status === 401 && auth && !path.startsWith("/auth/")) {
    if (!refreshing) {
      refreshing = refreshAccessToken().finally(() => {
        refreshing = null;
      });
    }
    const ok = await refreshing;
    if (ok) {
      const token = getAccessToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;
      resp = await fetch(`${API_BASE_URL}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } else {
      clearTokens();
    }
  }

  if (resp.status === 204) return undefined as T;

  let payload: unknown = null;
  const ct = resp.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    payload = await resp.json();
  }

  if (!resp.ok) {
    const err = (payload ?? {}) as { detail?: string; title?: string };
    throw new ApiError(resp.status, err.detail ?? err.title ?? `HTTP ${resp.status}`);
  }
  return payload as T;
}

export { API_BASE_URL };
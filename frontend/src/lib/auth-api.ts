import { apiFetch, getRefreshToken, setTokens, clearTokens, type ApiError } from "./api";

export interface Permission {
  id: number;
  code: string;
  module: string;
}

export interface Role {
  id: number;
  name: string;
  code: string;
  is_system: boolean;
}

export interface User {
  id: number;
  email: string;
  full_name: string;
  phone: string | null;
  is_active: boolean;
  is_superuser: boolean;
  last_login_at: string | null;
  roles: Role[];
  permissions: Permission[];
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export async function login(email: string, password: string): Promise<TokenResponse> {
  const data = await apiFetch<TokenResponse>("/auth/login", {
    method: "POST",
    auth: false,
    body: { email, password },
  });
  setTokens(data.access_token, data.refresh_token);
  return data;
}

export async function fetchMe(): Promise<User> {
  return apiFetch<User>("/auth/me");
}

export async function logout(): Promise<void> {
  const refresh = getRefreshToken();
  try {
    if (refresh) {
      await apiFetch("/auth/logout", { method: "POST", body: { refresh_token: refresh } });
    }
  } catch (e) {
    // best-effort; ignore network errors on logout
    if ((e as ApiError).status >= 500) throw e;
  } finally {
    clearTokens();
  }
}
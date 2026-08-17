import { apiFetch, setTokens, clearTokens, getRefreshToken } from "./client";
import type { TokenResponse, User } from "../types";

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
      await apiFetch("/auth/logout", {
        method: "POST",
        body: { refresh_token: refresh },
      });
    }
  } catch {
    // best-effort
  } finally {
    clearTokens();
  }
}
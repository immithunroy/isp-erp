import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "../src/lib/auth";
import { clearTokens, setTokens } from "../src/lib/api";

function Probe() {
  const { user, initializing } = useAuth();
  return (
    <div>
      <span data-testid="state">
        {initializing ? "loading" : user ? `user:${user.email}` : "anonymous"}
      </span>
    </div>
  );
}

function renderWithProviders() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    clearTokens();
    vi.restoreAllMocks();
  });

  it("reports anonymous when no token stored", async () => {
    renderWithProviders();
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("anonymous"));
  });

  it("fetches /auth/me when a token exists and clears it on 401", async () => {
    setTokens("access", "refresh");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.endsWith("/auth/me")) {
        return new Response(JSON.stringify({ title: "Unauthorized" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.endsWith("/auth/refresh")) {
        return new Response(JSON.stringify({ title: "Unauthorized" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("{}", { status: 200 });
    });

    renderWithProviders();
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("anonymous"));
    expect(fetchSpy).toHaveBeenCalled();
  });
});
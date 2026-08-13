import { describe, expect, it, vi, beforeEach } from "vitest";
import { apiFetch, setTokens, clearTokens } from "../src/lib/api";

describe("apiFetch", () => {
  beforeEach(() => {
    clearTokens();
    vi.restoreAllMocks();
  });

  it("sends JSON body and parses JSON response", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const data = await apiFetch<{ ok: boolean }>("/ping", { method: "POST", body: { a: 1 } });
    expect(data.ok).toBe(true);
    const init = spy.mock.calls[0][1] as RequestInit;
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
    expect(init.headers).toBeInstanceOf(Headers);
  });

  it("returns undefined for 204", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
    const data = await apiFetch("/noop", { method: "DELETE" });
    expect(data).toBeUndefined();
  });

  it("throws ApiError with structured detail on 401", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ title: "Unauthorized", detail: "bad creds" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    );
    await expect(apiFetch("/auth/me")).rejects.toMatchObject({
      status: 401,
      title: "Unauthorized",
      detail: "bad creds",
    });
  });

  it("attaches Authorization header when token is present (non-auth path)", async () => {
    setTokens("access-token", "refresh-token");
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    await apiFetch("/anything");
    const init = spy.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer access-token");
  });
});
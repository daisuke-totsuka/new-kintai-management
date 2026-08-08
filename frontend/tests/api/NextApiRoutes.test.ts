import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as loginPost } from "@/app/api/login/route";
import { GET as meGet } from "@/app/api/me/route";
import { GET as roleMenusGet } from "@/app/api/roles/[roleId]/menus/route";

describe("Next APIプロキシ", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = "http://api.example.test";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.NEXT_PUBLIC_API_URL;
  });

  it("ログインプロキシが要求本文を転送しバックエンドステータスとクッキーを維持する", async () => {
    const setCookie = "access_token=token-1; Path=/; HttpOnly";
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toEqual({
        email: "user@example.com",
        password: "secret",
      });
      return jsonResponse({ success: true }, 201, {
        "set-cookie": setCookie,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await loginPost(
      new Request("http://local.test/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "user@example.com",
          password: "secret",
        }),
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.example.test/login",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(response.status).toBe(201);
    expect(response.headers.get("set-cookie")).toBe(setCookie);
    expect(await response.json()).toEqual({ success: true });
  });

  it("認証確認プロキシがクッキーを転送し未認証レスポンスを維持する", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ error: "Unauthorized" }, 401),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await meGet(
      new Request("http://local.test/api/me", {
        headers: { cookie: "access_token=token-1" },
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.example.test/auth/me",
      expect.objectContaining({
        method: "GET",
        headers: { Cookie: "access_token=token-1" },
        cache: "no-store",
      }),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("権限メニュープロキシが権限IDをエンコードし未検出レスポンスを維持する", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ error: "Role not found" }, 404),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await roleMenusGet(
      new Request("http://local.test/api/roles/ADMIN ACCOUNTING/menus", {
        headers: { cookie: "access_token=token-1" },
      }),
      { params: { roleId: "ADMIN ACCOUNTING" } },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.example.test/roles/ADMIN%20ACCOUNTING/menus",
      expect.objectContaining({
        method: "GET",
        headers: { Cookie: "access_token=token-1" },
        cache: "no-store",
      }),
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "Role not found" });
  });
});

function jsonResponse(
  body: unknown,
  status = 200,
  headers: HeadersInit = {},
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

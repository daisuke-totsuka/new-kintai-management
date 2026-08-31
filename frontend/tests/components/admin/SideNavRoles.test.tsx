import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import SideNav from "@/app/SideNav";

const API_BASE_URL = "http://api.example.test";

const navState = vi.hoisted(() => ({
  pathname: "/admin/roles",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navState.pathname,
}));

describe("サイドナビ動的権限メニュー", () => {
  beforeEach(() => {
    navState.pathname = "/admin/roles";
    process.env.NEXT_PUBLIC_API_URL = API_BASE_URL;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.NEXT_PUBLIC_API_URL;
  });

  it("role_idが無い場合はメニューAPIを呼ばず空表示にする", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (String(input) === `${API_BASE_URL}/auth/me`) {
        return jsonResponse({ authenticated: true, user: {} });
      }
      return jsonResponse({ error: "not found" }, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<SideNav />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(screen.queryByText("勤務実績")).toBeNull();
      expect(screen.queryByText("権限管理")).toBeNull();
    });
  });

  it("現在パスに一致するAPIメニューをactive表示にする", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (url === `${API_BASE_URL}/auth/me`) {
          return jsonResponse({
            authenticated: true,
            user: { role_id: "ADMIN" },
          });
        }
        if (url === "/api/roles/ADMIN/menus") {
          return jsonResponse({
            success: true,
            role_id: "ADMIN",
            menus: [
              {
                menu_id: "ROLE_MANAGEMENT",
                menu_name: "権限管理",
                menu_category: "ADMIN",
                menu_path: "/admin/roles",
                is_active: true,
              },
            ],
          });
        }
        return jsonResponse({ error: "not found" }, 404);
      }),
    );

    render(<SideNav />);

    const roleLink = (await screen.findByText("権限管理")) as HTMLAnchorElement;
    expect(roleLink.className).toContain("active");
  });
});

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import SideNav from "@/app/SideNav";

const API_BASE_URL = "http://api.example.test";

const navState = vi.hoisted(() => ({
  pathname: "/attendance",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navState.pathname,
}));

const apiMenus = [
  {
    menu_id: "EXPENSE",
    menu_name: "経費請求",
    menu_category: "USER",
    menu_path: "/ExpenseClaims",
    is_active: true,
  },
  {
    menu_id: "ATTENDANCE",
    menu_name: "勤務実績",
    menu_category: "USER",
    menu_path: "/attendance",
    is_active: true,
  },
  {
    menu_id: "USER_MANAGEMENT",
    menu_name: "ユーザ管理",
    menu_category: "ADMIN",
    menu_path: "/admin/users",
    is_active: true,
  },
  {
    menu_id: "ROLE_MANAGEMENT",
    menu_name: "権限管理",
    menu_category: "ADMIN",
    menu_path: "/admin/roles",
    is_active: true,
  },
  {
    menu_id: "DASHBOARD",
    menu_name: "確定画面",
    menu_category: "ACCOUNTING",
    menu_path: "/dashboard",
    is_active: true,
  },
  {
    menu_id: "SUBMISSION_STATUS",
    menu_name: "提出状況",
    menu_category: "LEADER",
    menu_path: "/leader",
    is_active: true,
  },
];

describe("サイドナビ権限メニュー", () => {
  beforeEach(() => {
    navState.pathname = "/attendance";
    process.env.NEXT_PUBLIC_API_URL = API_BASE_URL;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.NEXT_PUBLIC_API_URL;
  });

  it("API取得メニューを表示する", async () => {
    const fetchMock = mockMenuApi("ADMIN", apiMenus);

    render(<SideNav />);

    expect(await screen.findByText("勤務実績")).toBeTruthy();
    expect(screen.getByText("ユーザ管理")).toBeTruthy();
    expect(screen.getByText("権限管理")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/auth/me`,
      expect.objectContaining({
        credentials: "include",
        cache: "no-store",
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/roles/ADMIN/menus",
      expect.objectContaining({
        credentials: "include",
        cache: "no-store",
      }),
    );
  });

  it("menu_categoryごとにUSER、ADMIN、LEADER、ACCOUNTINGの順で表示する", async () => {
    renderWithMenus(apiMenus);

    const nav = await screen.findByRole("navigation", {
      name: "利用可能メニュー",
    });
    const text = nav.textContent ?? "";

    expect(text.indexOf("ユーザ権限")).toBeLessThan(text.indexOf("管理権限"));
    expect(text.indexOf("管理権限")).toBeLessThan(text.indexOf("リーダー権限"));
    expect(text.indexOf("リーダー権限")).toBeLessThan(text.indexOf("経理権限"));
    expect(screen.getByText("勤務実績")).toBeTruthy();
    expect(screen.getByText("ユーザ管理")).toBeTruthy();
    expect(screen.getByText("提出状況")).toBeTruthy();
    expect(screen.getByText("確定画面")).toBeTruthy();
    expect(screen.getByText("経費請求")).toBeTruthy();
  });

  it("API失敗時に固定メニューを表示しない", async () => {
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
          return jsonResponse({ error: "failed" }, 500);
        }
        return jsonResponse({ error: "not found" }, 404);
      }),
    );

    render(<SideNav />);

    expect((await screen.findByRole("alert")).textContent).toBe(
      "メニュー情報の取得に失敗しました",
    );
    await waitFor(() => {
      expect(screen.queryByText("勤務実績")).toBeNull();
      expect(screen.queryByText("ユーザ管理")).toBeNull();
      expect(screen.queryByText("経費請求")).toBeNull();
    });
  });

  it("カスタムrole_idでもrole_menu_mapsのメニューを表示する", async () => {
    mockMenuApi("STORE_MANAGER", [
      {
        menu_id: "EXPENSE",
        menu_name: "経費請求",
        menu_category: "USER",
        menu_path: "/ExpenseClaims",
        is_active: true,
      },
    ]);

    render(<SideNav />);

    expect(await screen.findByText("経費請求")).toBeTruthy();
    expect(screen.getByText("ユーザ権限")).toBeTruthy();
  });
});

function renderWithMenus(menus: Record<string, unknown>[]) {
  mockMenuApi("ADMIN", menus);
  render(<SideNav />);
}

function mockMenuApi(roleId: string, menus: Record<string, unknown>[]) {
  const normalizedRoleId = roleId.trim().toUpperCase().replace(/[-\s]/g, "_");
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url === `${API_BASE_URL}/auth/me`) {
      return jsonResponse({
        authenticated: true,
        user: { role_id: roleId },
      });
    }
    if (url === `/api/roles/${normalizedRoleId}/menus`) {
      return jsonResponse({ success: true, role_id: normalizedRoleId, menus });
    }
    return jsonResponse({ error: "not found" }, 404);
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

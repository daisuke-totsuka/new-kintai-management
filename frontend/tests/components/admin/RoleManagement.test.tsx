import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import RoleManagementPage from "@/app/admin/roles/ClientPage";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

const menus = [
  {
    menu_id: "ATTENDANCE",
    menu_name: "勤務実績",
    menu_category: "USER",
    menu_path: "/attendance",
    is_active: true,
  },
  {
    menu_id: "WORK_TIME_SETTING",
    menu_name: "通常出勤時間設定",
    menu_category: "USER",
    menu_path: "/NormalWorkTimeSettings",
    is_active: true,
  },
  {
    menu_id: "EXPENSE",
    menu_name: "経費請求",
    menu_category: "USER",
    menu_path: "/ExpenseClaims",
    is_active: true,
  },
  {
    menu_id: "WORK_BILLING",
    menu_name: "業務請求明細",
    menu_category: "USER",
    menu_path: "/BusinessBillDetails",
    is_active: true,
  },
  {
    menu_id: "BRANCH_MANAGEMENT",
    menu_name: "支店管理",
    menu_category: "ADMIN",
    menu_path: "/admin/branches",
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
    menu_id: "SUBMISSION_STATUS",
    menu_name: "提出状況",
    menu_category: "LEADER",
    menu_path: "/leader",
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
    menu_id: "ATTENDANCE_SETTINGS",
    menu_name: "年度設定",
    menu_category: "ACCOUNTING",
    menu_path: "/AttendanceSettings",
    is_active: true,
  },
];

function menuById(menuId: string) {
  return menus.find((menu) => menu.menu_id === menuId)!;
}

describe("権限管理画面", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    pushMock.mockClear();
    process.env.NEXT_PUBLIC_API_URL = "http://api.example.test";

    const roles = [
      {
        role_id: "ADMIN",
        role_name: "Admin",
        description: "Admin role",
        is_active: true,
        menu_ids: ["USER_MANAGEMENT", "ROLE_MANAGEMENT"],
        menus: [menuById("USER_MANAGEMENT"), menuById("ROLE_MANAGEMENT")],
        updated_at: "2026-07-01T00:00:00+00:00",
      },
      {
        role_id: "LEADER",
        role_name: "Leader",
        description: "リーダー",
        is_active: true,
        menu_ids: [
          "ATTENDANCE",
          "WORK_TIME_SETTING",
          "EXPENSE",
          "WORK_BILLING",
          "SUBMISSION_STATUS",
        ],
        menus: [
          menuById("ATTENDANCE"),
          menuById("WORK_TIME_SETTING"),
          menuById("EXPENSE"),
          menuById("WORK_BILLING"),
          menuById("SUBMISSION_STATUS"),
        ],
        updated_at: "2026-07-01T00:00:00+00:00",
      },
      {
        role_id: "USER",
        role_name: "User",
        description: "一般利用者",
        is_active: true,
        menu_ids: ["ATTENDANCE", "WORK_TIME_SETTING", "EXPENSE", "WORK_BILLING"],
        menus: [
          menuById("ATTENDANCE"),
          menuById("WORK_TIME_SETTING"),
          menuById("EXPENSE"),
          menuById("WORK_BILLING"),
        ],
        updated_at: "2026-07-01T00:00:00+00:00",
      },
    ];

    fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (url.endsWith("/auth/me")) {
        return jsonResponse({
          authenticated: true,
          user: { role_id: "ADMIN" },
        });
      }

      if (url.endsWith("/menus")) {
        return jsonResponse({ success: true, menus });
      }

      if (url.endsWith("/roles") && method === "GET") {
        return jsonResponse({ success: true, roles });
      }

      if (url.endsWith("/roles") && method === "POST") {
        const payload = JSON.parse(String(init?.body));
        const role = {
          ...payload,
          menu_ids: payload.menu_ids,
          menus: menus.filter((menu) => payload.menu_ids.includes(menu.menu_id)),
          updated_at: "2026-07-02T00:00:00+00:00",
        };
        roles.push(role);
        return jsonResponse({ success: true, role }, 201);
      }

      if (url.endsWith("/roles/ADMIN") && method === "PUT") {
        const payload = JSON.parse(String(init?.body));
        const role = {
          ...roles[0],
          ...payload,
          menus: menus.filter((menu) => payload.menu_ids.includes(menu.menu_id)),
          updated_at: "2026-07-03T00:00:00+00:00",
        };
        roles[0] = role;
        return jsonResponse({ success: true, role });
      }

      return jsonResponse({ error: "not found" }, 404, false);
    });

    vi.stubGlobal("fetch", fetchMock);
  });

  it("role_menu_mapsのメニューを一覧表示できる", async () => {
    render(<RoleManagementPage />);

    expect(await screen.findByText("ADMIN")).toBeTruthy();
    expect(screen.getByText("LEADER")).toBeTruthy();
    expect(screen.getByText("USER")).toBeTruthy();
    expect(screen.getByText("ユーザ管理 / 権限管理")).toBeTruthy();
    expect(
      screen.getByText("勤務実績 / 通常出勤時間設定 / 経費請求 / 業務請求明細"),
    ).toBeTruthy();
  });

  it("権限登録フォームでカテゴリをUSER、ADMIN、LEADER、ACCOUNTINGの順で表示する", async () => {
    render(<RoleManagementPage />);

    await screen.findByText("ADMIN");
    fireEvent.click(screen.getByRole("button", { name: "+ 新規登録" }));

    const menuField = screen.getAllByText("利用可能メニュー").at(-1)!.parentElement!;
    const text = menuField.textContent ?? "";
    expect(text.indexOf("ユーザ権限")).toBeLessThan(text.indexOf("管理権限"));
    expect(text.indexOf("管理権限")).toBeLessThan(text.indexOf("リーダー権限"));
    expect(text.indexOf("リーダー権限")).toBeLessThan(text.indexOf("経理権限"));
  });

  it("権限名と説明で検索できる", async () => {
    render(<RoleManagementPage />);

    fireEvent.change(
      await screen.findByPlaceholderText("権限コード/権限名/メニューで検索"),
      { target: { value: "一般利用者" } },
    );

    await waitFor(() => {
      expect(screen.getByText("USER")).toBeTruthy();
      expect(screen.queryByText("ADMIN")).toBeNull();
    });
  });

  it("権限登録で選択メニューを保存できる", async () => {
    render(<RoleManagementPage />);

    await screen.findByText("ADMIN");
    fireEvent.click(screen.getByRole("button", { name: "+ 新規登録" }));
    fireEvent.change(screen.getByPlaceholderText("例: STORE_MANAGER"), {
      target: { value: "report-viewer" },
    });
    fireEvent.change(screen.getByPlaceholderText("例: 店舗管理者"), {
      target: { value: "帳票閲覧者" },
    });
    fireEvent.click(screen.getByLabelText("経費請求"));
    fireEvent.click(screen.getByRole("button", { name: "登録" }));

    await waitFor(() => {
      expect(screen.getByText("REPORT_VIEWER")).toBeTruthy();
    });

    const postCall = fetchMock.mock.calls.find(
      ([input, init]) => String(input).endsWith("/roles") && init?.method === "POST",
    );
    expect(postCall).toBeTruthy();
    expect(JSON.parse(String(postCall?.[1]?.body))).toEqual({
      role_id: "REPORT_VIEWER",
      role_name: "帳票閲覧者",
      description: "",
      is_active: true,
      menu_ids: ["EXPENSE"],
    });
  });

  it("権限編集ではrole_idを変更不可にしてメニューと有効状態を更新できる", async () => {
    render(<RoleManagementPage />);

    await screen.findByText("ADMIN");
    const adminRow = rowByFirstCell("ADMIN");
    fireEvent.click(within(adminRow).getByRole("button", { name: "編集" }));

    const roleIdInput = screen.getByDisplayValue("ADMIN") as HTMLInputElement;
    expect(roleIdInput.disabled).toBe(true);

    fireEvent.change(screen.getByPlaceholderText("例: 店舗管理者"), {
      target: { value: "管理者更新" },
    });
    fireEvent.click(screen.getByLabelText("ユーザ管理"));
    fireEvent.click(screen.getByLabelText("有効"));
    fireEvent.click(screen.getByRole("button", { name: "更新" }));

    await waitFor(() => {
      expect(screen.getByText("管理者更新")).toBeTruthy();
      expect(screen.getByText("無効")).toBeTruthy();
    });

    const putCall = fetchMock.mock.calls.find(
      ([input, init]) =>
        String(input).endsWith("/roles/ADMIN") && init?.method === "PUT",
    );
    expect(putCall).toBeTruthy();
    expect(JSON.parse(String(putCall?.[1]?.body))).toEqual({
      role_id: "ADMIN",
      role_name: "管理者更新",
      description: "Admin role",
      is_active: false,
      menu_ids: ["ROLE_MANAGEMENT"],
    });
  });
});

function jsonResponse(body: unknown, status = 200, ok = true) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(body),
  });
}

function rowByFirstCell(text: string) {
  return screen
    .getAllByRole("row")
    .slice(1)
    .find((row) => within(row).getAllByRole("cell")[0].textContent === text)!;
}

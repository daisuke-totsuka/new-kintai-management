import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import UserManagementPage from "@/app/admin/users/ClientPage";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

describe("ユーザ管理画面", () => {
  beforeEach(() => {
    pushMock.mockClear();
    process.env.NEXT_PUBLIC_API_URL = "http://api.example.test";
  });

  it("role_idを優先し、権限名と支店名を表示する", async () => {
    vi.stubGlobal("fetch", createFetchMock());

    render(<UserManagementPage />);

    expect(await screen.findByText("Api Admin")).toBeTruthy();
    expect(screen.getByText("管理者")).toBeTruthy();
    expect(screen.getByText("経理")).toBeTruthy();
    expect(screen.getByText("管理者兼経理")).toBeTruthy();
    expect(screen.getByText("一般ユーザ")).toBeTruthy();
    expect(screen.getAllByText("001 東京本社").length).toBeGreaterThan(0);
  });

  it("支店プルダウンにbranchesの値を表示し、選択したbranch_codeを保存する", async () => {
    let createdPayload: Record<string, unknown> | null = null;
    vi.stubGlobal(
      "fetch",
      createFetchMock((payload) => {
        createdPayload = payload;
      }),
    );

    render(<UserManagementPage />);

    await screen.findByText("Api Admin");
    fireEvent.click(screen.getByRole("button", { name: "+ 新規登録" }));

    const branchSelect = screen.getByRole("combobox", { name: "支店" });
    expect(within(branchSelect).getByRole("option", { name: "001 東京本社" })).toBeTruthy();
    expect(within(branchSelect).getByRole("option", { name: "002 大阪支店" })).toBeTruthy();

    fireEvent.change(screen.getByRole("combobox", { name: "権限" }), {
      target: { value: "USER" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "社員ID" }), {
      target: { value: "0000000010" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "氏名" }), {
      target: { value: "Created User" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "メール" }), {
      target: { value: "created@example.com" },
    });
    fireEvent.change(branchSelect, {
      target: { value: "001" },
    });
    fireEvent.click(screen.getByRole("button", { name: "登録" }));

    await waitFor(() => {
      expect(createdPayload?.branch_code).toBe("001");
    });
  });
});

function createFetchMock(onCreate?: (payload: Record<string, unknown>) => void) {
  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (url.endsWith("/auth/me")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ authenticated: true, user: { role_id: "ADMIN" } }),
      });
    }

    if (url.includes("/users/search")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            users: [
              user("0000000001", "Api Admin", "admin@example.com", "ADMIN", "管理者", "001", "東京本社"),
              user("0000000002", "Api Accounting", "accounting@example.com", "ACCOUNTING", "経理", "002", "大阪支店"),
              user(
                "0000000003",
                "Api Admin Accounting",
                "admin-accounting@example.com",
                "ADMIN_ACCOUNTING",
                "管理者兼経理",
                "001",
                "東京本社",
              ),
              user("0000000004", "Api User", "user@example.com", "USER", "一般ユーザ", "002", "大阪支店"),
            ],
          }),
      });
    }

    if (url.includes("/roles")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            roles: [
              { role_id: "ADMIN", role_name: "管理者" },
              { role_id: "ACCOUNTING", role_name: "経理" },
              { role_id: "ADMIN_ACCOUNTING", role_name: "管理者兼経理" },
              { role_id: "USER", role_name: "一般ユーザ" },
            ],
          }),
      });
    }

    if (url.includes("/branches")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            branches: [
              { branch_code: "001", branch_name: "東京本社", is_active: true },
              { branch_code: "002", branch_name: "大阪支店", is_active: true },
            ],
          }),
      });
    }

    if (url.endsWith("/new_users") && init?.method === "POST") {
      const payload = JSON.parse(String(init.body));
      onCreate?.(payload);

      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            user: {
              ...payload,
              id: payload.employee_id,
              role_name: "一般ユーザ",
              branch_name: "東京本社",
              updated_at: "2026-06-23T00:00:00+00:00",
            },
          }),
      });
    }

    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
  });
}

function user(
  employeeId: string,
  name: string,
  email: string,
  roleId: string,
  roleName: string,
  branchCode: string,
  branchName: string,
) {
  return {
    id: employeeId,
    employee_id: employeeId,
    name,
    email,
    role_id: roleId,
    role_name: roleName,
    branch_code: branchCode,
    branch_name: branchName,
    is_active: true,
    updated_at: "2026-06-23T00:00:00+00:00",
  };
}

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import RoleManagementPage from "@/app/admin/roles/ClientPage";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

describe("RoleManagementPage", () => {
  beforeEach(() => {
    pushMock.mockClear();
    process.env.NEXT_PUBLIC_API_URL = "http://api.example.test";
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);

        if (url.endsWith("/auth/me")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ authenticated: true, user: { role: "ADMIN" } }),
          });
        }

        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              roles: [
                { role_code: "ADMIN", role_name: "管理者", description: "", display_order: 10 },
                { role_code: "ACCOUNTING", role_name: "経理", description: "", display_order: 20 },
                { role_code: "ADMIN_ACCOUNTING", role_name: "管理者兼経理", description: "", display_order: 30 },
                { role_code: "USER", role_name: "一般ユーザ", description: "", display_order: 40 },
              ],
            }),
        });
      }),
    );
  });

  it("roles初期データ4件を表示できる", async () => {
    render(<RoleManagementPage />);

    expect(await screen.findByText("権限管理")).toBeTruthy();
    expect(await screen.findByText("ADMIN")).toBeTruthy();
    expect(screen.getByText("ACCOUNTING")).toBeTruthy();
    expect(screen.getByText("ADMIN_ACCOUNTING")).toBeTruthy();
    expect(screen.getByText("USER")).toBeTruthy();
    expect(screen.getByText("管理者兼経理")).toBeTruthy();
  });

  it("権限名で検索できる", async () => {
    render(<RoleManagementPage />);

    fireEvent.change(await screen.findByPlaceholderText("権限コード/権限名/メニューで検索"), {
      target: { value: "経理" },
    });

    await waitFor(() => {
      expect(screen.getByText("ACCOUNTING")).toBeTruthy();
      expect(screen.getByText("ADMIN_ACCOUNTING")).toBeTruthy();
      expect(screen.queryByText("USER")).toBeNull();
    });
  });
});

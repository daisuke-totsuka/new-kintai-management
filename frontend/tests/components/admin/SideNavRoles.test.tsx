import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import SideNav from "@/app/SideNav";

const navState = vi.hoisted(() => ({
  pathname: "/admin/roles",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navState.pathname,
}));

function mockCurrentUser(user: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            user,
          }),
      }),
    ),
  );
}

function mockCurrentRole(role: string) {
  mockCurrentUser({ role });
}

describe("SideNav role visibility", () => {
  beforeEach(() => {
    navState.pathname = "/admin/roles";
  });

  it("USERには一般メニューのみ表示される", async () => {
    mockCurrentRole("USER");
    render(<SideNav />);

    expect(await screen.findByText("勤務実績")).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByText("ユーザ管理")).toBeNull();
      expect(screen.queryByText("勤務表設定")).toBeNull();
    });
  });

  it("ADMINには管理メニューが表示され、経理メニューは表示されない", async () => {
    mockCurrentRole("ADMIN");
    render(<SideNav />);

    expect(await screen.findByText("権限管理")).toBeTruthy();
    expect(screen.getByText("ユーザ管理")).toBeTruthy();
    expect(screen.queryByText("勤務表設定")).toBeNull();
  });

  it("ACCOUNTINGには一般メニューと経理メニューが表示される", async () => {
    mockCurrentRole("ACCOUNTING");
    render(<SideNav />);

    expect(await screen.findByText("提出状況")).toBeTruthy();
    expect(screen.getByText("勤務表設定")).toBeTruthy();
    expect(screen.getByText("勤務実績")).toBeTruthy();
    expect(screen.queryByText("ユーザ管理")).toBeNull();
  });

  it("ADMIN_ACCOUNTINGにはADMINとACCOUNTINGの全機能が表示される", async () => {
    mockCurrentRole("ADMIN_ACCOUNTING");
    render(<SideNav />);

    expect(await screen.findByText("権限管理")).toBeTruthy();
    expect(screen.getByText("勤務表設定")).toBeTruthy();
    expect(screen.getByText("勤務実績")).toBeTruthy();
  });

  it("role_idをroleより優先して判定する", async () => {
    mockCurrentUser({ role_id: "ADMIN_ACCOUNTING", role: "USER" });
    render(<SideNav />);

    expect(await screen.findByText("権限管理")).toBeTruthy();
    expect(screen.getByText("支店管理")).toBeTruthy();
    expect(screen.getByText("勤務表設定")).toBeTruthy();
    expect(screen.getByText("勤務実績")).toBeTruthy();
  });

  it("role_id未設定時は既存roleで判定する", async () => {
    mockCurrentUser({ role: "ADMIN" });
    render(<SideNav />);

    expect(await screen.findByText("権限管理")).toBeTruthy();
    expect(screen.getByText("支店管理")).toBeTruthy();
    expect(screen.queryByText("勤務表設定")).toBeNull();
  });

  it("role_idもroleも無い場合は暫定でADMIN扱いにする", async () => {
    mockCurrentUser({});
    render(<SideNav />);

    expect(await screen.findByText("勤務実績")).toBeTruthy();
    expect(screen.getByText("支店管理")).toBeTruthy();
    expect(screen.getByText("権限管理")).toBeTruthy();
  });
});

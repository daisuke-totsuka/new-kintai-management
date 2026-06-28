import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import SideNav from "@/app/SideNav";

const navState = vi.hoisted(() => ({
  pathname: "/attendance",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navState.pathname,
}));

const GENERAL_MENU = ["勤務実績", "通常出勤時間設定", "経費請求", "業務請求分明細"];
const ACCOUNTING_MENU = ["提出状況", "勤務表設定"];
const ADMIN_MENU = ["ユーザ管理", "支店管理", "権限管理"];

function mockRole(roleId: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            user: {
              role_id: roleId,
            },
          }),
      }),
    ),
  );
}

async function expectRoleMenus(visible: string[], hidden: string[]) {
  await waitFor(() => {
    for (const label of visible) {
      expect(screen.getByText(label)).toBeTruthy();
    }

    for (const label of hidden) {
      expect(screen.queryByText(label)).toBeNull();
    }
  });
}

describe("SideNav role menu matrix", () => {
  beforeEach(() => {
    navState.pathname = "/attendance";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ADMINは管理メニューを表示し経理メニューを表示しない", async () => {
    mockRole("ADMIN");
    render(<SideNav />);

    await expectRoleMenus([...GENERAL_MENU, ...ADMIN_MENU], ACCOUNTING_MENU);
  });

  it("ACCOUNTINGは一般メニューと経理メニューを表示する", async () => {
    mockRole("ACCOUNTING");
    render(<SideNav />);

    await expectRoleMenus([...GENERAL_MENU, ...ACCOUNTING_MENU], ADMIN_MENU);
  });

  it("ADMIN_ACCOUNTINGは管理メニューと経理メニューを表示する", async () => {
    mockRole("ADMIN_ACCOUNTING");
    render(<SideNav />);

    await expectRoleMenus(
      [...GENERAL_MENU, ...ACCOUNTING_MENU, ...ADMIN_MENU],
      [],
    );
  });

  it("USERは一般メニューのみ表示する", async () => {
    mockRole("USER");
    render(<SideNav />);

    await expectRoleMenus(GENERAL_MENU, [...ACCOUNTING_MENU, ...ADMIN_MENU]);
  });
});

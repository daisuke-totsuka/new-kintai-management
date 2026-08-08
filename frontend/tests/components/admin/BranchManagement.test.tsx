import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import BranchManagementPage from "@/app/admin/branches/ClientPage";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

describe("支店管理画面", () => {
  beforeEach(() => {
    pushMock.mockClear();
    process.env.NEXT_PUBLIC_API_URL = "http://api.example.test";
    vi.stubGlobal("fetch", createFetchMock());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.NEXT_PUBLIC_API_URL;
  });

  it("支店一覧を表示できる", async () => {
    render(<BranchManagementPage />);

    expect(screen.getByText("支店管理")).toBeTruthy();
    expect(await screen.findByText("東京支店")).toBeTruthy();
    expect(screen.getByText("大阪支店")).toBeTruthy();
  });

  it("支店検索ができる", async () => {
    render(<BranchManagementPage />);

    await screen.findByText("東京支店");
    fireEvent.change(
      screen.getByPlaceholderText("支店コード/支店名/住所/電話番号で検索"),
      { target: { value: "大阪" } },
    );

    expect(screen.getByText("大阪支店")).toBeTruthy();
    expect(screen.queryByText("東京支店")).toBeNull();
  });

  it("支店登録ができる", async () => {
    render(<BranchManagementPage />);

    await screen.findByText("東京支店");
    fireEvent.click(screen.getByRole("button", { name: "+ 新規登録" }));
    fireEvent.change(screen.getByPlaceholderText("例: 東京支店"), {
      target: { value: "福岡支店" },
    });
    fireEvent.change(screen.getByPlaceholderText("例: トウキョウシテン"), {
      target: { value: "フクオカシテン" },
    });
    fireEvent.click(screen.getByRole("button", { name: "登録" }));

    await waitFor(() => {
      expect(screen.getByText("福岡支店")).toBeTruthy();
    });
  });

  it("支店編集ができる", async () => {
    render(<BranchManagementPage />);

    await screen.findByText("東京支店");
    fireEvent.click(screen.getAllByRole("button", { name: "編集" })[0]);
    fireEvent.change(screen.getByPlaceholderText("例: 東京支店"), {
      target: { value: "東京本店" },
    });
    fireEvent.click(screen.getByRole("button", { name: "更新" }));

    await waitFor(() => {
      expect(screen.getByText("東京本店")).toBeTruthy();
    });
  });

  it("支店論理削除ができる", async () => {
    render(<BranchManagementPage />);

    await screen.findByText("東京支店");
    fireEvent.click(screen.getAllByRole("button", { name: "削除" })[0]);
    expect(screen.getByText("支店論理削除")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "削除" }).at(-1)!);

    await waitFor(() => {
      expect(screen.getAllByText("削除済").length).toBeGreaterThan(0);
    });
  });

  it("社員検索モーダル表示", () => {
    render(<BranchManagementPage />);

    fireEvent.click(screen.getByRole("button", { name: "+ 新規登録" }));
    fireEvent.click(screen.getByRole("button", { name: "検索" }));

    const dialog = screen.getByRole("dialog", { name: "社員検索モーダル" });
    expect(within(dialog).getByText("社員検索")).toBeTruthy();
    expect(within(dialog).getAllByText("社員番号").length).toBeGreaterThan(0);
    expect(within(dialog).getAllByText("氏名").length).toBeGreaterThan(0);
    expect(within(dialog).getAllByText("メールアドレス").length).toBeGreaterThan(0);
  });

  it("社員選択", async () => {
    render(<BranchManagementPage />);

    fireEvent.click(screen.getByRole("button", { name: "+ 新規登録" }));
    fireEvent.click(screen.getByRole("button", { name: "検索" }));

    const dialog = screen.getByRole("dialog", { name: "社員検索モーダル" });
    fireEvent.change(within(dialog).getByPlaceholderText("例: 山田"), {
      target: { value: "山田" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "検索" }));

    await waitFor(() => {
      expect(within(dialog).getByText("山田 太郎")).toBeTruthy();
    });

    fireEvent.click(within(dialog).getByRole("button", { name: "選択" }));

    expect(screen.queryByRole("dialog", { name: "社員検索モーダル" })).toBeNull();
    expect(screen.getByDisplayValue("[0000000001] 山田 太郎")).toBeTruthy();
  });

  it("支店責任者反映", async () => {
    render(<BranchManagementPage />);

    await screen.findByText("東京支店");
    fireEvent.click(screen.getByRole("button", { name: "+ 新規登録" }));
    fireEvent.click(screen.getByRole("button", { name: "検索" }));

    const dialog = screen.getByRole("dialog", { name: "社員検索モーダル" });
    fireEvent.change(within(dialog).getByPlaceholderText("例: 山田"), {
      target: { value: "山田" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "検索" }));

    await waitFor(() => {
      expect(within(dialog).getByText("山田 太郎")).toBeTruthy();
    });

    fireEvent.click(within(dialog).getByRole("button", { name: "選択" }));
    fireEvent.change(screen.getByPlaceholderText("例: 東京支店"), {
      target: { value: "福岡支店" },
    });
    fireEvent.change(screen.getByPlaceholderText("例: トウキョウシテン"), {
      target: { value: "フクオカシテン" },
    });
    fireEvent.click(screen.getByRole("button", { name: "登録" }));

    await waitFor(() => {
      expect(screen.getByText("福岡支店")).toBeTruthy();
      expect(screen.getAllByText("[0000000001] 山田 太郎").length).toBeGreaterThan(0);
    });
  });
});

function createFetchMock() {
  const users = [
    {
      employee_id: "0000000001",
      name: "山田 太郎",
      email: "yamada.taro@example.com",
    },
  ];
  const branches = [
    branch("B001", "東京支店", "トウキョウシテン"),
    branch("B002", "大阪支店", "オオサカシテン"),
  ];

  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";

    if (url.endsWith("/auth/me")) {
      return jsonResponse({ authenticated: true, user: { role_id: "ADMIN" } });
    }

    if (url.endsWith("/branches") && method === "GET") {
      return jsonResponse({ success: true, branches });
    }

    if (url.endsWith("/branches") && method === "POST") {
      const payload = JSON.parse(String(init?.body));
      const newBranch = toApiBranch(payload);
      branches.unshift(newBranch);
      return jsonResponse({ success: true, branch: newBranch }, 201);
    }

    if (url.includes("/branches/") && method === "PUT") {
      const payload = JSON.parse(String(init?.body));
      const branchCode = decodeURIComponent(url.split("/branches/")[1] ?? "");
      const updatedBranch = toApiBranch(payload);
      const index = branches.findIndex((item) => item.branch_code === branchCode);
      if (index >= 0) branches[index] = updatedBranch;
      return jsonResponse({ success: true, branch: updatedBranch });
    }

    if (url.includes("/branches/") && method === "DELETE") {
      const branchCode = decodeURIComponent(url.split("/branches/")[1] ?? "");
      const target = branches.find((item) => item.branch_code === branchCode);
      if (target) target.is_active = false;
      return jsonResponse({ success: true });
    }

    if (url.includes("/users/search")) {
      return jsonResponse({ success: true, users });
    }

    return jsonResponse({ error: "not found" }, 404, false);
  });
}

function branch(branchCode: string, branchName: string, branchNameKana: string) {
  return {
    id: branchCode,
    branch_code: branchCode,
    branch_name: branchName,
    branch_name_kana: branchNameKana,
    postal_code: "100-0001",
    address: "東京都千代田区千代田1-1",
    phone: "03-1234-5678",
    manager_employee_id: "",
    manager_name: "",
    is_active: true,
    updated_at: "2026-07-01T00:00:00+09:00",
  };
}

function toApiBranch(payload: Record<string, string | boolean | null>) {
  const managerEmployeeId = String(payload.manager_employee_id ?? "");
  return {
    id: String(payload.branch_code),
    branch_code: String(payload.branch_code),
    branch_name: String(payload.branch_name),
    branch_name_kana: String(payload.branch_name_kana ?? ""),
    postal_code: String(payload.postal_code ?? ""),
    address: String(payload.address ?? ""),
    phone: String(payload.phone ?? ""),
    manager_employee_id: managerEmployeeId,
    manager_name: managerEmployeeId ? "山田 太郎" : "",
    is_active: Boolean(payload.is_active),
    updated_at: "2026-07-02T00:00:00+09:00",
  };
}

function jsonResponse(body: unknown, status = 200, ok = true) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(body),
  });
}

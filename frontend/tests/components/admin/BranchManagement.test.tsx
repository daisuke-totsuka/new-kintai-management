import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import BranchManagementPage from "@/app/admin/branches/ClientPage";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

describe("BranchManagementPage", () => {
  beforeEach(() => {
    pushMock.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve({ ok: true })),
    );
  });

  it("支店一覧を表示できる", () => {
    render(<BranchManagementPage />);

    expect(screen.getByText("支店管理")).toBeTruthy();
    expect(screen.getByText("東京支店")).toBeTruthy();
    expect(screen.getByText("大阪支店")).toBeTruthy();
  });

  it("支店検索ができる", () => {
    render(<BranchManagementPage />);

    fireEvent.change(
      screen.getByPlaceholderText("支店コード/支店名/住所/電話番号で検索"),
      { target: { value: "大阪" } },
    );

    expect(screen.getByText("大阪支店")).toBeTruthy();
    expect(screen.queryByText("東京支店")).toBeNull();
  });

  it("支店登録ができる", async () => {
    render(<BranchManagementPage />);

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
      expect(screen.getAllByText("[0000000001] 山田 太郎").length).toBeGreaterThan(1);
    });
  });
});

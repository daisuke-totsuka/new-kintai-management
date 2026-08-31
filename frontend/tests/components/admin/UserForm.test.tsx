import { beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import UserForm from "@/components/admin/UserForm";

describe("ユーザフォーム", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_API_URL;
    vi.unstubAllGlobals();
  });

  it("ユーザ登録タイトルが表示される", () => {
    render(<UserForm mode="create" />);

    expect(screen.getByText("ユーザ登録")).toBeTruthy();
  });

  it("氏名とメール未入力でエラーが表示される", async () => {
    render(<UserForm mode="create" initialValue={{ branchId: "B001" }} />);

    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByText("氏名は必須です")).toBeTruthy();
    expect(await screen.findByText("メールアドレスは必須です")).toBeTruthy();
  });

  it("不正なメールアドレスでエラーになる", async () => {
    render(<UserForm mode="create" />);

    fireEvent.change(screen.getByPlaceholderText("例）山田 太郎"), {
      target: { value: "山田太郎" },
    });

    fireEvent.change(screen.getByPlaceholderText("例）user@example.com"), {
      target: { value: "abc" },
    });

    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(
      await screen.findByText("メール形式が正しくありません"),
    ).toBeTruthy();
  });

  it("正常入力で保存処理が実行される", async () => {
    const alertMock = vi.spyOn(window, "alert").mockImplementation(() => {});

    render(<UserForm mode="create" initialValue={{ branchId: "B001" }} />);

    fireEvent.change(screen.getByPlaceholderText("例）山田 太郎"), {
      target: { value: "山田太郎" },
    });

    fireEvent.change(screen.getByPlaceholderText("例）user@example.com"), {
      target: { value: "test@example.com" },
    });

    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(alertMock).toHaveBeenCalled();
    });

    alertMock.mockRestore();
  });
});

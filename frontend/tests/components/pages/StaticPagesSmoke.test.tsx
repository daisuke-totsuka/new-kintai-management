import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import DashboardPage from "@/app/dashboard/ClientPage";
import LeaderPage from "@/app/leader/ClientPage";
import AttendanceSettingsPage from "@/app/AttendanceSettings/ClientPage";
import ExpenseClaimsPage from "@/app/ExpenseClaims/ClientPage";
import BusinessBillDetailsPage from "@/app/BusinessBillDetails/ClientPage";
import LoginPage from "@/app/page";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

describe("静的画面スモーク", () => {
  beforeEach(() => {
    pushMock.mockClear();
    process.env.NEXT_PUBLIC_API_URL = "http://api.example.test";
    vi.stubGlobal("fetch", authFetchMock());
    vi.stubGlobal("alert", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.NEXT_PUBLIC_API_URL;
  });

  it("確定画面で年度行と状態切替を表示する", async () => {
    const { container } = render(<DashboardPage />);

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(container.querySelectorAll("tbody tr")).toHaveLength(12);

    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(20);
    const firstStatusText = buttons[1].textContent;
    fireEvent.click(buttons[1]);
    expect(buttons[1].textContent).not.toBe(firstStatusText);
  });

  it("提出状況で年月選択と部下一覧を表示する", async () => {
    const { container } = render(<LeaderPage />);

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.getAllByRole("combobox")).toHaveLength(2);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(3);
    expect(screen.getByText("uuid-1")).toBeTruthy();
  });

  it("年度設定で数値入力とカレンダー入力の変更状態を管理する", async () => {
    const { container } = render(<AttendanceSettingsPage />);

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const saveButton = screen.getAllByRole("button")[0] as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);

    const firstNumericInput = container.querySelector(
      'input[inputmode="numeric"]',
    ) as HTMLInputElement;
    fireEvent.change(firstNumericInput, { target: { value: "123" } });
    expect(saveButton.disabled).toBe(false);

    fireEvent.click(saveButton);
    await waitFor(() => expect(saveButton.disabled).toBe(true));

    const dayButton = container.querySelector(".cell.day") as HTMLButtonElement;
    fireEvent.click(dayButton);
    expect(saveButton.disabled).toBe(false);
  });

  it("経費請求で最小行数を維持して行追加と削除ができる", async () => {
    const { container } = render(<ExpenseClaimsPage />);

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(container.querySelectorAll("tbody tr")).toHaveLength(5);

    const buttons = screen.getAllByRole("button");
    const addButton = buttons[0];
    const deleteButton = buttons[1] as HTMLButtonElement;
    expect(deleteButton.disabled).toBe(true);

    fireEvent.click(addButton);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(6);
    expect(deleteButton.disabled).toBe(false);

    fireEvent.click(deleteButton);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(5);
  });

  it("業務請求明細で金額合計と行追加削除ができる", async () => {
    const { container } = render(<BusinessBillDetailsPage />);

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(container.querySelectorAll("tbody tr")).toHaveLength(5);

    const buttons = screen.getAllByRole("button");
    const addButton = buttons[0];
    const deleteButton = buttons[1] as HTMLButtonElement;
    expect(deleteButton.disabled).toBe(true);

    fireEvent.click(addButton);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(6);
    expect(deleteButton.disabled).toBe(false);

    const numericInputs = container.querySelectorAll(
      'input[inputmode="numeric"]',
    );
    fireEvent.change(numericInputs[0], { target: { value: "1000" } });
    fireEvent.change(numericInputs[1], { target: { value: "2000" } });
    const rowTotals = container.querySelectorAll(
      "input[readonly]",
    ) as NodeListOf<HTMLInputElement>;
    expect(rowTotals[0].value).toBe("3,000");
  });

  it("ログインで認証情報を送信し成功時に勤務実績へ遷移する", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ success: true }));
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<LoginPage />);
    const email = container.querySelector('input[type="email"]') as HTMLInputElement;
    const password = container.querySelector(
      'input[type="password"]',
    ) as HTMLInputElement;

    fireEvent.change(email, { target: { value: "user@example.com" } });
    fireEvent.change(password, { target: { value: "secret" } });
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "http://api.example.test/login",
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          body: JSON.stringify({
            email: "user@example.com",
            password: "secret",
          }),
        }),
      );
      expect(pushMock).toHaveBeenCalledWith("/attendance");
    });
  });
});

function authFetchMock() {
  return vi.fn(async () => jsonResponse({ authenticated: true }));
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

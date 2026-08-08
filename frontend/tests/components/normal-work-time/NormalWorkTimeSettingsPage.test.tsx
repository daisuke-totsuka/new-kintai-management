import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import NormalWorkTimeSettingsPage from "@/app/NormalWorkTimeSettings/ClientPage";

const pushMock = vi.fn();
const scrollIntoViewMock = vi.fn();

type NormalWorkTimeDto = {
  id?: string | null;
  userId?: string | null;
  effectiveFromDay: number;
  effectiveToDay: number;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  updatedAt?: string | null;
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

describe("通常勤務時間設定画面", () => {
  beforeEach(() => {
    pushMock.mockClear();
    scrollIntoViewMock.mockClear();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoViewMock,
    });
    process.env.NEXT_PUBLIC_API_URL = "http://api.example.test";
  });

  it("初期表示で通常勤務時間設定を取得して一覧表示する", async () => {
    vi.stubGlobal("fetch", createFetchMock());

    render(<NormalWorkTimeSettingsPage />);

    expect(await screen.findByDisplayValue("1")).toBeTruthy();
    expect(screen.getByDisplayValue("15")).toBeTruthy();
    expect(screen.getByDisplayValue("09:00")).toBeTruthy();
    expect(screen.getAllByText("2026-07-01T00:00:00+00:00")).toHaveLength(2);
  });

  it("API取得結果を適用開始日の昇順で表示する", async () => {
    vi.stubGlobal(
      "fetch",
      createFetchMock({
        normalWorkTime: [
          setting({ id: "n2", effectiveFromDay: 16 }),
          setting({ id: "n1", effectiveFromDay: 1, effectiveToDay: 15 }),
        ],
      }),
    );

    render(<NormalWorkTimeSettingsPage />);

    const startDays = await screen.findAllByLabelText(/適用開始日/);
    expect(startDays.map((input) => (input as HTMLInputElement).value)).toEqual([
      "1",
      "16",
    ]);
  });

  it("行追加で新規行を表示する", async () => {
    vi.stubGlobal("fetch", createFetchMock({ normalWorkTime: [] }));

    render(<NormalWorkTimeSettingsPage />);

    await screen.findByText("未登録");
    fireEvent.click(screen.getByRole("button", { name: "新規追加" }));

    expect(screen.getByLabelText("1行目 適用開始日")).toHaveProperty("value", "1");
    expect(screen.getByLabelText("1行目 通常出勤時刻")).toHaveProperty("value", "09:00");
  });

  it("行編集で入力値を変更できる", async () => {
    vi.stubGlobal("fetch", createFetchMock());

    render(<NormalWorkTimeSettingsPage />);

    const startTime = await screen.findByLabelText("1行目 通常出勤時刻");
    fireEvent.change(startTime, { target: { value: "08:30" } });

    expect(startTime).toHaveProperty("value", "08:30");
  });

  it("保存でPUT payloadをcamelCaseで送信する", async () => {
    let savedPayload: any = null;
    vi.stubGlobal(
      "fetch",
      createFetchMock({
        onSave(payload) {
          savedPayload = payload;
        },
      }),
    );

    render(<NormalWorkTimeSettingsPage />);

    fireEvent.change(await screen.findByLabelText("1行目 通常出勤時刻"), {
      target: { value: "08:30" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(savedPayload).toMatchObject({
        userId: "0000000001",
        normalWorkTime: [
          {
            id: "n1",
            effectiveFromDay: 1,
            effectiveToDay: 15,
            startTime: "08:30",
            endTime: "18:00",
            breakMinutes: 60,
          },
          {
            id: "n2",
            effectiveFromDay: 16,
            effectiveToDay: 31,
          },
        ],
      });
    });
  });

  it("削除確認でDELETE APIを呼び、成功メッセージを表示する", async () => {
    const confirmMock = vi.spyOn(window, "confirm").mockReturnValue(true);
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      createFetchMock({
        onRequest(url, init) {
          if (init?.method === "DELETE") calls.push(url);
        },
      }),
    );

    render(<NormalWorkTimeSettingsPage />);

    await screen.findByLabelText("1行目 適用開始日");
    fireEvent.click(screen.getAllByRole("button", { name: "削除" })[0]);

    await waitFor(() => {
      expect(confirmMock).toHaveBeenCalledWith(
        "この通常勤務時間設定を削除します。よろしいですか？",
      );
      expect(calls).toEqual([
        "http://api.example.test/api/attendance/normal-work-time/n1",
      ]);
      expect(screen.getByText("通常勤務時間設定を削除しました。")).toBeTruthy();
    });
    confirmMock.mockRestore();
  });

  it("入力エラーを詳細表示し、エラー領域へスクロールする", async () => {
    let savedPayload: any = null;
    vi.stubGlobal(
      "fetch",
      createFetchMock({
        normalWorkTime: [setting({ id: "n1", effectiveToDay: 31 })],
        onSave(payload) {
          savedPayload = payload;
        },
      }),
    );

    render(<NormalWorkTimeSettingsPage />);

    fireEvent.change(await screen.findByLabelText("1行目 休憩時間"), {
      target: { value: "-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain(
        "1行目 休憩時間：0以上で入力してください。",
      );
      expect(scrollIntoViewMock).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "start",
      });
    });
    expect(savedPayload).toBeNull();
  });

  it("重複エラーを適用期間の詳細エラーとして表示する", async () => {
    vi.stubGlobal("fetch", createFetchMock());

    render(<NormalWorkTimeSettingsPage />);

    fireEvent.change(await screen.findByLabelText("2行目 適用開始日"), {
      target: { value: "10" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain(
        "2行目 適用期間：既存の設定と重複しています。",
      );
    });
  });

  it("保存成功メッセージを表示する", async () => {
    vi.stubGlobal("fetch", createFetchMock());

    render(<NormalWorkTimeSettingsPage />);

    await screen.findByLabelText("1行目 適用開始日");
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(screen.getByText("通常勤務時間を保存しました。")).toBeTruthy();
    });
  });

  it("Backend重複エラーをエラー一覧へ表示する", async () => {
    vi.stubGlobal(
      "fetch",
      createFetchMock({
        saveStatus: 400,
        saveBody: {
          success: false,
          validationResults: [
            {
              rowNo: 1,
              field: "effectivePeriod",
              message:
                "通常勤務時間の適用期間が既存の設定と重複しています。期間を確認してください。",
            },
          ],
        },
      }),
    );

    render(<NormalWorkTimeSettingsPage />);

    fireEvent.change(await screen.findByLabelText("1行目 通常出勤時刻"), {
      target: { value: "08:45" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain(
        "1行目 適用期間：通常勤務時間の適用期間が既存の設定と重複しています。期間を確認してください。",
      );
    });
  });
});

function createFetchMock(options?: {
  normalWorkTime?: any[];
  saveStatus?: number;
  saveBody?: any;
  onSave?: (payload: any) => void;
  onRequest?: (url: string, init?: RequestInit) => void;
}) {
  let normalWorkTime = options?.normalWorkTime ?? [
    setting({ id: "n1", effectiveFromDay: 1, effectiveToDay: 15 }),
    setting({
      id: "n2",
      effectiveFromDay: 16,
      effectiveToDay: 31,
      startTime: "08:30",
      endTime: "17:30",
    }),
  ];

  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    options?.onRequest?.(url, init);

    if (url.endsWith("/auth/me")) {
      return jsonResponse({
        authenticated: true,
        user: { user_id: "0000000001", employee_id: "U001" },
      });
    }

    if (url.includes("/api/attendance/normal-work-time") && init?.method === "PUT") {
      const payload = JSON.parse(String(init.body));
      options?.onSave?.(payload);
      if (options?.saveStatus && options.saveStatus >= 400) {
        return jsonResponse(options.saveBody ?? {}, options.saveStatus);
      }
      normalWorkTime = payload.normalWorkTime.map((row: any, index: number) => ({
        ...row,
        id: row.id ?? `n${index + 1}`,
        updatedAt: "saved-at",
      }));
      return jsonResponse({
        success: true,
        message: "通常勤務時間を保存しました。",
        normalWorkTime,
      });
    }

    if (url.includes("/api/attendance/normal-work-time") && init?.method === "DELETE") {
      const id = decodeURIComponent(url.split("/").pop() ?? "");
      normalWorkTime = normalWorkTime.filter((row) => row.id !== id);
      return jsonResponse({
        success: true,
        message: "通常勤務時間設定を削除しました。",
        normalWorkTime,
      });
    }

    if (url.includes("/api/attendance/normal-work-time")) {
      return jsonResponse({ success: true, normalWorkTime });
    }

    return jsonResponse({ success: true });
  });
}

function setting(overrides?: Partial<NormalWorkTimeDto>) {
  return {
    id: "n1",
    userId: "0000000001",
    effectiveFromDay: 1,
    effectiveToDay: 31,
    startTime: "09:00",
    endTime: "18:00",
    breakMinutes: 60,
    updatedAt: "2026-07-01T00:00:00+00:00",
    ...overrides,
  };
}

function jsonResponse(body: any, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
    json: () => Promise.resolve(body),
  });
}

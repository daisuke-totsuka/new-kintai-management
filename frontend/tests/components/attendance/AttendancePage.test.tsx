import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AttendancePage from "@/app/attendance/ClientPage";

const pushMock = vi.fn();
const scrollIntoViewMock = vi.fn();
let consoleErrorMock: ReturnType<typeof vi.spyOn>;
const originalNodeEnv = process.env.NODE_ENV;
const workTypeFixtures = [
  { code: "HOLIDAY_WORK", displayName: "休出" },
  { code: "PAID_LEAVE", displayName: "有休" },
  { code: "AM_LEAVE", displayName: "前休" },
  { code: "PM_LEAVE", displayName: "後休" },
  { code: "SPECIAL_LEAVE", displayName: "特休" },
  { code: "COMP_LEAVE", displayName: "振休" },
  { code: "COMP_PLAN", displayName: "振予" },
  { code: "ABSENCE", displayName: "欠勤" },
  { code: "LATE", displayName: "遅刻" },
  { code: "EARLY", displayName: "早退" },
  { code: "DELAY", displayName: "遅延" },
  { code: "SHIFT", displayName: "ｼﾌﾄ" },
  { code: "SUSPENSION", displayName: "休業" },
];

type SaveApiFailure =
  | { kind: "throw"; error: unknown }
  | { kind: "http"; status: number; body?: any };

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

describe("勤務実績画面", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-07-15T00:00:00+09:00"));
    pushMock.mockClear();
    scrollIntoViewMock.mockClear();
    consoleErrorMock = vi.spyOn(console, "error").mockImplementation(() => {});
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoViewMock,
    });
    Object.defineProperty(window, "scrollTo", {
      configurable: true,
      value: vi.fn(),
    });
    process.env.NEXT_PUBLIC_API_URL = "http://api.example.test";
  });

  afterEach(() => {
    vi.useRealTimers();
    consoleErrorMock.mockRestore();
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it("Backend算出の実働を表示し、入力変更だけではFrontend再計算しない", async () => {
    vi.stubGlobal("fetch", createFetchMock());

    render(<AttendancePage />);

    await waitFor(() => {
      expect(screen.getAllByText("8:00").length).toBeGreaterThan(0);
    });

    fireEvent.change(screen.getByLabelText("2026-07-01 始業"), {
      target: { value: "10:00" },
    });

    expect(screen.getAllByText("8:00").length).toBeGreaterThan(0);
  });

  it("エラーがない場合はエラー表示領域を表示しない", async () => {
    vi.stubGlobal("fetch", createFetchMock());

    render(<AttendancePage />);

    await screen.findByLabelText("2026-07-01 作業内容");

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("勤務区分プルダウンにAPIの表示名13件を表示する", async () => {
    vi.stubGlobal("fetch", createFetchMock());

    render(<AttendancePage />);

    const select = await screen.findByLabelText("2026-07-01 勤務区分") as HTMLSelectElement;
    const options = Array.from(select.options).slice(1);

    expect(options).toHaveLength(13);
    expect(options.map((option) => option.value)).toEqual(
      workTypeFixtures.map((workType) => workType.code),
    );
    expect(options.map((option) => option.textContent)).toEqual(
      workTypeFixtures.map((workType) => workType.displayName),
    );
  });

  it("保存時はdirtyRowsのみ送信し、保存成功後dirty表示を解除する", async () => {
    let savedPayload: any = null;
    vi.stubGlobal(
      "fetch",
      createFetchMock({
        onSave(payload) {
          savedPayload = payload;
        },
      }),
    );

    render(<AttendancePage />);

    const content = await screen.findByLabelText("2026-07-01 作業内容");
    fireEvent.change(content, {
      target: { value: "変更後作業" },
    });
    expect(content.className).toContain("cell-dirty");

    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(savedPayload?.changedRows).toHaveLength(1);
    });
    expect(savedPayload.changedRows[0]).toMatchObject({
      attendanceDay: 1,
      workDescription: "変更後作業",
    });
    await waitFor(() => {
      expect(
        screen.getByLabelText("2026-07-01 作業内容").className,
      ).not.toContain("cell-dirty");
    });
  });

  it("dirty状態の月変更は確認ダイアログを表示し、キャンセルで切替しない", async () => {
    vi.stubGlobal("fetch", createFetchMock());

    render(<AttendancePage />);

    await screen.findByLabelText("2026-07-01 作業内容");
    fireEvent.change(screen.getByLabelText("2026-07-01 作業内容"), {
      target: { value: "未保存" },
    });
    fireEvent.change(screen.getByLabelText("対象年月"), {
      target: { value: "2026-08" },
    });

    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByLabelText("対象年月")).toHaveProperty(
      "value",
      "2026-07",
    );
  });

  it("dirty状態の提出は保存成功後に提出APIを呼ぶ", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      createFetchMock({
        onRequest(url, init) {
          if (init?.method === "POST") calls.push(url);
        },
      }),
    );

    render(<AttendancePage />);

    await screen.findByLabelText("2026-07-01 作業内容");
    fireEvent.change(screen.getByLabelText("2026-07-01 作業内容"), {
      target: { value: "提出前保存" },
    });
    fireEvent.click(screen.getByRole("button", { name: "提出" }));

    await waitFor(() => {
      expect(calls).toEqual([
        "http://api.example.test/api/attendance/monthly",
        "http://api.example.test/api/attendance/monthly/submit",
      ]);
    });
  });

  it("排他エラーの差分セルを黄色表示対象にする", async () => {
    vi.stubGlobal("fetch", createFetchMock({ conflictOnSave: true }));

    render(<AttendancePage />);

    const start = await screen.findByLabelText("2026-07-01 始業");
    fireEvent.change(start, {
      target: { value: "10:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(screen.getByLabelText("2026-07-01 始業").className).toContain(
        "cell-conflict",
      );
    });
  });

  it("保存APIの400はBackend入力チェックエラーを赤色領域に表示する", async () => {
    vi.stubGlobal(
      "fetch",
      createFetchMock({
        saveError: {
          kind: "http",
          status: 400,
          body: {
            validationResults: [
              {
                attendanceDay: 3,
                field: "startTime",
                message: "必須です。",
              },
            ],
          },
        },
      }),
    );

    render(<AttendancePage />);

    await editFirstRowContent();
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expectRedErrorMessage("7月3日 出勤時刻：必須です。");
      expect(screen.getByRole("heading", { name: "入力エラーがあります（1件）" })).toBeTruthy();
      expect(scrolledToErrorSummary()).toBe(true);
    });
    expectSaveApiErrorLog(400, { validationResults: expect.any(Array) });
  });

  it.each([
    {
      name: "ネットワークエラー",
      saveError: () => ({
        kind: "throw" as const,
        error: new TypeError("Failed to fetch"),
      }),
      expectedMessages: [
        "サーバーへ接続できませんでした。",
        "ネットワーク接続を確認して、再度お試しください。",
      ],
      hiddenMessages: ["Failed to fetch"],
      expectedStatus: null,
    },
    {
      name: "HTTP 401",
      saveError: () => ({
        kind: "http" as const,
        status: 401,
        body: { error: "token expired" },
      }),
      expectedMessages: [
        "ログインの有効期限が切れました。",
        "再度ログインしてください。",
      ],
      hiddenMessages: ["token expired"],
      expectedStatus: 401,
    },
    {
      name: "HTTP 403",
      saveError: () => ({
        kind: "http" as const,
        status: 403,
        body: { error: "forbidden" },
      }),
      expectedMessages: ["この操作を実行する権限がありません。"],
      hiddenMessages: ["forbidden"],
      expectedStatus: 403,
    },
    {
      name: "HTTP 404",
      saveError: () => ({
        kind: "http" as const,
        status: 404,
        body: { error: "not found" },
      }),
      expectedMessages: ["保存先が見つかりません。"],
      hiddenMessages: ["not found"],
      expectedStatus: 404,
    },
    {
      name: "HTTP 500",
      saveError: () => ({
        kind: "http" as const,
        status: 500,
        body: { error: "database error" },
      }),
      expectedMessages: [
        "サーバーでエラーが発生しました。",
        "しばらくしてから再度お試しください。",
        "（HTTP 500）",
      ],
      hiddenMessages: ["database error"],
      expectedStatus: 500,
    },
    {
      name: "タイムアウト",
      saveError: () => ({ kind: "throw" as const, error: timeoutError() }),
      expectedMessages: [
        "サーバーへ接続できませんでした。",
        "ネットワーク接続を確認して、再度お試しください。",
      ],
      hiddenMessages: ["The operation was aborted."],
      expectedStatus: null,
    },
    {
      name: "その他例外",
      saveError: () => ({
        kind: "throw" as const,
        error: new Error("unexpected save failure"),
      }),
      expectedMessages: ["保存に失敗しました。"],
      hiddenMessages: ["unexpected save failure"],
      expectedStatus: null,
    },
  ])(
    "保存APIの$nameは利用者向けメッセージだけを赤色領域に表示する",
    async ({ saveError, expectedMessages, hiddenMessages, expectedStatus }) => {
      vi.stubGlobal("fetch", createFetchMock({ saveError: saveError() }));

      render(<AttendancePage />);

      await editFirstRowContent();
      fireEvent.click(screen.getByRole("button", { name: "保存" }));

      await waitFor(() => {
        for (const message of expectedMessages) {
          expectRedErrorMessage(message);
        }
        for (const message of hiddenMessages) {
          expect(screen.queryByText(message, { exact: false })).toBeNull();
        }
        expect(screen.getByRole("heading", { name: "エラーがあります（1件）" })).toBeTruthy();
        expect(scrolledToErrorSummary()).toBe(true);
      });
      expectSaveApiErrorLog(expectedStatus);
    },
  );

  it("保存APIの500 detailは開発環境のみ赤色領域に表示する", async () => {
    process.env.NODE_ENV = "development";
    vi.stubGlobal(
      "fetch",
      createFetchMock({
        saveError: {
          kind: "http",
          status: 500,
          body: {
            message: "保存処理でエラーが発生しました。",
            detail: "value too long for type character varying(20)",
          },
        },
      }),
    );

    render(<AttendancePage />);

    await editFirstRowContent();
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expectRedErrorMessage("サーバーでエラーが発生しました。");
      expectRedErrorMessage("value too long for type character varying(20)");
    });
  });

  it("保存APIの500 detailは本番環境では表示しない", async () => {
    process.env.NODE_ENV = "production";
    vi.stubGlobal(
      "fetch",
      createFetchMock({
        saveError: {
          kind: "http",
          status: 500,
          body: {
            message: "保存処理でエラーが発生しました。",
            detail: "value too long for type character varying(20)",
          },
        },
      }),
    );

    render(<AttendancePage />);

    await editFirstRowContent();
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expectRedErrorMessage("サーバーでエラーが発生しました。");
      expect(screen.queryByText("value too long", { exact: false })).toBeNull();
    });
  });

  it("提出エラー時はBackendの検証結果を一覧とセル強調に反映する", async () => {
    vi.stubGlobal("fetch", createFetchMock({
      validationResultsOnSubmit: [
        {
          code: "E006",
          severity: "error",
          attendanceDay: 1,
          field: "workDescription",
          message: "必須です。",
        },
      ],
    }));

    render(<AttendancePage />);

    const content = await screen.findByLabelText("2026-07-01 作業内容");
    fireEvent.click(screen.getByRole("button", { name: "提出" }));

    await waitFor(() => {
      expect(screen.getByText("7月1日 備考：必須です。")).toBeTruthy();
      expect(content.className).toContain("error");
      expect(screen.getByRole("alert").className).toContain("attendance-error-summary");
      expect(screen.queryByRole("status")).toBeNull();
      expect(scrollIntoViewMock).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "start",
      });
      expect(scrolledToErrorSummary()).toBe(true);
    });
  });

  it("排他エラー後は最新updatedAtをbaseUpdatedAtにして再保存できる", async () => {
    const savedPayloads: any[] = [];
    vi.stubGlobal(
      "fetch",
      createFetchMock({
        conflictOnSave: "once",
        onSave(payload) {
          savedPayloads.push(payload);
        },
      }),
    );

    render(<AttendancePage />);

    const start = await screen.findByLabelText("2026-07-01 始業");
    fireEvent.change(start, {
      target: { value: "10:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(start.className).toContain("cell-conflict");
    });

    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(savedPayloads).toHaveLength(2);
    });
    expect(savedPayloads[1].baseUpdatedAt).toBe("latest-at");
  });

  it("遅刻早退時間が範囲外の場合は保存前にエラーにする", async () => {
    let savedPayload: any = null;
    vi.stubGlobal(
      "fetch",
      createFetchMock({
        onSave(payload) {
          savedPayload = payload;
        },
      }),
    );

    render(<AttendancePage />);

    const lateEarly = await screen.findByLabelText("2026-07-01 遅刻早退時間");
    fireEvent.change(lateEarly, {
      target: { value: "1000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(
        screen.getByText("7月1日 遅刻早退時間：0以上999.5以下、30分単位で入力してください。"),
      ).toBeTruthy();
      expect(screen.getByRole("alert").className).toContain("attendance-error-summary");
      expect(screen.queryByRole("status")).toBeNull();
      expect(scrollIntoViewMock).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "start",
      });
      expect(scrolledToErrorSummary()).toBe(true);
    });
    expect(savedPayload).toBeNull();
  });

  it("退勤時刻が出勤時刻より前の場合は詳細エラーを表示する", async () => {
    let savedPayload: any = null;
    vi.stubGlobal(
      "fetch",
      createFetchMock({
        onSave(payload) {
          savedPayload = payload;
        },
      }),
    );

    render(<AttendancePage />);

    fireEvent.change(await screen.findByLabelText("2026-07-01 始業"), {
      target: { value: "18:00" },
    });
    fireEvent.change(screen.getByLabelText("2026-07-01 終業"), {
      target: { value: "09:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(screen.getByText("7月1日 退勤時刻：出勤時刻より前です。")).toBeTruthy();
      expect(screen.getByRole("alert").className).toContain("attendance-error-summary");
      expect(screen.queryByRole("status")).toBeNull();
    });
    expect(savedPayload).toBeNull();
  });

  it("複数行エラーと同一行複数エラーを全件表示する", async () => {
    vi.stubGlobal(
      "fetch",
      createFetchMock({
        validationResultsOnSubmit: [
          {
            attendanceDay: 3,
            field: "startTime",
            message: "必須です。",
          },
          {
            attendanceDay: 3,
            field: "endTime",
            message: "必須です。",
          },
          {
            attendanceDay: 5,
            field: "workTypeCode",
            message: "選択してください。",
          },
        ],
      }),
    );

    render(<AttendancePage />);

    await screen.findByLabelText("2026-07-01 作業内容");
    fireEvent.click(screen.getByRole("button", { name: "提出" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "入力エラーがあります（3件）" })).toBeTruthy();
      expect(screen.getByText("7月3日 出勤時刻：必須です。")).toBeTruthy();
      expect(screen.getByText("7月3日 退勤時刻：必須です。")).toBeTruthy();
      expect(screen.getByText("7月5日 勤務区分：選択してください。")).toBeTruthy();
      expect(screen.getByRole("alert").className).toContain("attendance-error-summary");
      expect(screen.queryByRole("status")).toBeNull();
    });
  });

  it("20件以上のエラーを赤色一覧内に全件表示する", async () => {
    const validationResults = Array.from({ length: 22 }, (_, index) => ({
      attendanceDay: index + 1,
      field: index % 2 === 0 ? "startTime" : "endTime",
      message: "必須です。",
    }));
    vi.stubGlobal("fetch", createFetchMock({ validationResultsOnSubmit: validationResults }));

    render(<AttendancePage />);

    await screen.findByLabelText("2026-07-01 作業内容");
    fireEvent.click(screen.getByRole("button", { name: "提出" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "入力エラーがあります（22件）" })).toBeTruthy();
      expect(screen.getByText("7月1日 出勤時刻：必須です。")).toBeTruthy();
      expect(screen.getByText("7月22日 退勤時刻：必須です。")).toBeTruthy();
      expect(screen.getByRole("alert").querySelector(".attendance-error-list")).toBeTruthy();
      expect(screen.queryByRole("status")).toBeNull();
    });
  });

  it("重複メッセージは1件にまとめて表示する", async () => {
    vi.stubGlobal(
      "fetch",
      createFetchMock({
        validationResultsOnSubmit: [
          { attendanceDay: 3, field: "startTime", message: "必須です。" },
          { attendanceDay: 3, field: "startTime", message: "必須です。" },
        ],
      }),
    );

    render(<AttendancePage />);

    await screen.findByLabelText("2026-07-01 作業内容");
    fireEvent.click(screen.getByRole("button", { name: "提出" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "入力エラーがあります（1件）" })).toBeTruthy();
      expect(screen.getAllByText("7月3日 出勤時刻：必須です。")).toHaveLength(1);
    });
  });

  it("画面最下部から保存しても赤色エラー一覧の先頭へスクロールする", async () => {
    vi.stubGlobal("fetch", createFetchMock());
    window.scrollTo(0, 99999);

    render(<AttendancePage />);

    const lateEarly = await screen.findByLabelText("2026-07-01 遅刻早退時間");
    fireEvent.change(lateEarly, {
      target: { value: "1000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(scrolledToErrorSummary()).toBe(true);
      expect(scrollIntoViewMock).toHaveBeenCalledWith({
        behavior: "smooth",
        block: "start",
      });
    });
  });

  it("エラー一覧領域だけがスクロールするCSSを持つ", () => {
    const css = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");

    expect(css).toContain(".attendance-error-list");
    expect(css).toContain("max-height: min(42vh, 360px);");
    expect(css).toContain("overflow-y: auto;");
    expect(css).toContain("scroll-margin-top: calc(var(--app-header-height) + 72px);");
  });

  it("draft以外の状態では入力不可として表示する", async () => {
    vi.stubGlobal("fetch", createFetchMock({ status: "submitted" }));

    render(<AttendancePage />);

    const content = await screen.findByLabelText("2026-07-01 作業内容");

    expect(content).toHaveProperty("disabled", true);
    expect(content.className).toContain("cell-disabled");
    expect(screen.queryByRole("button", { name: "保存" })).toBeNull();
    expect(screen.getByRole("button", { name: "編集再開" })).toBeTruthy();
  });
});

function scrolledToErrorSummary() {
  return scrollIntoViewMock.mock.contexts.some((context) =>
    context instanceof HTMLElement &&
    context.classList.contains("attendance-error-summary"),
  );
}

async function editFirstRowContent(value = "保存エラー確認") {
  const content = await screen.findByLabelText("2026-07-01 作業内容");
  fireEvent.change(content, {
    target: { value },
  });
}

function expectRedErrorMessage(message: string) {
  const alert = screen.getByRole("alert");
  expect(alert.className).toContain("attendance-error-summary");
  expect(alert.textContent).toContain(message);
  expect(screen.queryByRole("status")).toBeNull();
}

function expectSaveApiErrorLog(
  httpStatus: number | null,
  responseBody?: unknown,
) {
  expect(consoleErrorMock).toHaveBeenCalledWith(
    "Attendance save API error",
    expect.objectContaining({
      error: expect.anything(),
      httpStatus,
      responseBody: responseBody ?? (httpStatus === null ? null : expect.anything()),
      apiUrl: "http://api.example.test/api/attendance/monthly",
    }),
  );
}

function timeoutError() {
  const error = new Error("The operation was aborted.");
  error.name = "AbortError";
  return error;
}

function createFetchMock(options?: {
  conflictOnSave?: boolean | "once";
  status?: "draft" | "validated" | "submitted" | "approved" | "confirmed";
  saveError?: SaveApiFailure;
  validationErrorOnSubmit?: boolean;
  validationResultsOnSubmit?: any[];
  onSave?: (payload: any) => void;
  onRequest?: (url: string, init?: RequestInit) => void;
}) {
  let monthly = monthlyBody();
  if (options?.status) {
    monthly = {
      ...monthly,
      header: {
        ...monthly.header,
        status: options.status,
        printable: options.status !== "draft",
      },
    };
  }
  let conflictReturned = false;

  return vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    options?.onRequest?.(url, init);

    if (url.endsWith("/auth/me")) {
      return jsonResponse({
        authenticated: true,
        user: { user_id: "0000000001", employee_id: "U001", role_id: "USER" },
      });
    }

    if (url.includes("/api/attendance/work-types")) {
      return jsonResponse({
        success: true,
        workTypes: workTypeFixtures,
      });
    }

    if (url.includes("/api/attendance/monthly/submit")) {
      if (options?.validationResultsOnSubmit) {
        return jsonResponse(
          {
            ...monthly,
            success: false,
            errors: options.validationResultsOnSubmit,
            validationResults: options.validationResultsOnSubmit,
          },
          400,
        );
      }

      if (options?.validationErrorOnSubmit) {
        return jsonResponse(
          {
            ...monthly,
            success: false,
            validationResults: [
              {
                code: "E006",
                severity: "error",
                attendanceDay: 1,
                field: "workDescription",
                message: "1日の作業内容が未入力です。",
              },
            ],
          },
          400,
        );
      }

      monthly = {
        ...monthly,
        success: true,
        header: {
          ...monthly.header,
          status: "submitted",
          updatedAt: "submitted-at",
        },
      };
      return jsonResponse(monthly);
    }

    if (url.endsWith("/api/attendance/monthly") && init?.method === "POST") {
      const payload = JSON.parse(String(init.body));
      options?.onSave?.(payload);

      if (options?.saveError?.kind === "throw") {
        return Promise.reject(options.saveError.error);
      }

      if (options?.saveError?.kind === "http") {
        return jsonResponse(options.saveError.body ?? {}, options.saveError.status);
      }

      if (
        options?.conflictOnSave &&
        (options.conflictOnSave !== "once" || !conflictReturned)
      ) {
        conflictReturned = true;
        return jsonResponse(
          {
            success: false,
            error: "他の更新があります。最新内容を確認してください。",
            latestHeader: { ...monthly.header, updatedAt: "latest-at" },
            latestRows: monthly.rows,
            conflictCells: [
              {
                attendanceDay: 1,
                field: "startTime",
                latestValue: "09:00",
                submittedValue: "10:00",
              },
            ],
          },
          409,
        );
      }

      monthly = {
        ...monthly,
        header: { ...monthly.header, updatedAt: "saved-at" },
        rows: monthly.rows.map((row) => {
          const changed = payload.changedRows.find(
            (item: any) => item.attendanceDay === row.attendanceDay,
          );
          return changed ? { ...row, ...changed } : row;
        }),
      };
      return jsonResponse(monthly);
    }

    if (url.includes("/api/attendance/monthly")) {
      return jsonResponse(monthly);
    }

    return jsonResponse({ success: true });
  });
}

function jsonResponse(body: any, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

function monthlyBody() {
  return {
    success: true,
    header: {
      id: "h1",
      userId: "0000000001",
      employeeNo: "U001",
      employeeName: "山田 太郎",
      workplace: "東京本社",
      department: "一般ユーザ",
      targetYear: 2026,
      targetMonth: 7,
      status: "draft",
      completionLabel: null,
      printable: false,
      updatedAt: "base-at",
    },
    normalWorkTime: [
      {
        effectiveFromDay: 1,
        effectiveToDay: 31,
        startTime: "09:00",
        endTime: "18:00",
        breakMinutes: 60,
      },
    ],
    rows: [
      {
        id: "r1",
        attendanceDay: 1,
        dayOfWeek: "水",
        holidayFlag: 0,
        startTime: "09:00",
        endTime: "18:00",
        breakMinutes: "60",
        actualWorkMinutes: 480,
        workTypeCode: "",
        workDescription: "作業",
        lateEarlyMinutes: "",
        midnightMinutes: 0,
        warningFlag: false,
      },
      {
        id: "r2",
        attendanceDay: 2,
        dayOfWeek: "木",
        holidayFlag: 0,
        startTime: "",
        endTime: "",
        breakMinutes: "",
        actualWorkMinutes: null,
        workTypeCode: "",
        workDescription: "",
        lateEarlyMinutes: "",
        midnightMinutes: 0,
        warningFlag: false,
      },
    ],
    summary: {
      totalWorkDays: 1,
      normalWorkDays: 1,
      holidayWorkDays: 0,
      absenceDays: 0,
      paidLeaveDays: 0,
      totalActualWorkMinutes: 480,
      lateEarlyMinutes: 0,
      midnightMinutes: 0,
    },
    validationResults: [],
  };
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

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

type NormalWorkTimeResponse = {
  success: boolean;
  normalWorkTime: NormalWorkTimeDto[];
  message?: string;
  validationResults?: ValidationResult[];
  errors?: ValidationResult[];
};

type DraftSetting = {
  clientId: string;
  id: string | null;
  userId?: string | null;
  effectiveFromDay: string;
  effectiveToDay: string;
  startTime: string;
  endTime: string;
  breakMinutes: string;
  updatedAt?: string | null;
};

type EditableField =
  | "effectiveFromDay"
  | "effectiveToDay"
  | "startTime"
  | "endTime"
  | "breakMinutes";

type ValidationResult = {
  code?: string;
  severity?: "error" | "warning";
  rowNo?: number | null;
  row_no?: number | null;
  field?: string | null;
  message: string;
};

type ApiRequestError = Error & {
  status?: number;
  body?: unknown;
  url?: string;
};

const FIELD_LABELS: Record<string, string> = {
  effectiveFromDay: "適用開始日",
  effectiveToDay: "適用終了日",
  effectivePeriod: "適用期間",
  startTime: "通常出勤時刻",
  endTime: "通常退勤時刻",
  breakMinutes: "休憩時間",
};

const FIELD_ALIASES: Record<string, string> = {
  effective_from_day: "effectiveFromDay",
  effective_to_day: "effectiveToDay",
  effective_period: "effectivePeriod",
  start_time: "startTime",
  end_time: "endTime",
  break_minutes: "breakMinutes",
};

const OVERLAP_MESSAGE = "既存の設定と重複しています。";
const DELETE_CONFIRM_MESSAGE =
  "この通常勤務時間設定を削除します。よろしいですか？";
const SAVE_SUCCESS_MESSAGE = "通常勤務時間を保存しました。";
const DELETE_SUCCESS_MESSAGE = "通常勤務時間設定を削除しました。";

let clientIdSeed = 0;

export default function ClientPage() {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const errorListRef = useRef<HTMLDivElement | null>(null);
  const pendingErrorScrollRef = useRef(false);

  const [userId, setUserId] = useState("");
  const [rows, setRows] = useState<DraftSetting[]>([]);
  const [validationResults, setValidationResults] = useState<
    ValidationResult[]
  >([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorScrollRequestId, setErrorScrollRequestId] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const me = await requestJson<{
          authenticated?: boolean;
          user?: { user_id?: string; userId?: string };
        }>("/auth/me");
        const currentUserId = me.user?.user_id ?? me.user?.userId ?? "";
        if (!currentUserId) {
          routerRef.current.push("/");
          return;
        }
        if (!mounted) return;

        setUserId(currentUserId);
        const body = await fetchNormalWorkTime(currentUserId);
        if (!mounted) return;

        setRows(dtoRowsToDraft(body.normalWorkTime ?? []));
      } catch (error) {
        setValidationResults([
          globalErrorResult(
            error instanceof Error
              ? error.message
              : "通常勤務時間の取得に失敗しました。",
          ),
        ]);
        pendingErrorScrollRef.current = true;
        setErrorScrollRequestId((current) => current + 1);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  const sortedRows = useMemo(() => sortDraftRows(rows), [rows]);
  const inputErrors = validationResults.filter(
    (result) => result.severity !== "warning",
  );

  useEffect(() => {
    if (!pendingErrorScrollRef.current || inputErrors.length === 0) return;
    pendingErrorScrollRef.current = false;
    errorListRef.current?.scrollIntoView?.({
      behavior: "smooth",
      block: "start",
    });
  }, [errorScrollRequestId, inputErrors.length]);

  function updateRow(
    clientId: string,
    field: EditableField,
    value: string,
  ) {
    setRows((current) =>
      current.map((row) =>
        row.clientId === clientId ? { ...row, [field]: value } : row,
      ),
    );
    setValidationResults((current) =>
      current.filter((result) => {
        const rowNo = resultRowNo(result);
        if (!rowNo) return true;
        const target = sortedRows[rowNo - 1];
        if (!target || target.clientId !== clientId) return true;
        return result.field !== field && result.field !== "effectivePeriod";
      }),
    );
    setMessage("");
  }

  function addRow() {
    setRows((current) => [...current, createDraftSetting()]);
    setMessage("");
  }

  async function saveRows() {
    if (!userId) return;
    const errors = validateRows(sortedRows);
    if (errors.length > 0) {
      showValidationResults(errors);
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const body = await requestJson<NormalWorkTimeResponse>(
        "/api/attendance/normal-work-time",
        {
          method: "PUT",
          body: JSON.stringify({
            userId,
            normalWorkTime: sortedRows.map(toPayloadRow),
          }),
        },
      );
      setRows(dtoRowsToDraft(body.normalWorkTime ?? []));
      setValidationResults([]);
      setMessage(body.message || SAVE_SUCCESS_MESSAGE);
    } catch (error) {
      showValidationResults(apiFailureResults(error));
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow(row: DraftSetting) {
    if (!row.id) {
      setRows((current) =>
        current.filter((item) => item.clientId !== row.clientId),
      );
      setMessage("");
      return;
    }

    if (!window.confirm(DELETE_CONFIRM_MESSAGE)) return;

    setSaving(true);
    setMessage("");
    try {
      const body = await requestJson<NormalWorkTimeResponse>(
        `/api/attendance/normal-work-time/${encodeURIComponent(row.id)}`,
        { method: "DELETE" },
      );
      setRows(dtoRowsToDraft(body.normalWorkTime ?? []));
      setValidationResults([]);
      setMessage(body.message || DELETE_SUCCESS_MESSAGE);
    } catch (error) {
      showValidationResults(apiFailureResults(error));
    } finally {
      setSaving(false);
    }
  }

  function showValidationResults(results: ValidationResult[]) {
    const normalized = normalizeValidationResults(results);
    setValidationResults(normalized);
    setMessage("");
    if (normalized.some((result) => result.severity !== "warning")) {
      pendingErrorScrollRef.current = true;
      setErrorScrollRequestId((current) => current + 1);
    }
  }

  function focusValidationTarget(result: ValidationResult) {
    const rowNo = resultRowNo(result);
    if (!rowNo || !result.field) return;
    const row = sortedRows[rowNo - 1];
    if (!row) return;
    const targetField =
      result.field === "effectivePeriod" ? "effectiveFromDay" : result.field;
    const target = document.getElementById(
      inputId(row.clientId, targetField),
    ) as HTMLElement | null;
    target?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    target?.focus?.();
  }

  if (loading) {
    return (
      <div className="page-content">
        <main className="main">読み込み中...</main>
      </div>
    );
  }

  return (
    <div className="page-content normal-work-page">
      <div className="title-card page-header is-sticky normal-work-toolbar">
        <div>
          <h1 className="page-title">通常勤務時間設定</h1>
          <div className="normal-work-status">
            {message || `${sortedRows.length}件`}
          </div>
        </div>
        <div className="controls">
          <button
            className="btn"
            disabled={saving}
            type="button"
            onClick={addRow}
          >
            新規追加
          </button>
          <button
            className="btn btn-accent"
            disabled={saving}
            type="button"
            onClick={() => void saveRows()}
          >
            保存
          </button>
        </div>
      </div>

      <main className="main normal-work-main">
        {inputErrors.length > 0 && (
          <section
            className="normal-work-error-summary"
            ref={errorListRef}
            role="alert"
          >
            <h2 className="normal-work-section-title">
              入力エラーがあります（{inputErrors.length}件）
            </h2>
            <ul className="error-list normal-work-error-list">
              {inputErrors.map((result, index) => (
                <li key={validationKey(result, index)}>
                  <button
                    className="normal-work-error-link"
                    type="button"
                    onClick={() => focusValidationTarget(result)}
                  >
                    {validationLine(result)}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="normal-work-band">
          <div className="normal-work-table-wrap">
            <table className="table normal-work-table">
              <thead>
                <tr>
                  <th>適用開始日</th>
                  <th>適用終了日</th>
                  <th>通常出勤時刻</th>
                  <th>通常退勤時刻</th>
                  <th>休憩時間（分）</th>
                  <th>更新日時</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.length === 0 ? (
                  <tr>
                    <td className="muted center" colSpan={7}>
                      未登録
                    </td>
                  </tr>
                ) : (
                  sortedRows.map((row, index) => {
                    const rowNo = index + 1;
                    return (
                      <tr key={row.clientId}>
                        <td>
                          <div className="normal-work-input-unit">
                            <input
                              aria-label={`${rowNo}行目 適用開始日`}
                              className={inputClass(rowNo, "effectiveFromDay")}
                              id={inputId(row.clientId, "effectiveFromDay")}
                              max={31}
                              min={1}
                              type="number"
                              value={row.effectiveFromDay}
                              onChange={(event) =>
                                updateRow(
                                  row.clientId,
                                  "effectiveFromDay",
                                  event.target.value,
                                )
                              }
                            />
                            <span>日</span>
                          </div>
                        </td>
                        <td>
                          <div className="normal-work-input-unit">
                            <input
                              aria-label={`${rowNo}行目 適用終了日`}
                              className={inputClass(rowNo, "effectiveToDay")}
                              id={inputId(row.clientId, "effectiveToDay")}
                              max={31}
                              min={1}
                              type="number"
                              value={row.effectiveToDay}
                              onChange={(event) =>
                                updateRow(
                                  row.clientId,
                                  "effectiveToDay",
                                  event.target.value,
                                )
                              }
                            />
                            <span>日</span>
                          </div>
                        </td>
                        <td>
                          <input
                            aria-label={`${rowNo}行目 通常出勤時刻`}
                            className={inputClass(rowNo, "startTime")}
                            id={inputId(row.clientId, "startTime")}
                            type="time"
                            value={row.startTime}
                            onChange={(event) =>
                              updateRow(
                                row.clientId,
                                "startTime",
                                event.target.value,
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            aria-label={`${rowNo}行目 通常退勤時刻`}
                            className={inputClass(rowNo, "endTime")}
                            id={inputId(row.clientId, "endTime")}
                            type="time"
                            value={row.endTime}
                            onChange={(event) =>
                              updateRow(
                                row.clientId,
                                "endTime",
                                event.target.value,
                              )
                            }
                          />
                        </td>
                        <td>
                          <input
                            aria-label={`${rowNo}行目 休憩時間`}
                            className={inputClass(rowNo, "breakMinutes")}
                            id={inputId(row.clientId, "breakMinutes")}
                            min={0}
                            type="number"
                            value={row.breakMinutes}
                            onChange={(event) =>
                              updateRow(
                                row.clientId,
                                "breakMinutes",
                                event.target.value,
                              )
                            }
                          />
                        </td>
                        <td className="normal-work-updated">
                          {row.updatedAt || "--"}
                        </td>
                        <td>
                          <button
                            className="btn"
                            disabled={saving}
                            type="button"
                            onClick={() => void deleteRow(row)}
                          >
                            削除
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <style>{css}</style>
    </div>
  );

  function inputClass(rowNo: number, field: EditableField) {
    const hasError = validationResults.some((result) => {
      const resultField = result.field ?? "";
      return (
        resultRowNo(result) === rowNo &&
        (resultField === field ||
          (resultField === "effectivePeriod" &&
            (field === "effectiveFromDay" || field === "effectiveToDay")))
      );
    });
    return `cell-input${hasError ? " error" : ""}`;
  }
}

async function fetchNormalWorkTime(userId: string) {
  return requestJson<NormalWorkTimeResponse>(
    `/api/attendance/normal-work-time?userId=${encodeURIComponent(userId)}`,
  );
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${apiBaseUrl()}${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      credentials: "include",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch (error) {
    throw withApiUrl(error, url);
  }

  const body = await readResponseBody(response);
  if (!response.ok) {
    const error = new Error(apiErrorMessage(body, response.status)) as ApiRequestError;
    error.status = response.status;
    error.body = body;
    error.url = url;
    throw error;
  }
  return body as T;
}

function apiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL ?? "";
}

async function readResponseBody(response: Response) {
  if (typeof response.text === "function") {
    const text = await response.text().catch(() => "");
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return response.json().catch(() => null);
}

function apiErrorMessage(body: unknown, status: number) {
  if (body && typeof body === "object") {
    const error = (body as { error?: unknown; message?: unknown }).error;
    if (typeof error === "string" && error) return error;
    const message = (body as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return `API request failed (HTTP ${status})`;
}

function withApiUrl(error: unknown, url: string): ApiRequestError {
  if (error && typeof error === "object") {
    (error as ApiRequestError).url = url;
    return error as ApiRequestError;
  }
  const wrapped = new Error(String(error ?? "API request failed")) as ApiRequestError;
  wrapped.url = url;
  return wrapped;
}

function dtoRowsToDraft(items: NormalWorkTimeDto[]) {
  return sortDraftRows(
    items.map((item) => ({
      clientId: newClientId(),
      id: item.id ?? null,
      userId: item.userId ?? null,
      effectiveFromDay: String(item.effectiveFromDay ?? ""),
      effectiveToDay: String(item.effectiveToDay ?? ""),
      startTime: item.startTime ?? "",
      endTime: item.endTime ?? "",
      breakMinutes:
        item.breakMinutes === null || item.breakMinutes === undefined
          ? ""
          : String(item.breakMinutes),
      updatedAt: item.updatedAt ?? null,
    })),
  );
}

function createDraftSetting(): DraftSetting {
  return {
    clientId: newClientId(),
    id: null,
    effectiveFromDay: "1",
    effectiveToDay: "31",
    startTime: "09:00",
    endTime: "18:00",
    breakMinutes: "60",
    updatedAt: null,
  };
}

function newClientId() {
  clientIdSeed += 1;
  return `normal-work-${clientIdSeed}`;
}

function sortDraftRows(rows: DraftSetting[]) {
  return [...rows].sort((left, right) => {
    const leftDay = parseIntegerText(left.effectiveFromDay);
    const rightDay = parseIntegerText(right.effectiveFromDay);
    return (leftDay ?? 999) - (rightDay ?? 999);
  });
}

function validateRows(rows: DraftSetting[]): ValidationResult[] {
  const errors: ValidationResult[] = [];
  const validRanges: Array<{ rowNo: number; from: number; to: number }> = [];

  rows.forEach((row, index) => {
    const rowNo = index + 1;
    const fromDay = parseIntegerText(row.effectiveFromDay);
    const toDay = parseIntegerText(row.effectiveToDay);
    const breakMinutes = parseIntegerText(row.breakMinutes);
    const startMinutes = timeToMinutes(row.startTime);
    const endMinutes = timeToMinutes(row.endTime);

    if (row.effectiveFromDay.trim() === "") {
      errors.push(formatResult(rowNo, "effectiveFromDay", "必須です。"));
    } else if (fromDay === null || fromDay < 1 || fromDay > 31) {
      errors.push(formatResult(rowNo, "effectiveFromDay", "1～31で入力してください。"));
    }

    if (row.effectiveToDay.trim() === "") {
      errors.push(formatResult(rowNo, "effectiveToDay", "必須です。"));
    } else if (toDay === null || toDay < 1 || toDay > 31) {
      errors.push(formatResult(rowNo, "effectiveToDay", "1～31で入力してください。"));
    }

    if (fromDay !== null && toDay !== null && fromDay > toDay) {
      errors.push(
        formatResult(rowNo, "effectivePeriod", "適用開始日は適用終了日以前で入力してください。"),
      );
    }

    if (row.startTime.trim() === "") {
      errors.push(formatResult(rowNo, "startTime", "必須です。"));
    } else if (startMinutes === null) {
      errors.push(formatResult(rowNo, "startTime", "HH:mm形式で入力してください。"));
    }

    if (row.endTime.trim() === "") {
      errors.push(formatResult(rowNo, "endTime", "必須です。"));
    } else if (endMinutes === null) {
      errors.push(formatResult(rowNo, "endTime", "HH:mm形式で入力してください。"));
    }

    if (startMinutes !== null && endMinutes !== null && startMinutes >= endMinutes) {
      errors.push(formatResult(rowNo, "endTime", "通常出勤時刻より後にしてください。"));
    }

    if (row.breakMinutes.trim() === "") {
      errors.push(formatResult(rowNo, "breakMinutes", "必須です。"));
    } else if (breakMinutes === null || breakMinutes < 0) {
      errors.push(formatResult(rowNo, "breakMinutes", "0以上で入力してください。"));
    }

    if (
      fromDay !== null &&
      toDay !== null &&
      fromDay >= 1 &&
      fromDay <= 31 &&
      toDay >= 1 &&
      toDay <= 31 &&
      fromDay <= toDay
    ) {
      validRanges.push({ rowNo, from: fromDay, to: toDay });
    }
  });

  validRanges.forEach((left, leftIndex) => {
    validRanges.slice(leftIndex + 1).forEach((right) => {
      if (left.from <= right.to && left.to >= right.from) {
        errors.push(formatResult(right.rowNo, "effectivePeriod", OVERLAP_MESSAGE));
      }
    });
  });

  return dedupeValidationResults(errors);
}

function toPayloadRow(row: DraftSetting) {
  return {
    ...(row.id ? { id: row.id } : {}),
    userId: row.userId,
    effectiveFromDay: Number(row.effectiveFromDay),
    effectiveToDay: Number(row.effectiveToDay),
    startTime: row.startTime,
    endTime: row.endTime,
    breakMinutes: Number(row.breakMinutes),
  };
}

function parseIntegerText(value: string) {
  const text = value.trim();
  if (!/^[+-]?\d+$/.test(text)) return null;
  return Number(text);
}

function timeToMinutes(value: string) {
  const text = value.trim();
  if (!/^\d{2}:\d{2}$/.test(text)) return null;
  const [hour, minute] = text.split(":").map(Number);
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }
  return hour * 60 + minute;
}

function formatResult(rowNo: number, field: string, message: string): ValidationResult {
  return {
    code: `NORMAL_WORK_TIME_${field}`,
    severity: "error",
    rowNo,
    field,
    message,
  };
}

function apiFailureResults(error: unknown): ValidationResult[] {
  const body = (error as ApiRequestError | undefined)?.body;
  const validationResults = readValidationResults(body);
  if (validationResults.length > 0) return validationResults;

  const status = (error as ApiRequestError | undefined)?.status;
  if (status === 401) {
    return [globalErrorResult("ログインの有効期限が切れました。")];
  }
  if (status === 403) {
    return [globalErrorResult("この操作を実行する権限がありません。")];
  }
  if (status === 404) {
    return [globalErrorResult("対象の通常勤務時間設定が見つかりません。")];
  }
  if (status !== undefined && status >= 500) {
    return [globalErrorResult("サーバーでエラーが発生しました。")];
  }
  return [
    globalErrorResult(
      error instanceof Error ? error.message : "通常勤務時間の保存に失敗しました。",
    ),
  ];
}

function readValidationResults(body: unknown): ValidationResult[] {
  if (!body || typeof body !== "object") return [];
  const source = (body as { validationResults?: unknown; errors?: unknown }).validationResults ??
    (body as { errors?: unknown }).errors;
  if (!Array.isArray(source)) return [];
  return normalizeValidationResults(source as ValidationResult[]);
}

function normalizeValidationResults(results: ValidationResult[]) {
  return dedupeValidationResults(
    results.map((result) => {
      const field = result.field ? FIELD_ALIASES[result.field] ?? result.field : null;
      return {
        ...result,
        severity: result.severity ?? "error",
        rowNo: resultRowNo(result),
        field,
      };
    }),
  );
}

function dedupeValidationResults(results: ValidationResult[]) {
  const seen = new Set<string>();
  const deduped: ValidationResult[] = [];
  for (const result of results) {
    const key = [
      result.severity ?? "error",
      resultRowNo(result) ?? "",
      result.field ?? "",
      result.message,
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(result);
  }
  return deduped;
}

function validationLine(result: ValidationResult) {
  const row = resultRowNo(result) ? `${resultRowNo(result)}行目 ` : "";
  const field = result.field ? `${FIELD_LABELS[result.field] ?? result.field}：` : "";
  return `${row}${field}${result.message}`;
}

function validationKey(result: ValidationResult, index: number) {
  return `${result.code ?? "validation"}-${resultRowNo(result) ?? "global"}-${result.field ?? "field"}-${index}`;
}

function resultRowNo(result: ValidationResult) {
  const rowNo = result.rowNo ?? result.row_no;
  if (rowNo === null || rowNo === undefined) return null;
  const value = Number(rowNo);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function globalErrorResult(message: string): ValidationResult {
  return { severity: "error", message };
}

function inputId(clientId: string, field: string) {
  return `${clientId}-${field}`;
}

const css = `
  .normal-work-page {
    min-height: 100vh;
  }

  .normal-work-toolbar {
    padding: 10px 12px;
  }

  .normal-work-status {
    margin-top: 3px;
    color: var(--muted);
    font-size: 12px;
  }

  .normal-work-main {
    display: grid;
    gap: 14px;
  }

  .normal-work-band,
  .normal-work-error-summary {
    background: var(--panel);
    border: 1px solid var(--line);
    padding: 12px;
  }

  .normal-work-error-summary {
    border-color: #fecaca;
    background: #fef2f2;
    scroll-margin-top: calc(var(--app-header-height) + 72px);
  }

  .normal-work-section-title {
    margin: 0 0 10px 0;
    font-size: 16px;
  }

  .normal-work-error-list {
    max-height: min(42vh, 360px);
    overflow-y: auto;
    padding-right: 8px;
  }

  .normal-work-error-list li {
    color: var(--error);
  }

  .normal-work-error-link {
    width: 100%;
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    padding: 0;
    text-align: left;
  }

  .normal-work-table-wrap {
    overflow-x: auto;
    border: 1px solid var(--line);
    background: var(--panel);
  }

  .normal-work-table {
    min-width: 960px;
    border: none;
    border-radius: 0;
  }

  .normal-work-table th,
  .normal-work-table td {
    vertical-align: middle;
    white-space: nowrap;
  }

  .normal-work-table th:last-child,
  .normal-work-table td:last-child {
    width: 96px;
    text-align: center;
  }

  .normal-work-input-unit {
    display: grid;
    grid-template-columns: minmax(76px, 1fr) auto;
    align-items: center;
    gap: 6px;
  }

  .normal-work-input-unit span,
  .normal-work-updated {
    color: var(--muted);
    font-size: 13px;
  }

  .normal-work-table .center {
    text-align: center;
  }
`;

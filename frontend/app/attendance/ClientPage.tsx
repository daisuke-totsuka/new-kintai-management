"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Header = {
  id: string | null;
  userId: string;
  targetYear: number;
  targetMonth: number;
  status: "draft" | "validated" | "submitted" | "approved" | "confirmed";
  createdAt?: string | null;
  createdBy?: string | null;
  updatedAt?: string | null;
  updatedBy?: string | null;
  employeeNo: string;
  employeeName: string;
  workplace?: string | null;
  department?: string | null;
  completionLabel?: string | null;
  printable: boolean;
};

type AttendanceRow = {
  id?: string | null;
  attendanceDay: number;
  dayOfWeek: string;
  holidayFlag: number;
  startTime: string;
  endTime: string;
  breakMinutes: string;
  actualWorkMinutes?: number | null;
  workTypeCode: string;
  workDescription: string;
  lateEarlyMinutes: string;
  midnightMinutes?: number | null;
  warningFlag?: boolean;
};

type Summary = {
  totalWorkDays: number;
  normalWorkDays: number;
  holidayWorkDays: number;
  absenceDays: number;
  paidLeaveDays: number;
  totalActualWorkMinutes: number;
  lateEarlyMinutes: number;
  midnightMinutes: number;
};

type ValidationResult = {
  code?: string;
  severity?: "error" | "warning";
  attendanceDay?: number | null;
  field?: string | null;
  message: string;
};

type WorkType = {
  code: string;
  displayName: string;
};

type ConflictCell = {
  attendanceDay: number;
  field: string;
  latestValue?: string;
  submittedValue?: string;
};

type MonthlyResponse = {
  success: boolean;
  header: Header;
  normalWorkTime: NormalWorkTime[];
  rows: AttendanceRow[];
  summary: Summary;
  validationResults: ValidationResult[];
  errors?: ValidationResult[];
};

type ApiRequestError = Error & {
  status?: number;
  body?: unknown;
  url?: string;
};

type NormalWorkTime = {
  effectiveFromDay: number;
  effectiveToDay: number;
  startTime: string;
  endTime: string;
  breakMinutes: number | null;
};

const EDITABLE_STATUS = new Set(["draft"]);
const PRINTABLE_STATUS = new Set([
  "validated",
  "submitted",
  "approved",
  "confirmed",
]);

const FIELD_LABELS: Record<string, string> = {
  startTime: "始業",
  endTime: "終業",
  breakMinutes: "休憩",
  workTypeCode: "勤務区分",
  workDescription: "作業内容",
  lateEarlyMinutes: "遅刻早退時間",
  actualWorkMinutes: "実働",
  midnightMinutes: "深夜",
  normalWorkTime: "通常勤務時間",
  targetYear: "対象年",
  targetMonth: "対象月",
  attendanceDay: "出勤日",
};

const INPUT_FIELDS = [
  "startTime",
  "endTime",
  "breakMinutes",
  "workTypeCode",
  "workDescription",
  "lateEarlyMinutes",
] as const;

const ERROR_FIELD_LABELS: Record<string, string> = {
  startTime: "出勤時刻",
  endTime: "退勤時刻",
  breakMinutes: "休憩時間",
  workType: "勤務区分",
  workTypeCode: "勤務区分",
  workDescription: "備考",
  remarks: "備考",
  lateEarlyMinutes: "遅刻早退時間",
  actualWorkMinutes: "実働時間",
  midnightMinutes: "深夜時間",
  normalWorkTime: "通常勤務時間",
  targetYear: "対象年",
  targetMonth: "対象月",
  attendanceDay: "日",
};

const FIELD_ALIASES: Record<string, string> = {
  start_time: "startTime",
  end_time: "endTime",
  break_minutes: "breakMinutes",
  work_type: "workTypeCode",
  work_type_code: "workTypeCode",
  work_description: "workDescription",
  remarks: "workDescription",
  late_early_minutes: "lateEarlyMinutes",
  actual_work_minutes: "actualWorkMinutes",
  midnight_minutes: "midnightMinutes",
  normal_work_time: "normalWorkTime",
  target_year: "targetYear",
  target_month: "targetMonth",
  attendance_day: "attendanceDay",
};

const MAX_LATE_EARLY_MINUTES = 999.5;
const SAVE_NETWORK_ERROR_MESSAGE =
  "サーバーへ接続できませんでした。\nネットワーク接続を確認して、再度お試しください。";
const SAVE_SERVER_ERROR_MESSAGE =
  "サーバーでエラーが発生しました。\nしばらくしてから再度お試しください。";

export default function ClientPage() {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const errorListRef = useRef<HTMLDivElement | null>(null);
  const pendingErrorScrollRef = useRef(false);
  const [userId, setUserId] = useState("");
  const [targetYear, setTargetYear] = useState(() => new Date().getFullYear());
  const [targetMonth, setTargetMonth] = useState(() => new Date().getMonth() + 1);
  const [header, setHeader] = useState<Header | null>(null);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [summary, setSummary] = useState<Summary>(emptySummary());
  const [normalWorkTime, setNormalWorkTime] = useState<NormalWorkTime[]>([]);
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [validationResults, setValidationResults] = useState<
    ValidationResult[]
  >([]);
  const [dirtyRows, setDirtyRows] = useState<Set<number>>(() => new Set());
  const [conflictCells, setConflictCells] = useState<ConflictCell[]>([]);
  const [pendingMonth, setPendingMonth] = useState<{
    targetYear: number;
    targetMonth: number;
  } | null>(null);
  const [message, setMessage] = useState("");
  const [errorScrollRequestId, setErrorScrollRequestId] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function init() {
      const initialDate = new Date();
      const initialYear = initialDate.getFullYear();
      const initialMonth = initialDate.getMonth() + 1;

      try {
        const me = await requestJson<{
          authenticated: boolean;
          user: { user_id?: string; employee_id?: string };
        }>("/auth/me");
        const currentUserId = me.user?.user_id;
        if (!currentUserId) {
          routerRef.current.push("/");
          return;
        }
        if (!mounted) return;

        setUserId(currentUserId);
        const [monthly, workTypeBody] = await Promise.all([
          fetchMonthly(currentUserId, initialYear, initialMonth),
          requestJson<{ workTypes: WorkType[] }>("/api/attendance/work-types"),
        ]);
        if (!mounted) return;

        applyMonthly(monthly);
        setWorkTypes(workTypeBody.workTypes ?? []);
      } catch {
        routerRef.current.push("/");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  const editable = header ? EDITABLE_STATUS.has(header.status) : false;
  const dirty = dirtyRows.size > 0;
  const resultMap = useMemo(
    () => buildResultMap(validationResults),
    [validationResults],
  );
  const conflictMap = useMemo(
    () => buildConflictMap(conflictCells),
    [conflictCells],
  );
  const inputErrors = useMemo(
    () => validationResults.filter((result) => result.severity !== "warning"),
    [validationResults],
  );
  const inputWarnings = useMemo(
    () => validationResults.filter((result) => result.severity === "warning"),
    [validationResults],
  );
  const errorSummaryTitle = useMemo(
    () =>
      inputErrors.some((result) => result.attendanceDay || result.field)
        ? "入力エラーがあります"
        : "エラーがあります",
    [inputErrors],
  );

  useEffect(() => {
    if (!pendingErrorScrollRef.current || inputErrors.length === 0) return;
    pendingErrorScrollRef.current = false;
    errorListRef.current?.scrollIntoView?.({
      behavior: "smooth",
      block: "start",
    });
  }, [errorScrollRequestId, inputErrors.length]);

  async function loadMonth(
    nextTargetYear: number,
    nextTargetMonth: number,
    currentUserId = userId,
  ) {
    if (!currentUserId) return;
    setLoading(true);
    setMessage("");
    try {
      const monthly = await fetchMonthly(currentUserId, nextTargetYear, nextTargetMonth);
      setTargetYear(nextTargetYear);
      setTargetMonth(nextTargetMonth);
      applyMonthly(monthly);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "月次データの取得に失敗しました。",
      );
    } finally {
      setLoading(false);
    }
  }

  function requestMonthChange(value: string) {
    const [nextTargetYear, nextTargetMonth] = value.split("-").map(Number);
    if (!nextTargetYear || !nextTargetMonth) return;
    if (dirty) {
      setPendingMonth({ targetYear: nextTargetYear, targetMonth: nextTargetMonth });
      return;
    }
    void loadMonth(nextTargetYear, nextTargetMonth);
  }

  function updateRow(
    index: number,
    field: (typeof INPUT_FIELDS)[number],
    value: string,
  ) {
    setRows((current) => {
      const next = [...current];
      const row = { ...next[index], [field]: value };
      next[index] = row;
      return next;
    });
    setDirtyRows((current) => new Set(current).add(rows[index].attendanceDay));
    setValidationResults((current) =>
      current.filter(
        (result) =>
          result.attendanceDay !== rows[index].attendanceDay || result.field !== field,
      ),
    );
    setConflictCells((current) =>
      current.filter(
        (cell) => cell.attendanceDay !== rows[index].attendanceDay || cell.field !== field,
      ),
    );
    setMessage("");
  }

  function showValidationResults(results: ValidationResult[]) {
    const normalizedResults = normalizeValidationResults(results);
    setValidationResults(normalizedResults);
    setMessage("");
    if (normalizedResults.some((result) => result.severity !== "warning")) {
      pendingErrorScrollRef.current = true;
      setErrorScrollRequestId((current) => current + 1);
    }
  }

  function focusValidationTarget(result: ValidationResult) {
    if (!result.attendanceDay || !result.field) return;
    const target = document.getElementById(
      attendanceCellId(result.attendanceDay, result.field),
    ) as HTMLElement | null;
    target?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    target?.focus?.();
  }

  async function saveCurrentRows() {
    if (!header || !userId) return null;
    if (!dirty) {
      setMessage("変更はありません。");
      return currentMonthlyResponse();
    }

    const changedRows = rows.filter((row) => dirtyRows.has(row.attendanceDay));
    const formatErrors = collectDetailedFormatErrors(changedRows, workTypes);
    if (formatErrors.length > 0) {
      showValidationResults(formatErrors);
      return null;
    }

    setSaving(true);
    setMessage("");
    try {
      const body = await requestJson<MonthlyResponse>(
        "/api/attendance/monthly",
        {
          method: "POST",
          body: JSON.stringify({
            userId,
            targetYear,
            targetMonth,
            baseUpdatedAt: header.updatedAt ?? null,
            changedRows: changedRows.map(toChangedRow),
          }),
        },
      );
      applyMonthly(body);
      setMessage("保存しました。");
      return body;
    } catch (error: any) {
      logAttendanceSaveApiError(error);
      if (error?.body?.conflictCells) {
        applyConflict(error.body);
        setConflictCells(error.body.conflictCells);
        showValidationResults([
          globalErrorResult("他の更新があります。最新内容を確認してください。"),
        ]);
      } else {
        showValidationResults(saveFailureResults(error));
      }
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function submit() {
    let monthly = currentMonthlyResponse();
    if (dirty) {
      monthly = await saveCurrentRows();
      if (!monthly) return;
    }
    if (!monthly?.header || !userId) return;

    setSaving(true);
    setMessage("");
    try {
      const body = await requestJson<MonthlyResponse>(
        "/api/attendance/monthly/submit",
        {
          method: "POST",
          body: JSON.stringify({
            userId,
            targetYear,
            targetMonth,
            baseUpdatedAt: monthly.header.updatedAt ?? null,
          }),
        },
      );
      applyMonthly(body);
      setMessage(
        body.success ? "提出しました。" : "提出できない入力があります。",
      );
    } catch (error: any) {
      if (readValidationResults(error?.body).length > 0) {
        if (error.body.header && error.body.rows && error.body.summary) {
          applyMonthly(error.body);
        }
        showValidationResults(readValidationResults(error.body));
        return;
      } else if (error?.body?.conflictCells) {
        applyConflict(error.body);
        setConflictCells(error.body.conflictCells);
        setMessage("他の更新があります。最新内容を確認してください。");
      } else {
        setMessage(
          error instanceof Error ? error.message : "提出に失敗しました。",
        );
      }
    } finally {
      setSaving(false);
    }
  }

  async function unlock() {
    if (!header || !userId) return;
    setSaving(true);
    setMessage("");
    try {
      const body = await requestJson<MonthlyResponse>(
        "/api/attendance/monthly/unlock",
        {
          method: "POST",
          body: JSON.stringify({
            userId,
            targetYear,
            targetMonth,
            baseUpdatedAt: header.updatedAt ?? null,
          }),
        },
      );
      applyMonthly(body);
      setMessage("編集再開しました。");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "編集再開に失敗しました。",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveAndChangeMonth() {
    if (!pendingMonth) return;
    const saved = await saveCurrentRows();
    if (!saved) return;
    const next = pendingMonth;
    setPendingMonth(null);
    await loadMonth(next.targetYear, next.targetMonth);
  }

  function applyMonthly(body: MonthlyResponse) {
    setHeader(body.header);
    setRows(body.rows ?? []);
    setSummary(body.summary ?? emptySummary());
    setNormalWorkTime(body.normalWorkTime ?? []);
    setValidationResults(readValidationResults(body));
    setDirtyRows(new Set());
    setConflictCells([]);
  }

  function applyConflict(body: {
    latestHeader?: Header;
    latestUpdatedAt?: string | null;
    conflictCells?: ConflictCell[];
  }) {
    setHeader((current) => {
      if (!current && !body.latestHeader) return current;
      return {
        ...(current ?? body.latestHeader!),
        ...(body.latestHeader ?? {}),
        updatedAt:
          body.latestHeader?.updatedAt ??
          body.latestUpdatedAt ??
          current?.updatedAt ??
          null,
      };
    });
  }

  function currentMonthlyResponse(): MonthlyResponse | null {
    if (!header) return null;
    return {
      success: true,
      header,
      normalWorkTime,
      rows,
      summary,
      validationResults,
    };
  }

  if (loading && !header) {
    return (
      <div className="page-content">
        <main className="main">読み込み中...</main>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="title-card page-header is-sticky attendance-toolbar">
        <div>
          <div className="page-title">勤務実績（月間）</div>
          <div className="attendance-status">
            状態: {header?.status ?? "draft"}
            {header?.completionLabel ? ` / ${header.completionLabel}` : ""}
            {dirty ? " / 未保存" : ""}
          </div>
        </div>
        <div className="controls">
          <label>
            年月
            <input
              aria-label="対象年月"
              className="cell-input attendance-month-input"
              type="month"
              value={`${targetYear}-${String(targetMonth).padStart(2, "0")}`}
              onChange={(event) => requestMonthChange(event.target.value)}
            />
          </label>
          {editable && (
            <button
              className="btn btn-accent"
              disabled={!dirty || saving}
              onClick={() => void saveCurrentRows()}
            >
              保存
            </button>
          )}
          {(header?.status === "draft" || header?.status === "validated") && (
            <button
              className="btn"
              disabled={saving}
              onClick={() => void submit()}
            >
              提出
            </button>
          )}
          {(header?.status === "validated" ||
            header?.status === "submitted") && (
            <button
              className="btn"
              disabled={saving}
              onClick={() => void unlock()}
            >
              編集再開
            </button>
          )}
          {header?.printable && PRINTABLE_STATUS.has(header.status) && (
            <>
              <button className="btn" onClick={() => window.print()}>
                印刷
              </button>
              <button className="btn" onClick={() => window.print()}>
                合計印刷
              </button>
            </>
          )}
        </div>
      </div>

      <main className="main attendance-page">
        {message && (
          <div className="attendance-message" role="status">
            {message}
          </div>
        )}

        {inputErrors.length > 0 && (
          <section
            className="attendance-band attendance-error-summary"
            ref={errorListRef}
            role="alert"
          >
            <h2 className="attendance-section-title">
              {errorSummaryTitle}（{inputErrors.length}件）
            </h2>
            <ul className="error-list attendance-error-list">
              {inputErrors.map((result, index) => (
                <li className="attendance-result-error" key={validationKey(result, index)}>
                  <button
                    className="attendance-error-link"
                    data-attendance-day={result.attendanceDay ?? ""}
                    data-field={result.field ?? ""}
                    type="button"
                    onClick={() => focusValidationTarget(result)}
                  >
                    {validationLine(result, targetMonth)}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {inputWarnings.length > 0 && (
          <section className="attendance-band attendance-warning-summary">
            <h2 className="attendance-section-title">
              確認が必要な項目があります（{inputWarnings.length}件）
            </h2>
            <ul className="error-list attendance-error-list">
              {inputWarnings.map((result, index) => (
                <li className="attendance-result-warning" key={validationKey(result, index)}>
                  <button
                    className="attendance-error-link"
                    data-attendance-day={result.attendanceDay ?? ""}
                    data-field={result.field ?? ""}
                    type="button"
                    onClick={() => focusValidationTarget(result)}
                  >
                    {validationLine(result, targetMonth)}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="attendance-band">
          <div className="attendance-info-grid">
            <Info label="社員番号" value={header?.employeeNo || userId} />
            <Info label="氏名" value={header?.employeeName || ""} />
            <Info label="作業場所" value={header?.workplace || ""} />
            <Info label="所属" value={header?.department || ""} />
            <Info label="更新日時" value={header?.updatedAt || ""} />
          </div>
        </section>

        <section className="attendance-band">
          <h2 className="attendance-section-title">通常勤務時間</h2>
          <div className="attendance-normal-grid">
            {normalWorkTime.length === 0 ? (
              <div className="muted">未設定</div>
            ) : (
              normalWorkTime.map((item, index) => (
                <div
                  className="attendance-normal-item"
                  key={`${item.effectiveFromDay}-${index}`}
                >
                  <span>
                    {item.effectiveFromDay}日-{item.effectiveToDay}日
                  </span>
                  <span>
                    {item.startTime || "--"}-{item.endTime || "--"}
                  </span>
                  <span>休憩 {item.breakMinutes ?? "--"}分</span>
                </div>
              ))
            )}
          </div>
        </section>

        <div className="attendance-table-wrap">
          <table className="table attendance-table">
            <thead>
              <tr>
                <th>出勤日</th>
                <th>曜日</th>
                <th>休日区分</th>
                <th>始業</th>
                <th>終業</th>
                <th>休憩</th>
                <th>実働</th>
                <th>勤務区分</th>
                <th>作業内容</th>
                <th>遅刻早退</th>
                <th>深夜</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const dayLabel = attendanceDayLabel(targetYear, targetMonth, row.attendanceDay);
                return (
                <tr key={row.attendanceDay} className={rowClass(row)}>
                  <td>{dayLabel}</td>
                  <td>{row.dayOfWeek}</td>
                  <td>{row.holidayFlag}</td>
                  <td>
                    <input
                      id={attendanceCellId(row.attendanceDay, "startTime")}
                      data-attendance-day={row.attendanceDay}
                      data-field="startTime"
                      aria-label={`${dayLabel} 始業`}
                      className={cellClass(
                        row,
                        "startTime",
                        resultMap,
                        conflictMap,
                        dirtyRows,
                        editable,
                      )}
                      value={row.startTime}
                      disabled={!editable}
                      onChange={(event) =>
                        updateRow(index, "startTime", event.target.value)
                      }
                      title={cellTitle(
                        row,
                        "startTime",
                        resultMap,
                        conflictMap,
                      )}
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`${dayLabel} 終業`}
                      id={attendanceCellId(row.attendanceDay, "endTime")}
                      data-attendance-day={row.attendanceDay}
                      data-field="endTime"
                      className={cellClass(
                        row,
                        "endTime",
                        resultMap,
                        conflictMap,
                        dirtyRows,
                        editable,
                      )}
                      value={row.endTime}
                      disabled={!editable}
                      onChange={(event) =>
                        updateRow(index, "endTime", event.target.value)
                      }
                      title={cellTitle(row, "endTime", resultMap, conflictMap)}
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`${dayLabel} 休憩`}
                      id={attendanceCellId(row.attendanceDay, "breakMinutes")}
                      data-attendance-day={row.attendanceDay}
                      data-field="breakMinutes"
                      className={cellClass(
                        row,
                        "breakMinutes",
                        resultMap,
                        conflictMap,
                        dirtyRows,
                        editable,
                      )}
                      value={row.breakMinutes}
                      disabled={!editable}
                      onChange={(event) =>
                        updateRow(index, "breakMinutes", event.target.value)
                      }
                      title={cellTitle(
                        row,
                        "breakMinutes",
                        resultMap,
                        conflictMap,
                      )}
                    />
                  </td>
                  <td>{formatMinutes(row.actualWorkMinutes)}</td>
                  <td>
                    <select
                      aria-label={`${dayLabel} 勤務区分`}
                      id={attendanceCellId(row.attendanceDay, "workTypeCode")}
                      data-attendance-day={row.attendanceDay}
                      data-field="workTypeCode"
                      className={cellClass(
                        row,
                        "workTypeCode",
                        resultMap,
                        conflictMap,
                        dirtyRows,
                        editable,
                      )}
                      value={row.workTypeCode}
                      disabled={!editable}
                      onChange={(event) =>
                        updateRow(index, "workTypeCode", event.target.value)
                      }
                      title={cellTitle(
                        row,
                        "workTypeCode",
                        resultMap,
                        conflictMap,
                      )}
                    >
                      <option value=""></option>
                      {workTypes.map((workType) => (
                        <option key={workType.code} value={workType.code}>
                          {workType.displayName}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      aria-label={`${dayLabel} 作業内容`}
                      id={attendanceCellId(row.attendanceDay, "workDescription")}
                      data-attendance-day={row.attendanceDay}
                      data-field="workDescription"
                      className={cellClass(
                        row,
                        "workDescription",
                        resultMap,
                        conflictMap,
                        dirtyRows,
                        editable,
                      )}
                      value={row.workDescription}
                      disabled={!editable}
                      onChange={(event) =>
                        updateRow(index, "workDescription", event.target.value)
                      }
                      title={cellTitle(
                        row,
                        "workDescription",
                        resultMap,
                        conflictMap,
                      )}
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`${dayLabel} 遅刻早退時間`}
                      id={attendanceCellId(row.attendanceDay, "lateEarlyMinutes")}
                      data-attendance-day={row.attendanceDay}
                      data-field="lateEarlyMinutes"
                      className={cellClass(
                        row,
                        "lateEarlyMinutes",
                        resultMap,
                        conflictMap,
                        dirtyRows,
                        editable,
                      )}
                      value={row.lateEarlyMinutes}
                      type="number"
                      min="0"
                      max={MAX_LATE_EARLY_MINUTES}
                      step="30"
                      disabled={!editable}
                      onChange={(event) =>
                        updateRow(index, "lateEarlyMinutes", event.target.value)
                      }
                      title={cellTitle(
                        row,
                        "lateEarlyMinutes",
                        resultMap,
                        conflictMap,
                      )}
                    />
                  </td>
                  <td>{formatMinutes(row.midnightMinutes)}</td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <section className="attendance-band">
          <h2 className="attendance-section-title">集計</h2>
          <div className="attendance-summary-grid">
            <Info label="総勤務日数" value={summary.totalWorkDays} />
            <Info label="通常出勤" value={summary.normalWorkDays} />
            <Info label="休日出勤" value={summary.holidayWorkDays} />
            <Info label="欠勤" value={summary.absenceDays} />
            <Info label="有休" value={summary.paidLeaveDays} />
            <Info
              label="総実働"
              value={formatMinutes(summary.totalActualWorkMinutes)}
            />
            <Info label="遅刻早退" value={summary.lateEarlyMinutes} />
            <Info label="深夜" value={formatMinutes(summary.midnightMinutes)} />
          </div>
        </section>

      </main>

      {pendingMonth && (
        <div className="modal-backdrop">
          <div className="modal" role="dialog" aria-modal="true">
            <h2>対象月変更</h2>
            <div>未保存の変更があります。</div>
            <div className="attendance-dialog-actions">
              <button
                className="btn btn-accent"
                disabled={saving}
                onClick={() => void saveAndChangeMonth()}
              >
                保存して変更
              </button>
              <button
                className="btn"
                disabled={saving}
                onClick={() => setPendingMonth(null)}
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="attendance-info-item">
      <span>{label}</span>
      <strong>{value || "--"}</strong>
    </div>
  );
}

async function fetchMonthly(userId: string, targetYear: number, targetMonth: number) {
  return requestJson<MonthlyResponse>(
    `/api/attendance/monthly?userId=${encodeURIComponent(userId)}&targetYear=${targetYear}&targetMonth=${targetMonth}`,
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
    if (typeof message === "string" && message) {
      return withDevelopmentDetail(message, responseDetail(body));
    }
  }
  return `API request failed (HTTP ${status})`;
}

function responseDetail(body: unknown) {
  if (!body || typeof body !== "object") return "";
  const detail = (body as { detail?: unknown }).detail;
  return typeof detail === "string" ? detail : "";
}

function errorResponseDetail(error: unknown) {
  return responseDetail((error as ApiRequestError | undefined)?.body);
}

function withDevelopmentDetail(message: string, detail: string) {
  if (process.env.NODE_ENV !== "development" || !detail) return message;
  return `${message}\n${detail}`;
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

function readValidationResults(body: Partial<MonthlyResponse> | any): ValidationResult[] {
  return normalizeValidationResults(body?.validationResults ?? body?.errors ?? []);
}

function normalizeValidationResults(
  results: Array<ValidationResult | string> | undefined,
) {
  return dedupeValidationResults((results ?? []).map(normalizeValidationResult));
}

function normalizeValidationResult(result: ValidationResult | string): ValidationResult {
  if (typeof result === "string") {
    return { severity: "error", message: result };
  }
  const field = result.field ? FIELD_ALIASES[result.field] ?? result.field : null;
  return {
    ...result,
    severity: result.severity ?? "error",
    attendanceDay:
      result.attendanceDay === null || result.attendanceDay === undefined
        ? null
        : Number(result.attendanceDay),
    field,
  };
}

function validationKey(result: ValidationResult, index: number) {
  return `${result.code ?? "validation"}-${result.attendanceDay ?? "global"}-${result.field ?? "field"}-${index}`;
}

function validationLine(result: ValidationResult, targetMonth: number) {
  const day = result.attendanceDay ? `${targetMonth}月${result.attendanceDay}日 ` : "";
  const field = result.field ? `${fieldLabel(result.field)}\uFF1A` : "";
  return `${day}${field}${result.message}`;
}

function dedupeValidationResults(results: ValidationResult[]) {
  const seen = new Set<string>();
  const deduped: ValidationResult[] = [];
  for (const result of results) {
    const key = [
      result.severity ?? "error",
      result.attendanceDay ?? "",
      result.field ?? "",
      result.message,
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(result);
  }
  return deduped;
}

function fieldLabel(field: string) {
  return ERROR_FIELD_LABELS[field] ?? FIELD_LABELS[field] ?? field;
}

function saveFailureResults(error: unknown): ValidationResult[] {
  const status = apiStatus(error);
  const validationResults = readValidationResults((error as ApiRequestError | undefined)?.body);
  if (status === 400 && validationResults.length > 0) {
    return validationResults;
  }
  return [globalErrorResult(saveFailureMessage(error))];
}

function saveFailureMessage(error: unknown) {
  const status = apiStatus(error);
  if (status === 401) {
    return "ログインの有効期限が切れました。\n再度ログインしてください。";
  }
  if (status === 403) {
    return "この操作を実行する権限がありません。";
  }
  if (status === 404) {
    return "保存先が見つかりません。";
  }
  if (status !== undefined && status >= 500) {
    return withDevelopmentDetail(
      `${SAVE_SERVER_ERROR_MESSAGE}\n（HTTP ${status}）`,
      errorResponseDetail(error),
    );
  }
  if (status === undefined && isNetworkOrTimeoutError(error)) {
    return SAVE_NETWORK_ERROR_MESSAGE;
  }
  return "保存に失敗しました。";
}

function apiStatus(error: unknown) {
  const status = (error as ApiRequestError | undefined)?.status;
  return typeof status === "number" ? status : undefined;
}

function isNetworkOrTimeoutError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const name = error.name.toLowerCase();
  const message = error.message.toLowerCase();
  return (
    name === "typeerror" ||
    name === "aborterror" ||
    message.includes("failed to fetch") ||
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("aborted")
  );
}

function globalErrorResult(message: string): ValidationResult {
  return { severity: "error", message };
}

function logAttendanceSaveApiError(error: unknown) {
  const apiError = error as ApiRequestError;
  console.error("Attendance save API error", {
    error,
    httpStatus: apiError?.status ?? null,
    responseBody: apiError?.body ?? null,
    apiUrl: apiError?.url ?? null,
  });
}

function attendanceCellId(attendanceDay: number, field: string) {
  return `attendance-cell-${attendanceDay}-${field}`;
}

function collectDetailedFormatErrors(
  rows: AttendanceRow[],
  workTypes: WorkType[],
): ValidationResult[] {
  const allowedWorkTypes = new Set(workTypes.map((workType) => workType.code));
  const results: ValidationResult[] = [];

  for (const row of rows) {
    const invalidTimeFields = new Set<string>();
    for (const field of ["startTime", "endTime"] as const) {
      const value = row[field].trim();
      if (value && !isValidTimeText(value)) {
        invalidTimeFields.add(field);
        results.push(formatResult(row, field, "HH:mm形式で入力してください。"));
      }
    }

    const startMinutes = timeToMinutes(row.startTime);
    const endMinutes = timeToMinutes(row.endTime);
    if (
      !invalidTimeFields.has("startTime")
      && !invalidTimeFields.has("endTime")
      && startMinutes !== null
      && endMinutes !== null
      && endMinutes < startMinutes
      && !row.workTypeCode
    ) {
      results.push(formatResult(row, "endTime", "出勤時刻より前です。"));
    }

    if (row.breakMinutes.trim()) {
      const value = Number(row.breakMinutes);
      if (!Number.isInteger(value) || value < 0) {
        results.push(formatResult(row, "breakMinutes", "0以上の整数で入力してください。"));
      }
    }

    if (row.lateEarlyMinutes.trim()) {
      const value = Number(row.lateEarlyMinutes);
      if (
        Number.isNaN(value)
        || value < 0
        || value > MAX_LATE_EARLY_MINUTES
        || value % 30 !== 0
      ) {
        results.push(
          formatResult(
            row,
            "lateEarlyMinutes",
            `0以上${MAX_LATE_EARLY_MINUTES}以下、30分単位で入力してください。`,
          ),
        );
      }
    }

    if (row.workTypeCode && !allowedWorkTypes.has(row.workTypeCode)) {
      results.push(formatResult(row, "workTypeCode", "登録済みの勤務区分を選択してください。"));
    }
  }

  return results;
}

function isValidTimeText(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [hour, minute] = value.split(":").map(Number);
  return (
    Number.isInteger(hour) &&
    Number.isInteger(minute) &&
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59
  );
}

function timeToMinutes(value: string) {
  const text = value.trim();
  if (!isValidTimeText(text)) return null;
  const [hour, minute] = text.split(":").map(Number);
  return hour * 60 + minute;
}

function formatResult(
  row: AttendanceRow,
  field: keyof AttendanceRow,
  message: string,
): ValidationResult {
  return {
    code: `FORMAT_${String(field).toUpperCase()}`,
    severity: "error",
    attendanceDay: row.attendanceDay,
    field: String(field),
    message,
  };
}

function toChangedRow(row: AttendanceRow) {
  return {
    id: row.id,
    attendanceDay: row.attendanceDay,
    startTime: row.startTime,
    endTime: row.endTime,
    breakMinutes: row.breakMinutes,
    workTypeCode: row.workTypeCode,
    workDescription: row.workDescription,
    lateEarlyMinutes: row.lateEarlyMinutes,
  };
}

function buildResultMap(results: ValidationResult[]) {
  const map = new Map<string, ValidationResult>();
  for (const result of results) {
    if (!result.attendanceDay || !result.field) continue;
    map.set(`${result.attendanceDay}:${result.field}`, result);
  }
  return map;
}

function buildConflictMap(cells: ConflictCell[]) {
  const map = new Map<string, ConflictCell>();
  for (const cell of cells) {
    map.set(`${cell.attendanceDay}:${cell.field}`, cell);
  }
  return map;
}

function cellClass(
  row: AttendanceRow,
  field: string,
  results: Map<string, ValidationResult>,
  conflicts: Map<string, ConflictCell>,
  dirtyRows: Set<number>,
  editable: boolean,
) {
  const key = `${row.attendanceDay}:${field}`;
  const result = results.get(key);
  const classes = ["cell-input"];
  if (!editable) classes.push("cell-disabled");
  if (dirtyRows.has(row.attendanceDay)) classes.push("cell-dirty");
  if (conflicts.has(key)) classes.push("cell-conflict");
  if (result?.severity === "warning") classes.push("cell-warning");
  if (result?.severity === "error") classes.push("error");
  return classes.join(" ");
}

function cellTitle(
  row: AttendanceRow,
  field: string,
  results: Map<string, ValidationResult>,
  conflicts: Map<string, ConflictCell>,
) {
  const key = `${row.attendanceDay}:${field}`;
  const result = results.get(key);
  if (result) return result.code ? `${result.code} ${result.message}` : result.message;
  const conflict = conflicts.get(key);
  if (conflict) return `最新値: ${conflict.latestValue ?? ""}`;
  return "";
}

function rowClass(row: AttendanceRow) {
  if (row.holidayFlag === 3) return "attendance-row-sunday";
  if (row.holidayFlag === 1 || row.holidayFlag === 2)
    return "attendance-row-saturday";
  return "";
}

function attendanceDayLabel(targetYear: number, targetMonth: number, attendanceDay: number) {
  return `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(attendanceDay).padStart(2, "0")}`;
}

function formatMinutes(value?: number | null) {
  if (value === null || value === undefined) return "--";
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) return "--";
  const sign = minutes < 0 ? "-" : "";
  const absolute = Math.abs(minutes);
  return `${sign}${Math.floor(absolute / 60)}:${String(absolute % 60).padStart(2, "0")}`;
}

function emptySummary(): Summary {
  return {
    totalWorkDays: 0,
    normalWorkDays: 0,
    holidayWorkDays: 0,
    absenceDays: 0,
    paidLeaveDays: 0,
    totalActualWorkMinutes: 0,
    lateEarlyMinutes: 0,
    midnightMinutes: 0,
  };
}

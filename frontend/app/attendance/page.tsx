"use client";

import { useMemo, useState } from "react";

type WorkRow = {
  workDate: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  breakMinutes: string;
  notes: string;
};

type ValidationError = {
  workDate: string;
  field: "startTime" | "endTime" | "breakMinutes" | "notes" | "workDate";
  message: string;
};

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getDaysInMonth(year: number, month: number): WorkRow[] {
  const result: WorkRow[] = [];
  const last = new Date(year, month + 1, 0);
  for (let d = 1; d <= last.getDate(); d += 1) {
    const date = new Date(year, month, d);
    result.push({
      workDate: formatDate(date),
      dayOfWeek: WEEKDAYS[date.getDay()],
      startTime: "",
      endTime: "",
      breakMinutes: "",
      notes: "",
    });
  }
  return result;
}

function parseTimeToMinutes(value: string): number | null {
  if (!/^\d{2}:\d{2}$/.test(value)) return null;
  const [h, m] = value.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function normalizeTimeInput(raw: string): string {
  const trimmed = raw.trim();
  if (/^\d{1,4}$/.test(trimmed)) {
    if (trimmed.length <= 2) {
      return `${trimmed.padStart(2, "0")}:00`;
    }
    const h = trimmed.slice(0, trimmed.length - 2).padStart(2, "0");
    const m = trimmed.slice(-2);
    return `${h}:${m}`;
  }
  return trimmed;
}

function isFutureDate(iso: string): boolean {
  const today = new Date();
  const date = new Date(iso + "T00:00:00");
  return (
    date.getTime() >
    new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  );
}

export default function Page() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [rows, setRows] = useState<WorkRow[]>(() =>
    getDaysInMonth(today.getFullYear(), today.getMonth())
  );
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"validate" | "register">(
    "validate"
  );
  const [showHelp, setShowHelp] = useState(false);
  const [activeCell, setActiveCell] = useState<{
    workDate: string;
    field: "startTime" | "endTime";
  } | null>(null);

  const errorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const err of errors) {
      map.set(`${err.workDate}:${err.field}`, err.message);
    }
    return map;
  }, [errors]);

  const totalMinutes = useMemo(() => {
    return rows.reduce((sum, row) => {
      const start = parseTimeToMinutes(row.startTime);
      const end = parseTimeToMinutes(row.endTime);
      const breakMin =
        row.breakMinutes === "" ? null : Number(row.breakMinutes);
      if (start === null || end === null || breakMin === null || Number.isNaN(breakMin)) {
        return sum;
      }
      const work = end - start - breakMin;
      if (work <= 0) return sum;
      return sum + work;
    }, 0);
  }, [rows]);

  function changeMonth(newYear: number, newMonth: number) {
    setYear(newYear);
    setMonth(newMonth);
    setRows(getDaysInMonth(newYear, newMonth));
    setErrors([]);
  }

  function updateRow(index: number, field: keyof WorkRow, value: string) {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function validateRows(mode: "validate" | "register") {
    const nextErrors: ValidationError[] = [];

    rows.forEach((row) => {
      if (isFutureDate(row.workDate)) return;

      const start = row.startTime.trim();
      const end = row.endTime.trim();
      const breakStr = row.breakMinutes.trim();
      const notes = row.notes.trim();

      const hasAny =
        start !== "" || end !== "" || breakStr !== "" || notes !== "";
      const hasTimeAny = start !== "" || end !== "" || breakStr !== "";

      if (!hasAny) return;

      if (hasTimeAny && (start === "" || end === "" || breakStr === "")) {
        nextErrors.push({
          workDate: row.workDate,
          field:
            start === ""
              ? "startTime"
              : end === ""
              ? "endTime"
              : "breakMinutes",
          message: "開始時刻・終了時刻・休憩時間をすべて入力してください",
        });
        return;
      }

      if (start === "" && end === "") {
        return;
      }

      const startMin = parseTimeToMinutes(start);
      const endMin = parseTimeToMinutes(end);
      if (startMin === null) {
        nextErrors.push({
          workDate: row.workDate,
          field: "startTime",
          message: "時刻はhh:mm形式で入力してください",
        });
        return;
      }
      if (endMin === null) {
        nextErrors.push({
          workDate: row.workDate,
          field: "endTime",
          message: "時刻はhh:mm形式で入力してください",
        });
        return;
      }
      if (endMin < startMin) {
        nextErrors.push({
          workDate: row.workDate,
          field: "endTime",
          message: "終了時刻が開始時刻より前です",
        });
        return;
      }

      const breakMin = Number(breakStr);
      if (Number.isNaN(breakMin)) {
        nextErrors.push({
          workDate: row.workDate,
          field: "breakMinutes",
          message: "休憩時間は数値で入力してください",
        });
        return;
      }
      if (breakMin < 0) {
        nextErrors.push({
          workDate: row.workDate,
          field: "breakMinutes",
          message: "休憩時間がマイナスです",
        });
        return;
      }

      const workMin = endMin - startMin - breakMin;
      if (workMin < 0) {
        nextErrors.push({
          workDate: row.workDate,
          field: "breakMinutes",
          message: "勤務時間がマイナスです",
        });
        return;
      }
      if (workMin >= 24 * 60) {
        nextErrors.push({
          workDate: row.workDate,
          field: "endTime",
          message: "勤務時間が24時間以上です",
        });
      }

      if (notes.length > 20) {
        nextErrors.push({
          workDate: row.workDate,
          field: "notes",
          message: "備考は全角20文字以内にしてください",
        });
      }

      if (workMin === 0 && notes === "") {
        return;
      }
    });

    setErrors(nextErrors);
    setModalMode(mode);
    setShowModal(true);
  }

  function handleTimeBlur(
    index: number,
    field: "startTime" | "endTime",
    value: string
  ) {
    updateRow(index, field, normalizeTimeInput(value));
  }

  function setCurrentTime() {
    if (!activeCell) return;
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}`;
    const index = rows.findIndex((row) => row.workDate === activeCell.workDate);
    if (index === -1) return;
    updateRow(index, activeCell.field, time);
  }

  return (
    <div className="page-content">
      <div className="sticky-bar">
        <div className="title">勤務実績（月間）</div>
        <div className="controls">
          <label>
            年月:
            <input
              className="cell-input"
              style={{ width: 120, marginLeft: 6 }}
              type="month"
              value={`${year}-${String(month + 1).padStart(2, "0")}`}
              onChange={(e) => {
                const [y, m] = e.target.value.split("-").map(Number);
                if (!Number.isNaN(y) && !Number.isNaN(m)) {
                  changeMonth(y, m - 1);
                }
              }}
            />
          </label>
          <button
            className="btn btn-accent"
            onClick={() => validateRows("validate")}
          >
            入力チェック
          </button>
          <button className="btn" onClick={() => validateRows("register")}>
            データ登録
          </button>
          <button className="btn" onClick={setCurrentTime}>
            現在時刻をセット
          </button>
          <button className="btn btn-ghost" onClick={() => setShowHelp(true)}>
            入力補助の使い方
          </button>
        </div>
      </div>

      <main className="main">
        <table className="table">
          <thead>
            <tr>
              <th>日付</th>
              <th>曜日</th>
              <th>開始時刻</th>
              <th>終了時刻</th>
              <th>休憩時間(分)</th>
              <th>勤務時間(分)</th>
              <th>備考</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const startMin = parseTimeToMinutes(row.startTime);
              const endMin = parseTimeToMinutes(row.endTime);
              const breakMin =
                row.breakMinutes === "" ? null : Number(row.breakMinutes);
              const workMin =
                startMin !== null &&
                endMin !== null &&
                breakMin !== null &&
                !Number.isNaN(breakMin)
                  ? endMin - startMin - breakMin
                  : null;

              return (
                <tr key={row.workDate}>
                  <td>{row.workDate}</td>
                  <td>{row.dayOfWeek}</td>
                  <td>
                    <input
                      className={`cell-input ${
                        errorMap.has(`${row.workDate}:startTime`) ? "error" : ""
                      }`}
                      value={row.startTime}
                      onChange={(e) =>
                        updateRow(index, "startTime", e.target.value)
                      }
                      onBlur={(e) =>
                        handleTimeBlur(index, "startTime", e.target.value)
                      }
                      onFocus={() =>
                        setActiveCell({
                          workDate: row.workDate,
                          field: "startTime",
                        })
                      }
                      placeholder="09:00"
                      title={errorMap.get(`${row.workDate}:startTime`) || ""}
                    />
                  </td>
                  <td>
                    <input
                      className={`cell-input ${
                        errorMap.has(`${row.workDate}:endTime`) ? "error" : ""
                      }`}
                      value={row.endTime}
                      onChange={(e) =>
                        updateRow(index, "endTime", e.target.value)
                      }
                      onBlur={(e) =>
                        handleTimeBlur(index, "endTime", e.target.value)
                      }
                      onFocus={() =>
                        setActiveCell({
                          workDate: row.workDate,
                          field: "endTime",
                        })
                      }
                      placeholder="18:00"
                      title={errorMap.get(`${row.workDate}:endTime`) || ""}
                    />
                  </td>
                  <td>
                    <input
                      className={`cell-input ${
                        errorMap.has(`${row.workDate}:breakMinutes`)
                          ? "error"
                          : ""
                      }`}
                      value={row.breakMinutes}
                      onChange={(e) =>
                        updateRow(index, "breakMinutes", e.target.value)
                      }
                      placeholder="60"
                      title={
                        errorMap.get(`${row.workDate}:breakMinutes`) || ""
                      }
                    />
                  </td>
                  <td className="muted">
                    {workMin !== null ? workMin : "--"}
                  </td>
                  <td>
                    <input
                      className={`cell-input ${
                        errorMap.has(`${row.workDate}:notes`) ? "error" : ""
                      }`}
                      value={row.notes}
                      onChange={(e) =>
                        updateRow(index, "notes", e.target.value)
                      }
                      placeholder="備考"
                      title={errorMap.get(`${row.workDate}:notes`) || ""}
                    />
                  </td>
                </tr>
              );
            })}
            <tr className="sum-row">
              <td colSpan={5}>月末合計</td>
              <td>{totalMinutes}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </main>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>入力チェック結果</h2>
            {errors.length === 0 ? (
              <div className="ok">
                {modalMode === "register"
                  ? "登録準備OKです（登録処理は未実装）"
                  : "問題はありません。"}
              </div>
            ) : (
              <>
                <div className="error">エラーがあります。</div>
                <ul className="error-list">
                  {errors.map((err, i) => (
                    <li key={`${err.workDate}-${err.field}-${i}`}>
                      {err.workDate} {err.message}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div
              style={{
                marginTop: 16,
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button className="btn" onClick={() => setShowModal(false)}>
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {showHelp && (
        <div className="modal-backdrop" onClick={() => setShowHelp(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>入力チェックと入力補助</h2>
            <div className="help-grid">
              <div className="help-item">
                開始時刻・終了時刻・休憩時間は全て入力してください。
              </div>
              <div className="help-item">
                時刻は「hh:mm」形式です。数字だけ入力すると自動整形します。
              </div>
              <div className="help-item">
                エラーがあるセルは赤枠表示され、ツールチップで理由を表示します。
              </div>
              <div className="help-item">
                「現在時刻をセット」で選択中の時刻入力に現在時刻を入力します。
              </div>
              <div className="help-item">
                未来日の入力チェックは実行しません。
              </div>
            </div>
            <div
              style={{
                marginTop: 16,
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button className="btn" onClick={() => setShowHelp(false)}>
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

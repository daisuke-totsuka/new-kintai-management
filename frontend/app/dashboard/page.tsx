"use client";

import { useMemo, useState } from "react";

const fiscalMonths = [
  { label: "4月", key: "04" },
  { label: "5月", key: "05" },
  { label: "6月", key: "06" },
  { label: "7月", key: "07" },
  { label: "8月", key: "08" },
  { label: "9月", key: "09" },
  { label: "10月", key: "10" },
  { label: "11月", key: "11" },
  { label: "12月", key: "12" },
  { label: "1月", key: "01" },
  { label: "2月", key: "02" },
  { label: "3月", key: "03" },
];

function hhmmToMinutes(hhmm: string) {
  if (!hhmm || hhmm === "—") return 0;
  const m = /^(\d+):([0-5]\d)$/.exec(hhmm.trim());
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

function minutesToHhmm(totalMinutes: number) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h)}:${String(m).padStart(2, "0")}`;
}

function makeInitialRows(fiscalYear: number) {
  return fiscalMonths.map((m, idx) => {
    const year = idx <= 8 ? fiscalYear : fiscalYear + 1;
    const yyyymm = `${year}${m.key}`;
    return {
      id: yyyymm,
      monthLabel: m.label,
      plannedDays: idx % 3 === 0 ? 20 : idx % 3 === 1 ? 21 : 20,
      standardHoursDecimal: idx % 3 === 2 ? 168.0 : 160.0,
      actualDays: idx < 4 ? (idx % 2 === 0 ? 19 : 20) : null,
      actualWorkTime: idx < 4 ? (idx % 2 === 0 ? "155:00" : "160:50") : "—",
      status: {
        timesheet: idx < 2,
        expense: idx < 1,
        invoiceDetail: idx < 1,
      },
    };
  });
}

function StatusButton({
  value,
  onClick,
  disabled,
}: {
  value: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  const stateClass = value ? "is-on" : "is-off";
  return (
    <button
      type="button"
      className={`status-btn ${stateClass}`}
      onClick={onClick}
      disabled={disabled}
    >
      {value ? "確定" : "未確定"}
    </button>
  );
}

export default function DashboardPage() {
  const [fiscalYear, setFiscalYear] = useState(2024);
  const [rows, setRows] = useState(() => makeInitialRows(2024));

  const onChangeFiscalYear = (nextYear: number) => {
    setFiscalYear(nextYear);
    setRows(makeInitialRows(nextYear));
  };

  const toggleStatus = (
    rowId: string,
    actionType: "timesheet" | "expense" | "invoiceDetail",
  ) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        return {
          ...r,
          status: {
            ...r.status,
            [actionType]: !r.status[actionType],
          },
        };
      }),
    );
  };

  const totals = useMemo(() => {
    const plannedDays = rows.reduce(
      (sum, r) => sum + (Number.isFinite(r.plannedDays) ? r.plannedDays : 0),
      0,
    );
    const standardMinutes = rows.reduce((sum, r) => {
      const hours = Number(r.standardHoursDecimal);
      if (!Number.isFinite(hours)) return sum;
      return sum + Math.round(hours * 60);
    }, 0);

    //const actualDays = rows.reduce(
    //  (sum, r) => sum + (Number.isFinite(r.actualDays) ? r.actualDays : 0),
    //  0
    //);
    const actualDays = rows.reduce(
      (sum, r) =>
        sum + (Number.isFinite(r.actualDays ?? 0) ? (r.actualDays ?? 0) : 0),
      0,
    );
    const actualMinutes = rows.reduce(
      (sum, r) => sum + hhmmToMinutes(r.actualWorkTime),
      0,
    );

    const timesheetConfirmed = rows.filter((r) => r.status.timesheet).length;
    const expenseConfirmed = rows.filter((r) => r.status.expense).length;
    const invoiceConfirmed = rows.filter((r) => r.status.invoiceDetail).length;

    return {
      plannedDays,
      standardMinutes,
      actualDays,
      actualMinutes,
      timesheetConfirmed,
      expenseConfirmed,
      invoiceConfirmed,
    };
  }, [rows]);

  return (
    <div className="page dashboard-page">
      <div className="dashboard-wrap">
        <section className="dashboard-card">
          <div className="dashboard-head page-header">
            <div>
              <h1 className="page-title dashboard-title">確定画面</h1>
            </div>

            <div className="dashboard-controls">
              <label>
                年度
                <select
                  value={fiscalYear}
                  onChange={(e) => onChangeFiscalYear(Number(e.target.value))}
                >
                  {[2022, 2023, 2024, 2025, 2026].map((y) => (
                    <option key={y} value={y}>
                      {y}年度
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="btn btn-dark"
                onClick={() => {
                  setRows((prev) => [...prev]);
                }}
              >
                再集計
              </button>
            </div>
          </div>
        </section>

        <section className="dashboard-table-wrap">
          <div className="dashboard-table-scroll">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>月</th>
                  <th className="right">出勤日数（計画）</th>
                  <th className="right">基準時間（計画）</th>
                  <th className="right">実績出勤日数</th>
                  <th className="right">実績勤務時間</th>
                  <th className="center">勤務表</th>
                  <th className="center">経費</th>
                  <th className="center">業務請求分明細</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={r.id}
                    className={i % 2 === 0 ? "row-even" : "row-odd"}
                  >
                    <td>
                      <div className="month-cell">
                        <span>{r.monthLabel}</span>
                        <span className="month-id">{r.id}</span>
                      </div>
                    </td>
                    <td className="right">{r.plannedDays ?? "—"}</td>
                    <td className="right">
                      {Number.isFinite(r.standardHoursDecimal)
                        ? r.standardHoursDecimal.toFixed(1)
                        : "—"}
                    </td>
                    <td className="right">
                      {Number.isFinite(r.actualDays) ? r.actualDays : "—"}
                    </td>
                    <td className="right">{r.actualWorkTime || "—"}</td>
                    <td className="center">
                      <StatusButton
                        value={r.status.timesheet}
                        onClick={() => toggleStatus(r.id, "timesheet")}
                      />
                    </td>
                    <td className="center">
                      <StatusButton
                        value={r.status.expense}
                        onClick={() => toggleStatus(r.id, "expense")}
                      />
                    </td>
                    <td className="center">
                      <StatusButton
                        value={r.status.invoiceDetail}
                        onClick={() => toggleStatus(r.id, "invoiceDetail")}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="total-label">合計</td>
                  <td className="right total-value">{totals.plannedDays}</td>
                  <td className="right total-value">
                    {minutesToHhmm(totals.standardMinutes)}
                  </td>
                  <td className="right total-value">{totals.actualDays}</td>
                  <td className="right total-value">
                    {minutesToHhmm(totals.actualMinutes)}
                  </td>
                  <td className="center total-mini">
                    {totals.timesheetConfirmed}/12
                  </td>
                  <td className="center total-mini">
                    {totals.expenseConfirmed}/12
                  </td>
                  <td className="center total-mini">
                    {totals.invoiceConfirmed}/12
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="dashboard-note">
            実装メモ：
            <ul>
              <li>
                ここではReact上で擬似ボタン（確定/未確定）を実装していますが、Excelで同様にやる場合は
                「セルをボタン化 +
                共通処理1本化（クリック位置→対象月→アクション判定）」が効率的です。
              </li>
              <li>
                次のステップ：row.id（YYYYMM）をキーに、API（またはExcel集計結果）を読み込み、
                toggleStatusで確定処理（保存/ロック/ログ）に接続してください。
              </li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}

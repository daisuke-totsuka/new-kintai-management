"use client";

import React, { useMemo, useState } from "react";

type MonthIndex = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

type YearSettings = {
  year: number;
  gasolineByMonth: Record<MonthIndex, number>; // JPY
  vacationDates: Set<string>; // "YYYY-MM-DD"
};

const MONTHS: { m: MonthIndex; label: string }[] = [
  { m: 1, label: "1月" },
  { m: 2, label: "2月" },
  { m: 3, label: "3月" },
  { m: 4, label: "4月" },
  { m: 5, label: "5月" },
  { m: 6, label: "6月" },
  { m: 7, label: "7月" },
  { m: 8, label: "8月" },
  { m: 9, label: "9月" },
  { m: 10, label: "10月" },
  { m: 11, label: "11月" },
  { m: 12, label: "12月" },
];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function ymd(year: number, month: number, day: number) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function toJPY(n: number) {
  return new Intl.NumberFormat("ja-JP").format(n);
}

function clampInt(value: string, min: number, max: number) {
  // Empty string should remain empty, so return NaN instead of min
  const v = Number(value);
  if (!Number.isFinite(v)) return NaN;
  return Math.min(max, Math.max(min, Math.trunc(v)));
}

function getMonthMeta(year: number, month: number) {
  // month: 1-12
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  const firstDow = first.getDay(); // 0=Sun
  const daysInMonth = last.getDate();
  return { firstDow, daysInMonth };
}

type CalendarCell =
  | { kind: "empty" }
  | {
      kind: "day";
      day: number;
      dateKey: string;
      isToday: boolean;
      isSelected: boolean;
      dow: number;
    };

function buildCalendarGrid(
  year: number,
  month: number,
  selected: Set<string>
): CalendarCell[] {
  const { firstDow, daysInMonth } = getMonthMeta(year, month);
  const today = new Date();
  const todayKey = ymd(today.getFullYear(), today.getMonth() + 1, today.getDate());

  const cells: CalendarCell[] = [];
  // leading empties
  for (let i = 0; i < firstDow; i++) cells.push({ kind: "empty" });

  for (let d = 1; d <= daysInMonth; d++) {
    const key = ymd(year, month, d);
    const dow = new Date(year, month - 1, d).getDay();
    cells.push({
      kind: "day",
      day: d,
      dateKey: key,
      isToday: key === todayKey,
      isSelected: selected.has(key),
      dow,
    });
  }

  // trailing empties to complete rows (7 columns)
  while (cells.length % 7 !== 0) cells.push({ kind: "empty" });

  return cells;
}

function createDefaultSettings(year: number): YearSettings {
  const gasolineByMonth = MONTHS.reduce((acc, { m }) => {
    acc[m] = 0;
    return acc;
  }, {} as Record<MonthIndex, number>);

  return { year, gasolineByMonth, vacationDates: new Set<string>() };
}

/**
 * Company "annual settings" screen (gasoline + vacation days)
 * - Gasoline: monthly numeric input (JPY)
 * - Vacation days: select month -> toggle dates on calendar
 * - Save/Cancel: console.log / reset (example)
 */
export default function AttendanceSettings() {
  const currentYear = new Date().getFullYear();

  // Year options
  const yearOptions = useMemo(() => {
    const ys: number[] = [];
    for (let y = currentYear - 1; y <= currentYear + 1; y++) ys.push(y);
    return ys;
  }, [currentYear]);

  const [draft, setDraft] = useState<YearSettings>(() => createDefaultSettings(currentYear));
  const [saved, setSaved] = useState<YearSettings>(() => createDefaultSettings(currentYear));

  const [calendarMonth, setCalendarMonth] = useState<number>(7); // default July

  const calendarCells = useMemo(
    () => buildCalendarGrid(draft.year, calendarMonth, draft.vacationDates),
    [draft.year, calendarMonth, draft.vacationDates]
  );

  const gasolineTotal = useMemo(() => {
    let sum = 0;
    for (const { m } of MONTHS) sum += draft.gasolineByMonth[m] || 0;
    return sum;
  }, [draft.gasolineByMonth]);

  const dirty = useMemo(() => {
    if (draft.year !== saved.year) return true;

    for (const { m } of MONTHS) {
      if ((draft.gasolineByMonth[m] || 0) !== (saved.gasolineByMonth[m] || 0)) return true;
    }

    if (draft.vacationDates.size !== saved.vacationDates.size) return true;
    for (const k of draft.vacationDates) if (!saved.vacationDates.has(k)) return true;

    return false;
  }, [draft, saved]);

  function changeYear(nextYear: number) {
    // In production, load yearly data from API.
    // Here we reset to a new default when year changes.
    const next = createDefaultSettings(nextYear);
    setDraft(next);
    setSaved(next);
    setCalendarMonth(7);
  }

  function updateGasoline(month: MonthIndex, valueStr: string) {
    const v = valueStr.trim() === "" ? NaN : clampInt(valueStr, 0, 99999999);
    setDraft((prev) => ({
      ...prev,
      gasolineByMonth: {
        ...prev.gasolineByMonth,
        [month]: Number.isFinite(v) ? v : 0,
      },
    }));
  }

  function toggleVacation(dateKey: string) {
    setDraft((prev) => {
      const nextSet = new Set(prev.vacationDates);
      if (nextSet.has(dateKey)) nextSet.delete(dateKey);
      else nextSet.add(dateKey);
      return { ...prev, vacationDates: nextSet };
    });
  }

  function clearMonthVacations() {
    const prefix = `${draft.year}-${pad2(calendarMonth)}-`;
    setDraft((prev) => {
      const nextSet = new Set(prev.vacationDates);
      for (const k of Array.from(nextSet)) {
        if (k.startsWith(prefix)) nextSet.delete(k);
      }
      return { ...prev, vacationDates: nextSet };
    });
  }

  async function onSave() {
    // Replace with API save (fetch/axios)
    const payload = {
      year: draft.year,
      gasolineByMonth: draft.gasolineByMonth,
      vacationDates: Array.from(draft.vacationDates).sort(),
    };
    console.log("SAVE payload:", payload);

    setSaved({
      year: draft.year,
      gasolineByMonth: { ...draft.gasolineByMonth },
      vacationDates: new Set(draft.vacationDates),
    });
  }

  function onCancel() {
    setDraft({
      year: saved.year,
      gasolineByMonth: { ...saved.gasolineByMonth },
      vacationDates: new Set(saved.vacationDates),
    });
  }

  return (
    <div className="attendance-settings">
      <header className="header">
        <div className="titleBlock">
          <div className="yearBig">{draft.year}</div>
          <div className="title">年度設定</div>
        </div>

        <div className="headerActions">
          <label className="field">
            <span className="label">年度</span>
            <select className="select" value={draft.year} onChange={(e) => changeYear(Number(e.target.value))}>
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>

          <button className="btn primary" onClick={onSave} disabled={!dirty}>
            設定を保存
          </button>
          <button className="btn" onClick={onCancel} disabled={!dirty}>
            キャンセル
          </button>
        </div>
      </header>

      <main className="grid">
        <section className="card">
          <div className="cardHeader">
            <div className="cardTitle">
              <span className="icon" aria-hidden>
                ⛽
              </span>
              月別ガソリン代設定
            </div>
            <div className="chip">年間合計: {toJPY(gasolineTotal)} 円</div>
          </div>

          <div className="tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 120 }}>月</th>
                  <th>ガソリン代（円）</th>
                </tr>
              </thead>
              <tbody>
                {MONTHS.map(({ m, label }) => (
                  <tr key={m}>
                    <td className="tdMonth">{label}</td>
                    <td>
                      <div className="moneyInput">
                        <input
                          className="input"
                          inputMode="numeric"
                          value={String(draft.gasolineByMonth[m] ?? 0)}
                          onChange={(e) => updateGasoline(m, e.target.value)}
                        />
                        <span className="suffix">円</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="hint">
            ※ 月別の目安を入力。実績集計とは別管理にする想定（必要ならAPI側でマージ）。
          </div>
        </section>

        <section className="card">
          <div className="cardHeader">
            <div className="cardTitle">
              <span className="icon" aria-hidden>
                📅
              </span>
              休暇日設定
            </div>
            <div className="row">
              <label className="field">
                <span className="label">設定月</span>
                <select className="select" value={calendarMonth} onChange={(e) => setCalendarMonth(Number(e.target.value))}>
                  {MONTHS.map(({ m, label }) => (
                    <option key={m} value={m}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <button className="btn small" onClick={clearMonthVacations}>
                この月の選択を解除
              </button>
            </div>
          </div>

          <div className="monthTitle">
            {draft.year}年 {calendarMonth}月
          </div>

          <div className="calendar">
            <div className="dow">
              {["日", "月", "火", "水", "木", "金", "土"].map((d) => (
                <div key={d} className="dowCell">
                  {d}
                </div>
              ))}
            </div>

            <div className="cells">
              {calendarCells.map((c, idx) => {
                if (c.kind === "empty") return <div key={idx} className="cell empty" />;

                const isSun = c.dow === 0;
                const isSat = c.dow === 6;

                const cls = [
                  "cell",
                  "day",
                  c.isSelected ? "selected" : "",
                  c.isToday ? "today" : "",
                  isSun ? "sun" : "",
                  isSat ? "sat" : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <button
                    key={c.dateKey}
                    className={cls}
                    onClick={() => toggleVacation(c.dateKey)}
                    type="button"
                    title={c.dateKey}
                  >
                    <span className="dayNum">{c.day}</span>
                    {c.isSelected && <span className="mark">休</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="hint">
            ※ 日付をクリックで休暇日をON/OFF。祝日連携や勤怠種別（有休/代休など）は拡張ポイントです。
          </div>
        </section>
      </main>

      <style>{css}</style>
    </div>
  );
}

const css = `
  .attendance-settings{
    --bg: #f6f7fb;
    --card: #ffffff;
    --text: #0f172a;
    --muted: #64748b;
    --line: #e2e8f0;
    --primary: #2563eb;
    --primary-weak: #dbeafe;
    --shadow: 0 10px 30px rgba(2, 6, 23, .06);
    --radius: 16px;
  }
  .attendance-settings *{ box-sizing: border-box; }
  .attendance-settings{
    background:var(--bg); min-height:100vh; padding:24px;
    color:var(--text);
  }
  .header{
    display:flex; align-items:center; justify-content:space-between;
    gap:16px; margin-bottom:16px;
    background: linear-gradient(180deg, #1f6feb 0%, #0b4fb3 100%);
    color:#fff; padding:16px 18px; border-radius: 14px;
    box-shadow: 0 10px 22px rgba(12, 55, 120, 0.2);
  }
  .titleBlock{ display:flex; align-items:baseline; gap:12px; }
  .yearBig{ font-size:44px; font-weight:800; letter-spacing: .5px; }
  .title{ font-size:18px; font-weight:700; color:#e8f1ff; }
  .headerActions{ display:flex; gap:10px; align-items:flex-end; flex-wrap:wrap; }
  .grid{ display:grid; grid-template-columns: 1.05fr 1fr; gap:16px; }
  @media (max-width: 980px){
    .grid{ grid-template-columns: 1fr; }
    .header{ align-items:flex-start; }
  }

  .card{
    background:var(--card); border:1px solid var(--line); border-radius: var(--radius);
    box-shadow: var(--shadow); padding:16px;
  }
  .cardHeader{ display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:10px; }
  .cardTitle{ display:flex; gap:10px; align-items:center; font-weight:800; font-size:16px; }
  .icon{ width:28px; height:28px; display:grid; place-items:center; background:#f1f5f9; border-radius: 10px; }
  .chip{
    background:#f1f5f9; border:1px solid var(--line); border-radius:999px;
    padding:8px 10px; font-size:12px; color:var(--muted); white-space:nowrap;
  }
  .row{ display:flex; gap:10px; align-items:flex-end; flex-wrap:wrap; }
  .field{ display:flex; flex-direction:column; gap:6px; }
  .label{ font-size:12px; color:#e8f1ff; }
  .select, .input{
    border:1px solid #cfe0ff; background:#fff; color:var(--text);
    border-radius: 12px; padding:10px 12px; outline:none;
  }
  .select:focus, .input:focus{ border-color: rgba(37, 99, 235, .6); box-shadow: 0 0 0 3px rgba(37, 99, 235, .12); }
  .btn{
    border:1px solid #cfe0ff; background:#fff; color:#0b3d6b;
    border-radius: 12px; padding:10px 12px; cursor:pointer;
  }
  .btn:hover{ background:#f8fafc; }
  .btn:disabled{ opacity:.5; cursor:not-allowed; }
  .btn.primary{
    border-color: rgba(37, 99, 235, .35);
    background: var(--primary); color:#fff;
  }
  .btn.primary:hover{ filter: brightness(.98); }
  .btn.small{ padding:8px 10px; font-size:12px; }

  .tableWrap{ overflow:auto; border-radius: 12px; border:1px solid var(--line); }
  .table{ width:100%; border-collapse: collapse; min-width: 520px; }
  .table thead th{
    text-align:left; font-size:12px; color:var(--muted);
    background:#f8fafc; border-bottom:1px solid var(--line); padding:10px 12px;
  }
  .table tbody td{
    border-bottom:1px solid var(--line); padding:10px 12px; vertical-align:middle;
  }
  .table tbody tr:last-child td{ border-bottom:none; }
  .tdMonth{ font-weight:700; }
  .moneyInput{ display:flex; gap:8px; align-items:center; }
  .suffix{ color:var(--muted); font-size:12px; }
  .hint{ margin-top:10px; font-size:12px; color:var(--muted); line-height: 1.6; }

  .monthTitle{ font-weight:800; margin:8px 0 10px; }
  .calendar{
    border:1px solid var(--line);
    border-radius: 12px;
    overflow:hidden;
  }
  .dow{
    display:grid; grid-template-columns: repeat(7, 1fr);
    background:#f8fafc; border-bottom:1px solid var(--line);
  }
  .dowCell{
    padding:10px 0; text-align:center; font-size:12px; color:var(--muted);
  }
  .cells{ display:grid; grid-template-columns: repeat(7, 1fr); }
  .cell{
    height:54px; border-right:1px solid var(--line); border-bottom:1px solid var(--line);
  }
  .cells .cell:nth-child(7n){ border-right:none; }
  .cell.empty{ background:#fff; }
  .cell.day{
    background:#fff; cursor:pointer; display:flex; align-items:center; justify-content:center;
    position:relative; padding:8px;
  }
  .cell.day:hover{ background:#f8fafc; }
  .dayNum{ font-weight:700; }
  .cell.day.sun .dayNum{ color:#ef4444; }
  .cell.day.sat .dayNum{ color:#3b82f6; }

  .cell.day.selected{
    background: var(--primary-weak);
    border-color: rgba(37, 99, 235, .25);
  }
  .cell.day.today{
    outline: 2px solid rgba(37, 99, 235, .45);
    outline-offset: -2px;
  }
  .mark{
    position:absolute; right:8px; top:8px;
    font-size:11px; font-weight:800;
    color:#fff; background: var(--primary);
    padding:2px 6px; border-radius:999px;
  }
`;

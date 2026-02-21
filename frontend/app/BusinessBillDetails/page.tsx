"use client";

import React, { useMemo, useState } from "react";

/**
 * 業務請求分明細 入力画面（経費請求と同じ仕様）
 * - 初期表示：5行
 * - 行追加/行削除：年月（発生日）の右側に配置（行削除は5行以下不可）
 * - 各行先頭：入力クリア（その行だけクリア）
 * - 合計金額・申請送信：一覧の上に表示（右上）
 * - 一覧列（左から）：
 *   「入力クリア」「月 日」「交 通 機 関 ・ 宿 泊 先」「乗 車 経 路」「交 通 費」「宿 泊 費」「そ の 他」「金額」
 */

type BizClaimRow = {
  id: string;
  // 「月 日」：日付入力（実装は date: YYYY-MM-DD を保持して表示は月日でもOK）
  date: string;

  // 交 通 機 関 ・ 宿 泊 先
  place: string;

  // 乗 車 経 路
  route: string;

  // 交 通 費 / 宿 泊 費 / そ の 他（数値文字列）
  transportCost: string;
  lodgingCost: string;
  otherCost: string;
};

const MIN_ROWS = 5;

function uid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function createEmptyRow(): BizClaimRow {
  return {
    id: uid(),
    date: "",
    place: "",
    route: "",
    transportCost: "",
    lodgingCost: "",
    otherCost: "",
  };
}

function onlyNumberComma(v: string) {
  return v.replace(/[^\d,]/g, "");
}

function toNumber(v: string) {
  const n = Number(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function formatMonthDay(dateStr: string) {
  // dateStr: YYYY-MM-DD
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  if (!m || !d) return "";
  return `${Number(m)}/${Number(d)}`;
}

export default function BizClaimDetailScreen() {
  const today = new Date();
  const [year, setYear] = useState<number>(today.getFullYear());
  const [month, setMonth] = useState<number>(today.getMonth() + 1);

  const [rows, setRows] = useState<BizClaimRow[]>(
    Array.from({ length: MIN_ROWS }, () => createEmptyRow())
  );

  const canDeleteRow = rows.length > MIN_ROWS;

  const addRow = () => setRows((prev) => [...prev, createEmptyRow()]);

  const deleteRow = () => {
    setRows((prev) => {
      if (prev.length <= MIN_ROWS) return prev;
      return prev.slice(0, -1);
    });
  };

  const clearRow = (id: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...createEmptyRow(), id } : r))
    );
  };

  const updateRow = <K extends keyof BizClaimRow>(
    id: string,
    key: K,
    value: BizClaimRow[K]
  ) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
  };

  // 各行の「金額」（交通費+宿泊費+その他）
  const rowAmount = (r: BizClaimRow) =>
    toNumber(r.transportCost) + toNumber(r.lodgingCost) + toNumber(r.otherCost);

  // 合計金額（全行の金額の合計）
  const totalAmount = useMemo(() => {
    return rows.reduce((sum, r) => sum + rowAmount(r), 0);
  }, [rows]);

  const submit = () => {
    const payload = { year, month, rows };
    console.log("submit payload:", payload);
    alert("申請送信（デモ）しました。コンソールにpayloadを出力しています。");
  };

  const years = Array.from({ length: 6 }, (_, i) => today.getFullYear() - 2 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div style={styles.headerTitle}>業務請求分明細</div>
      </div>

      <div style={styles.card}>
        {/* 上部コントロール列 */}
        <div style={styles.topRow}>
          <div style={styles.leftControls}>
            <div style={styles.label}>発生日：</div>

            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              style={styles.select}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}年
                </option>
              ))}
            </select>

            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              style={styles.select}
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {String(m).padStart(2, "0")}月
                </option>
              ))}
            </select>

            {/* 行追加/行削除（年月の右側） */}
            <button onClick={addRow} style={{ ...styles.btn, ...styles.btnPrimary }}>
              ＋ 行追加
            </button>
            <button
              onClick={deleteRow}
              disabled={!canDeleteRow}
              style={{
                ...styles.btn,
                ...styles.btnGhost,
                ...(canDeleteRow ? null : styles.btnDisabled),
              }}
              title={canDeleteRow ? "" : "5行以下は削除できません"}
            >
              － 行削除
            </button>
          </div>

          {/* 合計金額・申請送信（一覧の上） */}
          <div style={styles.rightControls}>
            <div style={styles.total}>
              合計金額：<span style={styles.totalValue}>{totalAmount.toLocaleString()} 円</span>
            </div>
            <button onClick={submit} style={{ ...styles.btn, ...styles.btnSubmit }}>
              申請送信
            </button>
          </div>
        </div>

        {/* 一覧テーブル */}
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, width: 110 }}>入力クリア</th>
                <th style={{ ...styles.th, width: 110 }}>月 日</th>
                <th style={{ ...styles.th, width: 220 }}>交 通 機 関 ・ 宿 泊 先</th>
                <th style={{ ...styles.th, width: 260 }}>乗 車 経 路</th>
                <th style={{ ...styles.th, width: 140, textAlign: "right" }}>交 通 費</th>
                <th style={{ ...styles.th, width: 140, textAlign: "right" }}>宿 泊 費</th>
                <th style={{ ...styles.th, width: 140, textAlign: "right" }}>そ の 他</th>
                <th style={{ ...styles.th, width: 140, textAlign: "right" }}>金額</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((r) => {
                const amount = rowAmount(r);
                return (
                  <tr key={r.id}>
                    <td style={styles.td}>
                      <button
                        type="button"
                        onClick={() => clearRow(r.id)}
                        style={{ ...styles.btn, ...styles.btnSmall }}
                      >
                        入力クリア
                      </button>
                    </td>

                    <td style={styles.td}>
                      {/* 「月日」入力：入力は date、表示は月日でもOK。 */}
                      <div style={styles.monthDayWrap}>
                        <input
                          type="date"
                          value={r.date}
                          onChange={(e) => updateRow(r.id, "date", e.target.value)}
                          style={styles.input}
                        />
                        <div style={styles.monthDayHint}>{formatMonthDay(r.date)}</div>
                      </div>
                    </td>

                    <td style={styles.td}>
                      <input
                        value={r.place}
                        onChange={(e) => updateRow(r.id, "place", e.target.value)}
                        placeholder="例：電車 / ◯◯ホテル"
                        style={styles.input}
                      />
                    </td>

                    <td style={styles.td}>
                      <input
                        value={r.route}
                        onChange={(e) => updateRow(r.id, "route", e.target.value)}
                        placeholder="例：東京→大阪、◯◯駅→△△駅"
                        style={styles.input}
                      />
                    </td>

                    <td style={{ ...styles.td, textAlign: "right" }}>
                      <div style={styles.amountWrap}>
                        <input
                          inputMode="numeric"
                          value={r.transportCost}
                          onChange={(e) =>
                            updateRow(r.id, "transportCost", onlyNumberComma(e.target.value))
                          }
                          placeholder="0"
                          style={{ ...styles.input, textAlign: "right" }}
                        />
                        <span style={styles.yen}>円</span>
                      </div>
                    </td>

                    <td style={{ ...styles.td, textAlign: "right" }}>
                      <div style={styles.amountWrap}>
                        <input
                          inputMode="numeric"
                          value={r.lodgingCost}
                          onChange={(e) =>
                            updateRow(r.id, "lodgingCost", onlyNumberComma(e.target.value))
                          }
                          placeholder="0"
                          style={{ ...styles.input, textAlign: "right" }}
                        />
                        <span style={styles.yen}>円</span>
                      </div>
                    </td>

                    <td style={{ ...styles.td, textAlign: "right" }}>
                      <div style={styles.amountWrap}>
                        <input
                          inputMode="numeric"
                          value={r.otherCost}
                          onChange={(e) =>
                            updateRow(r.id, "otherCost", onlyNumberComma(e.target.value))
                          }
                          placeholder="0"
                          style={{ ...styles.input, textAlign: "right" }}
                        />
                        <span style={styles.yen}>円</span>
                      </div>
                    </td>

                    <td style={{ ...styles.td, textAlign: "right" }}>
                      <div style={styles.amountWrap}>
                        <input
                          value={amount ? amount.toLocaleString() : ""}
                          readOnly
                          style={{
                            ...styles.input,
                            textAlign: "right",
                            background: "#f7faff",
                          }}
                          placeholder="0"
                        />
                        <span style={styles.yen}>円</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {!canDeleteRow && (
            <div style={styles.helperText}>※ 行削除は {MIN_ROWS} 行より多い場合のみ可能です。</div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    background: "#f3f6fb",
    minHeight: "100vh",
    padding: 24,
  },
  header: {
    background: "linear-gradient(180deg, #1f78ff 0%, #0b5ed7 100%)",
    borderRadius: 10,
    padding: "18px 18px",
    boxShadow: "0 8px 18px rgba(20, 80, 160, 0.18)",
    color: "#fff",
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 800,
    textAlign: "center",
    letterSpacing: 1,
  },
  card: {
    background: "#fff",
    borderRadius: 12,
    padding: 16,
    boxShadow: "0 10px 24px rgba(0,0,0,0.06)",
    border: "1px solid #e6eefb",
  },
  topRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "6px 4px 14px 4px",
  },
  leftControls: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  rightControls: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  label: {
    fontWeight: 700,
    color: "#1f2a44",
  },
  select: {
    height: 36,
    borderRadius: 8,
    border: "1px solid #cfd9ea",
    padding: "0 10px",
    background: "#fff",
    outline: "none",
  },
  input: {
    width: "100%",
    height: 34,
    borderRadius: 8,
    border: "1px solid #cfd9ea",
    padding: "0 10px",
    outline: "none",
    background: "#fff",
  },
  btn: {
    height: 36,
    borderRadius: 8,
    border: "1px solid #cfd9ea",
    padding: "0 12px",
    background: "#fff",
    cursor: "pointer",
    fontWeight: 700,
    color: "#1f2a44",
  },
  btnSmall: {
    height: 32,
    padding: "0 10px",
    fontWeight: 700,
    border: "1px solid #d7e2f6",
    background: "#f7faff",
  },
  btnPrimary: {
    background: "#eaf2ff",
    border: "1px solid #bcd3ff",
    color: "#0b5ed7",
  },
  btnGhost: {
    background: "#fff",
  },
  btnDisabled: {
    opacity: 0.45,
    cursor: "not-allowed",
  },
  btnSubmit: {
    background: "#0b5ed7",
    border: "1px solid #0b5ed7",
    color: "#fff",
    boxShadow: "0 10px 18px rgba(11, 94, 215, 0.25)",
  },
  total: {
    fontWeight: 800,
    color: "#1f2a44",
    whiteSpace: "nowrap",
  },
  totalValue: {
    fontSize: 16,
  },
  tableWrap: {
    overflowX: "auto",
    borderTop: "1px solid #eef3ff",
    paddingTop: 10,
  },
  table: {
    width: "100%",
    borderCollapse: "separate",
    borderSpacing: 0,
    minWidth: 1180,
  },
  th: {
    position: "sticky",
    top: 0,
    background: "#f3f7ff",
    borderTop: "1px solid #dbe6fb",
    borderBottom: "1px solid #dbe6fb",
    borderRight: "1px solid #dbe6fb",
    padding: "10px 10px",
    textAlign: "left",
    fontWeight: 800,
    color: "#1f2a44",
    whiteSpace: "nowrap",
  },
  td: {
    borderBottom: "1px solid #edf2fb",
    borderRight: "1px solid #edf2fb",
    padding: "8px 10px",
    verticalAlign: "middle",
    background: "#fff",
  },
  amountWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
  yen: {
    color: "#6b7a99",
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  helperText: {
    marginTop: 10,
    color: "#6b7a99",
    fontSize: 13,
    fontWeight: 600,
  },
  monthDayWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  monthDayHint: {
    fontSize: 12,
    color: "#6b7a99",
    fontWeight: 700,
  },
};
